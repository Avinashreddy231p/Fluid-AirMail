from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# Many-to-many relationship association table between Mail and Tag
mail_tags = Table(
    "mail_tags",
    Base.metadata,
    Column("mail_id", Integer, ForeignKey("mails.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)



class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    public_key = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen  = Column(DateTime, default=datetime.utcnow)
    avatar_base64 = Column(Text, nullable=True)
    bio = Column(String, default="")
    is_admin = Column(Boolean, default=False)
    security_question = Column(String, nullable=True)
    security_answer = Column(String, nullable=True)
    
    ai_provider = Column(String, default="pollinations")
    ai_model = Column(String, nullable=True)
    openai_key = Column(String, nullable=True)
    ollama_url = Column(String, default="http://localhost:11434/v1")
    gemini_key = Column(String, nullable=True)
    default_tone = Column(String, default="professional")

    sent_mails     = relationship("Mail", foreign_keys="Mail.sender_id",    back_populates="sender")
    received_mails = relationship("Mail", foreign_keys="Mail.recipient_id", back_populates="recipient")


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    content = Column(Text, default="")
    tone = Column(String, default="professional")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mail_id = Column(Integer, ForeignKey("mails.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending") # pending, drafted, sent, dismissed
    trigger_date = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    mail = relationship("Mail")


class Mail(Base):
    """
    A mail message sent from one registered user to another (or an external address).
    - If recipient_id is set, the recipient is a registered MailNet user.
    - If recipient_id is None, recipient_email holds an external/unregistered address.
    """
    __tablename__ = "mails"

    id             = Column(Integer, primary_key=True, index=True)
    sender_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id   = Column(Integer, ForeignKey("users.id"), nullable=True)   # null = external
    recipient_email = Column(String, index=True)                              # always stored
    cc_emails      = Column(String, nullable=True)                            # JSON string of CCs
    bcc_emails     = Column(String, nullable=True)                            # JSON string of BCCs
    recipient_name  = Column(String, default="")
    subject        = Column(String, default="")
    body           = Column(Text, default="")
    starred        = Column(Boolean, default=False)
    read           = Column(Boolean, default=False)                           # for recipient
    category       = Column(String, default="inbox")
    status         = Column(String, default="sent")                           # sent, draft
    is_trashed     = Column(Boolean, default=False)
    attachment_url = Column(String, nullable=True)
    ai_summary     = Column(Text, nullable=True)
    parent_id      = Column(Integer, ForeignKey("mails.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)

    sender    = relationship("User", foreign_keys=[sender_id],    back_populates="sent_mails")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_mails")
    parent    = relationship("Mail", remote_side=[id])
    tags      = relationship("Tag", secondary=mail_tags, backref="mails")
    folder_associations = relationship("MailFolderAssociation", back_populates="mail", cascade="all, delete-orphan")


class Thread(Base):
    __tablename__ = "threads"

    id            = Column(Integer, primary_key=True, index=True)
    subject       = Column(String, index=True)
    is_chat       = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(JSON, default={})

    participants = relationship("ThreadParticipant", back_populates="thread")
    messages     = relationship("Message", back_populates="thread")


class ThreadParticipant(Base):
    __tablename__ = "thread_participants"

    id         = Column(Integer, primary_key=True, index=True)
    thread_id  = Column(Integer, ForeignKey("threads.id"))
    user_id    = Column(Integer, ForeignKey("users.id"))
    joined_at  = Column(DateTime, default=datetime.utcnow)

    thread = relationship("Thread", back_populates="participants")
    user   = relationship("User")


class Message(Base):
    __tablename__ = "messages"

    id                = Column(Integer, primary_key=True, index=True)
    thread_id         = Column(Integer, ForeignKey("threads.id"))
    sender_id         = Column(Integer, ForeignKey("users.id"))
    encrypted_content = Column(Text)
    nonce             = Column(String)
    tag               = Column(String)
    timestamp         = Column(DateTime, default=datetime.utcnow)
    status            = Column(String, default="sent")
    metadata_json     = Column(JSON, default={})

    thread = relationship("Thread", back_populates="messages")
    sender = relationship("User")



class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    action      = Column(String, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    resource_id = Column(String)
    timestamp   = Column(DateTime, default=datetime.utcnow)
    details     = Column(JSON, default={})

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    contact_email = Column(String, index=True)
    name = Column(String)
    nickname = Column(String, nullable=True)
    company = Column(String, nullable=True)
    dob = Column(String, nullable=True)
    birthday = Column(DateTime, nullable=True)  # New birthday field
    ai_graph = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id])


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete flag

    user = relationship("User")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete flag

    user = relationship("User")


class MailFolderAssociation(Base):
    __tablename__ = "mail_folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mail_id = Column(Integer, ForeignKey("mails.id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False)

    user = relationship("User")
    mail = relationship("Mail", back_populates="folder_associations")
    folder = relationship("Folder")

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    color = Column(String, default="#6366f1")
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    is_completed = Column(Boolean, default=False)
    due_date = Column(DateTime, nullable=True)
    priority = Column(String, default="medium")  # low, medium, high
    color = Column(String, default="#6366f1")     # hex color
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

class FilterRule(Base):
    __tablename__ = "filter_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    condition_type = Column(String, nullable=False) # 'from', 'subject_contains', 'has_attachment'
    condition_value = Column(String, default="")
    action_type = Column(String, nullable=False) # 'add_tag', 'move_to_trash', 'star'
    action_value = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
