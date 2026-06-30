# MailNet — Advanced Secure Mail & Chat Network

![MailNet](https://img.shields.io/badge/MailNet-v1.0.0-3ea6ff?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

**MailNet** is a full-stack, end-to-end encrypted mail and chat application built for modern teams. It combines a high-performance **FastAPI** backend with a **React + TypeScript** frontend, offering AES-256-GCM message encryption, JWT-based authentication, and a premium dark-mode UI.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Secure Auth** | JWT bearer tokens (HS256), bcrypt password hashing, 30-minute token expiry |
| 🔒 **Encryption** | AES-256-GCM encryption for all message payloads |
| 📧 **Mail & Chat** | Unified inbox for both email-style threads and real-time chat messages |
| ⭐ **Star & Filter** | Star messages; filter by Inbox, Chats, Sent, Starred, or Snoozed |
| 🔍 **Search** | Live client-side search across sender, subject, and message body |
| ✏️ **Compose** | Modal compose window with animated send action |
| 👤 **User Profile** | Dropdown profile menu with logout, avatar, and custom bio |
| 🛡️ **Admin Panel**  | Dedicated dashboard for platform analytics and user management |
| 📋 **Audit Logging** | Database model for comprehensive audit trails |
| 🗄️ **Async DB** | SQLite (dev) via `aiosqlite` / pluggable to PostgreSQL via `asyncpg` |

---

## 🏗️ Architecture

```
Avi/
├── backend/                  # FastAPI Python server
│   ├── main.py               # API routes & lifespan management
│   ├── models.py             # SQLAlchemy ORM models
│   ├── database.py           # Async engine & session factory
│   ├── security.py           # JWT, bcrypt, AES-GCM helpers
│   ├── requirements.txt      # Python dependencies
│   └── mailnet.db            # SQLite database (auto-created)
│
├── frontend/                 # React + TypeScript (Vite)
│   ├── index.html            # HTML entry point (fonts, SEO)
│   └── src/
│       ├── main.tsx          # App entry & routing setup
│       ├── App.tsx           # Main dashboard (inbox, compose, search)
│       ├── AuthContext.tsx   # JWT auth state (Context + localStorage)
│       ├── ProtectedRoute.tsx# Route guard — redirects to /login
│       ├── Login.tsx         # Sign-in page
│       ├── Register.tsx      # Sign-up page
│       └── index.css         # Design system & component styles
│
├── run_backend.bat           # One-click backend starter (Windows)
└── run_frontend.bat          # One-click frontend starter (Windows)
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`

---

### 1 — Backend Setup

```powershell
# Navigate to backend
cd backend

# Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the API server
python -m uvicorn main:app --reload
```

The API will be available at **http://localhost:8000**

> **Tip:** Use the included `run_backend.bat` to start without activating the venv manually.

---

### 2 — Frontend Setup

```powershell
# Navigate to frontend
cd frontend

# Install npm packages
npm install

# Start the dev server
npm run dev
```

The UI will open at **http://localhost:5173**

> **Tip:** Use the included `run_frontend.bat` as a shortcut.

---

### 3 — Admin Account Setup

By default, the **very first user** to register on the platform is automatically granted **Admin** privileges.

For testing and demonstration purposes, a default admin account is seeded automatically:
- **Email:** `admin@mailnet.com`
- **Password:** `admin`

Once logged in, the Admin user will see a special "Shield" icon in the navigation bar to access the **Admin Analytics Dashboard**, which displays:
- Real-time active user metrics
- Total emails, chats, and exact words exchanged
- A complete user management directory

### 4 — One-Click Start (Windows)

Double-click `run_backend.bat` and `run_frontend.bat` (or run them in separate terminals).

---

## 📡 API Reference

All authenticated endpoints require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | ❌ | Health welcome message |
| `GET` | `/health` | ❌ | Server health check |
| `POST` | `/register` | ❌ | Register new user; returns JWT |
| `POST` | `/login` | ❌ | Authenticate; returns JWT |
| `GET` | `/users/me` | ✅ | Get current user profile |

### Register — `POST /register`

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "mysecretpass"
}
```

**Response `201`:**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

### Login — `POST /login`

```json
{
  "email": "john@example.com",
  "password": "mysecretpass"
}
```

**Response `200`:**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

### Get Profile — `GET /users/me`

**Response `200`:**
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com"
}
```

---

## 🗄️ Database Models

| Model | Purpose |
|---|---|
| `User` | Stores credentials, username, email, profile details, and `is_admin` flag |
| `Contact` | User's address book including nickname, company, and DOB |
| `Thread` | Mail/chat thread container (subject, is_chat flag, metadata) |
| `Message` | Encrypted message payload (AES-GCM nonce + ciphertext + tag) and attachment URLs |
| `AuditLog` | Full action audit trail (user, resource, action, timestamp) |

---

## 🔐 Security Details

- **Passwords** — hashed with `bcrypt` via `passlib`
- **JWT Tokens** — signed with HMAC-SHA256; 30-minute expiry
- **Message Encryption** — AES-256-GCM with random 96-bit nonces per message
- **CORS** — restricted to `localhost:5173` and `localhost:5174`

> ⚠️ **Production Note:** Replace `SECRET_KEY` in `security.py` with a cryptographically random value (e.g., `secrets.token_hex(32)`). Use a KMS for the AES key rather than the in-memory generated key.

---

## 🛠️ Development

### Build frontend for production

```powershell
cd frontend
npm run build
```

### Interactive API docs (Swagger UI)

Visit **http://localhost:8000/docs** while the backend is running.

### Run backend with auto-reload

```powershell
python -m uvicorn main:app --reload --port 8000
```

---

## 🗺️ Roadmap

- [ ] Real-time WebSocket chat
- [ ] Message threading & reply chains
- [ ] File attachments (end-to-end encrypted)
- [ ] Per-user public-key encryption (E2EE)
- [ ] PostgreSQL migration with Alembic
- [ ] Docker Compose deployment
- [ ] Mobile responsive design

---

## 📄 License

MIT © MailNet Contributors
