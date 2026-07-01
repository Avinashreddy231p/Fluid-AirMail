# Fluid AirMail — Advanced Secure Mail & Chat Network

<div align="center">
  <img alt="Fluid AirMail" src="https://img.shields.io/badge/Fluid_AirMail-v1.0.0-3ea6ff?style=flat-square">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi">
  <img alt="React" src="https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
</div>

<br />

> **Fluid AirMail** is a full-stack, end-to-end encrypted mail and chat application built for modern teams. It combines a high-performance backend with a modern React frontend, offering AES-256-GCM message encryption, JWT-based authentication, an AI-powered Action Center, WebRTC voice calling, and a premium dark-mode UI.

---

## 📸 Screenshots

*(Replace the placeholder URLs below with links to actual screenshots of your application)*

| Dashboard & Unified Inbox | AI Action Center |
| :---: | :---: |
| <img src="https://via.placeholder.com/600x350.png?text=Dashboard+Screenshot" alt="Dashboard" width="100%"> | <img src="https://via.placeholder.com/600x350.png?text=AI+Action+Center+Screenshot" alt="AI Center" width="100%"> |

| Secure Compose & Templates | Admin Analytics |
| :---: | :---: |
| <img src="https://via.placeholder.com/600x350.png?text=Compose+Mail+Screenshot" alt="Compose Mail" width="100%"> | <img src="https://via.placeholder.com/600x350.png?text=Admin+Analytics+Screenshot" alt="Admin Analytics" width="100%"> |

---

## ✨ Key Features

### 🧠 AI & Productivity
* **AI Action Center**: A global, floating AI assistant that can summarize long threads, find specific attachments, and answer questions about your inbox using semantic search.
* **Smart Compose**: Draft powerful emails using intelligent templates and AI tone adjustments (professional, casual, etc.).
* **Semantic Search**: Click the sparkle icon in the search bar to find emails by meaning, not just exact keywords.

### 🔒 Security & Privacy
* **Secure Auth**: JWT bearer tokens (HS256), bcrypt password hashing, and 30-minute token expiries.
* **End-to-End Encryption**: AES-256-GCM encryption is used for all message payloads (nonces, ciphertext, and tags).
* **Audit Logging**: Comprehensive database trails for critical platform actions.

### 📧 Mail & Communication
* **Unified Inbox**: View both standard email-style threads and real-time chat messages in a single interface.
* ****: Built-in peer-to-peer secure voice calling directly from the application.
* **Read Receipts**: Real-time status updates for sent messages.
* **Drafts, CC & BCC**: Fully featured mail composing with rich text, carbon copying, and draft saving.
* **Organization**: Star messages, filter by Inbox, Chats, Sent, Starred, or Snoozed, and manage your contacts book.

### 🎨 User Experience
* **Interactive Walkthrough**: A dynamic, step-by-step React Joyride tour that guides new users through the application's core features.
* **Premium Design**: Built with Tailwind CSS featuring a sleek, responsive, and glassmorphic dark-mode aesthetic.
* **Admin Dashboard**: Dedicated portal for platform analytics, active user metrics, and user management.

---

## 🚀 Technologies Used

### Frontend
* **React 18** (UI Library)
* **TypeScript** (Static Typing)
* **Vite** (Build Tool & Dev Server)
* **Tailwind CSS** (Utility-first Styling - Custom Design System)
* **React Joyride** (Interactive Feature Tours)
* **Lucide React** (Beautiful Iconography)

### Backend
* **Python 3.11** (Core Language)
* **FastAPI** (High-performance Async Web Framework)
* **Uvicorn** (ASGI Web Server)
* **SQLAlchemy & aiosqlite** (Async Database ORM)
* **Passlib & bcrypt** (Password Hashing)
* **PyJWT** (Stateless Authentication)
* **Cryptography (AES-256-GCM)** (End-to-End Encryption)

### Infrastructure
* **Docker & Docker Compose** (Containerization & Orchestration)
* **Nginx** (Production Frontend Web Server)
* **SQLite** (Persistent Database Storage, pluggable to PostgreSQL)

---

## 🏗️ Architecture

```text
Fluid AirMail/
├── backend/                  # FastAPI Python server
│   ├── main.py               # API routes & lifespan management
│   ├── models.py             # SQLAlchemy ORM models
│   ├── database.py           # Async engine & session factory
│   ├── security.py           # JWT, bcrypt, AES-GCM helpers
│   ├── ai_service.py         # Semantic Search & LLM integration
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Backend container configuration
│   └── mailnet.db            # SQLite database (auto-created)
│
├── frontend/                 # React + TypeScript (Vite)
│   ├── index.html            # HTML entry point (fonts, SEO)
│   ├── Dockerfile            # Frontend container (Multi-stage + Nginx)
│   ├── nginx.conf            # Nginx server configuration for routing
│   └── src/
│       ├── App.tsx           # Main dashboard (inbox, compose, search, calling)
│       ├── AuthContext.tsx   # JWT auth state (Context + localStorage)
│       └── index.css         # Design system & component styles
│
├── docker-compose.yml        # Orchestration for Backend, Frontend, and Volumes
├── run_backend.bat           # One-click backend starter (Windows)
└── run_frontend.bat          # One-click frontend starter (Windows)
```

---

## 🚀 Getting Started

### Method 1: Docker Deployment (Recommended)
You can launch the entire application with a single command if you have **Docker Desktop** installed.

```powershell
# Build and run the containers in detached mode
docker compose up -d --build
```
* **Frontend UI:** `http://localhost`
* **Backend API:** `http://localhost:8000`

---

### Method 2: Local Development Setup

**Prerequisites:** Python 3.10+ and Node.js 18+

#### 1 — Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload
```
> **Tip:** Use the included `run_backend.bat` to start without activating the venv manually.

#### 2 — Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
> **Tip:** Use the included `run_frontend.bat` as a shortcut.

---

### Admin Account Setup

By default, the **very first user** to register on the platform is automatically granted **Admin** privileges.

For testing and demonstration purposes, a default admin account is seeded automatically:
- **Email:** `admin@mailnet.com`
- **Password:** `admin`

Once logged in, the Admin user will see a special "Shield" icon in the navigation bar to access the **Admin Analytics Dashboard**.

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
| `GET` | `/mails` | ✅ | Fetch unified inbox & chats |

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
- **CORS** — securely scoped configuration compatible with Docker environments

> ⚠️ **Production Note:** Replace `SECRET_KEY` in `security.py` with a cryptographically random value (e.g., `secrets.token_hex(32)`). Use a KMS for the AES key rather than the in-memory generated key.

---

## 🗺️ Roadmap

- [x] Docker Compose deployment
- [x] Message threading & reply chains
- [x] Interactive UI walkthroughs
- [x] Semantic AI search & summaries
- [ ] Real-time WebSocket chat fallback
- [ ] File attachments (end-to-end encrypted storage)
- [ ] Per-user public-key encryption (E2EE)
- [ ] PostgreSQL migration with Alembic
- [x] Mobile responsive design

---

## 📄 License

MIT © Fluid AirMail Contributors
