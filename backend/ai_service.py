import os
import chromadb
from openai import AsyncOpenAI
import google.generativeai as genai
import json
from sqlalchemy.future import select
import models

import threading
import datetime
import asyncio

_chroma_client = None
_emails_collection = None
_chats_collection = None
_init_lock = threading.Lock()

def get_collections():
    global _chroma_client, _emails_collection, _chats_collection
    if _chroma_client is None:
        with _init_lock:
            if _chroma_client is None:
                _chroma_client = chromadb.PersistentClient(path="./chroma_db")
                _emails_collection = _chroma_client.get_or_create_collection(name="emails")
                _chats_collection = _chroma_client.get_or_create_collection(name="chats")
    return _emails_collection, _chats_collection

async def get_llm_client(user):
    if user.ai_provider == "openai":
        return AsyncOpenAI(api_key=user.openai_key or "invalid")
    elif user.ai_provider == "pollinations":
        return AsyncOpenAI(
            base_url="https://text.pollinations.ai/openai",
            api_key="pollinations",
            default_headers={"User-Agent": "Mozilla/5.0"}
        )
    else:
        return AsyncOpenAI(
            base_url=user.ollama_url or "http://localhost:11434/v1",
            api_key="ollama" # required by sdk but ignored by ollama
        )

async def generate_summary(user, text, context_type="emails"):
    if not text.strip():
        return "No recent activity."
    try:
        prompt = f"Summarize the following {context_type} briefly in a helpful, conversational tone like a personal assistant. Keep it short (2-3 sentences max).\n\n{text}"
        
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            return response.text
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150
            )
            return response.choices[0].message.content
    except Exception as e:
        return f"AI Summary unavailable: {str(e)}"

def add_mail_to_rag(user_id, mail_id, subject, body):
    try:
        emails_coll, _ = get_collections()
        text = f"[Mail ID: {mail_id}] Subject: {subject}\n\nBody: {body}"
        emails_coll.add(
            documents=[text],
            metadatas=[{"user_id": user_id, "mail_id": mail_id}],
            ids=[f"mail_{mail_id}"]
        )
    except Exception as e:
        print("RAG mail add error:", e)

def add_chat_to_rag(user_id, chat_id, text):
    try:
        _, chats_coll = get_collections()
        full_text = f"[Chat ID: {chat_id}] {text}"
        chats_coll.add(
            documents=[full_text],
            metadatas=[{"user_id": user_id, "chat_id": chat_id}],
            ids=[f"chat_{chat_id}"]
        )
    except Exception as e:
        print("RAG chat add error:", e)

async def query_rag(user, query: str, history: list[dict] = [], db=None, context_settings: dict = {}):
    try:
        emails_coll, chats_coll = get_collections()
        email_results = await asyncio.to_thread(
            emails_coll.query,
            query_texts=[query],
            n_results=3,
            where={"user_id": user.id}
        )
        chat_results = await asyncio.to_thread(
            chats_coll.query,
            query_texts=[query],
            n_results=3,
            where={"user_id": user.id}
        )
        
        context_parts = []
        if email_results['documents'] and email_results['documents'][0]:
            context_parts.extend(email_results['documents'][0])
        if chat_results['documents'] and chat_results['documents'][0]:
            context_parts.extend(chat_results['documents'][0])
            
        context_str = "\n---\n".join(context_parts)

        history_parts = []
        for msg in history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            text = msg.get("text", "")
            history_parts.append(f"{role}: {text}")
        history_str = "\n".join(history_parts) if history_parts else "No previous history."
        
        contacts_str = "No contacts found."
        emails_str = "No recent emails found."
        tasks_str = "No tasks found."
        events_str = "No events found."
        notes_str = "No notes found."
        
        if db:
            from sqlalchemy import select
            import models
            result = await db.execute(select(models.Contact).where(models.Contact.owner_id == user.id))
            contacts = result.scalars().all()
            if contacts:
                contacts_str = ", ".join([f"{c.name} ({c.contact_email}, dob: {c.dob or 'unknown'})" for c in contacts])
            
            mail_res = await db.execute(select(models.Mail).where((models.Mail.sender_id == user.id) | (models.Mail.recipient_id == user.id)).order_by(models.Mail.created_at.desc()).limit(20))
            emails = mail_res.scalars().all()
            if emails:
                emails_str = "\n".join([f"[Mail ID: {m.id}] From: {m.sender_id} To: {m.recipient_email} Subject: {m.subject} Date: {m.created_at}" for m in emails])
                
            task_res = await db.execute(select(models.Task).where(models.Task.user_id == user.id))
            tasks = task_res.scalars().all()
            if tasks:
                tasks_str = "\n".join([f"[Task ID: {t.id}] {t.title} (Due: {t.due_date}, Completed: {t.is_completed}, Priority: {t.priority}, Color: {t.color})" for t in tasks])
                
            event_res = await db.execute(select(models.CalendarEvent).where(models.CalendarEvent.user_id == user.id))
            events = event_res.scalars().all()
            if events:
                events_str = "\n".join([f"[Event ID: {e.id}] {e.title} (Start: {e.start_time}, End: {e.end_time})" for e in events])
                
            note_res = await db.execute(select(models.Note).where(models.Note.user_id == user.id))
            notes = note_res.scalars().all()
            if notes:
                notes_str = "\n".join([f"[Note ID: {n.id}] {n.title}: {n.content[:800]}" for n in notes])
        
        settings_str = json.dumps(context_settings, indent=2) if context_settings else "No extra settings provided."
        
        current_time = datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p")

        prompt = f"""You are Surya, a radiant, warm, and highly capable AI assistant with ultimate power. Your personality is bright, empathetic, and exceptionally helpful, much like the sun.
Your goal is to answer the user's request and execute actions on their behalf using the provided personal context (from their emails and chats).
IMPORTANT: The current local time is {current_time}. When scheduling events or tasks, DO NOT append a 'Z' to timestamps. Generate them in 'YYYY-MM-DDTHH:MM:SS' format.
If the answer is not in the context, say you cannot find it in their records. Be polite, concise, and helpful.

You have the authority to trash emails, tag emails, create folders, group emails, draft/send emails, send chats, and manage the user's ecosystem (Tasks, Calendar Events, Notes).
When the user asks you to perform an action (e.g. "Trash the email from John", "Create a folder called Work", "Remind me to buy groceries"), extract the required IDs from the context and output the corresponding action objects.
Valid actions include:
  - "trash_mail" (mail_id: number)
  - "create_folder" (name: string)
  - "group_mail" (mail_id: number, folder_name: string)
  - "tag_mail" (mail_id: number, tag_name: string)
  - "create_tag" (tag_name: string, color: string)
  - "auto_tag_mail" (mail_id: number)
  - "tag_all_mails" ()
  - "change_theme" (theme: string "dark" | "light")
  - "send_mail" (to: string[], subject: string, body: string)
  - "draft_email" (to: string[], subject: string, body: string)
  - "create_calendar_event" (title: string, start_time: string, end_time: string, description: string)
  - "edit_calendar_event" (event_id: number, title: string, start_time: string, end_time: string, description: string)
  - "delete_calendar_event" (event_id: number)
  - "create_task" (title: string, due_date: string, description: string, priority: string, color: string)
  - "edit_task" (task_id: number, title: string, due_date: string, is_completed: boolean)
  - "toggle_task" (task_id: number)
  - "complete_task" (task_id: number)
  - "create_note" (title: string, content: string)
  - "edit_note" (note_id: number, title: string, content: string)
  - "summarize_note" (note_id: number)

To generate an image, use Markdown image syntax with the Pollinations AI API: `![description](https://image.pollinations.ai/prompt/{{url_encoded_prompt}})` where {{url_encoded_prompt}} is the prompt with spaces replaced by %20. You can include this markdown directly in your answer or in the body of an email/chat.

For complex queries (e.g. "send mail to contacts older than 18"), you must determine the appropriate contacts using the 'dob' (date of birth) in the User's Contacts List. Ensure the current year is roughly 2026. Create a separate action for each contact or group them into the 'to' array if the action supports it.
For changing themes, emit the 'change_theme' action.

You MUST return a valid JSON object matching this exact schema:
{{
  "answer": "Your detailed, serene, and blissful response to the user.",
  "actions": [
    {{
      "type": "draft_email",
      "to": "email address",
      "subject": "subject",
      "body": "email body"
    }},
    {{
      "type": "send_chat",
      "to": "email address",
      "text": "chat message"
    }},
    {{
      "type": "trash_mail",
      "mail_id": 123
    }},
    {{
      "type": "create_folder",
      "name": "Folder Name"
    }},
    {{
      "type": "group_mail",
      "mail_id": 123,
      "folder_name": "Folder Name"
    }},
    {{
      "type": "tag_mail",
      "mail_id": 123,
      "tag_name": "Tag Name"
    }},
    {{
      "type": "create_task",
      "title": "Buy groceries",
      "due_date": "2026-06-24T17:00:00",
      "description": "Milk, eggs, bread"
    }}
  ]
}}
Only include actions if the user's request implies performing them. If no actions are needed, return an empty array for actions. Return ONLY the raw JSON object, without any markdown formatting like ```json.

Context from user's records:
{context_str}

Recent Emails:
{emails_str}

User's Contacts List:
{contacts_str}

User's Tasks:
{tasks_str}

User's Calendar Events:
{events_str}

User's Notes:
{notes_str}

User's App Settings:
{settings_str}

Conversation History:
{history_str}

User Request: {query}"""

        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            # Try to parse json from text as gemini might include markdown
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:-3]
            elif text.startswith("```"):
                text = text[3:-3]
            return json.loads(text)
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                response_format={ "type": "json_object" }
            )
            return json.loads(response.choices[0].message.content)
    except Exception as e:
        return {"answer": f"AI Query failed: Ensure your AI provider is running/valid. ({str(e)})", "actions": []}

async def get_available_models(provider: str, key: str) -> list[dict]:
    try:
        if provider == "gemini":
            if not key: return []
            genai.configure(api_key=key)
            allowed = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-exp", "gemini-2.5-flash", "gemini-2.5-pro"]
            recommended = ["gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"]
            models = []
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    mid = m.name.replace('models/', '')
                    if any(mid.startswith(a) for a in allowed) and not any(x in mid for x in ["-tts", "-audio", "-image", "-live"]):
                        is_rec = any(mid.startswith(r) for r in recommended)
                        models.append({"id": mid, "tokens": getattr(m, 'inputTokenLimit', 0), "recommended": is_rec})
            return sorted(models, key=lambda x: (not x["recommended"], x["id"]))
        elif provider == "openai":
            if not key: return []
            client = AsyncOpenAI(api_key=key)
            models = await client.models.list()
            known = {
                "gpt-4": 8192,
                "gpt-4-32k": 32768,
                "gpt-3.5-turbo": 16385,
                "gpt-4-turbo": 128000,
                "gpt-4o": 128000,
                "gpt-4o-mini": 128000,
                "o1-preview": 128000,
                "o1-mini": 128000
            }
            allowed = ["gpt-4o", "o1-preview", "o1-mini", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4"]
            recommended = ["gpt-4o", "gpt-4o-mini"]
            res = []
            for m in models.data:
                if any(m.id.startswith(a) for a in allowed):
                    tokens = known.get(m.id, 0)
                    if tokens == 0:
                        for k, v in known.items():
                            if m.id.startswith(k):
                                tokens = v
                                break
                    is_rec = any(m.id.startswith(r) for r in recommended)
                    res.append({"id": m.id, "tokens": tokens, "recommended": is_rec})
            return sorted(res, key=lambda x: (not x["recommended"], x["id"]))
    except Exception as e:
        print(f"Error fetching models: {e}")
    return []

async def generate_chat_suggestions(user, history_text: str) -> list[str]:
    if not history_text.strip(): return ["Hi!", "How are you?", "What's up?"]
    prompt = f"""You are an Apple Intelligence style auto-reply assistant.
Analyze this chat history and suggest 3 short, natural, context-aware quick replies for the user to send next.
Return ONLY a valid JSON array of strings, e.g. ["Sure thing!", "I can do that", "No problem"].

History:
{history_text}"""
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"): text = text[7:-3]
            elif text.startswith("```"): text = text[3:-3]
            return json.loads(text)
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            # OpenAI doesn't enforce array natively without tools, we parse the text
            content = response.choices[0].message.content.strip()
            if content.startswith("```json"): content = content[7:-3]
            elif content.startswith("```"): content = content[3:-3]
            return json.loads(content)
    except:
        return ["Ok", "Yes", "No"]

async def generate_mail_tool_text(user, tool_type: str, text: str) -> str:
    strict_constraint = " You are an automated text replacement engine. Return a JSON object with a single key 'result' containing exactly ONE rewritten version. No markdown, no options, no conversational text. Example: {\"result\": \"The rewritten text here.\"}"
    if tool_type == "professional":
        prompt = f"Rewrite the following text to be professional, polite, and formal.{strict_constraint}\n\n{text}"
    elif tool_type == "friendly":
        prompt = f"Rewrite the following text to be friendly, approachable, and warm.{strict_constraint}\n\n{text}"
    elif tool_type == "expand":
        prompt = f"Expand on the following text, adding more detail and context while keeping the same core meaning.{strict_constraint}\n\n{text}"
    elif tool_type == "suggest":
        prompt = f"Draft an appropriate, concise email reply to this context.{strict_constraint}\n\n{text}"
    else:
        return text

    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            content = model.generate_content(prompt).text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content.strip()
            
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        parsed = json.loads(content)
        return parsed.get("result", text)
    except Exception as e:
        return text

async def generate_mail_summary_strict(user, text: str) -> str:
    prompt = f"Summarize the following email in 1-2 short sentences. Do NOT include any conversational filler like 'Here is the summary'. Return ONLY the summary text.\n\n{text}"
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            return model.generate_content(prompt).text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content.strip()
    except:
        return "Summary unavailable."

async def categorize_mail_strict(user, text: str) -> str:
    prompt = f"""You are a strict email categorization engine.
Analyze the following email and categorize it into exactly ONE of the following four categories:
- primary (Personal, important, direct messages)
- promotions (Marketing, sales, newsletters)
- social (Social media notifications, network updates)
- updates (Receipts, alerts, bills, automated notices)

Return a JSON object with a single key 'category' containing exactly one of the four words: "primary", "promotions", "social", or "updates".
Do not include any other text or markdown.

Email content:
{text}"""
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            content = response.text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content.strip()
            
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        parsed = json.loads(content)
        return parsed.get("category", "primary").lower()
    except:
        return "primary"

async def generate_auto_tags(user, text: str, existing_tags: list) -> list:
    tags_str = ", ".join([f"{t.name} (color: {t.color})" for t in existing_tags])
    prompt = f"""You are an intelligent auto-tagging system.
Analyze the following email and assign relevant tags.
You can use existing tags: [{tags_str}]
If an appropriate tag is missing, CREATE a new one with a suitable hex color code.
Return ONLY a valid JSON array of objects. Example: [{{"name": "Urgent", "color": "#ff0000"}}, {{"name": "Project X", "color": "#00ff00"}}]
Do not include markdown or conversational filler.

Email content:
{text}"""
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            content = response.text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content.strip()
            
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        return json.loads(content)
    except:
        return []

async def categorize_mail(user, subject: str, body: str) -> dict:
    """Categorize a mail into actionable streams."""
    text = f"Subject: {subject}\n\nBody: {body}"
    prompt = f"""You are an intelligent email triage engine.
Analyze the following email and categorize it into exactly ONE actionable stream:
- urgent (Time-sensitive, requires immediate attention or action)
- actionable (Requires a response or action but not immediately)
- informational (FYI, newsletters, updates — no action needed)
- social (Social notifications, greetings, personal)
- transactional (Receipts, confirmations, automated notices)

Also assess whether a follow-up reminder would be appropriate (true/false) and suggest a follow-up timeframe if applicable ("1 day", "3 days", "1 week", or null).

Return ONLY a valid JSON object:
{{"stream": "urgent", "needs_followup": true, "followup_timeframe": "3 days"}}

Email content:
{text}"""
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            content = response.text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content.strip()
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        return json.loads(content)
    except:
        return {"stream": "informational", "needs_followup": False, "followup_timeframe": None}


async def draft_from_template(user, template_content: str, placeholders: dict, tone: str = "professional", context: str = "") -> str:
    """Replace placeholders in a template and adjust tone using AI."""
    # First, do simple placeholder replacement
    filled = template_content
    for key, value in placeholders.items():
        filled = filled.replace(f"{{{{{key}}}}}", str(value))

    prompt = f"""You are an email drafting assistant. You have been given a pre-filled email template.
Your job is to:
1. Polish the text so it reads naturally (fix any remaining placeholder syntax like {{{{something}}}}).
2. Adjust the tone to be: {tone}
3. Keep the core message intact but make it sound human and polished.

{"Additional context from conversation history: " + context if context else ""}

Return ONLY a JSON object: {{"subject": "...", "body": "..."}}
If the template doesn't have a clear subject, generate an appropriate one.

Template content:
{filled}"""
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            content = response.text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content.strip()
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        return json.loads(content)
    except:
        return {"subject": "", "body": filled}


async def evaluate_followup(user, mail_subject: str, mail_body: str) -> dict:
    """Evaluate whether an email thread needs a follow-up reminder."""
    prompt = f"""You are an email follow-up evaluation engine.
Analyze this email and determine:
1. Does it require a follow-up? (true/false)
2. Suggested follow-up timeframe ("1 day", "3 days", "1 week", "2 weeks", or null)
3. A brief suggested follow-up note (e.g. "Check if they responded to the pricing proposal")

Return ONLY a valid JSON object:
{{"needs_followup": true, "timeframe": "3 days", "note": "Follow up on the proposal"}}

Email:
Subject: {mail_subject}
Body: {mail_body}"""
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            content = response.text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content.strip()
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        return json.loads(content)
    except:
        return {"needs_followup": False, "timeframe": None, "note": ""}


async def generate_character_graph(user, history_text: str) -> dict:
    if not history_text.strip():
        return {"traits": ["Unknown"], "memories": ["No chat history available."], "relation": "New Contact"}
        
    prompt = f"""You are a psychological and relationship analysis engine.
Analyze the following chat history between the user and this contact.
Build a Character Graph profile of this contact containing:
- traits: list of 3-5 personality traits (e.g. "Sarcastic", "Helpful")
- memories: list of 2-4 key facts or memories shared (e.g. "Lives in NY", "Helped with deployment")
- relation: A short 2-5 word phrase describing the relationship dynamic (e.g. "Professional Colleague", "Close Friend")

Return ONLY a valid JSON object matching this structure:
{{"traits": ["..."], "memories": ["..."], "relation": "..."}}
Do not include markdown.

Chat History:
{history_text}"""
    try:
        if user.ai_provider == "gemini":
            genai.configure(api_key=user.gemini_key or "invalid")
            model = genai.GenerativeModel(user.ai_model or 'gemini-2.5-flash')
            response = model.generate_content(prompt)
            content = response.text.strip()
        else:
            client = await get_llm_client(user)
            model_name = user.ai_model or ("gpt-4" if user.ai_provider == "openai" else "llama3")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content.strip()
            
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        return json.loads(content)
    except:
        return {"traits": ["Error analyzing"], "memories": [], "relation": "Unknown"}
