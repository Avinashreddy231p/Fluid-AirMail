from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Query, Body, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, aliased
from sqlalchemy import or_, and_, text
from jose import jwt, JWTError
from datetime import timedelta, datetime
from typing import Optional
import json
import asyncio
import httpx
from bs4 import BeautifulSoup
import uuid
import os
import shutil

from database import engine, Base, get_db, AsyncSessionLocal
import models
import security
import ai_service
import knowledge_graph

os.makedirs("uploads", exist_ok=True)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE mails ADD COLUMN attachment_url TEXT"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN gemini_key VARCHAR"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE mails ADD COLUMN ai_summary TEXT"))
        except Exception:
            pass
    yield
    await engine.dispose()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="MailNet API",
    description="Secure Mail & Chat — real cross-account delivery",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer()

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def fetch_link_meta_sync(url: str):
    try:
        with httpx.Client(follow_redirects=True, timeout=5.0) as client:
            # We use an accept-encoding that asks for gzip and handles it
            response = client.get(url, headers={'User-Agent': 'Mozilla/5.0'})
            response.raise_for_status()
            html = response.text
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Helper to get first matching meta content
            def get_meta(properties, names):
                for p in properties:
                    tag = soup.find('meta', property=p)
                    if tag and tag.get('content'):
                        return tag['content']
                for n in names:
                    tag = soup.find('meta', attrs={"name": n})
                    if tag and tag.get('content'):
                        return tag['content']
                return None
                
            title = get_meta(['og:title', 'twitter:title'], [])
            if not title:
                title_tag = soup.find('title')
                if title_tag:
                    title = title_tag.string
                    
            description = get_meta(['og:description', 'twitter:description'], ['description'])
            image = get_meta(['og:image', 'twitter:image'], [])
            
            site_name = get_meta(['og:site_name'], [])
            if not site_name:
                from urllib.parse import urlparse
                site_name = urlparse(url).netloc.replace('www.', '')
                
            favicon = None
            icon_tag = soup.find('link', rel=lambda x: x and 'icon' in x.lower())
            if icon_tag and icon_tag.get('href'):
                favicon = icon_tag['href']
                # resolve relative favicon URL
                if not favicon.startswith('http'):
                    from urllib.parse import urljoin
                    favicon = urljoin(url, favicon)
                    
            return {
                "title": title,
                "description": description,
                "image": image,
                "siteName": site_name,
                "favicon": favicon,
            }
    except Exception as e:
        print(f"Link preview error for {url}: {e}")
        return {}

@app.get("/link-preview")
async def link_preview_endpoint(url: str = Query(...)):
    res = await asyncio.to_thread(fetch_link_meta_sync, url)
    return res


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    security_question: Optional[str] = None
    security_answer: Optional[str] = None

class RecoverAccountReq(BaseModel):
    email: str

class ResetPasswordReq(BaseModel):
    email: str
    security_answer: str
    new_password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    bio: str = ""
    avatar_base64: Optional[str] = None
    is_admin: bool = False
    ai_provider: Optional[str] = "ollama"
    ai_model: Optional[str] = None
    openai_key: Optional[str] = None
    ollama_url: Optional[str] = "http://localhost:11434/v1"
    gemini_key: Optional[str] = None

    class Config:
        from_attributes = True


class MailSend(BaseModel):
    to_email: str
    to_name: str = ""
    subject: str = ""
    body: str
    attachment_url: Optional[str] = None
    attachment_urls: Optional[list[str]] = None


class MailStar(BaseModel):
    starred: bool


class ChatSend(BaseModel):
    to_email: str
    text: str
    attachment_url: Optional[str] = None
    attachment_urls: Optional[list[str]] = None

class ChatReadBody(BaseModel):
    thread_id: int

class ProfileUpdate(BaseModel):
    username: str
    bio: str
    avatar_base64: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    openai_key: Optional[str] = None
    ollama_url: Optional[str] = None
    gemini_key: Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class ContactCreate(BaseModel):
    email: str
    name: str
    nickname: Optional[str] = None
    company: Optional[str] = None
    dob: Optional[str] = None

class ContactOut(BaseModel):
    id: int
    contact_email: str
    name: str
    nickname: Optional[str] = None
    company: Optional[str] = None
    dob: Optional[str] = None

    class Config:
        from_attributes = True


class TagCreate(BaseModel):
    name: str
    color: str


class MailTagsUpdate(BaseModel):
    tag_ids: list[int]


class FolderCreate(BaseModel):
    name: str


class MailFolderUpdate(BaseModel):
    folder_id: Optional[int] = None

class CalendarEventCreate(BaseModel):
    title: str
    description: str = ""
    start_time: datetime
    end_time: datetime

class CalendarEventOut(CalendarEventCreate):
    id: int
    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    is_completed: bool = False
    due_date: Optional[datetime] = None

class TaskOut(TaskCreate):
    id: int
    class Config:
        from_attributes = True

class NoteCreate(BaseModel):
    title: str
    content: str = ""

class NoteOut(NoteCreate):
    id: int
    updated_at: datetime
    class Config:
        from_attributes = True

class FilterRuleCreate(BaseModel):
    condition_type: str
    condition_value: str = ""
    action_type: str
    action_value: str = ""

class FilterRuleOut(FilterRuleCreate):
    id: int
    class Config:
        from_attributes = True


class AIChatSuggestReq(BaseModel):
    history_text: str

class AIMailToolsReq(BaseModel):
    tool_type: str
    text: str

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_attachment_url(message: models.Message) -> list[str]:
    metadata = message.metadata_json
    if not metadata:
        return []
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            return []
    if isinstance(metadata, dict):
        att_urls = metadata.get("attachment_urls")
        if att_urls and isinstance(att_urls, list):
            return att_urls
        att_url = metadata.get("attachment_url")
        if att_url:
            return [att_url]
    return []


def _fmt_time(dt: datetime) -> str:
    """Windows-safe 12-hour time formatter."""
    try:
        t = dt.strftime("%I:%M %p")  # e.g. "09:05 AM"
        return t.lstrip("0") or t    # remove leading zero → "9:05 AM"
    except Exception:
        return str(dt)


def _mail_to_dict(mail: models.Mail, current_user_id: int) -> dict:
    """
    Convert a fully-loaded Mail ORM row to a plain dict.
    Relationships (mail.sender, mail.recipient) MUST already be loaded
    via selectinload before calling this.
    """
    from_me = (mail.sender_id == current_user_id)
    body    = mail.body or ""
    snippet = body[:120].replace("\n", " ")

    sender_name  = mail.sender.username  if mail.sender    else "Unknown"
    sender_email = mail.sender.email     if mail.sender    else ""

    # Recipient display: prefer stored name, fall back to username, then email
    to_name  = (mail.recipient_name
                or (mail.recipient.username if mail.recipient else None)
                or mail.recipient_email)
    to_email = mail.recipient_email

    # Filter tags to only those owned by current_user_id
    user_tags = [
        {"id": t.id, "name": t.name, "color": t.color}
        for t in mail.tags
        if t.user_id == current_user_id
    ]

    # Find if this mail is in a custom folder for this user
    user_folder_assoc = next((fa for fa in mail.folder_associations if fa.user_id == current_user_id), None)
    folder_id = user_folder_assoc.folder_id if user_folder_assoc else None

    attachment_urls = []
    if mail.attachment_url:
        try:
            parsed = json.loads(mail.attachment_url)
            if isinstance(parsed, list):
                attachment_urls = parsed
            elif isinstance(parsed, str):
                attachment_urls = [parsed]
        except Exception:
            attachment_urls = [mail.attachment_url]

    return {
        "id":           mail.id,
        "from_me":      from_me,
        "sender_name":  sender_name,
        "sender_email": sender_email,
        "to_name":      to_name,
        "to_email":     to_email,
        "subject":      mail.subject or "",
        "body":         body,
        "snippet":      snippet,
        "time":         _fmt_time(mail.created_at),
        "starred":      mail.starred,
        "read":         mail.read,
        "category":     mail.category,
        "is_trashed":   mail.is_trashed,
        "tags":         user_tags,
        "folder_id":    folder_id,
        "attachment_url": attachment_urls[0] if attachment_urls else None,
        "attachment_urls": attachment_urls,
        "ai_summary":   mail.ai_summary,
    }


# Reusable query options that eagerly load sender + recipient
_MAIL_OPTS = [
    selectinload(models.Mail.sender),
    selectinload(models.Mail.recipient),
    selectinload(models.Mail.tags),
    selectinload(models.Mail.folder_associations),
]


# ── Auth ──────────────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> models.User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            security.SECRET_KEY,
            algorithms=[security.ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(
        select(models.User).where(models.User.id == int(user_id))
    )
    user = result.scalars().first()
    if not user:
        raise exc
    return user


async def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user


# ── Misc routes ───────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "MailNet API v2.1 — real cross-account mail delivery"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.User).where(
            or_(models.User.email == user.email,
                models.User.username == user.username)
        )
    )
    if result.scalars().first():
        raise HTTPException(400, "Email or username already registered")

    count_res = await db.execute(select(models.User))
    user_count = len(count_res.scalars().all())
    is_first_user = (user_count == 0)

    db_user = models.User(
        username=user.username,
        email=user.email.strip().lower(),
        hashed_password=security.get_password_hash(user.password),
        is_admin=is_first_user,
        security_question=user.security_question,
        security_answer=user.security_answer.lower().strip() if user.security_answer else None
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    token = security.create_access_token(
        data={"sub": str(db_user.id)},
        expires_delta=timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@app.post("/login")
async def login(user: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.User).where(models.User.email == user.email.strip().lower())
    )
    db_user = result.scalars().first()
    if not db_user or not security.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = security.create_access_token(
        data={"sub": str(db_user.id)},
        expires_delta=timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}

@app.post("/recover-account")
async def recover_account(req: RecoverAccountReq, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.email == req.email.strip().lower()))
    user = result.scalars().first()
    if not user or not user.security_question:
        raise HTTPException(404, "User not found or no security question set")
    return {"security_question": user.security_question}

@app.post("/reset-password")
async def reset_password(req: ResetPasswordReq, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.email == req.email.strip().lower()))
    user = result.scalars().first()
    if not user or not user.security_answer:
        raise HTTPException(404, "User not found or no security answer set")
    
    if req.security_answer.lower().strip() != user.security_answer:
        raise HTTPException(400, "Incorrect security answer")
        
    user.hashed_password = security.get_password_hash(req.new_password)
    await db.commit()
    return {"status": "success"}

@app.get("/admin/stats")
async def admin_stats(
    admin: models.User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    users_res = await db.execute(select(models.User))
    users = users_res.scalars().all()
    
    mails_res = await db.execute(select(models.Mail.id))
    total_mails = len(mails_res.scalars().all())

    msgs_res = await db.execute(select(models.Message.encrypted_content))
    messages = msgs_res.scalars().all()
    total_messages = len(messages)
    
    words_exchanged = sum(len(str(m).split()) for m in messages if m)
    
    active_users = sum(1 for u in users if (datetime.utcnow() - u.last_seen).total_seconds() < 86400)
    
    return {
        "total_users": len(users),
        "total_emails": total_mails,
        "total_messages": total_messages,
        "active_users": active_users,
        "words_exchanged": words_exchanged
    }

@app.get("/admin/users")
async def admin_users(
    admin: models.User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    users_res = await db.execute(select(models.User))
    users = users_res.scalars().all()
    
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "last_seen": _fmt_time(u.last_seen),
            "created_at": _fmt_time(u.created_at)
        }
        for u in users
    ]


@app.get("/admin/tables")
async def get_admin_tables(
    admin: models.User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
    tables = [row[0] for row in result.fetchall()]
    return {"tables": tables}


@app.get("/admin/tables/{table_name}")
async def get_admin_table_data(
    table_name: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    sort_by: Optional[str] = Query(None),
    sort_order: str = Query("asc"),
    search: Optional[str] = Query(None),
    admin: models.User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate table name to prevent SQL injection
    result = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    valid_tables = [row[0] for row in result.fetchall()]
    if table_name not in valid_tables:
        raise HTTPException(404, "Table not found")
        
    # Get columns
    pragma_result = await db.execute(text(f"PRAGMA table_info({table_name})"))
    pragma_rows = pragma_result.fetchall()
    columns = [row[1] for row in pragma_rows]
    pk_columns = [row[1] for row in pragma_rows if row[5] > 0]
    
    # Base query
    base_query = f"FROM {table_name}"
    where_clauses = []
    params = {}
    
    if search:
        search_clauses = [f"CAST({col} AS TEXT) LIKE :search" for col in columns]
        where_clauses.append("(" + " OR ".join(search_clauses) + ")")
        params["search"] = f"%{search}%"
        
    if where_clauses:
        base_query += " WHERE " + " AND ".join(where_clauses)
        
    # Count total rows
    count_query = f"SELECT COUNT(*) {base_query}"
    count_result = await db.execute(text(count_query), params)
    total_rows = count_result.scalar()
    
    # Order By
    order_clause = ""
    if sort_by and sort_by in columns:
        order_dir = "DESC" if sort_order.lower() == "desc" else "ASC"
        order_clause = f" ORDER BY {sort_by} {order_dir}"
        
    # Pagination
    offset = (page - 1) * limit
    data_query = f"SELECT * {base_query}{order_clause} LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset
    
    # Get data
    data_result = await db.execute(text(data_query), params)
    rows = []
    for row in data_result.fetchall():
        row_dict = {}
        for idx, col in enumerate(columns):
            row_dict[col] = row[idx]
        rows.append(row_dict)
        
    return {
        "columns": columns,
        "pk_columns": pk_columns,
        "rows": rows,
        "total": total_rows,
        "page": page,
        "limit": limit
    }

@app.put("/admin/tables/{table_name}")
async def update_admin_table_data(
    table_name: str,
    payload: dict = Body(...),
    admin: models.User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    valid_tables = [row[0] for row in result.fetchall()]
    if table_name not in valid_tables:
        raise HTTPException(404, "Table not found")

    pragma_result = await db.execute(text(f"PRAGMA table_info({table_name})"))
    pragma_rows = pragma_result.fetchall()
    columns = [row[1] for row in pragma_rows]
    pk_columns = [row[1] for row in pragma_rows if row[5] > 0]

    if not pk_columns:
        raise HTTPException(400, "Table has no primary key, cannot update")
        
    original = payload.get("original", {})
    updated = payload.get("updated", {})
    
    if not updated:
         raise HTTPException(400, "No updated data provided")
         
    where_clauses = []
    params = {}
    for pk in pk_columns:
        if pk not in original:
            raise HTTPException(400, f"Missing primary key {pk} in original data")
        where_clauses.append(f"{pk} = :pk_{pk}")
        params[f"pk_{pk}"] = original[pk]

    set_clauses = []
    for col, val in updated.items():
        if col in columns:
            set_clauses.append(f"{col} = :val_{col}")
            params[f"val_{col}"] = val
            
    if not set_clauses:
        raise HTTPException(400, "No valid columns to update")

    update_query = f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE {' AND '.join(where_clauses)}"
    
    try:
        await db.execute(text(update_query), params)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(400, str(e))
        
    return {"ok": True}

@app.delete("/admin/tables/{table_name}")
async def delete_admin_table_data(
    table_name: str,
    payload: dict = Body(...),
    admin: models.User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    valid_tables = [row[0] for row in result.fetchall()]
    if table_name not in valid_tables:
        raise HTTPException(404, "Table not found")

    pragma_result = await db.execute(text(f"PRAGMA table_info({table_name})"))
    pragma_rows = pragma_result.fetchall()
    pk_columns = [row[1] for row in pragma_rows if row[5] > 0]

    if not pk_columns:
        raise HTTPException(400, "Table has no primary key, cannot delete")
        
    where_clauses = []
    params = {}
    for pk in pk_columns:
        if pk not in payload:
            raise HTTPException(400, f"Missing primary key {pk} in payload")
        where_clauses.append(f"{pk} = :pk_{pk}")
        params[f"pk_{pk}"] = payload[pk]

    delete_query = f"DELETE FROM {table_name} WHERE {' AND '.join(where_clauses)}"
    
    try:
        await db.execute(text(delete_query), params)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(400, str(e))
        
    return {"ok": True}


@app.get("/users/me", response_model=UserOut)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.put("/users/me")
async def update_profile(
    profile: ProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.username = profile.username
    current_user.bio = profile.bio
    if profile.avatar_base64 is not None:
        current_user.avatar_base64 = profile.avatar_base64
    if profile.ai_provider is not None:
        current_user.ai_provider = profile.ai_provider
    if profile.ai_model is not None:
        current_user.ai_model = profile.ai_model
    if profile.openai_key is not None:
        current_user.openai_key = profile.openai_key
    if profile.ollama_url is not None:
        current_user.ollama_url = profile.ollama_url
    if profile.gemini_key is not None:
        current_user.gemini_key = profile.gemini_key
    await db.commit()
    return {"ok": True}


@app.put("/users/me/password")
async def update_password(
    body: PasswordUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not security.verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(400, "Incorrect current password")
    current_user.hashed_password = security.get_password_hash(body.new_password)
    await db.commit()
    return {"ok": True}


@app.get("/users/search")
async def search_users(
    q: str = Query("", min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.User)
        .where(models.User.email.ilike(f"%{q}%"))
        .where(models.User.id != current_user.id)
        .limit(10)
    )
    users = result.scalars().all()
    return [{"username": u.username, "email": u.email, "avatar_base64": u.avatar_base64} for u in users]


# ── Contacts ──────────────────────────────────────────────────────────────────

@app.get("/contacts", response_model=list[ContactOut])
async def get_contacts(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(models.Contact).where(models.Contact.owner_id == current_user.id))
    return res.scalars().all()

@app.post("/contacts", response_model=ContactOut)
async def create_contact(
    payload: ContactCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = models.Contact(
        owner_id=current_user.id,
        contact_email=payload.email,
        name=payload.name,
        nickname=payload.nickname,
        company=payload.company,
        dob=payload.dob
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact

@app.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: int,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(models.Contact).where(models.Contact.id == contact_id, models.Contact.owner_id == current_user.id))
    contact = res.scalars().first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    await db.delete(contact)
    await db.commit()
    return {"ok": True}

# ── Uploads ───────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join("uploads", filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"http://localhost:8000/uploads/{filename}"}


# ── Mail routes ───────────────────────────────────────────────────────────────

@app.post("/mail/send", status_code=status.HTTP_201_CREATED)
async def send_mail(
    payload: MailSend,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a mail.  If the recipient email belongs to a registered MailNet user,
    recipient_id is set so the mail appears in their inbox instantly.
    """
    to_email = payload.to_email.strip().lower()

    # Look up recipient by email (case-insensitive)
    result = await db.execute(
        select(models.User).where(models.User.email == to_email)
    )
    recipient_user = result.scalars().first()

    recipient_name = (payload.to_name.strip()
                      or (recipient_user.username if recipient_user else to_email.split("@")[0]))

    attachment_str = None
    if payload.attachment_urls:
        attachment_str = json.dumps(payload.attachment_urls)
    elif payload.attachment_url:
        attachment_str = json.dumps([payload.attachment_url])

    mail = models.Mail(
        sender_id      = current_user.id,
        recipient_id   = recipient_user.id if recipient_user else None,
        recipient_email= to_email,
        recipient_name = recipient_name,
        subject        = payload.subject,
        body           = payload.body,
        read           = False,
        starred        = False,
        attachment_url = attachment_str,
    )
    
    # Auto-categorize and summarize the email before saving
    from ai_service import categorize_mail_strict, generate_auto_tags, generate_mail_summary_strict
    email_text = f"Subject: {payload.subject}\n\n{payload.body}"
    owner = recipient_user if recipient_user else current_user
    
    category = await categorize_mail_strict(owner, email_text)
    mail.category = category
    
    summary = await generate_mail_summary_strict(owner, email_text)
    mail.ai_summary = summary

    db.add(mail)
    await db.commit()
    await db.refresh(mail)

    # Auto tag
    tag_res = await db.execute(select(models.Tag).where(models.Tag.user_id == owner.id))
    existing_tags = tag_res.scalars().all()
    
    suggested_tags = await generate_auto_tags(owner, email_text, existing_tags)
    if suggested_tags:
        tags_to_add = []
        for st in suggested_tags:
            tag_name = st.get("name")
            tag_color = st.get("color", "#888888")
            if not tag_name: continue
            existing_tag = next((t for t in existing_tags if t.name.lower() == tag_name.lower()), None)
            if existing_tag:
                tags_to_add.append(existing_tag)
            else:
                new_tag = models.Tag(user_id=owner.id, name=tag_name, color=tag_color)
                db.add(new_tag)
                tags_to_add.append(new_tag)
        if tags_to_add:
            mail.tags = tags_to_add
            await db.commit()

    # --- Apply Automation Filter Rules ---
    if recipient_user:
        rules_res = await db.execute(select(models.FilterRule).where(models.FilterRule.user_id == recipient_user.id))
        rules = rules_res.scalars().all()
        for rule in rules:
            match = False
            cond_val = rule.condition_value.lower()
            if rule.condition_type == 'from' and cond_val in current_user.email.lower():
                match = True
            elif rule.condition_type == 'subject_contains' and cond_val in mail.subject.lower():
                match = True
            elif rule.condition_type == 'has_attachment' and (mail.attachment_url is not None):
                match = True
                
            if match:
                if rule.action_type == 'add_tag':
                    # Need to find or create the tag
                    tag_res = await db.execute(select(models.Tag).where(models.Tag.user_id == recipient_user.id, models.Tag.name.ilike(rule.action_value)))
                    tag = tag_res.scalars().first()
                    if not tag:
                        tag = models.Tag(user_id=recipient_user.id, name=rule.action_value, color="#4285F4")
                        db.add(tag)
                    if tag not in mail.tags:
                        mail.tags.append(tag)
                elif rule.action_type == 'move_to_trash':
                    mail.is_trashed = True
                elif rule.action_type == 'star':
                    mail.starred = True
        await db.commit()
    # -------------------------------------

    ai_service.add_mail_to_rag(current_user.id, mail.id, mail.subject, mail.body)
    if recipient_user:
        ai_service.add_mail_to_rag(recipient_user.id, mail.id, mail.subject, mail.body)

    return {

        "id": mail.id,
        "delivered_to_registered_user": recipient_user is not None,
        "recipient": recipient_user.username if recipient_user else None,
    }


@app.get("/mail/inbox")
async def get_inbox(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all mails received by the current user, newest first, excluding those in custom folders."""
    from sqlalchemy.sql import exists
    folder_exists = exists().where(
        and_(
            models.MailFolderAssociation.mail_id == models.Mail.id,
            models.MailFolderAssociation.user_id == current_user.id
        )
    )
    result = await db.execute(
        select(models.Mail)
        .options(*_MAIL_OPTS)
        .where(
            and_(
                or_(
                    models.Mail.recipient_id    == current_user.id,
                    models.Mail.recipient_email == current_user.email,
                ),
                ~folder_exists
            )
        )
        .order_by(models.Mail.created_at.desc())
    )
    mails = result.scalars().all()
    return [_mail_to_dict(m, current_user.id) for m in mails]


@app.get("/mail/sent")
async def get_sent(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all mails sent by the current user, newest first, excluding those in custom folders."""
    from sqlalchemy.sql import exists
    folder_exists = exists().where(
        and_(
            models.MailFolderAssociation.mail_id == models.Mail.id,
            models.MailFolderAssociation.user_id == current_user.id
        )
    )
    result = await db.execute(
        select(models.Mail)
        .options(*_MAIL_OPTS)
        .where(
            and_(
                models.Mail.sender_id == current_user.id,
                ~folder_exists
            )
        )
        .order_by(models.Mail.created_at.desc())
    )
    mails = result.scalars().all()
    return [_mail_to_dict(m, current_user.id) for m in mails]


@app.get("/mail/poll")
async def poll_new_mail(
    since_id: int = Query(0),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.last_seen = datetime.utcnow()
    await db.commit()
    """
    Return inbox mails with id > since_id, excluding those in custom folders.
    Used by the frontend every 5 s to surface new deliveries.
    """
    from sqlalchemy.sql import exists
    folder_exists = exists().where(
        and_(
            models.MailFolderAssociation.mail_id == models.Mail.id,
            models.MailFolderAssociation.user_id == current_user.id
        )
    )
    result = await db.execute(
        select(models.Mail)
        .options(*_MAIL_OPTS)
        .where(
            and_(
                or_(
                    models.Mail.recipient_id    == current_user.id,
                    models.Mail.recipient_email == current_user.email,
                ),
                models.Mail.id > since_id,
                ~folder_exists
            )
        )
        .order_by(models.Mail.created_at.asc())
    )
    mails = result.scalars().all()
    return [_mail_to_dict(m, current_user.id) for m in mails]


@app.patch("/mail/{mail_id}/read")
async def mark_read(
    mail_id: int,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(models.Mail).where(models.Mail.id == mail_id))
    mail = result.scalars().first()
    if not mail:
        raise HTTPException(404, "Mail not found")
    if (mail.recipient_id != current_user.id
            and mail.recipient_email != current_user.email):
        raise HTTPException(403, "Forbidden")
    mail.read = True
    await db.commit()
    return {"ok": True}


@app.patch("/mail/{mail_id}/trash")
async def trash_mail(
    mail_id: int,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Mail).where(
            models.Mail.id == mail_id,
            models.Mail.recipient_id == current_user.id
        )
    )
    mail = result.scalars().first()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found or unauthorized")

    mail.is_trashed = True
    db.add(mail)
    await db.commit()
    return {"status": "trashed"}

@app.patch("/mail/{mail_id}/star")
async def toggle_star(
    mail_id: int,
    body: MailStar,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(models.Mail).where(models.Mail.id == mail_id))
    mail = result.scalars().first()
    if not mail:
        raise HTTPException(404, "Mail not found")
    if (mail.sender_id != current_user.id
            and mail.recipient_id != current_user.id):
        raise HTTPException(403, "Forbidden")
    mail.starred = body.starred
    await db.commit()
    return {"ok": True, "starred": mail.starred}


@app.delete("/mail/{mail_id}")
async def delete_mail(
    mail_id: int,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(models.Mail).where(models.Mail.id == mail_id))
    mail = result.scalars().first()
    if not mail:
        raise HTTPException(404, "Mail not found")
    if (mail.sender_id != current_user.id
            and mail.recipient_id != current_user.id):
        raise HTTPException(403, "Forbidden")
    await db.delete(mail)
    await db.commit()
    return {"ok": True}


# ── Tag / Category Routes ──────────────────────────────────────────────────────

@app.get("/tags")
async def get_tags(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Tag).where(models.Tag.user_id == current_user.id)
    )
    tags = result.scalars().all()
    if not tags:
        # Auto-create default tags for the user
        defaults = [
            ("Personal", "#3b82f6"),
            ("Work", "#eab308"),
            ("Finance", "#22c55e"),
            ("Social", "#a855f7"),
        ]
        tags = []
        for name, color in defaults:
            tag = models.Tag(user_id=current_user.id, name=name, color=color)
            db.add(tag)
            tags.append(tag)
        await db.commit()
        for t in tags:
            await db.refresh(t)
    return [{"id": t.id, "name": t.name, "color": t.color} for t in tags]


@app.post("/tags")
async def create_tag(
    payload: TagCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if a tag with this name already exists for the user
    existing_res = await db.execute(
        select(models.Tag).where(
            models.Tag.user_id == current_user.id,
            models.Tag.name == payload.name
        )
    )
    if existing_res.scalars().first():
        raise HTTPException(400, f"Tag '{payload.name}' already exists")

    tag = models.Tag(
        user_id=current_user.id,
        name=payload.name,
        color=payload.color
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color}


@app.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Tag).where(
            models.Tag.id == tag_id,
            models.Tag.user_id == current_user.id
        )
    )
    tag = result.scalars().first()
    if not tag:
        raise HTTPException(404, "Tag not found")
        
    await db.delete(tag)
    await db.commit()
    return {"ok": True}


@app.put("/mail/{mail_id}/tags")
async def update_mail_tags(
    mail_id: int,
    payload: MailTagsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Mail)
        .options(selectinload(models.Mail.tags))
        .where(models.Mail.id == mail_id)
    )
    mail = result.scalars().first()
    if not mail:
        raise HTTPException(404, "Mail not found")
        
    if (mail.sender_id != current_user.id
            and mail.recipient_id != current_user.id):
        raise HTTPException(403, "Forbidden")
        
    tag_res = await db.execute(
        select(models.Tag).where(models.Tag.user_id == current_user.id)
    )
    user_tags = {t.id: t for t in tag_res.scalars().all()}
    
    new_tags = []
    for tid in payload.tag_ids:
        if tid not in user_tags:
            raise HTTPException(400, f"Invalid tag ID: {tid}")
        new_tags.append(user_tags[tid])
        
    other_user_tags = [t for t in mail.tags if t.user_id != current_user.id]
    
    mail.tags = other_user_tags + new_tags
    await db.commit()
    return {"ok": True}


# ── Custom Folder Routes ───────────────────────────────────────────────────────

@app.get("/folders")
async def get_folders(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Folder).where(models.Folder.user_id == current_user.id)
    )
    folders = result.scalars().all()
    return [{"id": f.id, "name": f.name} for f in folders]


@app.post("/folders")
async def create_folder(
    payload: FolderCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing_res = await db.execute(
        select(models.Folder).where(
            models.Folder.user_id == current_user.id,
            models.Folder.name == payload.name
        )
    )
    if existing_res.scalars().first():
        raise HTTPException(400, f"Folder '{payload.name}' already exists")

    folder = models.Folder(
        user_id=current_user.id,
        name=payload.name
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {"id": folder.id, "name": folder.name}


@app.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: int,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Folder).where(
            models.Folder.id == folder_id,
            models.Folder.user_id == current_user.id
        )
    )
    folder = result.scalars().first()
    if not folder:
        raise HTTPException(404, "Folder not found")
        
    await db.delete(folder)
    await db.commit()
    return {"ok": True}


@app.get("/mail/folder/{folder_id}")
async def get_folder_mails(
    folder_id: int,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder_res = await db.execute(
        select(models.Folder).where(
            models.Folder.id == folder_id,
            models.Folder.user_id == current_user.id
        )
    )
    if not folder_res.scalars().first():
        raise HTTPException(404, "Folder not found")
        
    result = await db.execute(
        select(models.Mail)
        .options(*_MAIL_OPTS)
        .join(models.MailFolderAssociation, models.Mail.id == models.MailFolderAssociation.mail_id)
        .where(
            models.MailFolderAssociation.folder_id == folder_id,
            models.MailFolderAssociation.user_id == current_user.id
        )
        .order_by(models.Mail.created_at.desc())
    )
    mails = result.scalars().all()
    return [_mail_to_dict(m, current_user.id) for m in mails]


@app.put("/mail/{mail_id}/folder")
async def update_mail_folder(
    mail_id: int,
    payload: MailFolderUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Mail)
        .options(selectinload(models.Mail.folder_associations))
        .where(models.Mail.id == mail_id)
    )
    mail = result.scalars().first()
    if not mail:
        raise HTTPException(404, "Mail not found")
        
    if (mail.sender_id != current_user.id
            and mail.recipient_id != current_user.id):
        raise HTTPException(403, "Forbidden")
        
    # Remove existing folder association if any
    assoc_res = await db.execute(
        select(models.MailFolderAssociation).where(
            models.MailFolderAssociation.mail_id == mail_id,
            models.MailFolderAssociation.user_id == current_user.id
        )
    )
    existing_assoc = assoc_res.scalars().first()
    if existing_assoc:
        await db.delete(existing_assoc)
        
    if payload.folder_id is not None:
        # Verify folder exists and belongs to user
        folder_res = await db.execute(
            select(models.Folder).where(
                models.Folder.id == payload.folder_id,
                models.Folder.user_id == current_user.id
            )
        )
        if not folder_res.scalars().first():
            raise HTTPException(400, "Invalid folder ID")
            
        assoc = models.MailFolderAssociation(
            user_id=current_user.id,
            mail_id=mail_id,
            folder_id=payload.folder_id
        )
        db.add(assoc)
        
    await db.commit()
    return {"ok": True}


# ── Chat routes ───────────────────────────────────────────────────────────────

@app.post("/chat/send")
async def send_chat(
    payload: ChatSend,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    to_email = payload.to_email.strip().lower()
    if to_email == current_user.email:
        raise HTTPException(400, "Cannot chat with yourself")

    result = await db.execute(select(models.User).where(models.User.email == to_email))
    recipient = result.scalars().first()

    if not recipient:
        raise HTTPException(404, "Recipient not found on MailNet")

    res1 = await db.execute(select(models.ThreadParticipant.thread_id).where(models.ThreadParticipant.user_id == current_user.id))
    user1_threads = set(res1.scalars().all())

    res2 = await db.execute(select(models.ThreadParticipant.thread_id).where(models.ThreadParticipant.user_id == recipient.id))
    user2_threads = set(res2.scalars().all())

    common = user1_threads.intersection(user2_threads)
    
    if common:
        thread_id = list(common)[0]
    else:
        thread = models.Thread(is_chat=True)
        db.add(thread)
        await db.commit()
        await db.refresh(thread)
        
        p1 = models.ThreadParticipant(thread_id=thread.id, user_id=current_user.id)
        p2 = models.ThreadParticipant(thread_id=thread.id, user_id=recipient.id)
        db.add_all([p1, p2])
        await db.commit()
        thread_id = thread.id

    metadata = {}
    if payload.attachment_urls:
        metadata["attachment_urls"] = payload.attachment_urls
    elif payload.attachment_url:
        metadata["attachment_urls"] = [payload.attachment_url]

    msg = models.Message(
        thread_id=thread_id,
        sender_id=current_user.id,
        encrypted_content=payload.text,
        status="sent",
        metadata_json=metadata
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # ── Surya AI interception ─────────────────────────────────────────────────
    if to_email == "surya@mailnet.ai":
        import asyncio
        try:
            # Build history from thread messages
            hist_res = await db.execute(
                select(models.Message)
                .where(models.Message.thread_id == thread_id)
                .order_by(models.Message.timestamp.asc())
            )
            hist_msgs = hist_res.scalars().all()
            history = []
            for hm in hist_msgs:
                role = "user" if hm.sender_id == current_user.id else "assistant"
                history.append({"role": role, "text": hm.encrypted_content})
            # Remove last user message (just sent) from history to avoid duplication in query
            if history and history[-1]["role"] == "user":
                history = history[:-1]

            ai_result = await ai_service.query_rag(current_user, payload.text, history, db, {})
            ai_text = ai_result.get("answer", "I'm here! How can I help?")
        except Exception as e:
            print("Surya AI error:", e)
            ai_text = "I'm having a moment of quiet. Please try again!"

        ai_reply = models.Message(
            thread_id=thread_id,
            sender_id=recipient.id,
            encrypted_content=ai_text,
            status="sent",
            metadata_json={}
        )
        db.add(ai_reply)
        await db.commit()
        await db.refresh(ai_reply)

        return {
            "id": msg.id,
            "thread_id": thread_id,
            "text": msg.encrypted_content,
            "fromMe": True,
            "time": _fmt_time(msg.timestamp),
            "status": "sent",
            "attachment_url": metadata.get("attachment_urls")[0] if metadata.get("attachment_urls") else None,
            "attachment_urls": metadata.get("attachment_urls", []),
            "surya_reply": {
                "id": ai_reply.id,
                "thread_id": thread_id,
                "text": ai_reply.encrypted_content,
                "fromMe": False,
                "time": _fmt_time(ai_reply.timestamp),
                "status": "sent",
                "attachment_url": None,
                "attachment_urls": []
            }
        }

    return {
        "id": msg.id,
        "thread_id": thread_id,
        "text": msg.encrypted_content,
        "fromMe": True,
        "time": _fmt_time(msg.timestamp),
        "status": "sent",
        "attachment_url": metadata.get("attachment_urls")[0] if metadata.get("attachment_urls") else None,
        "attachment_urls": metadata.get("attachment_urls", [])
    }

@app.get("/chat/conversations")
async def get_conversations(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Ensure Surya user exists
    surya_res = await db.execute(select(models.User).where(models.User.email == "surya@mailnet.ai"))
    surya_user = surya_res.scalars().first()
    if not surya_user:
        surya_user = models.User(username="Surya", email="surya@mailnet.ai", hashed_password="disabled", is_admin=False)
        db.add(surya_user)
        await db.commit()
        await db.refresh(surya_user)

    # Check if thread with Surya exists
    res1 = await db.execute(select(models.ThreadParticipant.thread_id).where(models.ThreadParticipant.user_id == current_user.id))
    user1_threads = set(res1.scalars().all())
    res2 = await db.execute(select(models.ThreadParticipant.thread_id).where(models.ThreadParticipant.user_id == surya_user.id))
    user2_threads = set(res2.scalars().all())
    common = user1_threads.intersection(user2_threads)
    if not common:
        # Create thread
        thread = models.Thread(is_chat=True)
        db.add(thread)
        await db.commit()
        await db.refresh(thread)
        p1 = models.ThreadParticipant(thread_id=thread.id, user_id=current_user.id)
        p2 = models.ThreadParticipant(thread_id=thread.id, user_id=surya_user.id)
        db.add_all([p1, p2])
        await db.commit()
        
        # Add welcome message
        msg = models.Message(
            thread_id=thread.id,
            sender_id=surya_user.id,
            encrypted_content="Hi, I am Surya, your radiant AI assistant. How can I brighten your day?",
            status="sent",
            metadata_json={}
        )
        db.add(msg)
        await db.commit()

    res = await db.execute(select(models.ThreadParticipant.thread_id).where(models.ThreadParticipant.user_id == current_user.id))
    thread_ids = res.scalars().all()

    if not thread_ids:
        return []

    conversations = []
    for tid in thread_ids:
        p_res = await db.execute(
            select(models.User)
            .join(models.ThreadParticipant, models.User.id == models.ThreadParticipant.user_id)
            .where(models.ThreadParticipant.thread_id == tid, models.User.id != current_user.id)
        )
        other_user = p_res.scalars().first()
        if not other_user:
            continue
            
        m_res = await db.execute(
            select(models.Message)
            .where(models.Message.thread_id == tid)
            .order_by(models.Message.timestamp.asc())
        )
        messages = m_res.scalars().all()
        
        is_online = (datetime.utcnow() - other_user.last_seen).total_seconds() < 15
        
        msgs_out = []
        for m in messages:
            att = _get_attachment_url(m)
            msgs_out.append({
                "id": m.id,
                "text": m.encrypted_content,
                "fromMe": m.sender_id == current_user.id,
                "time": _fmt_time(m.timestamp),
                "status": m.status,
                "attachment_url": att[0] if att else None,
                "attachment_urls": att
            })
            
        conversations.append({
            "id": tid,
            "name": other_user.username,
            "email": other_user.email,
            "color": "",
            "online": is_online,
            "lastSeen": "Active now" if is_online else f"Active {_fmt_time(other_user.last_seen)}",
            "avatar_base64": other_user.avatar_base64,
            "bio": other_user.bio,
            "messages": msgs_out,
            "unread": 0
        })
        
    conversations.sort(key=lambda c: c["messages"][-1]["id"] if c["messages"] else 0, reverse=True)
    return conversations

@app.get("/chat/poll")
async def poll_chat(
    since_msg_id: int = Query(0),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.last_seen = datetime.utcnow()
    await db.commit()

    res = await db.execute(select(models.ThreadParticipant.thread_id).where(models.ThreadParticipant.user_id == current_user.id))
    thread_ids = res.scalars().all()

    if not thread_ids:
        return {"new_messages": [], "status_updates": []}

    m_res = await db.execute(
        select(models.Message)
        .where(
            models.Message.thread_id.in_(thread_ids),
            models.Message.id > since_msg_id,
            models.Message.sender_id != current_user.id
        )
        .order_by(models.Message.timestamp.asc())
    )
    new_incoming = m_res.scalars().all()
    
    new_msgs_out = []
    for m in new_incoming:
        if m.status == "sent":
            m.status = "delivered"
        att = _get_attachment_url(m)
        new_msgs_out.append({
            "id": m.id,
            "thread_id": m.thread_id,
            "text": m.encrypted_content,
            "fromMe": False,
            "time": _fmt_time(m.timestamp),
            "status": m.status,
            "attachment_url": att[0] if att else None,
            "attachment_urls": att
        })
    await db.commit()

    status_res = await db.execute(
        select(models.Message.id, models.Message.status)
        .where(
            models.Message.thread_id.in_(thread_ids),
            models.Message.sender_id == current_user.id,
            models.Message.status != "sent"
        )
    )
    status_updates = [{"id": row.id, "status": row.status} for row in status_res.all()]
    
    return {"new_messages": new_msgs_out, "status_updates": status_updates}


@app.patch("/chat/read")
async def chat_read(
    body: ChatReadBody,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        models.Message.__table__.update()
        .where(
            models.Message.thread_id == body.thread_id,
            models.Message.sender_id != current_user.id,
            models.Message.status != "read"
        )
        .values(status="read")
    )
    await db.commit()
    return {"ok": True}


# ── AI Routes ─────────────────────────────────────────────────────────────────

class AIQuery(BaseModel):
    query: str
    history: list[dict] = []
    context_settings: dict = {}

class AIExecuteRequest(BaseModel):
    actions: list[dict]

@app.get("/ai/home")
async def ai_home(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mail_res = await db.execute(
        select(models.Mail)
        .where(or_(models.Mail.recipient_id == current_user.id, models.Mail.sender_id == current_user.id))
        .order_by(models.Mail.created_at.desc())
        .limit(5)
    )
    mails = mail_res.scalars().all()
    mail_text = "\n".join([f"Subject: {m.subject}, Body: {m.body[:100]}" for m in mails])
    
    chat_res = await db.execute(
        select(models.Message)
        .join(models.ThreadParticipant, models.ThreadParticipant.thread_id == models.Message.thread_id)
        .where(models.ThreadParticipant.user_id == current_user.id)
        .order_by(models.Message.timestamp.desc())
        .limit(5)
    )
    chats = chat_res.scalars().all()
    chat_text = "\n".join([f"Message: {m.encrypted_content}" for m in chats])
    
    mail_summary = await ai_service.generate_summary(current_user, mail_text, "emails")
    chat_summary = await ai_service.generate_summary(current_user, chat_text, "chats")
    
    return {"mail_summary": mail_summary, "chat_summary": chat_summary}

@app.get("/ai/graph")
async def ai_graph(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await knowledge_graph.get_user_knowledge_graph(current_user, db)

@app.post("/ai/query")
async def ai_query(
    req: AIQuery,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from ai_service import query_rag
    res = await query_rag(current_user, req.query, req.history, db, req.context_settings)
    return res

@app.post("/ai/execute")
async def ai_execute(
    req: AIExecuteRequest,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    results = []
    for act in req.actions:
        try:
            if act.get("type") == "trash_mail":
                mail_id = act.get("mail_id")
                result = await db.execute(select(models.Mail).where(models.Mail.id == mail_id, models.Mail.recipient_id == current_user.id))
                mail = result.scalars().first()
                if mail:
                    mail.is_trashed = True
                    db.add(mail)
                    results.append({"status": "success", "action": "trash_mail", "mail_id": mail_id})
            elif act.get("type") == "create_folder":
                name = act.get("name")
                folder = models.Folder(name=name, user_id=current_user.id)
                db.add(folder)
                results.append({"status": "success", "action": "create_folder", "name": name})
            elif act.get("type") == "group_mail":
                mail_id = act.get("mail_id")
                folder_name = act.get("folder_name")
                result = await db.execute(select(models.Folder).where(models.Folder.name == folder_name, models.Folder.user_id == current_user.id))
                folder = result.scalars().first()
                if folder:
                    # Create association
                    assoc = models.MailFolderAssociation(user_id=current_user.id, mail_id=mail_id, folder_id=folder.id)
                    db.add(assoc)
                    results.append({"status": "success", "action": "group_mail", "mail_id": mail_id})
            elif act.get("type") == "tag_mail":
                mail_id = act.get("mail_id")
                tag_name = act.get("tag_name")
                tag_result = await db.execute(select(models.Tag).where(models.Tag.name == tag_name, models.Tag.user_id == current_user.id))
                tag = tag_result.scalars().first()
                if not tag:
                    tag = models.Tag(name=tag_name, color="#4F46E5", user_id=current_user.id)
                    db.add(tag)
                    await db.commit()
                    await db.refresh(tag)
                
                # We need to use raw SQL or fetch mail with tags
                # For simplicity, we just execute an insert into the association table
                try:
                    await db.execute(models.mail_tags.insert().values(mail_id=mail_id, tag_id=tag.id))
                except Exception:
                    pass # already tagged
                results.append({"status": "success", "action": "tag_mail", "mail_id": mail_id})
            elif act.get("type") == "create_tag":
                tag_name = act.get("tag_name")
                color = act.get("color", "#4F46E5")
                tag_result = await db.execute(select(models.Tag).where(models.Tag.name == tag_name, models.Tag.user_id == current_user.id))
                tag = tag_result.scalars().first()
                if not tag:
                    tag = models.Tag(name=tag_name, color=color, user_id=current_user.id)
                    db.add(tag)
                    await db.commit()
                results.append({"status": "success", "action": "create_tag", "tag_name": tag_name})
            elif act.get("type") == "auto_tag_mail":
                from main import ai_mail_auto_tag
                mail_id = act.get("mail_id")
                await ai_mail_auto_tag(mail_id, db, current_user)
                results.append({"status": "success", "action": "auto_tag_mail", "mail_id": mail_id})
            elif act.get("type") == "tag_all_mails":
                from main import ai_mail_auto_tag
                # Fetch all untagged mails belonging to user
                res = await db.execute(
                    select(models.Mail)
                    .options(selectinload(models.Mail.tags))
                    .where(models.Mail.recipient_id == current_user.id)
                )
                mails = res.scalars().all()
                tagged_count = 0
                for mail in mails:
                    if not mail.tags:
                        try:
                            await ai_mail_auto_tag(mail.id, db, current_user)
                            tagged_count += 1
                        except Exception as e:
                            pass
                results.append({"status": "success", "action": "tag_all_mails", "tagged_count": tagged_count})
            elif act.get("type") == "send_mail":
                to_list = act.get("to", [])
                if isinstance(to_list, str):
                    to_list = [to_list]
                
                for to_email in to_list:
                    to_email = to_email.strip().lower()
                    result = await db.execute(select(models.User).where(models.User.email == to_email))
                    recipient_user = result.scalars().first()
                    
                    # Create the outbound "sent" mail for the sender
                    sent_mail = models.Mail(
                        sender_id=current_user.id,
                        recipient_id=recipient_user.id if recipient_user else None,
                        recipient_email=to_email,
                        recipient_name=recipient_user.username if recipient_user else to_email.split("@")[0],
                        subject=act.get("subject", ""),
                        body=act.get("body", ""),
                        category="sent",
                        read=True
                    )
                    db.add(sent_mail)
                    
                    # Create the inbound "inbox" mail for the recipient if they exist
                    if recipient_user:
                        inbox_mail = models.Mail(
                            sender_id=current_user.id,
                            recipient_id=recipient_user.id,
                            recipient_email=to_email,
                            recipient_name=recipient_user.username,
                            subject=act.get("subject", ""),
                            body=act.get("body", ""),
                            category="inbox",
                            read=False
                        )
                        db.add(inbox_mail)
                
                results.append({"status": "success", "action": "send_mail", "recipients": to_list})
            elif act.get("type") == "draft_email":
                # Handled by frontend clientAction
                pass
            elif act.get("type") == "send_chat":
                to_email = act.get("to", "").strip().lower()
                text_msg = act.get("text", "")
                
                # find recipient user
                res = await db.execute(select(models.User).where(models.User.email == to_email))
                recipient = res.scalars().first()
                if recipient:
                    # thread ID is min/max of user IDs
                    t_id = hash(tuple(sorted([current_user.id, recipient.id]))) % 2147483647
                    from backend.security import encrypt_message
                    enc_text = encrypt_message(text_msg)
                    msg = models.Message(
                        thread_id=t_id,
                        sender_id=current_user.id,
                        encrypted_content=enc_text
                    )
                    db.add(msg)
                    await db.flush()
                    # Add to RAG
                    from backend.ai_service import add_chat_to_rag
                    import asyncio
                    asyncio.create_task(asyncio.to_thread(add_chat_to_rag, current_user.id, msg.id, f"To {recipient.username}: {text_msg}"))
                    results.append({"status": "success", "action": "send_chat", "to": to_email})
                else:
                    results.append({"status": "error", "action": "send_chat", "error": "User not found"})
            elif act.get("type") == "update_settings":
                if act.get("username"): current_user.username = act["username"]
                if act.get("bio") is not None: current_user.bio = act["bio"]
                if act.get("ai_provider"): current_user.ai_provider = act["ai_provider"]
                if act.get("ai_model"): current_user.ai_model = act["ai_model"]
                results.append({"status": "success", "action": "update_settings"})
            elif act.get("type") == "create_contact":
                contact = models.Contact(
                    owner_id=current_user.id,
                    contact_email=act.get("email", ""),
                    name=act.get("name", "Unknown"),
                    nickname=act.get("nickname"),
                    company=act.get("company"),
                    dob=act.get("dob")
                )
                db.add(contact)
                await db.flush()
                results.append({"status": "success", "action": "create_contact", "contact_id": contact.id})
            elif act.get("type") == "delete_contact":
                cid = act.get("contact_id")
                contact = await db.get(models.Contact, cid)
                if contact and contact.owner_id == current_user.id:
                    await db.delete(contact)
                    results.append({"status": "success", "action": "delete_contact", "contact_id": cid})
                else:
                    results.append({"status": "error", "action": "delete_contact", "error": "Not found"})
            # ── Ecosystem AI Actions ──────────────────────────────────────────
            elif act.get("type") == "create_calendar_event":
                from dateutil.parser import parse as parse_dt
                try:
                    start = parse_dt(act.get("start_time", ""))
                    end = parse_dt(act.get("end_time", ""))
                except Exception:
                    start = datetime.utcnow()
                    end = datetime.utcnow() + timedelta(hours=1)
                event = models.CalendarEvent(
                    user_id=current_user.id,
                    title=act.get("title", "Untitled Event"),
                    description=act.get("description", ""),
                    start_time=start,
                    end_time=end,
                )
                db.add(event)
                await db.flush()
                results.append({"status": "success", "action": "create_calendar_event", "event_id": event.id, "title": event.title})
            elif act.get("type") == "edit_calendar_event":
                from dateutil.parser import parse as parse_dt
                event_id = act.get("event_id")
                event = await db.get(models.CalendarEvent, event_id)
                if event and event.user_id == current_user.id:
                    if act.get("title"):
                        event.title = act["title"]
                    if act.get("description") is not None:
                        event.description = act["description"]
                    if act.get("start_time"):
                        try:
                            event.start_time = parse_dt(act["start_time"])
                        except Exception:
                            pass
                    if act.get("end_time"):
                        try:
                            event.end_time = parse_dt(act["end_time"])
                        except Exception:
                            pass
                    results.append({"status": "success", "action": "edit_calendar_event", "event_id": event_id})
                else:
                    results.append({"status": "error", "action": "edit_calendar_event", "error": "Event not found"})
            elif act.get("type") == "delete_calendar_event":
                event_id = act.get("event_id")
                event = await db.get(models.CalendarEvent, event_id)
                if event and event.user_id == current_user.id:
                    await db.delete(event)
                    results.append({"status": "success", "action": "delete_calendar_event", "event_id": event_id})
                else:
                    results.append({"status": "error", "action": "delete_calendar_event", "error": "Event not found"})
            elif act.get("type") == "create_task":
                from dateutil.parser import parse as parse_dt
                due = None
                if act.get("due_date"):
                    try:
                        due = parse_dt(act["due_date"])
                    except Exception:
                        pass
                task = models.Task(
                    user_id=current_user.id,
                    title=act.get("title", "Untitled Task"),
                    description=act.get("description", ""),
                    due_date=due,
                )
                db.add(task)
                await db.flush()
                results.append({"status": "success", "action": "create_task", "task_id": task.id, "title": task.title})
            elif act.get("type") == "edit_task":
                from dateutil.parser import parse as parse_dt
                task_id = act.get("task_id")
                task = await db.get(models.Task, task_id)
                if task and task.user_id == current_user.id:
                    if act.get("title"):
                        task.title = act["title"]
                    if act.get("description") is not None:
                        task.description = act["description"]
                    if act.get("due_date"):
                        try:
                            task.due_date = parse_dt(act["due_date"])
                        except Exception:
                            pass
                    if act.get("is_completed") is not None:
                        task.is_completed = bool(act["is_completed"])
                    results.append({"status": "success", "action": "edit_task", "task_id": task_id})
                else:
                    results.append({"status": "error", "action": "edit_task", "error": "Task not found"})
            elif act.get("type") == "delete_task":
                task_id = act.get("task_id")
                task = await db.get(models.Task, task_id)
                if task and task.user_id == current_user.id:
                    await db.delete(task)
                    results.append({"status": "success", "action": "delete_task", "task_id": task_id})
                else:
                    results.append({"status": "error", "action": "delete_task", "error": "Task not found"})
            elif act.get("type") == "create_note":
                note = models.Note(
                    user_id=current_user.id,
                    title=act.get("title", "Untitled Note"),
                    content=act.get("content", ""),
                )
                db.add(note)
                await db.flush()
                results.append({"status": "success", "action": "create_note", "note_id": note.id, "title": note.title})
            elif act.get("type") == "edit_note":
                note_id = act.get("note_id")
                note = await db.get(models.Note, note_id)
                if note and note.user_id == current_user.id:
                    if act.get("title"):
                        note.title = act["title"]
                    if act.get("content") is not None:
                        note.content = act["content"]
                    results.append({"status": "success", "action": "edit_note", "note_id": note_id})
                else:
                    results.append({"status": "error", "action": "edit_note", "error": "Note not found"})
            elif act.get("type") == "delete_note":
                note_id = act.get("note_id")
                note = await db.get(models.Note, note_id)
                if note and note.user_id == current_user.id:
                    await db.delete(note)
                    results.append({"status": "success", "action": "delete_note", "note_id": note_id})
                else:
                    results.append({"status": "error", "action": "delete_note", "error": "Note not found"})
        except Exception as e:
            results.append({"status": "error", "action": act.get("type"), "error": str(e)})
    await db.commit()
    return {"results": results}

@app.get("/ai/models")
async def ai_models(
    provider: str = Query(...),
    api_key: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user)
):
    from ai_service import get_available_models
    if provider == "openai":
        key = api_key or current_user.openai_key
    else:
        key = api_key or current_user.gemini_key
    models = await get_available_models(provider, key)
    return {"models": models}

@app.post("/ai/chat-suggest")
async def ai_chat_suggest(
    req: AIChatSuggestReq,
    current_user: models.User = Depends(get_current_user)
):
    from ai_service import generate_chat_suggestions
    suggestions = await generate_chat_suggestions(current_user, req.history_text)
    return {"suggestions": suggestions}

@app.post("/ai/mail-tools")
async def ai_mail_tools(
    req: AIMailToolsReq,
    current_user: models.User = Depends(get_current_user)
):
    from ai_service import generate_mail_tool_text
    result = await generate_mail_tool_text(current_user, req.tool_type, req.text)
    return {"text": result}

@app.post("/ai/mail/summarize/{mail_id}")
async def ai_mail_summarize(
    mail_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    from ai_service import generate_mail_summary_strict
    res = await db.execute(select(models.Mail).where(models.Mail.id == mail_id))
    mail = res.scalar_one_or_none()
    if not mail or (mail.sender_id != current_user.id and mail.recipient_id != current_user.id):
        raise HTTPException(status_code=404, detail="Mail not found")
    
    summary = await generate_mail_summary_strict(current_user, mail.body)
    return {"summary": summary}

@app.post("/ai/mail/auto-tag/{mail_id}")
async def ai_mail_auto_tag(
    mail_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    from ai_service import generate_auto_tags
    res = await db.execute(select(models.Mail).where(models.Mail.id == mail_id))
    mail = res.scalar_one_or_none()
    if not mail or (mail.sender_id != current_user.id and mail.recipient_id != current_user.id):
        raise HTTPException(status_code=404, detail="Mail not found")

    # Get user's existing tags
    tag_res = await db.execute(select(models.Tag).where(models.Tag.user_id == current_user.id))
    existing_tags = tag_res.scalars().all()

    # Generate tags
    new_tags_json = await generate_auto_tags(current_user, mail.body, existing_tags)
    
    # Process and assign tags
    assigned_tags = []
    for tag_data in new_tags_json:
        tag_name = tag_data.get("name")
        tag_color = tag_data.get("color", "#888888")
        if not tag_name: continue
        
        # Check if exists
        existing = next((t for t in existing_tags if t.name.lower() == tag_name.lower()), None)
        if not existing:
            new_tag = models.Tag(user_id=current_user.id, name=tag_name, color=tag_color)
            db.add(new_tag)
            await db.commit()
            await db.refresh(new_tag)
            existing = new_tag
        
        assigned_tags.append(existing)

    # Assign to mail
    # Note: SQLAlchemy requires eager loading of tags collection to append, or we can just run an insert
    # Actually, simpler is to do a manual insert or await mail.tags lazy load
    # Let's just do a manual insert ignoring duplicates
    for t in assigned_tags:
        try:
            await db.execute(
                models.mail_tags.insert().values(mail_id=mail.id, tag_id=t.id)
            )
        except Exception:
            pass # Ignore unique constraint violation if already tagged
    await db.commit()

    return {"tags": [{"id": t.id, "name": t.name, "color": t.color} for t in assigned_tags]}

@app.post("/ai/chat/character-graph/{contact_id}")
async def ai_character_graph(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    from ai_service import generate_character_graph
    # Get contact
    print(f"ai_character_graph hit: contact_id={contact_id}, current_user_id={current_user.id}")
    res = await db.execute(select(models.Contact).where(models.Contact.id == contact_id, models.Contact.owner_id == current_user.id))
    contact = res.scalar_one_or_none()
    if not contact:
        print("Contact not found in DB!")
        raise HTTPException(status_code=404, detail="Contact not found")

    # Find the target user ID for this contact email
    user_res = await db.execute(select(models.User).where(models.User.email == contact.contact_email))
    target_user = user_res.scalar_one_or_none()
    
    if target_user:
        # Get chat history between current_user and target_user
        # Find threads where both are participants
        tp1 = aliased(models.ThreadParticipant)
        tp2 = aliased(models.ThreadParticipant)
        thread_res = await db.execute(
            select(models.Thread.id)
            .join(tp1, tp1.thread_id == models.Thread.id)
            .join(tp2, tp2.thread_id == models.Thread.id)
            .where(models.Thread.is_chat == True)
            .where(tp1.user_id == current_user.id)
            .where(tp2.user_id == target_user.id)
        )
        thread_ids = thread_res.scalars().all()
        
        if thread_ids:
            msg_res = await db.execute(
                select(models.Message)
                .where(models.Message.thread_id.in_(thread_ids))
                .order_by(models.Message.timestamp.asc())
            )
            messages = msg_res.scalars().all()
            history = "\n".join([f"{m.sender_id}: {m.encrypted_content}" for m in messages])
        else:
            history = ""
    else:
        history = ""

    graph = await generate_character_graph(current_user, history)
    
    contact.ai_graph = graph
    db.add(contact)
    await db.commit()
    
    return graph


# Map of lowercased user emails to active WebSocket connections
active_call_connections = {}

@app.websocket("/call/ws")
async def call_websocket(websocket: WebSocket, token: str = Query(None)):
    await websocket.accept()
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        payload = jwt.decode(
            token,
            security.SECRET_KEY,
            algorithms=[security.ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Look up user email in db
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(models.User).where(models.User.id == int(user_id))
        )
        user = result.scalars().first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_email = user.email.lower()
        user_name = user.username

    active_call_connections[user_email] = websocket

    try:
        while True:
            # Expect JSON messages for WebRTC signaling
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "call_user":
                target_email = data.get("target_email", "").lower()
                offer = data.get("offer")
                target_ws = active_call_connections.get(target_email)
                if target_ws:
                    await target_ws.send_json({
                        "type": "incoming_call",
                        "caller_email": user_email,
                        "caller_name": user_name,
                        "offer": offer
                    })
                else:
                    await websocket.send_json({
                        "type": "call_failed",
                        "reason": "User is offline"
                    })
                    
            elif msg_type == "accept_call":
                caller_email = data.get("caller_email", "").lower()
                answer = data.get("answer")
                caller_ws = active_call_connections.get(caller_email)
                if caller_ws:
                    await caller_ws.send_json({
                        "type": "call_accepted",
                        "callee_email": user_email,
                        "answer": answer
                    })
                    
            elif msg_type == "decline_call":
                caller_email = data.get("caller_email", "").lower()
                caller_ws = active_call_connections.get(caller_email)
                if caller_ws:
                    await caller_ws.send_json({
                        "type": "call_declined",
                        "callee_email": user_email
                    })
                    
            elif msg_type == "ice_candidate":
                target_email = data.get("target_email", "").lower()
                candidate = data.get("candidate")
                target_ws = active_call_connections.get(target_email)
                if target_ws:
                    await target_ws.send_json({
                        "type": "ice_candidate",
                        "sender_email": user_email,
                        "candidate": candidate
                    })
                    
            elif msg_type == "hang_up":
                target_email = data.get("target_email", "").lower()
                target_ws = active_call_connections.get(target_email)
                if target_ws:
                    await target_ws.send_json({
                        "type": "call_ended",
                        "sender_email": user_email
                    })

    except WebSocketDisconnect:
        pass
    finally:
        if user_email in active_call_connections and active_call_connections[user_email] == websocket:
            del active_call_connections[user_email]

# ── Ecosystem & Rules Endpoints ───────────────────────────────────────────────

@app.get("/calendar", response_model=list[CalendarEventOut])
async def get_calendar_events(current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.CalendarEvent).where(models.CalendarEvent.user_id == current_user.id))
    return res.scalars().all()

@app.post("/calendar", response_model=CalendarEventOut)
async def create_calendar_event(payload: CalendarEventCreate, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = models.CalendarEvent(**payload.dict(), user_id=current_user.id)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event

@app.delete("/calendar/{event_id}")
async def delete_calendar_event(event_id: int, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await db.get(models.CalendarEvent, event_id)
    if event and event.user_id == current_user.id:
        await db.delete(event)
        await db.commit()
    return {"ok": True}

@app.get("/tasks", response_model=list[TaskOut])
async def get_tasks(current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.Task).where(models.Task.user_id == current_user.id))
    return res.scalars().all()

@app.post("/tasks", response_model=TaskOut)
async def create_task(payload: TaskCreate, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = models.Task(**payload.dict(), user_id=current_user.id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

@app.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, payload: TaskCreate, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await db.get(models.Task, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(404, "Task not found")
    for k, v in payload.dict().items():
        setattr(task, k, v)
    await db.commit()
    await db.refresh(task)
    return task

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: int, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await db.get(models.Task, task_id)
    if task and task.user_id == current_user.id:
        await db.delete(task)
        await db.commit()
    return {"ok": True}

@app.get("/notes", response_model=list[NoteOut])
async def get_notes(current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.Note).where(models.Note.user_id == current_user.id))
    return res.scalars().all()

@app.post("/notes", response_model=NoteOut)
async def create_note(payload: NoteCreate, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = models.Note(**payload.dict(), user_id=current_user.id)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

@app.put("/notes/{note_id}", response_model=NoteOut)
async def update_note(note_id: int, payload: NoteCreate, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await db.get(models.Note, note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(404, "Note not found")
    note.title = payload.title
    note.content = payload.content
    await db.commit()
    await db.refresh(note)
    return note

@app.delete("/notes/{note_id}")
async def delete_note(note_id: int, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await db.get(models.Note, note_id)
    if note and note.user_id == current_user.id:
        await db.delete(note)
        await db.commit()
    return {"ok": True}

@app.get("/rules", response_model=list[FilterRuleOut])
async def get_rules(current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.FilterRule).where(models.FilterRule.user_id == current_user.id))
    return res.scalars().all()

@app.post("/rules", response_model=FilterRuleOut)
async def create_rule(payload: FilterRuleCreate, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rule = models.FilterRule(**payload.dict(), user_id=current_user.id)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@app.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rule = await db.get(models.FilterRule, rule_id)
    if rule and rule.user_id == current_user.id:
        await db.delete(rule)
        await db.commit()
    return {"ok": True}

class SmartReplyReq(BaseModel):
    mail_id: int

@app.post("/ai/smart-reply")
async def generate_smart_reply(payload: SmartReplyReq, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    mail = await db.get(models.Mail, payload.mail_id)
    if not mail or (mail.sender_id != current_user.id and mail.recipient_id != current_user.id):
        raise HTTPException(404, "Mail not found")
    
    # Simple history text block
    history = f"From: {mail.sender_email}\nSubject: {mail.subject}\n\n{mail.body}"
    suggestions = await ai_service.generate_chat_suggestions(current_user, history)
    return {"suggestions": suggestions}
