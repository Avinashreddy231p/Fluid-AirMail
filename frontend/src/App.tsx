import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Inbox, MessageSquare, Star, Settings as SettingsIcon, Shield, Search, Plus, 
  Users, Mail, Layers, Sun, LogOut, X, 
  RefreshCw, Loader2, ArrowLeft, Reply, Forward, Trash2, UserPlus, Check, 
  AlertCircle, Wifi, Folder, FolderPlus, Tag as TagIcon, Paperclip, ChevronLeft, Sparkles,
  Zap, FileText, Clock, Calendar as CalendarIcon, CheckSquare, CheckCircle
} from 'lucide-react';
import { useAuth } from './AuthContext';
import ChatView, { Conversation, ContactHint } from './ChatView';
import SettingsView from './SettingsView';
import AdminView from './AdminView';
import AiActionCenter, { Message as AiMessage } from './AiActionCenter';
import { Joyride, Step } from 'react-joyride';
import LibraryView from './LibraryView';
import ActionDashboard from './ActionDashboard';
import TemplatesView from './TemplatesView';
import { useShortcuts } from './useShortcuts';
import {
  AttachmentBubble,
  ComposeAttachment,
  AttachmentPreviewProvider,
  useAttachmentPreview,
  detectAttachmentType,
  getFileName,
} from './AttachmentPreview';
// unused import removed
import ReactMarkdown from 'react-markdown';
import EcosystemPanel from './EcosystemPanel';
import CalendarView from './CalendarView';
import TasksView from './TasksView';
import NotesView from './NotesView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio?: string;
  avatar_base64?: string;
  is_admin?: boolean;
}

type Section = string;

export interface TagCategory {
  id: number;
  name: string;
  color: string;
}

export interface MailFolder {
  id: number;
  name: string;
}

interface MailMessage {
  id: number;
  fromMe: boolean;
  sender: string;
  senderEmail: string;
  to: string;
  toEmail: string;
  subject: string;
  snippet: string;
  body: string;
  time: string;
  color: string;
  starred: boolean;
  read: boolean;
  category?: string;
  is_trashed?: boolean;
  tags?: TagCategory[];
  folder_id?: number | null;
  attachment_url?: string;
  attachment_urls?: string[];
  ai_summary?: string;
}

interface Contact {
  id: number;
  name: string;
  email: string;
  nickname?: string;
  company?: string;
  dob?: string;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = (import.meta as any).env.VITE_API_URL || 'http://127.0.0.1:8000';

const AVATAR_COLORS = [
  '#3ea6ff', '#ea4335', '#34a853', '#fbbc05', '#ab47bc',
  '#ef5350', '#26a69a', '#ec407a', '#5c6bc0', '#ff7043',
];

function colorFor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hexToRgb(hex: string): string {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}

// Convert a backend MailOut object to our frontend MailMessage
function apiMailToMsg(m: any, _myId: number): MailMessage {
  return {
    id: m.id,
    fromMe: m.from_me,
    sender: m.sender_name,
    senderEmail: m.sender_email,
    to: m.to_name,
    toEmail: m.to_email,
    subject: m.subject,
    snippet: m.snippet,
    body: m.body,
    time: m.time,
    color: colorFor(m.from_me ? m.to_name : m.sender_name),
    starred: m.starred,
    read: m.read,
    category: m.category || 'primary',
    is_trashed: m.is_trashed || false,
    tags: m.tags || [],
    folder_id: m.folder_id || null,
    attachment_urls: m.attachment_urls || [],
    ai_summary: m.ai_summary,
  };
}

const playSystemNotification = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
  
  if ('vibrate' in navigator) {
    navigator.vibrate(150);
  }
};

// ─── Compose Modal ────────────────────────────────────────────────────────────

interface ComposeTemplate {
  id: number;
  name: string;
  content: string;
  tone: string;
}

interface ComposeProps {
  onClose: () => void;
  onSend: (to: string, toEmail: string, subject: string, body: string, attachmentUrls?: string[]) => Promise<void>;
  prefillToEmail?: string;
  prefillSubject?: string;
  prefillBody?: string;
  contacts: Contact[];
  token: string;
}

function ComposeModal({ onClose, onSend, prefillToEmail = '', prefillSubject = '', prefillBody = '', contacts, token }: ComposeProps) {
  const [toInput, setToInput] = useState(prefillToEmail);
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState(prefillSubject);
  const [body, setBody] = useState(prefillBody);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [apiSuggestions, setApiSuggestions] = useState<{ id: number; username: string; email: string }[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  // ── Attachment state ──
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const suggTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showAiTools, setShowAiTools] = useState(false);
  const [fetchingAi, setFetchingAi] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<ComposeTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showFollowUpOption, setShowFollowUpOption] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(3);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // Load templates
  useEffect(() => {
    const loadTmpl = async () => {
      try {
        const res = await fetch(`${API}/templates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setTemplates(await res.json());
      } catch {}
    };
    loadTmpl();
  }, [token]);

  // Close template dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node))
        setShowTemplateDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyTemplate = async (tmpl: ComposeTemplate, customTone?: string) => {
    setShowTemplateDropdown(false);
    setFetchingAi(true);
    try {
      const res = await fetch(`${API}/ai/draft-from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template_id: tmpl.id,
          placeholders: { "recipient_name": toName || toInput.split('@')[0] || "there" },
          tone: customTone || tmpl.tone,
          context: subject || body ? `Subject: ${subject}\nBody: ${body}` : undefined
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subject) setSubject(data.subject);
        if (data.body) setBody(data.body);
      }
    } catch (e) {
      console.error('Failed to apply template', e);
      setBody(tmpl.content); // fallback
    } finally {
      setFetchingAi(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (aiRef.current && !aiRef.current.contains(e.target as Node)) setShowAiTools(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleShortcutSend = () => {
      handleSend();
    };
    window.addEventListener('shortcuts-send', handleShortcutSend);
    return () => window.removeEventListener('shortcuts-send', handleShortcutSend);
  }); // Run on every render so it captures the latest handleSend closure state

  const applyAiTool = async (toolType: string) => {
    if (!body.trim()) return;
    setFetchingAi(true);
    setShowAiTools(false);
    try {
      const res = await fetch(`${API}/ai/mail-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tool_type: toolType, text: body })
      });
      if (res.ok) {
        const data = await res.json();
        setBody(data.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingAi(false);
    }
  };

  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = document.getElementById('compose-body-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end, text.length);
    setBody(before + prefix + selected + suffix + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };


  useEffect(() => {
    if (prefillToEmail) {
      const match = contacts.find(c => c.email === prefillToEmail);
      if (match) setToName(match.name);
    }
  }, [prefillToEmail, contacts]);

  useEffect(() => {
    const q = toInput.trim().toLowerCase();
    if (!q || toInput === prefillToEmail) { setSuggestions([]); setApiSuggestions([]); setShowSugg(false); return; }

    const local = contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
    setSuggestions(local);

    if (suggTimer.current) clearTimeout(suggTimer.current);
    suggTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const filtered = data.filter((u: any) => !local.find(c => c.email === u.email));
          setApiSuggestions(filtered);
        }
      } catch { /* offline */ }
    }, 300);

    setShowSugg(true);
    return () => { if (suggTimer.current) clearTimeout(suggTimer.current); };
  }, [toInput, contacts, prefillToEmail, token]);

  const selectContact = (name: string, email: string) => {
    setToInput(email);
    setToName(name);
    setShowSugg(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(async file => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${API}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          return data.url;
        }
        return null;
      }));
      setAttachments(prev => [...prev, ...urls.filter(u => u)]);
    } catch { /* offline */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const email = toInput.trim();
    if (!email || (!body.trim() && !attachments.length)) { setError('Recipient and message body are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }

    setSending(true);
    try {
      const name = toName || contacts.find(c => c.email === email)?.name || email.split('@')[0];
      await onSend(name, email, subject, body, attachments.length > 0 ? attachments : undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const allSugg = [
    ...suggestions.map(c => ({ name: c.name, email: c.email, isRegistered: true })),
    ...apiSuggestions.map(u => ({ name: u.username, email: u.email, isRegistered: true })),
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      padding: '16px',
    }} className="animate-fade-in">
      <div className="animate-scale-in" style={{
        background: 'var(--color-background-elevated)',
        border: '1px solid var(--color-border-premium)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        width: '100%', maxWidth: '580px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-divider)',
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-primary)', fontSize: '15px', fontWeight: 500, fontFamily: 'inherit',
            padding: '4px 0',
          }}>Cancel</button>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)' }}>New Message</h2>
          <button
            type="submit" form="compose-form" disabled={sending}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
              padding: '4px 0',
              opacity: sending ? 0.5 : 1,
            }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : 'Send'}
          </button>
        </div>

        {/* Form */}
        <form id="compose-form" onSubmit={handleSend} noValidate style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {error && (
            <div style={{
              margin: '12px 20px 0', padding: '10px 14px',
              background: 'rgba(255, 59, 48, 0.08)', borderRadius: 'var(--radius-sm)',
              fontSize: '13px', color: 'var(--color-danger)',
              display: 'flex', alignItems: 'center', gap: '8px',
              flexShrink: 0,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* To field */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 20px',
              borderBottom: '1px solid var(--color-divider)',
              minHeight: '44px',
            }}>
              <span style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)', marginRight: '8px', flexShrink: 0 }}>To:</span>
              <input
                ref={toRef}
                type="text"
                placeholder="Email address or name…"
                value={toInput}
                onChange={e => { setToInput(e.target.value); setToName(''); setError(''); }}
                onFocus={() => allSugg.length > 0 && setShowSugg(true)}
                autoComplete="off"
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: '15px', color: 'var(--color-foreground)',
                  outline: 'none', padding: '12px 0', fontFamily: 'inherit',
                }}
              />
            </div>
            {showSugg && allSugg.length > 0 && (
              <div className="animate-slide-down" style={{
                position: 'absolute', top: '100%', left: '0', right: '0',
                background: 'var(--color-background-elevated)',
                borderBottom: '1px solid var(--color-divider)',
                boxShadow: 'var(--shadow-md)',
                maxHeight: '200px', overflowY: 'auto', zIndex: 10,
              }}>
                {allSugg.map((s, i) => (
                  <button
                    key={i} type="button"
                    style={{
                      display: 'flex', alignItems: 'center', width: '100%', gap: '12px',
                      padding: '10px 20px', border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      borderBottom: i < allSugg.length - 1 ? '1px solid var(--color-divider)' : 'none',
                      transition: 'background 0.12s',
                    }}
                    onMouseDown={() => selectContact(s.name, s.email)}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: colorFor(s.name), display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0,
                    }}>{s.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>{s.email}</div>
                    </div>
                    {s.isRegistered && <Wifi size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0 20px',
            borderBottom: '1px solid var(--color-divider)',
            minHeight: '44px', flexShrink: 0,
          }}>
            <span style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)', marginRight: '8px', flexShrink: 0 }}>Subject:</span>
            <input
              type="text"
              placeholder="Message subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: '15px', color: 'var(--color-foreground)',
                outline: 'none', padding: '12px 0', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Body */}
          <textarea
            id="compose-body-textarea"
            placeholder="Write your message…"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: '15px', color: 'var(--color-foreground)',
              outline: 'none', padding: '16px 20px', fontFamily: 'inherit',
              resize: 'none', lineHeight: 1.5,
              minHeight: '160px', overflowY: 'auto',
            }}
          />

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div style={{ padding: '4px 20px 8px', flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {attachments.map((att, idx) => (
                <ComposeAttachment key={idx} url={att} onRemove={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} />
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px',
            borderTop: '1px solid var(--color-divider)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              onClick={() => insertFormatting('**')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 10px', borderRadius: '100px',
                background: 'var(--color-background-secondary)',
                border: '1px solid var(--color-divider)',
                color: 'var(--color-foreground-secondary)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.12s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
              title="Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 10px', borderRadius: '100px',
                background: 'var(--color-background-secondary)',
                border: '1px solid var(--color-divider)',
                color: 'var(--color-foreground-secondary)',
                fontSize: '13px', fontStyle: 'italic', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.12s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
              title="Italic"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('__')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 10px', borderRadius: '100px',
                background: 'var(--color-background-secondary)',
                border: '1px solid var(--color-divider)',
                color: 'var(--color-foreground-secondary)',
                fontSize: '13px', textDecoration: 'underline', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.12s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
              title="Underline"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('~~')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 10px', borderRadius: '100px',
                background: 'var(--color-background-secondary)',
                border: '1px solid var(--color-divider)',
                color: 'var(--color-foreground-secondary)',
                fontSize: '13px', textDecoration: 'line-through', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.12s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
              title="Strikethrough"
            >
              S
            </button>
            <div style={{ width: '1px', height: '16px', background: 'var(--color-divider)', margin: '0 4px' }} />
            
            <div style={{ position: 'relative' }} ref={aiRef}>
              <button
                type="button"
                onClick={() => setShowAiTools(!showAiTools)}
                disabled={fetchingAi || !body.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '100px',
                  background: 'var(--color-primary-light)',
                  border: '1px solid var(--color-primary-light)',
                  color: 'var(--color-primary)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.12s, opacity 0.12s',
                  opacity: (fetchingAi || !body.trim()) ? 0.5 : 1,
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                title="Apple Intelligence Tools"
              >
                {fetchingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Writing Tools
              </button>
              {showAiTools && (
                <div className="animate-scale-in" style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px',
                  background: 'var(--color-background-elevated)',
                  border: '1px solid var(--color-divider)',
                  borderRadius: '16px', boxShadow: 'var(--shadow-xl)',
                  padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
                  minWidth: '200px', zIndex: 100,
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-foreground-secondary)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apple Intelligence</div>
                  {[
                    { id: 'professional', label: 'Make Professional' },
                    { id: 'friendly', label: 'Make Friendly' },
                    { id: 'expand', label: 'Expand Details' },
                    { id: 'suggest', label: 'Suggest Reply' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyAiTool(t.id)}
                      style={{
                        padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent',
                        textAlign: 'left', fontSize: '14px', color: 'var(--color-foreground)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: '1px', height: '16px', background: 'var(--color-divider)', margin: '0 4px' }} />

            {/* Template Picker */}
            <div style={{ position: 'relative' }} ref={templateDropdownRef}>
              <button
                type="button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 12px', borderRadius: '100px',
                  background: 'var(--color-background-secondary)',
                  border: '1px solid var(--color-divider)',
                  color: 'var(--color-foreground-secondary)',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.12s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
                onMouseOut={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                title="Use Template"
              >
                <FileText size={14} />
                Template
              </button>
              {showTemplateDropdown && (
                <div className="animate-scale-in" style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px',
                  background: 'var(--color-background-elevated)',
                  border: '1px solid var(--color-divider)',
                  borderRadius: '16px', boxShadow: 'var(--shadow-xl)',
                  padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
                  minWidth: '220px', maxHeight: '250px', overflowY: 'auto', zIndex: 100,
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-foreground-secondary)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Templates</div>
                  {templates.length === 0 ? (
                    <div style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--color-foreground-secondary)', textAlign: 'center' }}>
                      No templates yet
                    </div>
                  ) : (
                    templates.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => applyTemplate(t)}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent',
                            textAlign: 'left', fontSize: '14px', color: 'var(--color-foreground)',
                            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
                            display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                          title={`Draft with default tone (${t.tone})`}
                        >
                          <span style={{ fontSize: '12px' }}>{t.tone === 'professional' ? '💼' : t.tone === 'friendly' ? '😊' : t.tone === 'sales' ? '📈' : '📋'}</span>
                          {t.name}
                        </button>
                        <select 
                          className="ios-input"
                          style={{ padding: '4px 8px', fontSize: '11px', height: '26px', borderRadius: '6px', width: '80px' }}
                          onChange={(e) => {
                            if (e.target.value) {
                              applyTemplate(t, e.target.value);
                              e.target.value = ""; // reset
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Tone...</option>
                          <option value="professional">Professional</option>
                          <option value="friendly">Friendly</option>
                          <option value="formal">Formal</option>
                          <option value="casual">Casual</option>
                          <option value="sales">Sales</option>
                        </select>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Follow-Up Reminder */}
            <button
              type="button"
              onClick={() => setShowFollowUpOption(!showFollowUpOption)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '100px',
                background: showFollowUpOption ? 'var(--color-primary-light)' : 'var(--color-background-secondary)',
                border: `1px solid ${showFollowUpOption ? 'var(--color-primary-light)' : 'var(--color-divider)'}`,
                color: showFollowUpOption ? 'var(--color-primary)' : 'var(--color-foreground-secondary)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = showFollowUpOption ? 'var(--color-primary-light)' : 'var(--color-foreground-quaternary)')}
              onMouseOut={e => (e.currentTarget.style.background = showFollowUpOption ? 'var(--color-primary-light)' : 'var(--color-background-secondary)')}
              title={showFollowUpOption ? `Reminder set: ${followUpDays} days` : 'Set follow-up reminder'}
            >
              <Clock size={14} />
              {showFollowUpOption ? `${followUpDays}d` : 'Remind'}
            </button>

            {showFollowUpOption && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                {[1, 3, 7, 14].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFollowUpDays(d)}
                    style={{
                      padding: '4px 8px', borderRadius: '6px', border: 'none',
                      background: followUpDays === d ? 'var(--color-primary)' : 'var(--color-background-secondary)',
                      color: followUpDays === d ? '#fff' : 'var(--color-foreground-secondary)',
                      fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.12s',
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            )}

            <div style={{ width: '1px', height: '16px', background: 'var(--color-divider)', margin: '0 4px' }} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '100px',
                background: 'var(--color-background-secondary)',
                border: '1px solid var(--color-divider)',
                color: 'var(--color-foreground-secondary)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.12s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
              title="Attach file"
            >
              {uploading
                ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                : <Paperclip size={14} />}
              Attach File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.7z,.txt,.md,.js,.ts,.py"
              onChange={handleUpload}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Toast notification ────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const isError = message.toLowerCase().includes('fail') || message.toLowerCase().includes('error');
  const isSuccess = message.toLowerCase().includes('success') || message.includes('✅');
  
  const Icon = isError ? AlertCircle : isSuccess ? CheckCircle : Mail;
  const color = isError ? 'var(--color-danger, #ef4444)' : isSuccess ? 'var(--color-success, #10b981)' : 'var(--color-primary)';
  const bg = isError ? 'rgba(239, 68, 68, 0.1)' : isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-primary-light)';

  return (
    <div className="toast-notification" onClick={onDismiss} style={{
      border: `1px solid ${color}40`,
      boxShadow: `0 8px 32px -8px ${color}30`
    }}>
      <div style={{
        background: bg,
        color: color,
        padding: '8px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={18} />
      </div>
      <span style={{ flex: 1, fontWeight: 500, letterSpacing: '-0.01em' }}>{message.replace(/^(✅|❌|⏰|📅)\s*/, '')}</span>
      <button className="toast-close"><X size={14} /></button>
    </div>
  );
}

// ─── Tag Dropdown Editor ──────────────────────────────────────────────────────

interface TagDropdownEditorProps {
  currentTagIds: number[];
  allTags: TagCategory[];
  onUpdate: (tagIds: number[]) => Promise<void>;
}

function TagDropdownEditor({ currentTagIds, allTags, onUpdate }: TagDropdownEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTag = (id: number) => {
    if (currentTagIds.includes(id)) {
      onUpdate(currentTagIds.filter(t => t !== id));
    } else {
      onUpdate([...currentTagIds, id]);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        style={{
          padding: '6px', borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'transparent', display: 'flex', alignItems: 'center',
          color: currentTagIds.length > 0 ? 'var(--color-primary)' : 'var(--color-foreground-secondary)',
          transition: 'background 0.12s',
        }}
        onClick={() => setIsOpen(!isOpen)}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-tertiary)')}
        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
      >
        <TagIcon size={18} />
      </button>
      {isOpen && (
        <div className="animate-slide-down" style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          width: '200px', background: 'var(--color-background-elevated)',
          border: '1px solid var(--color-divider)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden', zIndex: 100,
        }}>
          {allTags.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>No categories</div>
          ) : (
            allTags.map(tag => (
              <button key={tag.id} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 16px', fontSize: '14px', border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                color: 'var(--color-foreground)', fontFamily: 'inherit',
                borderBottom: '1px solid var(--color-divider)',
                transition: 'background 0.12s',
              }}
              onClick={() => toggleTag(tag.id)}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{tag.name}</span>
                {currentTagIds.includes(tag.id) && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Folder Mover Dropdown ────────────────────────────────────────────────────

interface FolderMoverDropdownProps {
  currentFolderId?: number | null;
  allFolders: MailFolder[];
  onMove: (folderId: number | null) => Promise<void>;
}

function FolderMoverDropdown({ currentFolderId, allFolders, onMove }: FolderMoverDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectFolder = (id: number | null) => { onMove(id); setIsOpen(false); };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        style={{
          padding: '6px', borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'transparent', display: 'flex', alignItems: 'center',
          color: currentFolderId ? 'var(--color-primary)' : 'var(--color-foreground-secondary)',
          transition: 'background 0.12s',
        }}
        onClick={() => setIsOpen(!isOpen)}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-tertiary)')}
        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
      >
        <FolderPlus size={18} />
      </button>
      {isOpen && (
        <div className="animate-slide-down" style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          width: '200px', background: 'var(--color-background-elevated)',
          border: '1px solid var(--color-divider)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden', zIndex: 100,
        }}>
          <button style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 16px', fontSize: '14px', border: 'none',
            background: 'transparent', cursor: 'pointer', textAlign: 'left',
            color: 'var(--color-foreground)', fontFamily: 'inherit',
            borderBottom: '1px solid var(--color-divider)', transition: 'background 0.12s',
          }}
          onClick={() => selectFolder(null)}
          onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Inbox size={14} />
            <span style={{ flex: 1 }}>Default Feed</span>
            {currentFolderId === null && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
          </button>
          {allFolders.map(folder => (
            <button key={folder.id} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 16px', fontSize: '14px', border: 'none',
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
              color: 'var(--color-foreground)', fontFamily: 'inherit',
              borderBottom: '1px solid var(--color-divider)', transition: 'background 0.12s',
            }}
            onClick={() => selectFolder(folder.id)}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Folder size={14} />
              <span style={{ flex: 1 }}>{folder.name}</span>
              {currentFolderId === folder.id && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Message Detail Panel ─────────────────────────────────────────────────────

interface DetailPanelProps {
  API: string;
  token: string;
  message: MailMessage;
  contacts: Contact[];
  allTags: TagCategory[];
  allFolders: MailFolder[];
  onAddContact: (c: Omit<Contact, 'id' | 'color'>) => Promise<void>;
  onClose: () => void;
  onStar: (id: number, starred: boolean) => void;
  onDelete: (id: number) => void;
  onReply: (email: string, bodyText?: string) => void;
  onForward: (subject: string, body: string) => void;
  onUpdateMailTags: (mailId: number, tagIds: number[]) => Promise<void>;
  onUpdateMailFolder: (mailId: number, folderId: number | null) => Promise<void>;
}

function MessageDetailPanel({
  message, contacts, allTags, allFolders, onAddContact, onClose, onStar, onDelete, onReply, onForward,
  onUpdateMailTags, onUpdateMailFolder, API, token
}: DetailPanelProps) {
  const isSent = message.fromMe;
  const displayName  = isSent ? message.to : message.sender;
  const displayEmail = isSent ? message.toEmail : message.senderEmail;
  const displayColor = colorFor(displayName);

  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);

  useEffect(() => {
    if (!isSent && message.body) {
      fetch(`${API}/ai/smart-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: message.body })
      }).then(res => res.json()).then(data => {
         setSmartReplies(data.suggestions || []);
      }).catch(e => console.error(e));
    } else {
      setSmartReplies([]);
    }
  }, [message.id, isSent, message.body, API, token]);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const res = await fetch(`${API}/ai/mail/summarize/${message.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="animate-slide-in-right" style={{
      flex: 1, overflowY: 'auto',
      background: 'var(--color-background)',
      borderLeft: '1px solid var(--color-divider)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Sticky header */}
      <div className="ios-blur" style={{
        position: 'sticky', top: 0, zIndex: 30,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-divider)',
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '6px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'transparent', display: 'flex', alignItems: 'center',
            color: 'var(--color-primary)', transition: 'background 0.12s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-tertiary)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isSent && (
            <span style={{
              padding: '3px 10px', fontSize: '12px', fontWeight: 600,
              color: 'var(--color-primary)', background: 'var(--color-primary-light)',
              borderRadius: '100px',
            }}>Sent</span>
          )}
          <FolderMoverDropdown currentFolderId={message.folder_id} allFolders={allFolders} onMove={folderId => onUpdateMailFolder(message.id, folderId)} />
          <TagDropdownEditor currentTagIds={(message.tags || []).map(t => t.id)} allTags={allTags} onUpdate={tagIds => onUpdateMailTags(message.id, tagIds)} />
          <button
            style={{
              padding: '6px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'transparent', display: 'flex', alignItems: 'center',
              transition: 'background 0.12s',
            }}
            onClick={() => onStar(message.id, !message.starred)}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-tertiary)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Star size={18} style={{ color: message.starred ? 'var(--color-warning)' : 'var(--color-foreground-secondary)' }} fill={message.starred ? 'currentColor' : 'none'} />
          </button>
          <button
            style={{
              padding: '6px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'transparent', display: 'flex', alignItems: 'center',
              color: 'var(--color-danger)', transition: 'background 0.12s',
            }}
            onClick={() => { onDelete(message.id); onClose(); }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,59,48,0.08)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', width: '100%', padding: '28px 24px' }}>
        <h1 style={{
          fontSize: '28px', fontWeight: 700,
          color: 'var(--color-foreground)',
          letterSpacing: '-0.02em', lineHeight: 1.2,
          marginBottom: '12px',
        }}>{message.subject || '(No Subject)'}</h1>

        {message.tags && message.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {message.tags.map(t => (
              <span key={t.id} style={{
                padding: '4px 12px', borderRadius: '100px',
                fontSize: '13px', fontWeight: 500,
                background: `rgba(${hexToRgb(t.color)}, 0.12)`,
                color: t.color,
              }}>{t.name}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: displayColor, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '18px', flexShrink: 0,
          }}>{displayName.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div>
                <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)' }}>
                  {isSent ? `To: ${displayName}` : displayName}
                </span>
                <span style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)', marginLeft: '6px' }}>
                  &lt;{displayEmail}&gt;
                </span>
              </div>
              <span style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)', flexShrink: 0 }}>{message.time}</span>
            </div>
            {isSent && (
              <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)', marginBottom: '4px' }}>
                From: {message.sender} &lt;{message.senderEmail}&gt;
              </div>
            )}

            {/* AI Summarize Button & Box */}
            <div style={{ marginTop: '16px', marginBottom: '8px' }}>
              {!summary && !isSummarizing ? (
                <button
                  onClick={handleSummarize}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--color-divider)',
                    background: 'var(--color-background-secondary)', color: 'var(--color-foreground)',
                    fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
                    cursor: 'pointer', transition: 'border 0.12s'
                  }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--color-divider)')}
                >
                  <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
                  Summarize Email
                </button>
              ) : isSummarizing ? (
                <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-foreground-secondary)' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span style={{ fontSize: '14px' }}>Analyzing...</span>
                </div>
              ) : (
                <div style={{
                  padding: '16px', borderRadius: '12px', background: 'var(--color-primary-light)',
                  border: '1px solid rgba(0, 122, 255, 0.15)', display: 'flex', gap: '12px'
                }}>
                  <Sparkles size={20} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      AI Summary
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--color-foreground)', lineHeight: 1.5 }}>
                      {summary}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mail body with markdown */}
            <div className="markdown-body" style={{
              fontSize: '17px', color: 'var(--color-foreground)',
              lineHeight: 1.6, marginTop: '20px',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              <ReactMarkdown>{message.body}</ReactMarkdown>
            </div>

            {/* Attachments */}
            {message.attachment_urls && message.attachment_urls.length > 0 && (
              <div style={{ marginTop: '20px', marginBottom: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-foreground-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {message.attachment_urls.length > 1 ? 'Attachments' : 'Attachment'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {message.attachment_urls.map((url, idx) => (
                    <MailAttachmentBlock key={idx} url={url} hideTitle />
                  ))}
                </div>
              </div>
            )}
            
            {smartReplies.length > 0 && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {smartReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => onReply(message.senderEmail, reply)}
                    style={{
                      padding: '8px 16px', borderRadius: '100px',
                      background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                      border: '1px solid rgba(0, 122, 255, 0.15)',
                      fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(0, 122, 255, 0.15)'}
                    onMouseOut={e => e.currentTarget.style.background = 'var(--color-primary-light)'}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
            
            {/* Action buttons */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginTop: '16px', paddingTop: '20px',
              borderTop: '1px solid var(--color-divider)',
            }}>
              {!isSent && (
                <button className="ios-button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => onReply(message.senderEmail)}>
                  <Reply size={16} /> Reply
                </button>
              )}
              <button 
                className="ios-button-secondary" 
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--color-foreground-quaternary)',
                  color: 'var(--color-foreground)',
                }}
                onClick={() => onForward(message.subject, message.body)}
              >
                <Forward size={16} /> Forward
              </button>
              {!contacts.some(c => c.email.toLowerCase() === displayEmail.toLowerCase()) && (
                <button
                  className="ios-button-secondary"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'var(--color-foreground-quaternary)',
                    color: 'var(--color-foreground)',
                    marginLeft: 'auto',
                  }}
                  onClick={() => onAddContact({ name: displayName, email: displayEmail })}
                >
                  <UserPlus size={16} /> Add Contact
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mail Attachment Block ────────────────────────────────────────────────────
// Wraps AttachmentBubble inside the mail detail panel with preview context

function MailAttachmentBlock({ url, hideTitle = false }: { url: string; hideTitle?: boolean }) {
  const { openPreview } = useAttachmentPreview();
  const type = detectAttachmentType(url);
  const name = getFileName(url);
  return (
    <div style={hideTitle ? {} : { marginTop: '20px', marginBottom: '4px' }}>
      {!hideTitle && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-foreground-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attachment</div>}
      <AttachmentBubble
        url={url}
        isSent={false}
        onPreview={() => openPreview([{ url, type, name }], 0)}
      />
    </div>
  );
}

// ─── Contacts Panel ───────────────────────────────────────────────────────────

interface ContactsPanelProps {
  contacts: Contact[];
  onAdd: (c: Omit<Contact, 'id' | 'color'>) => void;
  onDelete: (id: number) => void;
  onMail: (email: string) => void;
  onChat: (name: string, email: string, color: string) => void;
}

function ContactsPanel({ contacts, onAdd, onDelete, onMail, onChat }: ContactsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', nickname: '', company: '', dob: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const resetForm = () => { setNewContact({ name: '', email: '', nickname: '', company: '', dob: '' }); setError(''); setShowForm(false); };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newContact.name.trim() || !newContact.email.trim()) { setError('Name and email are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContact.email)) { setError('Please enter a valid email address.'); return; }
    onAdd({
      name: newContact.name.trim(),
      email: newContact.email.trim().toLowerCase(),
      nickname: newContact.nickname.trim() || undefined,
      company: newContact.company.trim() || undefined,
      dob: newContact.dob.trim() || undefined
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); resetForm(); }, 900);
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--color-background-secondary)',
      overflow: 'hidden', padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-foreground)', letterSpacing: '-0.02em' }}>Contacts</h1>
        <button className="ios-button" onClick={() => { setShowForm(true); setError(''); }}>
          <UserPlus size={16} /> Add Contact
        </button>
      </div>

      {showForm && (
        <div className="animate-slide-up" style={{
          background: 'var(--color-background-tertiary)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden', marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-divider)',
          }}>
            <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)' }}>New Contact</span>
            <button className="icon-btn" onClick={resetForm}><X size={16} /></button>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {error && (
              <div style={{
                fontSize: '13px', color: 'var(--color-danger)',
                background: 'rgba(255,59,48,0.08)', padding: '10px 14px',
                borderRadius: 'var(--radius-sm)', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}><AlertCircle size={14} />{error}</div>
            )}
            <form onSubmit={handleAdd} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-foreground-secondary)' }}>Name</label>
                  <input className="ios-input" placeholder="Enter name" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-foreground-secondary)' }}>Email</label>
                  <input className="ios-input" type="email" placeholder="Enter email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-foreground-secondary)' }}>Nickname</label>
                  <input className="ios-input" placeholder="Optional" value={newContact.nickname} onChange={e => setNewContact({ ...newContact, nickname: e.target.value })} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-foreground-secondary)' }}>Company</label>
                  <input className="ios-input" placeholder="Optional" value={newContact.company} onChange={e => setNewContact({ ...newContact, company: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={resetForm} style={{
                  padding: '8px 16px', border: 'none', background: 'transparent',
                  color: 'var(--color-foreground-secondary)', fontSize: '15px', fontWeight: 500,
                  cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit',
                }}>Cancel</button>
                <button type="submit" disabled={saved} className="ios-button">
                  {saved ? <><Check size={14} /> Saved!</> : <><UserPlus size={14} /> Save Contact</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contacts.length === 0 && !showForm ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-foreground-secondary)', gap: '12px',
        }}>
          <Users size={48} style={{ opacity: 0.2 }} />
          <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-foreground)' }}>No contacts yet</p>
          <p style={{ fontSize: '15px' }}>Add your first contact to get started</p>
          <button className="ios-button-secondary" onClick={() => setShowForm(true)}>
            <UserPlus size={16} /> Add Contact
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px',
          overflowY: 'auto', paddingBottom: '20px',
        }}>
          {contacts.map(c => (
            <div key={c.id} style={{
              background: 'var(--color-background-tertiary)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s ease',
            }}>
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: c.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '18px', flexShrink: 0,
                }}>{c.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Mail size={11} /> {c.email}
                  </div>
                  {c.company && <div style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', marginTop: '2px' }}>{c.company}</div>}
                </div>
              </div>
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--color-divider)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px',
              }}>
                <button className="icon-btn" onClick={() => onMail(c.email)} title="Send mail" style={{ color: 'var(--color-primary)' }}><Mail size={16} /></button>
                <button className="icon-btn" onClick={() => onChat(c.name, c.email, c.color)} title="Start chat" style={{ color: 'var(--color-primary)' }}><MessageSquare size={16} /></button>
                <div style={{ width: '1px', height: '16px', background: 'var(--color-divider)', margin: '0 4px' }} />
                <button className="icon-btn" onClick={() => onDelete(c.id)} title="Remove" style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const { token, logout } = useAuth();

  const [activeSection, setActiveSection] = useState<Section>('inbox');
  const [activeCategory, setActiveCategory] = useState('primary');
  const [messages, setMessages]           = useState<MailMessage[]>([]);
  const [loadingMail, setLoadingMail]     = useState(true);
  const [selectedMsg, setSelectedMsg]     = useState<MailMessage | null>(null);
  const [contacts, setContacts]           = useState<Contact[]>([]);
  const [allTags, setAllTags]             = useState<TagCategory[]>([]);
  const [allFolders, setAllFolders]       = useState<MailFolder[]>([]);
  const [folderMessages, setFolderMessages] = useState<MailMessage[]>([]);
  const [filterTagId, setFilterTagId]       = useState<number | null>(null);
  const [showTutorial, setShowTutorial]     = useState(false);
  const [showAiActionCenter, setShowAiActionCenter] = useState(false);
  const [showEcosystem, setShowEcosystem]   = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);

  // Semantic search state
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<MailMessage[]>([]);
  const semanticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSemanticSearch = useCallback((query: string) => {
    if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);
    if (!query.trim()) { setSemanticResults([]); return; }
    semanticTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/mail/semantic-search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.results) {
            setSemanticResults(data.results.map((m: any) => ({
              id: m.id,
              fromMe: m.from_me,
              sender: m.sender_name,
              senderEmail: m.sender_email,
              to: m.to_name,
              toEmail: m.to_email,
              subject: m.subject,
              snippet: m.snippet,
              body: m.body,
              time: m.time,
              color: colorFor(m.sender_name),
              starred: m.starred,
              read: m.read,
              category: m.category,
              is_trashed: m.is_trashed,
              tags: m.tags,
              folder_id: m.folder_id,
              attachment_url: m.attachment_url,
              attachment_urls: m.attachment_urls,
              ai_summary: m.ai_summary,
            })));
          }
        }
      } catch (e) { console.error('Semantic search error:', e); }
    }, 500);
  }, [token]);

  const { shortcutsEnabled, toggleShortcuts } = useShortcuts({
    onToggleAi: () => setShowAiActionCenter(prev => !prev),
    onSend: () => {
      // If compose modal is open, we could trigger a send event. For now we will check if it's open
      // In a real app we'd expose a ref or a global event. 
      // Another option is to dispatch a custom event that ComposeModal listens to
      window.dispatchEvent(new CustomEvent('shortcuts-send'));
    },
    onClose: () => {
      if (showAiActionCenter) setShowAiActionCenter(false);
      // could also close other modals
    },
    onToggleShortcutsGuide: () => {
      setActiveSection('settings');
    }
  });

  // ── Request Notification Permission ──────────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Load Contacts ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setContacts([]); return; }
    fetch(`${API}/contacts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setContacts(data.map(c => ({
            id: c.id,
            name: c.name,
            email: c.contact_email,
            nickname: c.nickname,
            company: c.company,
            dob: c.dob,
            color: colorFor(c.name)
          })));
        }
      })
      .catch(() => {});
  }, [token]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [targetConvId, setTargetConvId]   = useState<number | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [composing, setComposing]         = useState(false);
  const [composeTo, setComposeTo]         = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody]     = useState('');
  const [user, setUser]                   = useState<UserProfile | null>(null);
  const [loadingUser, setLoadingUser]     = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [_backendOnline, setBackendOnline] = useState(true);
  const [toast, setToast]                 = useState<string | null>(null);

  // ── Task Reminders ─────────────────────────────────────────────────────────
  const lastRemindedTasks = useRef<Set<number>>(new Set());
  const lastRemindedEvents = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!token) return;
    const checkReminders = async () => {
      try {
        const [tasksRes, eventsRes] = await Promise.all([
          fetch(`${API}/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/calendar`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          tasks.forEach((t: any) => {
            if (!t.is_completed && t.due_date && !lastRemindedTasks.current.has(t.id)) {
              const diff = new Date(t.due_date).getTime() - Date.now();
              // Remind if due within 30 minutes
              if (diff > 0 && diff < 30 * 60 * 1000) {
                setToast(`⏰ Task Reminder: "${t.title}" is due soon!`);
                playSystemNotification();
                lastRemindedTasks.current.add(t.id);
              }
            }
          });
        }
        if (eventsRes.ok) {
          const events = await eventsRes.json();
          events.forEach((e: any) => {
            if (e.start_time && !lastRemindedEvents.current.has(e.id)) {
              const diff = new Date(e.start_time).getTime() - Date.now();
              // Remind if starting within 15 minutes
              if (diff > 0 && diff < 15 * 60 * 1000) {
                setToast(`📅 Event Reminder: "${e.title}" is starting soon!`);
                playSystemNotification();
                lastRemindedEvents.current.add(e.id);
              }
            }
          });
        }
      } catch (e) {}
    };
    const interval = setInterval(checkReminders, 60000); // Check every minute
    checkReminders();
    return () => clearInterval(interval);
  }, [token, API]);


  // Track the highest mail id seen so polling only fetches new ones
  const lastChatId = useRef(0);


  // ── Fetch user profile ────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) { setUser(await res.json()); setBackendOnline(true); }
        else setBackendOnline(false);
      } catch { setBackendOnline(false); }
      finally { setLoadingUser(false); }
    })();
  }, [token]);

  // ── Load inbox + sent from backend ────────────────────────────────────────

  const loadMail = useCallback(async () => {
    if (!token) return;
    try {
      const [inboxRes, sentRes] = await Promise.all([
        fetch(`${API}/mail/inbox`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/mail/sent`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!inboxRes.ok || !sentRes.ok) return;
      const inbox: any[] = await inboxRes.json();
      const sent:  any[] = await sentRes.json();
      const all = [...inbox.map(m => apiMailToMsg(m, user?.id ?? 0)),
                   ...sent.map(m => apiMailToMsg(m, user?.id ?? 0))];
      const seen = new Set<number>();
      const deduped = all.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
      deduped.sort((a, b) => b.id - a.id);
      setMessages(deduped);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    } finally {
      setLoadingMail(false);
    }
  }, [token, user?.id]);

  const loadChat = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const convs = await res.json();
        setConversations(convs);
        let maxId = 0;
        convs.forEach((c: any) => c.messages.forEach((m: any) => { if (m.id > maxId) maxId = m.id; }));
        lastChatId.current = maxId;
      }
    } catch { /* offline */ }
  }, [token]);

  const loadTagsAndFolders = useCallback(async () => {
    if (!token) return;
    try {
      const [tRes, fRes] = await Promise.all([
        fetch(`${API}/tags`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/folders`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (tRes.ok) setAllTags(await tRes.json());
      if (fRes.ok) setAllFolders(await fRes.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      const hasSeen = localStorage.getItem('has_seen_tutorial');
      if (!hasSeen) {
        setShowTutorial(true);
      }
    }
  }, [token]);


  const loadData = async () => {
    await Promise.all([loadMail(), loadChat(), loadTagsAndFolders()]);
  };

  useEffect(() => {
    if (user) {
      loadMail();
      loadChat();
      loadTagsAndFolders();
    } else if (!loadingUser) {
      setLoadingMail(false);
    }
  }, [user, loadingUser, loadMail, loadChat, loadTagsAndFolders]);

  useEffect(() => {
    if (activeSection.startsWith('folder_')) {
      const folderId = parseInt(activeSection.replace('folder_', ''), 10);
      setLoadingMail(true);
      fetch(`${API}/mail/folder/${folderId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Failed to load folder');
        })
        .then(data => {
          setFolderMessages(data.map((m: any) => apiMailToMsg(m, user?.id ?? 0)));
        })
        .catch(() => setFolderMessages([]))
        .finally(() => setLoadingMail(false));
    }
  }, [activeSection, token, user?.id]);

  // ── Polling ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token || !user) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_mail') {
          // Trigger a lightweight fetch to get the new mail
          loadMail();
        } else if (data.type === 'new_chat') {
          const msg = data.message;
          setConversations(prev => {
            let updated = [...prev];
            let maxId = lastChatId.current;
            if (msg.id > maxId) maxId = msg.id;
            
            const convIdx = updated.findIndex(c => c.id === msg.thread_id);
            if (convIdx >= 0) {
              const conv = updated[convIdx];
              if (!conv.messages.find((m: any) => m.id === msg.id)) {
                 const newMessages = [...conv.messages, msg];
                 updated[convIdx] = { ...conv, messages: newMessages, unread: msg.fromMe ? conv.unread : conv.unread + 1 };
                 if (!msg.fromMe) {
                   const txt = `New message from ${conv.name}`;
                   setToast(txt);
                   playSystemNotification();
                   if ('Notification' in window && Notification.permission === 'granted') {
                     new Notification('Fluid AirMail', { body: txt });
                   }
                 }
              }
            } else {
               loadChat();
            }
            lastChatId.current = maxId;
            return updated;
          });
        } else if (data.type === 'chat_read') {
          const thread_id = data.thread_id;
          setConversations(prev => {
            return prev.map(conv => {
              if (conv.id === thread_id) {
                const newMsgs = conv.messages.map(m => {
                  if (m.fromMe && m.status !== 'read') {
                    return { ...m, status: 'read' as any };
                  }
                  return m;
                });
                return { ...conv, messages: newMsgs };
              }
              return conv;
            });
          });
        }
      } catch (e) {
        console.error("WS message error", e);
      }
    };
    
    ws.onclose = () => {
       console.log('WebSocket disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [token, user, loadMail, loadChat]);

  // ── Mail actions ──────────────────────────────────────────────────────────

  const openCompose = useCallback((toEmail = '', subject = '', body = '') => {
    setComposeTo(toEmail);
    setComposeSubject(subject);
    setComposeBody(body);
    setComposing(true);
  }, []);

  const handleComposeSend = useCallback(async (
    toName: string, toEmail: string, subject: string, body: string, attachmentUrls?: string[]
  ) => {
    const res = await fetch(`${API}/mail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to_email: toEmail, to_name: toName, subject, body, attachment_urls: attachmentUrls }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to send mail');
    }

    const result = await res.json();

    const sentMsg: MailMessage = {
      id: result.id ?? Date.now(),
      fromMe: true,
      sender: user?.username ?? 'Me',
      senderEmail: user?.email ?? '',
      to: toName,
      toEmail,
      subject,
      snippet: body.slice(0, 120),
      body,
      time: nowTime(),
      color: colorFor(toName),
      starred: false,
      read: true,
      attachment_urls: attachmentUrls,
      attachment_url: attachmentUrls?.[0],
    };
    setMessages(prev => [sentMsg, ...prev]);

    if (result.delivered_to_registered_user) {
      setToast(`✅ Mail delivered to ${result.recipient} on Fluid AirMail`);
    } else {
      setToast(`📤 Mail sent to ${toEmail}`);
    }
  }, [token, user]);

  const handleStar = useCallback(async (id: number, starred: boolean) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, starred } : m));
    setSelectedMsg(prev => prev?.id === id ? { ...prev, starred } : prev);
    try {
      await fetch(`${API}/mail/${id}/star`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ starred }),
      });
    } catch { /* offline */ }
  }, [token]);

  const handleDelete = useCallback(async (id: number) => {
    if (activeSection === 'bin') {
      setMessages(prev => prev.filter(m => m.id !== id));
      setSelectedMsg(prev => prev?.id === id ? null : prev);
      try {
        await fetch(`${API}/mail/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* offline */ }
    } else {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_trashed: true } : m));
      setSelectedMsg(prev => prev?.id === id ? null : prev);
      try {
        await fetch(`${API}/mail/${id}/trash`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* offline */ }
    }
  }, [token, activeSection]);

  const handleClickMessage = useCallback(async (msg: MailMessage) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
    setSelectedMsg({ ...msg, read: true });
    if (!msg.read && !msg.fromMe) {
      try {
        await fetch(`${API}/mail/${msg.id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* offline */ }
    }
  }, [token]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMail();
    await loadChat();
    await loadTagsAndFolders();
    if (activeSection.startsWith('folder_')) {
      const folderId = parseInt(activeSection.replace('folder_', ''), 10);
      try {
        const res = await fetch(`${API}/mail/folder/${folderId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setFolderMessages((await res.json()).map((m: any) => apiMailToMsg(m, user?.id ?? 0)));
      } catch {}
    }
    setRefreshing(false);
  }, [loadMail, loadChat, loadTagsAndFolders, activeSection, token, user?.id]);

  // ── Contact actions ───────────────────────────────────────────────────────

  const handleSaveContact = async (c: Omit<Contact, 'id' | 'color'>) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: c.email, name: c.name, nickname: c.nickname, company: c.company, dob: c.dob })
      });
      if (!res.ok) throw new Error('Failed to save contact');
      const newC = await res.json();
      setContacts(prev => [...prev, {
        id: newC.id, name: newC.name, email: newC.contact_email,
        nickname: newC.nickname, company: newC.company, dob: newC.dob,
        color: colorFor(newC.name)
      }]);
      setToast(`Added ${newC.name} to contacts`);
    } catch {
      setToast('Failed to save contact');
    }
  };

  const handleRemoveContact = async (id: number) => {
    if (!token) return;
    try {
      await fetch(`${API}/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch {
      setToast('Failed to delete contact');
    }
  };

  const handleStartChat = useCallback((name: string, email: string, color: string) => {
    const existing = conversations.find(c => c.email === email);
    if (existing) {
      setTargetConvId(existing.id);
    } else {
      const tempId = Date.now();
      const newConv: Conversation = {
        id: tempId, name, email, color, online: false,
        lastSeen: 'Just added', messages: [], unread: 0,
      };
      setConversations(prev => [newConv, ...prev]);
      setTargetConvId(tempId);
    }
    setActiveSection('chats');
  }, [conversations]);

  const handleSendChatMessage = useCallback(async (toEmail: string, text: string, attachment_urls?: string[]) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to_email: toEmail, text, attachment_urls }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setConversations(prev => {
          const updated = [...prev];
          const convIdx = updated.findIndex(c => c.id === newMsg.thread_id || c.email === toEmail);
          if (convIdx >= 0) {
            const conv = updated[convIdx];
            const msgs = [...conv.messages, newMsg];
            if (newMsg.surya_reply) {
              msgs.push({ ...newMsg.surya_reply, fromMe: false });
            }
            updated[convIdx] = { ...conv, id: newMsg.thread_id, messages: msgs };
            
            const [movedConv] = updated.splice(convIdx, 1);
            updated.unshift(movedConv);
          } else {
             loadChat();
          }
          return updated;
        });
        lastChatId.current = Math.max(lastChatId.current, newMsg.surya_reply?.id ?? newMsg.id, newMsg.id);
        setTargetConvId(newMsg.thread_id);
      }
    } catch {
       setToast('Failed to send message');
    }
  }, [token, loadChat]);

  const handleChatRead = useCallback(async (convId: number) => {
    if (!token) return;
    try {
      await fetch(`${API}/chat/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ thread_id: convId }),
      });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread: 0 } : c));
    } catch { /* ignore */ }
  }, [token]);

  const handleUpdateMailTags = useCallback(async (mailId: number, tagIds: number[]) => {
    if (!token) return;
    const newTags = tagIds.map(id => allTags.find(t => t.id === id)!).filter(Boolean);
    const updater = (m: MailMessage) => m.id === mailId ? { ...m, tags: newTags } : m;
    setMessages(prev => prev.map(updater));
    setFolderMessages(prev => prev.map(updater));
    setSelectedMsg(prev => prev?.id === mailId ? { ...prev, tags: newTags } : prev);
    try {
      await fetch(`${API}/mail/${mailId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tag_ids: tagIds })
      });
    } catch { setToast('Failed to update tags'); }
  }, [allTags, token]);

  const handleUpdateMailFolder = useCallback(async (mailId: number, folderId: number | null) => {
    if (!token) return;
    const updater = (m: MailMessage) => m.id === mailId ? { ...m, folder_id: folderId } : m;

    if (folderId !== null && (activeSection === 'inbox' || activeSection === 'sent')) {
      setMessages(prev => prev.filter(m => m.id !== mailId));
      if (selectedMsg?.id === mailId) setSelectedMsg(null);
    } else if (activeSection.startsWith('folder_') && activeSection !== `folder_${folderId}`) {
      setFolderMessages(prev => prev.filter(m => m.id !== mailId));
      if (selectedMsg?.id === mailId) setSelectedMsg(null);
      loadMail();
    } else {
       setMessages(prev => prev.map(updater));
       setFolderMessages(prev => prev.map(updater));
       setSelectedMsg(prev => prev?.id === mailId ? { ...prev, folder_id: folderId } : prev);
    }

    try {
      await fetch(`${API}/mail/${mailId}/folder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ folder_id: folderId })
      });
    } catch { setToast('Failed to update folder'); }
  }, [activeSection, loadMail, token, selectedMsg?.id]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredMessages = (semanticSearch && searchQuery.trim() !== '')
    ? semanticResults
    : activeSection.startsWith('folder_')
    ? folderMessages.filter(m => {
        const q = searchQuery.toLowerCase();
        return !m.is_trashed && (!q ||
          m.sender.toLowerCase().includes(q) ||
          m.to.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q));
      })
    : messages.filter(m => {
        if (activeSection === 'bin') {
          if (!m.is_trashed) return false;
        } else {
          if (m.is_trashed) return false;
        }

        const matchSection =
          activeSection === 'inbox'   ? (!m.fromMe && m.category === activeCategory) :
          activeSection === 'sent'    ? m.fromMe :
          activeSection === 'starred' ? m.starred :
          activeSection === 'snoozed' ? false : 
          activeSection === 'bin'     ? true :
          activeSection.startsWith('tag_') ? m.tags?.some(t => t.id === parseInt(activeSection.replace('tag_', ''), 10)) : true;

        const q = searchQuery.toLowerCase().trim();
        let matchSearch = true;
        if (q) {
          const hasFrom = q.match(/from:([^\s]+)/);
          const hasAttachment = q.includes('has:attachment');
          const hasAfter = q.match(/after:([^\s]+)/);
          
          let fromMatch = true;
          if (hasFrom) {
             fromMatch = m.sender.toLowerCase().includes(hasFrom[1]) || m.senderEmail.toLowerCase().includes(hasFrom[1]);
          }
          
          let attachMatch = true;
          if (hasAttachment) {
             attachMatch = (m.attachment_urls && m.attachment_urls.length > 0) || (m.attachment_url !== null && m.attachment_url !== undefined);
          }
          
          let afterMatch = true;
          if (hasAfter) {
             try {
                const afterDate = new Date(hasAfter[1]);
                const mailDate = new Date(m.time); // m.time is usually just a time string, we might need actual date
                // Simplified: assuming m.time has date or we just parse it
                if (!isNaN(afterDate.getTime()) && !isNaN(mailDate.getTime())) {
                   afterMatch = mailDate > afterDate;
                }
             } catch(e) {}
          }
          
          // Remove operators from query to do general text search
          let textQ = q.replace(/from:[^\s]+/, '').replace('has:attachment', '').replace(/after:[^\s]+/, '').trim();
          
          let textMatch = true;
          if (textQ) {
             textMatch = m.sender.toLowerCase().includes(textQ) ||
                         m.to.toLowerCase().includes(textQ) ||
                         m.subject.toLowerCase().includes(textQ) ||
                         m.snippet.toLowerCase().includes(textQ);
          }
          
          matchSearch = fromMatch && attachMatch && afterMatch && textMatch;
        }

        const matchTagFilter = filterTagId === null || m.tags?.some(t => t.id === filterTagId);

        return matchSection && matchSearch && matchTagFilter;
      });

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const unreadMail  = messages.filter(m => !m.fromMe && !m.read).length;
  const unreadChats = conversations.reduce((s, c) => s + c.unread, 0);

  const sidebarNav: { id: Section; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Zap size={20} /> },
    { id: 'inbox',    label: 'Inbox',    icon: <Inbox size={20} />,         count: unreadMail  || undefined },
    { id: 'chats',    label: 'Chats',    icon: <MessageSquare size={20} />, count: unreadChats || undefined },
    { id: 'calendar', label: 'Calendar', icon: <CalendarIcon size={20} /> },
    { id: 'tasks',    label: 'Tasks',    icon: <CheckSquare size={20} /> },
    { id: 'notes',    label: 'Notes',    icon: <FileText size={20} /> },
    { id: 'templates', label: 'Templates', icon: <FileText size={20} /> },
    { id: 'library',  label: 'Library',  icon: <Layers size={20} />         },
    { id: 'contacts', label: 'Contacts', icon: <Users size={20} />,         count: contacts.length || undefined },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} />   },
  ];
  if (user?.is_admin) {
    sidebarNav.push({ id: 'admin', label: 'Admin', icon: <Shield size={20} /> });
  }

  const contactHints: ContactHint[] = contacts.map(c => ({
    id: c.id, name: c.name, email: c.email, color: c.color,
  }));

  const handleLogout = useCallback(() => logout(), [logout]);

  // ── Sidebar item renderer ────────────────────────────────────────────────
  const SidebarItem = ({ item }: { item: typeof sidebarNav[0] }) => {
    const isActive = activeSection === item.id;
    return (
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setActiveSection(item.id); setSelectedMsg(null); setFilterTagId(null); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderRadius: '9999px',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
          background: isActive ? 'var(--color-primary)' : 'transparent',
          color: isActive ? '#ffffff' : 'var(--color-foreground)',
        }}
        onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-foreground-quaternary)'; }}
        onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {React.cloneElement(item.icon as React.ReactElement<any>, { size: 18, strokeWidth: isActive ? 2.5 : 2 })}
          <span style={{ fontSize: '15px', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
        </div>
        {item.count !== undefined && (
          <span style={{
            fontSize: '11px', fontWeight: 700,
            padding: '2px 8px', borderRadius: '100px',
            background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--color-foreground-tertiary)',
            color: isActive ? '#ffffff' : 'var(--color-foreground)',
            minWidth: '22px', textAlign: 'center',
          }}>{item.count}</span>
        )}
      </a>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AttachmentPreviewProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--color-background)', overflow: 'hidden' }}>

      {/* ═══ Sidebar ═══ */}
      <aside className="tour-sidebar" style={{
        width: '240px', height: '100vh',
        background: 'var(--color-background-secondary)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 12px', gap: '4px',
        flexShrink: 0, borderRight: '1px solid var(--color-divider)',
        overflowY: 'auto',
      }}>
        {/* Branding */}
        <div style={{ padding: '4px 12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-foreground)', letterSpacing: '-0.02em' }}>Fluid AirMail</div>
          <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || 'Personal Account'}
          </div>
        </div>

        {/* Compose */}
        <button className="ios-button tour-compose" style={{ width: '100%', marginBottom: '12px', padding: '10px 16px' }} onClick={() => openCompose()}>
          <Plus size={18} /> Compose
        </button>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {sidebarNav.filter(n => n.id !== 'settings' && n.id !== 'admin').map(item => (
            <SidebarItem key={item.id} item={item} />
          ))}
        </nav>

        {/* Bottom items */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '12px' }}>
          {sidebarNav.filter(n => n.id === 'settings' || n.id === 'admin').map(item => (
            <SidebarItem key={item.id} item={item} />
          ))}
          <button
            onClick={() => setShowTutorial(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '8px 12px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', background: 'transparent',
              color: 'var(--color-primary)', fontSize: '15px', fontWeight: 500,
              fontFamily: 'inherit', textAlign: 'left', marginTop: '4px',
              transition: 'background 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--color-foreground-quaternary)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Zap size={18} /> Walkthrough
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '8px 12px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', background: 'transparent',
              color: 'var(--color-danger)', fontSize: '15px', fontWeight: 500,
              fontFamily: 'inherit', textAlign: 'left', marginTop: '4px',
              transition: 'background 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,59,48,0.08)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', background: 'var(--color-background)' }}>

        {/* Top header bar */}
        <header className="ios-blur" style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 24px',
          borderBottom: '1px solid var(--color-divider)',
          flexShrink: 0, position: 'sticky', top: 0, zIndex: 40,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <div className="tour-search" style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: semanticSearch ? 'var(--color-primary)' : 'var(--color-foreground-secondary)' }} />
              <input
                className="ios-input"
                style={{ paddingLeft: '34px', paddingRight: semanticSearch ? '80px' : '32px', fontSize: '15px', height: '36px', borderRadius: '9999px' }}
                placeholder={semanticSearch ? 'Semantic search (AI)…' : 'Search'}
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSelectedMsg(null); if (semanticSearch) handleSemanticSearch(e.target.value); }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSemanticResults([]); }}
                  style={{
                    position: 'absolute', right: semanticSearch ? '42px' : '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-foreground-secondary)', display: 'flex', padding: '2px',
                  }}
                ><X size={14} /></button>
              )}
              <button
                onClick={() => { setSemanticSearch(!semanticSearch); setSemanticResults([]); }}
                title={semanticSearch ? 'Switch to keyword search' : 'Switch to AI semantic search'}
                style={{
                  position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                  background: semanticSearch ? 'var(--color-primary)' : 'var(--color-background-secondary)',
                  border: '1px solid var(--color-divider)', borderRadius: '6px',
                  cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center',
                  color: semanticSearch ? '#fff' : 'var(--color-foreground-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                <Sparkles size={12} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleRefresh}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-primary)', display: 'flex', padding: '4px',
              }}
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              className="tour-ai"
              onClick={() => setShowEcosystem(!showEcosystem)}
              style={{
                background: showEcosystem ? 'var(--color-primary)' : 'var(--color-background-secondary)',
                border: '1px solid var(--color-divider)', cursor: 'pointer',
                color: showEcosystem ? '#fff' : 'var(--color-foreground)', display: 'flex', padding: '6px',
                borderRadius: '8px', transition: 'all 0.15s ease'
              }}
              title="Toggle Ecosystem Sidebar"
            >
              <Layers size={16} />
            </button>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--color-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px',
            }}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

          {/* Mail feed column */}
          {activeSection !== 'chats' && activeSection !== 'settings' && activeSection !== 'admin' && activeSection !== 'contacts' && activeSection !== 'library' && activeSection !== 'dashboard' && activeSection !== 'templates' && activeSection !== 'calendar' && activeSection !== 'tasks' && activeSection !== 'notes' && (
            <aside className="tour-sidebar" style={{
              width: '360px', flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              borderRight: '1px solid var(--color-divider)',
              overflowY: 'auto',
              background: 'var(--color-background)',
            }}>
              {/* Section header */}
              <div className="ios-blur" style={{
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, zIndex: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(activeSection === 'snoozed' || activeSection === 'bin' || activeSection.startsWith('tag_') || activeSection.startsWith('folder_')) && (
                    <button 
                      onClick={() => setActiveSection('library')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-primary)', marginRight: '8px', padding: 0 }}
                    >
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-foreground)', margin: 0 }}>
                    {activeSection.startsWith('tag_') 
                      ? allTags.find(t => t.id === parseInt(activeSection.replace('tag_', '')))?.name || 'Tag'
                      : activeSection.startsWith('folder_')
                        ? allFolders.find(f => f.id === parseInt(activeSection.replace('folder_', '')))?.name || 'Folder'
                        : sidebarNav.find(n => n.id === activeSection)?.label ?? (activeSection.charAt(0).toUpperCase() + activeSection.slice(1))}
                  </h2>
                  
                  {(activeSection === 'inbox' || activeSection === 'sent') && allTags.length > 0 && (
                    <div style={{ position: 'relative' }}>
                      <select
                        value={filterTagId || ''}
                        onChange={(e) => setFilterTagId(e.target.value ? parseInt(e.target.value, 10) : null)}
                        style={{
                          background: 'var(--color-background-elevated)',
                          color: 'var(--color-foreground)',
                          border: '1px solid var(--color-divider)',
                          borderRadius: '8px',
                          padding: '4px 8px',
                          fontSize: '13px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">All Tags</option>
                        {allTags.map(tag => (
                          <option key={tag.id} value={tag.id}>{tag.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {activeSection === 'inbox' && unreadMail > 0 && (
                  <span style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>{unreadMail} unread</span>
                )}
              </div>

              {activeSection === 'inbox' && (
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-divider)', marginBottom: '8px' }}>
                  {['primary', 'promotions', 'social', 'updates'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: activeCategory === cat ? 600 : 500,
                        color: activeCategory === cat ? 'var(--color-primary)' : 'var(--color-foreground-secondary)',
                        borderBottom: activeCategory === cat ? '2px solid var(--color-primary)' : '2px solid transparent',
                        textTransform: 'capitalize',
                        transition: 'all 0.2s',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {loadingMail ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--color-foreground-secondary)' }}>
                  <Loader2 size={28} className="animate-spin" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '15px' }}>Loading...</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--color-foreground-secondary)' }}>
                  <Mail size={44} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '17px', fontWeight: 500 }}>{searchQuery ? 'No results found' : 'Nothing here yet'}</p>
                </div>
              ) : (
                <div className="tour-inbox" style={{ padding: '4px 12px 12px' }}>
                  {filteredMessages.map((item) => {
                    const isActive = selectedMsg?.id === item.id;
                    const isUnread = !item.read && !item.fromMe;
                    return (
                      <div key={item.id}>
                        {/* Removed divider for card look */}
                        <div
                          onClick={() => handleClickMessage(item)}
                          style={{
                            padding: '18px 20px', borderRadius: '20px',
                            cursor: 'pointer', display: 'flex', gap: '14px',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            background: isActive ? 'var(--color-primary)' : 'var(--color-background-elevated)',
                            color: isActive ? '#ffffff' : 'inherit',
                            boxShadow: isActive ? '0 12px 32px -8px rgba(99,102,241,0.5)' : 'var(--shadow-sm)',
                            marginBottom: '12px',
                            border: isActive ? '1px solid transparent' : '1px solid var(--color-border-premium)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                          }}
                          onMouseOver={e => {
                            if (!isActive) {
                              e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)';
                              e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(0,0,0,0.1)';
                              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                            }
                          }}
                          onMouseOut={e => {
                            if (!isActive) {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                              e.currentTarget.style.borderColor = 'var(--color-border-premium)';
                            }
                          }}
                        >
                          {/* Unread dot */}
                          <div style={{ width: '8px', display: 'flex', alignItems: 'flex-start', paddingTop: '8px', flexShrink: 0 }}>
                            {isUnread && !isActive && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{
                                fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                color: isActive ? '#ffffff' : 'var(--color-foreground)',
                              }}>
                                {item.fromMe ? `To: ${item.to}` : item.sender}
                              </span>
                              <span style={{
                                fontSize: '12.5px', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px',
                                color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--color-foreground-tertiary)',
                              }}>{item.time}</span>
                            </div>
                            <p style={{
                              fontSize: '15px', fontWeight: 600, margin: 0, letterSpacing: '-0.01em',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              color: isActive ? '#ffffff' : 'var(--color-foreground)',
                              marginBottom: '4px',
                            }}>{item.subject || '(No Subject)'}</p>
                            <p className="line-clamp-2" style={{
                              fontSize: '14.5px', margin: 0, lineHeight: 1.5,
                              color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-foreground-secondary)',
                            }}>{item.snippet}</p>
                            {item.ai_summary && (
                              <div style={{
                                marginTop: '6px', padding: '6px 10px',
                                borderRadius: '8px', background: isActive ? 'rgba(255,255,255,0.1)' : 'var(--color-primary-light)',
                                display: 'flex', gap: '6px', alignItems: 'flex-start'
                              }}>
                                <Sparkles size={14} style={{ color: isActive ? '#fff' : 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                                <span className="line-clamp-2" style={{ fontSize: '13px', color: isActive ? '#fff' : 'var(--color-foreground)', lineHeight: 1.4 }}>
                                  {item.ai_summary}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          )}

          {/* Detail / Right column */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-background)' }}>
            {activeSection === 'dashboard' ? (
              <ActionDashboard
                token={token || ''}
                onSelectMail={(mailId) => {
                  const mail = messages.find(m => m.id === mailId);
                  if (mail) { setSelectedMsg(mail); setActiveSection('inbox'); }
                }}
                onCompose={(toEmail, subject, body) => openCompose(toEmail || '', subject || '', body || '')}
              />
            ) : activeSection === 'calendar' ? (
              <CalendarView token={token || ''} API={API} />
            ) : activeSection === 'tasks' ? (
              <TasksView token={token || ''} API={API} />
            ) : activeSection === 'notes' ? (
              <NotesView token={token || ''} API={API} />
            ) : activeSection === 'templates' ? (
              <TemplatesView
                token={token || ''}
                onUseTemplate={(subject, body) => {
                  openCompose('', subject, body);
                }}
              />
            ) : activeSection === 'contacts' ? (
              <ContactsPanel
                contacts={contacts}
                onAdd={handleSaveContact}
                onDelete={handleRemoveContact}
                onMail={email => { openCompose(email); setActiveSection('inbox'); }}
                onChat={handleStartChat}
              />
            ) : activeSection === 'chats' ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <ChatView
                    meName={user?.username || 'Me'}
                    conversations={conversations}
                    contacts={contactHints}
                    targetConvId={targetConvId}
                    onUpdateConversations={setConversations}
                    onClearTarget={() => setTargetConvId(null)}
                    onSendMessage={handleSendChatMessage}
                    onReadMessages={handleChatRead}
                    onAddContact={handleSaveContact}
                    
                    API={API}
                    token={token || ''}
                  />
              </div>
            ) : activeSection === 'library' ? (
              <LibraryView 
                allTags={allTags}
                allFolders={allFolders}
                snoozedCount={0}
                binCount={messages.filter(m => m.is_trashed).length}
                sentCount={messages.filter(m => m.fromMe).length}
                starredCount={messages.filter(m => m.starred).length}
                onNavigate={(section) => {
                  setActiveSection(section);
                  setSelectedMsg(null);
                }}
              />
            ) : activeSection === 'settings' ? (
              <SettingsView
                user={user}
                token={token || ''}
                onUpdateUser={setUser}
                API={API}
                allTags={allTags}
                allFolders={allFolders}
                onRefreshData={loadTagsAndFolders}
                shortcutsEnabled={shortcutsEnabled}
                onToggleShortcuts={toggleShortcuts}
              />
            ) : activeSection === 'admin' && user?.is_admin ? (
              <AdminView token={token || ''} API={API} />
            ) : selectedMsg ? (
              <MessageDetailPanel
                API={API}
                token={token || ''}
                message={selectedMsg}
                contacts={contacts}
                allTags={allTags}
                allFolders={allFolders}
                onAddContact={handleSaveContact}
                onClose={() => setSelectedMsg(null)}
                onStar={(id, starred) => handleStar(id, starred)}
                onDelete={(id) => handleDelete(id)}
                onReply={(email, bodyText) => openCompose(email, `Re: ${selectedMsg?.subject || ''}`, bodyText)}
                onForward={(subject, body) => {
                  const fwdSubject = subject.toLowerCase().startsWith('fwd:') ? subject : `Fwd: ${subject}`;
                  const fwdBody = `\n\n-------- Forwarded Message --------\nFrom: ${selectedMsg.sender} <${selectedMsg.senderEmail}>\nDate: ${selectedMsg.time}\nSubject: ${selectedMsg.subject || '(No Subject)'}\n\n${body}`;
                  openCompose('', fwdSubject, fwdBody);
                }}
                onUpdateMailTags={handleUpdateMailTags}
                onUpdateMailFolder={handleUpdateMailFolder}
              />
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'var(--color-foreground-secondary)',
              }}>
                <Mail size={64} style={{ marginBottom: '16px', opacity: 0.15, color: 'var(--color-foreground-secondary)' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>Select an item to read</h3>
                <p style={{ fontSize: '15px' }}>Nothing is selected</p>
              </div>
            )}
          </div>
          {showEcosystem && <EcosystemPanel API={API} token={token || ''} />}
        </div>
      </main>

      {/* Compose modal */}
      {composing && (
        <ComposeModal
          onClose={() => { setComposing(false); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }}
          onSend={handleComposeSend}
          prefillToEmail={composeTo}
          prefillSubject={composeSubject}
          prefillBody={composeBody}
          contacts={contacts}
          token={token ?? ''}
        />
      )}


      {/* Toast notifications */}
      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Tutorial Modal */}
            <Joyride 
        steps={tourSteps} 
        run={showTutorial} 
        continuous 
         
        
/>
      {/* Floating AI Action Center Button */}
      <button
        onClick={() => setShowAiActionCenter(true)}
        className="ai-glow-icon"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '64px',
          height: '64px',
          borderRadius: '32px',
          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 60%, #FF8C00 100%)',
          color: 'white',
          border: 'none',
          boxShadow: '0 0 0 5px rgba(255, 165, 0, 0.2), 0 10px 30px rgba(255, 165, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 50,
          transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Sun size={30} strokeWidth={2.5} />
      </button>

      {/* Full Screen AI Action Center */}
      {showAiActionCenter && (
        <AiActionCenter
          token={token || ''}
          API={API}
          onClose={() => setShowAiActionCenter(false)}
          onRefreshData={loadData}
          messages={aiMessages}
          setMessages={setAiMessages}
          contextSettings={{ theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light', shortcutsEnabled }}
          onClientAction={(action) => {
            if (action.type === 'change_theme') {
              const wantDark = action.theme === 'dark';
              if (wantDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
                localStorage.setItem('theme', 'dark');
              } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
                localStorage.setItem('theme', 'light');
              }
            } else if (action.type === 'draft_email') {
              const toList = Array.isArray(action.to) ? action.to.join(', ') : action.to;
              setComposeTo(toList || '');
              setComposeSubject(action.subject || '');
              setComposeBody(action.body || '');
              setComposing(true);
              setShowAiActionCenter(false);
            }
          }}
        />
      )}

    </div>
    </AttachmentPreviewProvider>
  );
};


const tourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to Fluid AirMail! Let\'s take a quick tour of your new workspace.',
    placement: 'center',
  },
  {
    target: '.tour-compose',
    content: 'Click here to draft powerful emails with CC/BCC, templates, and Apple Intelligence tools.',
  },
  {
    target: '.tour-sidebar',
    content: 'Navigate between your Inbox, Drafts, Chats, and custom folders here.',
  },
  {
    target: '.tour-search',
    content: 'Use the search bar to find emails instantly. Click the sparkle icon to use AI Semantic Search!',
  },
  {
    target: '.tour-inbox',
    content: 'This is your message list. Emails update in real-time, and you can see read-receipts instantly!',
  },
  {
    target: '.tour-ai',
    content: 'Open the AI Action Center to summarize emails, ask questions about your inbox, or find attachments quickly.',
  }
];

export default App;
