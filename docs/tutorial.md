# Fluid AirMail — Comprehensive Engineering & Architecture Guide

Welcome to the comprehensive internal engineering manual for **Fluid AirMail**. This document is designed to give you, or anyone you are onboarding (or interviewing with), a complete, microscopic understanding of how this application is structured, why certain technologies were chosen, and exactly how the code executes under the hood.

---

## 1. System Architecture Overview

Fluid AirMail follows a decoupled **Client-Server Architecture**. 

- **Frontend (Client)**: A Single Page Application (SPA) built with React, TypeScript, and Vite. It manages its own state and routing, communicating with the backend exclusively via APIs.
- **Backend (Server)**: A Python-based API built with FastAPI. It handles business logic, database transactions, AI inference, and real-time socket connections.
- **Database (Storage)**: A local SQLite database (`fluidairmail.db`) managed via SQLAlchemy (an Object-Relational Mapper).
- **Vector Store (AI Memory)**: A local ChromaDB instance that stores mathematical representations (embeddings) of user emails for semantic search.

### Conceptual Data Flow
1. User clicks "Send Email" in React.
2. React sends a `POST /mail/send` HTTP request with a JSON payload and a `Bearer <JWT>` token.
3. FastAPI validates the token, extracts the sender's identity, and saves the email to SQLite via SQLAlchemy.
4. FastAPI identifies the recipient, and if they have an active `WebSocket` connection in the `ConnectionManager`, it pushes a `new_mail` event over the TCP socket.
5. The recipient's React client receives the socket event and updates the UI instantly, with zero page reloads.

---

## 2. Core Technologies & Implementation Details

### A. The Backend Engine: FastAPI & SQLAlchemy
**FastAPI** was chosen over Django or Flask because it is built entirely on Python's modern `async/await` syntax and Pydantic. 
- **Type Safety**: FastAPI strictly enforces data types. If a frontend sends a string instead of an integer for an ID, FastAPI instantly rejects it with a 422 Unprocessable Entity error before it even hits our logic.
- **Async ORM**: We use `SQLAlchemy` in asynchronous mode (`AsyncSession`). This means while the database is saving an email, the Python event loop can pause that function and handle another user's request. This makes the server highly concurrent.

### B. Relational Database Schema
Fluid AirMail simulates email routing using a closed relational database. Here is the core schema:
- **`users` table**: Stores `id`, `email`, `username`, and a heavily encrypted `hashed_password`.
- **`mails` table**: The core email structure. It links `sender_id` (Foreign Key) to `recipient_id` (Foreign Key). It stores the `subject`, `body`, and flags like `is_read` and `is_starred`.
- **`threads` & `messages` tables**: Used specifically for the Chat feature. A thread has multiple participants, and messages belong to a thread.

*Interview Concept*: By using Foreign Keys to internal user IDs, we bypass the need for external SMTP (Simple Mail Transfer Protocol) servers. Email delivery is instantaneous because it is just an `INSERT` statement in a database.

### C. Stateless Authentication (JSON Web Tokens)
**How it works**:
1. User submits email/password to `POST /login`.
2. The server hashes the password with `bcrypt` and compares it to the database.
3. If successful, the server generates a **JWT (JSON Web Token)**. This token contains the user's `ID` encoded within it, cryptographically signed with a `SECRET_KEY`.
4. The client saves this token in `localStorage` and attaches it to the `Authorization` header of every future request.

*Why it's interview-ready*: We use stateless authentication. The server does *not* store active sessions in the database. When a request comes in, the server simply runs a mathematical signature check on the token. If it matches, the server trusts it. This makes scaling horizontally (adding more servers) incredibly easy.

---

## 3. Deep Dive: Real-Time WebSockets Architecture

Previously, the app used **HTTP Polling**, asking the server "Do I have new mail?" every 5 seconds. We optimized this by ripping out polling and implementing **WebSockets**.

### Step-by-Step Execution:
1. **Connection**: Upon logging in, React creates a `new WebSocket(wsUrl)`. 
2. **Server Registry**: FastAPI accepts the connection on the `@app.websocket("/ws")` route. It decodes the JWT token to find the `user_id`, and adds the active socket to a Python dictionary: `active_connections[user_id] = [websocket]`.
3. **The Trigger**: When User A sends a chat to User B, the `send_chat` function writes the message to the database, and then executes:
   ```python
   await manager.send_personal_message({"type": "new_chat", "message": msg_data}, user_B_id)
   ```
4. **Client Ingestion**: React listens via `ws.onmessage`. When it receives the `new_chat` JSON, it dynamically updates the React state array, instantly rendering the message bubble.

---

## 4. Deep Dive: Artificial Intelligence & RAG Pipeline

Fluid AirMail features "Surya", an integrated AI assistant. Since Large Language Models (LLMs) like OpenAI or local models do not know the user's private emails, we implemented a **Retrieval-Augmented Generation (RAG)** pipeline.

### The RAG Workflow:
1. **Embedding**: Every time an email is sent, the text is passed through a sentence-transformer model (via `ai_service.py`). This converts the English text into an array of thousands of numbers (a high-dimensional vector) representing its semantic meaning.
2. **Vector Storage**: This vector is stored in **ChromaDB**.
3. **Querying**: When you ask Surya, "What did John say about the project?", the backend converts your question into a vector.
4. **Similarity Search**: ChromaDB calculates the cosine similarity between your question's vector and all email vectors, instantly finding the top 3 most mathematically similar emails.
5. **Context Injection**: The backend secretly injects those 3 emails into the prompt sent to the LLM: 
   *"Context: [Email 1], [Email 2]. Question: What did John say?"*
6. **Result**: Surya generates an accurate response based on your private inbox.

---

## 5. Frequently Asked Questions & Gotchas

**Q: Why don't we just use SQLite for the AI semantic search?**
A: Traditional SQL databases are optimized for exact keyword matches (e.g., `WHERE body LIKE '%project%'`). They cannot understand context or synonyms. Vector databases like ChromaDB perform nearest-neighbor mathematical searches, allowing the AI to find emails conceptually related to a query, even if exact keywords aren't used.

**Q: How does the Admin feature work?**
A: Fluid AirMail checks the `id` of the user. The absolute first user to ever register on the platform is assigned User ID 1. The frontend checks if `user.id === 1`, and if so, unlocks the Admin Dashboard, which queries raw aggregate stats (Total Users, Total Emails sent) from the backend.

**Q: What happens if the backend restarts? Do we lose WebSockets?**
A: Yes. Because the `ConnectionManager` dictionary is stored in the server's RAM (in-memory), restarting the backend severs all WebSocket connections. However, the React frontend is designed with robust error handling (`ws.onclose`) and will cleanly fail over or attempt to reconnect when the server comes back online. No data is lost because every message is safely committed to SQLite *before* the socket broadcast happens.

---

## 6. How to Scale This to 1 Million Users (Interview Answer)

If you are asked how you would take this architecture to the next level for an enterprise launch, here is the exact blueprint:

1. **Database Migration**: Upgrade SQLite to **PostgreSQL**. SQLite locks the entire database file during writes, which bottlenecks under heavy traffic. PostgreSQL handles concurrent writes beautifully.
2. **Stateless WebSockets**: Move the WebSocket `ConnectionManager` out of Python RAM and into **Redis Pub/Sub**. If you have 5 backend servers running, User A might be connected to Server 1, and User B to Server 2. Redis acts as a central nervous system to broadcast messages across all servers instantly.
3. **Blob Storage**: Move the local `/uploads` folder to **Amazon S3**. This prevents the backend servers' hard drives from filling up with user attachments and allows for faster serving via CDNs.
4. **Background Task Queues**: Move the AI embedding generation (which is CPU-intensive) out of the main FastAPI request cycle and into a background worker queue like **Celery** or **RabbitMQ**. This ensures the user's "Send" button reacts instantly without waiting for the AI to process the text.
