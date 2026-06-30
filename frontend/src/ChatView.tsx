import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, ArrowLeft, Phone, Info,
  Check, CheckCheck, X, Edit, UserPlus,
  Loader2, Calendar, Mail, Plus, ArrowUp, Paperclip, Play, Sparkles
} from 'lucide-react';
import { getLocalCompletions, getDatamuseSuggestions } from './predictiveText';
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: number;
  text: string;
  fromMe: boolean;
  time: string;
  status: 'sent' | 'delivered' | 'read';
  reactions?: string[];
  attachment_url?: string;
  attachment_urls?: string[];
}

export interface Conversation {
  id: number;
  name: string;
  email: string;
  color: string;
  online: boolean;
  lastSeen?: string;
  avatar_base64?: string;
  bio?: string;
  messages: ChatMessage[];
  unread: number;
}

export interface ContactHint {
  id: number;
  name: string;
  email: string;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

export const INITIAL_CONVERSATIONS: Conversation[] = [];

const AVATAR_COLORS = [
  '#3ea6ff', '#ea4335', '#34a853', '#fbbc05', '#ab47bc',
  '#ef5350', '#26a69a', '#ec407a', '#5c6bc0', '#ff7043',
];

function colorFor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Status tick ──────────────────────────────────────────────────────────────

function StatusTick({ status }: { status: ChatMessage['status'] }) {
  if (status === 'read') return <CheckCheck size={14} className="tick-read" />;
  if (status === 'delivered') return <CheckCheck size={14} className="tick-delivered" />;
  return <Check size={14} className="tick-sent" />;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="typing-bubble">
      <span className="dot" /><span className="dot" /><span className="dot" />
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  msg: ChatMessage;
  showAvatar: boolean;
  color: string;
  name: string;
  onReact: (msgId: number, emoji: string) => void;
}

function Bubble({ msg, showAvatar, color, name, onReact }: BubbleProps) {
  const [showPicker, setShowPicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowPicker(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const isAudio = msg.text.includes('[Audio]');
  const isSent = msg.fromMe;

  return (
    <div style={{ display: 'flex', width: '100%', marginBottom: '4px', padding: '0 16px', justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
      {!isSent && (
        <div style={{ width: '28px', flexShrink: 0, marginRight: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {showAvatar ? (
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '11px', background: color,
            }}>{name.charAt(0).toUpperCase()}</div>
          ) : <div style={{ width: '28px', height: '28px' }} />}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '70%', position: 'relative' }} ref={ref}>
        {isAudio ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '20px',
            background: isSent ? 'var(--color-bubble-sent)' : 'var(--color-bubble-received)',
            color: isSent ? 'var(--color-bubble-sent-text)' : 'var(--color-bubble-received-text)',
            borderBottomRightRadius: isSent ? '4px' : '20px',
            borderBottomLeftRadius: isSent ? '20px' : '4px',
          }}>
            <button style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.15)', color: 'inherit', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}><Play size={12} fill="currentColor" /></button>
            <div style={{ flex: 1, height: '3px', background: 'rgba(0,0,0,0.15)', borderRadius: '100px', position: 'relative', minWidth: '80px' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '33%', background: 'currentColor', borderRadius: '100px' }} />
            </div>
            <span style={{ fontSize: '11px', opacity: 0.6 }}>0:30</span>
            <span style={{ fontSize: '10px', opacity: 0.5, marginLeft: '4px' }}>{msg.time}</span>
          </div>
        ) : (
          <div
            style={{
              padding: '8px 14px', borderRadius: '20px', position: 'relative',
              background: isSent ? 'var(--color-bubble-sent)' : 'var(--color-bubble-received)',
              color: isSent ? 'var(--color-bubble-sent-text)' : 'var(--color-bubble-received-text)',
              borderBottomRightRadius: isSent ? '4px' : '20px',
              borderBottomLeftRadius: isSent ? '20px' : '4px',
            }}
            onDoubleClick={() => setShowPicker(p => !p)}
            title="Double-click to react"
          >
            {msg.attachment_urls && msg.attachment_urls.map((url, idx) => (
              <AttachmentBubbleWrapper key={idx} url={url} isSent={isSent} />
            ))}
            <div className="markdown-body" style={{ fontSize: '15px', lineHeight: 1.4 }}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', justifyContent: 'flex-end', opacity: 0.5 }}>
              <span style={{ fontSize: '10px' }}>{msg.time}</span>
              {isSent && <StatusTick status={msg.status} />}
            </div>
          </div>
        )}
        {msg.reactions && msg.reactions.length > 0 && (
          <div style={{ display: 'flex', gap: '3px', marginTop: '2px', justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
            {msg.reactions.map((r, i) => (
              <span key={i} style={{
                fontSize: '13px', padding: '2px 6px', borderRadius: '100px',
                background: 'var(--color-background-tertiary)',
                border: '1px solid var(--color-divider)',
              }}>{r}</span>
            ))}
          </div>
        )}
        {showPicker && (
          <div className="animate-scale-in" style={{
            position: 'absolute', zIndex: 10, top: '100%', marginTop: '4px',
            background: 'var(--color-background-elevated)',
            border: '1px solid var(--color-divider)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: '100px', padding: '4px 8px',
            display: 'flex', gap: '2px',
            ...(isSent ? { right: 0 } : { left: 0 }),
          }}>
            {EMOJI_REACTIONS.map(e => (
              <button key={e} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '20px', padding: '4px', borderRadius: '50%',
                transition: 'transform 0.12s',
              }}
              onClick={() => { onReact(msg.id, e); setShowPicker(false); }}
              onMouseOver={e2 => (e2.currentTarget.style.transform = 'scale(1.3)')}
              onMouseOut={e2 => (e2.currentTarget.style.transform = 'scale(1)')}
              >{e}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attachment Bubble Wrapper (uses preview context) ─────────────────────────

function AttachmentBubbleWrapper({ url, isSent }: { url: string; isSent: boolean }) {
  const { openPreview } = useAttachmentPreview();
  const type = detectAttachmentType(url);
  const name = getFileName(url);
  return (
    <div style={{ marginBottom: '6px' }}>
      <AttachmentBubble
        url={url}
        isSent={isSent}
        onPreview={() => openPreview([{ url, type, name }], 0)}
      />
    </div>
  );
}

// ─── New Message Dialog ────────────────────────────────────────────────────────

interface NewMsgDialogProps {
  contacts: ContactHint[];
  existingConvs: Conversation[];
  onSelect: (contact: ContactHint) => void;
  onClose: () => void;
  token?: string;
  API?: string;
}

function NewMessageDialog({ contacts, existingConvs, onSelect, onClose, token, API }: NewMsgDialogProps) {
  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState<ContactHint[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const allLocal: ContactHint[] = [
    ...contacts,
    ...existingConvs
      .filter(c => !contacts.find(k => k.email === c.email))
      .map(c => ({ id: c.id, name: c.name, email: c.email, color: c.color })),
  ];

  const filteredLocal = allLocal.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.email.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q || !token || !API) {
      setApiResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const filtered = data
            .filter((u: any) => !allLocal.some(c => c.email.toLowerCase() === u.email.toLowerCase()))
            .map((u: any, idx: number) => ({
              id: -(idx + 1),
              name: u.username,
              email: u.email,
              color: colorFor(u.username)
            }));
          setApiResults(filtered);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, token, API]);

  return (
    <div className="new-msg-overlay" onClick={onClose}>
      <div className="new-msg-dialog" onClick={e => e.stopPropagation()}>
        <div className="new-msg-header">
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          <span className="new-msg-title">New Message</span>
        </div>
        <div className="new-msg-search">
          <Search size={15} className="new-msg-search-icon" />
          <input
            ref={inputRef}
            className="new-msg-input"
            placeholder="Search people by email or username…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="new-msg-results">
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          )}
          {!loading && filteredLocal.length === 0 && apiResults.length === 0 ? (
            <div className="new-msg-empty">
              <UserPlus size={32} style={{ opacity: 0.2 }} />
              <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-foreground)' }}>No results found</p>
              <p style={{ fontSize: '13px', opacity: 0.5 }}>Search by username or email</p>
            </div>
          ) : (
            !loading && (
              <>
                {filteredLocal.length > 0 && (
                  <div className="new-msg-section">
                    <div className="new-msg-section-title">Contacts & Recent Chats</div>
                    {filteredLocal.map(c => (
                      <button key={c.id} className="new-msg-item" onClick={() => onSelect(c)}>
                        <div className="conv-avatar" style={{ backgroundColor: c.color }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="new-msg-item-info">
                          <span className="new-msg-item-name">{c.name}</span>
                          <span className="new-msg-item-email">{c.email}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {apiResults.length > 0 && (
                  <div className="new-msg-section">
                    <div className="new-msg-section-title">Global Directory</div>
                    {apiResults.map(c => (
                      <button key={c.id} className="new-msg-item" onClick={() => onSelect(c)}>
                        <div className="conv-avatar" style={{ backgroundColor: c.color }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="new-msg-item-info">
                          <span className="new-msg-item-name">{c.name}</span>
                          <span className="new-msg-item-email">{c.email}</span>
                        </div>
                        <span className="global-badge">Global</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Window ──────────────────────────────────────────────────────────────

interface ChatWindowProps {
  conv: Conversation;
  contacts: ContactHint[];
  onAddContact: (c: { name: string; email: string }) => Promise<void>;
  onVoiceCall?: (email: string, name: string) => void;
  onBack: () => void;
  onSendMessage: (convId: number, text: string, attachment_urls?: string[]) => void;
  onReact: (convId: number, msgId: number, emoji: string) => void;
  API?: string;
  token?: string;
}

function ChatWindow({ conv, contacts, onAddContact, onVoiceCall, onBack, onSendMessage, onReact, API, token }: ChatWindowProps) {
  const [text, setText] = useState('');
  const textRef = useRef('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [realtimeSuggestions, setRealtimeSuggestions] = useState<string[]>(["I", "The", "Hi", "Are"]);
  const isTyping = false;
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAiProfile, setShowAiProfile] = useState(false);
  const [aiProfileData, setAiProfileData] = useState<{ traits: string[], memories: string[], relation: string } | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const contactInfo = contacts.find(c => c.email === conv.email);

  const handleOpenAiProfile = async () => {
    if (!contactInfo) return;
    setShowAiProfile(true);
    setIsLoadingProfile(true);
    try {
      const res = await fetch(`${API}/ai/chat/character-graph/${contactInfo.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAiProfileData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conv.messages, isTyping]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !API || !token) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(async file => {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        if (res.ok) {
          const data = await res.json();
          return data.url;
        }
        return null;
      }));
      setAttachments(prev => {
        const validUrls = urls.filter((u): u is string => u !== null);
        return [...prev, ...validUrls];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = useCallback((overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : text;
    const trimmed = textToSend.trim();
    if (!trimmed && attachments.length === 0) return;
    if (overrideText === undefined) setText('');
    
    const atts = attachments.length > 0 ? attachments : undefined;
    if (overrideText === undefined) setAttachments([]);

    setRealtimeSuggestions(["I", "The", "Hi", "Are"]); // Reset suggestions
    onSendMessage(conv.id, textToSend, atts);
  }, [text, attachments, conv.id, onSendMessage]);

  useEffect(() => {
    const handleShortcutSend = () => {
      handleSend();
    };
    window.addEventListener('shortcuts-send', handleShortcutSend);
    return () => window.removeEventListener('shortcuts-send', handleShortcutSend);
  }, [handleSend]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    textRef.current = val;
    
    const locals = getLocalCompletions(val);
    setRealtimeSuggestions(locals);

    if (val.endsWith(" ")) {
      getDatamuseSuggestions(val).then(networkSugs => {
        if (textRef.current === val && networkSugs.length > 0) {
          const unique = Array.from(new Set([...networkSugs, ...locals]));
          setRealtimeSuggestions(unique.slice(0, 4));
        }
      });
    }
  };

  const applySuggestion = (suggestion: string) => {
    let newText = "";
    if (!text.trim()) {
      newText = suggestion + " ";
    } else {
      const endsWithSpace = text.endsWith(" ");
      if (endsWithSpace) {
        newText = text + suggestion + " ";
      } else {
        const words = text.split(/\s+/);
        words[words.length - 1] = suggestion;
        newText = words.join(" ") + " ";
      }
    }
    
    setText(newText);
    textRef.current = newText;
    
    const locals = getLocalCompletions(newText);
    setRealtimeSuggestions(locals);
    
    getDatamuseSuggestions(newText).then(networkSugs => {
      if (textRef.current === newText && networkSugs.length > 0) {
        const unique = Array.from(new Set([...networkSugs, ...locals]));
        setRealtimeSuggestions(unique.slice(0, 4));
      }
    });

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const grouped = conv.messages.map((msg, i) => {
    const next = conv.messages[i + 1];
    return { msg, isLastInGroup: !next || next.fromMe !== msg.fromMe };
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--color-background)', position: 'relative', width: '100%',
      borderRight: '1px solid var(--color-divider)',
    }}>
      {/* Header */}
      <div className="ios-blur" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--color-divider)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="icon-btn" onClick={onBack} style={{ display: 'none' }}><ArrowLeft size={20} /></button>
          {conv.avatar_base64 ? (
            <img src={conv.avatar_base64} alt={conv.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '16px', background: conv.color,
            }}>{conv.name.charAt(0).toUpperCase()}</div>
          )}
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)', lineHeight: 1.2, margin: 0 }}>{conv.name}</h2>
            <span style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>{conv.email}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {contactInfo ? (
            <button
              onClick={handleOpenAiProfile}
              style={{
                padding: '6px 12px', borderRadius: '100px', border: '1px solid rgba(0, 122, 255, 0.2)',
                background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer', transition: 'background 0.12s'
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(0, 122, 255, 0.15)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
            >
              <Sparkles size={14} />
              AI Profile
            </button>
          ) : (
            <button 
              className="icon-btn" 
              onClick={() => onAddContact({ name: conv.name, email: conv.email })}
              style={{ color: 'var(--color-primary)' }}
              title="Add to Contacts"
            >
              <UserPlus size={18} />
            </button>
          )}
          {onVoiceCall && (
            <button className="icon-btn" onClick={() => onVoiceCall(conv.email, conv.name)} style={{ color: 'var(--color-primary)' }}>
              <Phone size={18} />
            </button>
          )}
        </div>
      </div>

      {showAiProfile && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="animate-scale-in" style={{
            background: 'var(--color-background)', borderRadius: '16px',
            width: '100%', maxWidth: '400px', overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--color-divider)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--color-background-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
                <Sparkles size={18} />
                Character Graph
              </div>
              <button onClick={() => setShowAiProfile(false)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-foreground-secondary)'
              }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isLoadingProfile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: 'var(--color-foreground-secondary)' }}>
                  <Loader2 size={32} className="animate-spin" style={{ marginBottom: '16px', color: 'var(--color-primary)' }} />
                  <div>Analyzing chat history...</div>
                </div>
              ) : aiProfileData ? (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Relationship Dynamic
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {aiProfileData.relation}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      Personality Traits
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {aiProfileData.traits.map((t, idx) => (
                        <div key={idx} style={{
                          padding: '6px 14px', borderRadius: '100px', fontSize: '14px', fontWeight: 500,
                          background: 'var(--color-background-secondary)', color: 'var(--color-foreground)',
                          border: '1px solid var(--color-divider)'
                        }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      Key Memories & Facts
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {aiProfileData.memories.map((m, idx) => (
                        <div key={idx} style={{
                          padding: '12px 14px', borderRadius: '10px', fontSize: '14px', lineHeight: 1.4,
                          background: 'rgba(0, 122, 255, 0.05)', color: 'var(--color-foreground)',
                          borderLeft: '3px solid var(--color-primary)'
                        }}>
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-foreground-secondary)' }}>
                  Failed to load profile.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column' }}>
        {grouped.map(({ msg, isLastInGroup }) => (
          <Bubble key={msg.id} msg={msg} showAvatar={isLastInGroup} color={conv.color} name={conv.name} onReact={(msgId, emoji) => onReact(conv.id, msgId, emoji)} />
        ))}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '4px', padding: '0 16px' }}>
            <div style={{ width: '28px', marginRight: '6px' }} />
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--color-background)',
        borderTop: '1px solid var(--color-divider)',
        position: 'sticky', bottom: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {/* Realtime Gboard-style Suggestions Bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '0 8px', gap: '8px'
        }}>
          {Array.from({ length: 4 }).map((_, i) => {
            const s = realtimeSuggestions[i];
            if (!s) {
              return <div key={`empty-${i}`} style={{ flex: 1, padding: '8px 4px' }} />;
            }
            return (
              <button
                key={i}
                onClick={() => applySuggestion(s)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'var(--color-foreground)',
                  fontSize: '15px', fontWeight: i === 1 ? 600 : 400, fontFamily: 'inherit',
                  transition: 'background 0.1s', textAlign: 'center', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis'
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                {s}
              </button>
            );
          })}
        </div>

        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px 16px', background: 'var(--color-background-secondary)' }}>
            {attachments.map((att, idx) => (
              <ComposeAttachment
                key={idx}
                url={att}
                onRemove={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'var(--color-background-secondary)',
          borderRadius: '9999px', padding: '4px 8px',
        }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'var(--color-foreground-quaternary)', color: 'var(--color-foreground-secondary)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
            title="Attach file"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} /> : <Paperclip size={18} />}
          </button>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleUpload}
            style={{ display: 'none' }}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.7z,.txt,.md,.js,.ts,.py,.rb,.go"
          />

          <input
            ref={inputRef}
            type="text"
            placeholder="iMessage"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: 'var(--color-foreground)', fontSize: '15px',
              outline: 'none', padding: '8px', fontFamily: 'inherit',
            }}
          />

          <button
            onClick={() => handleSend()}
            disabled={uploading || (!text.trim() && attachments.length === 0)}
            style={{
              padding: '8px', borderRadius: '50%', cursor: 'pointer',
              background: (text.trim() || attachments.length > 0) ? 'var(--color-primary)' : 'var(--color-foreground-tertiary)',
              color: '#ffffff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, opacity 0.15s',
              opacity: uploading ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            <ArrowUp size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation List ────────────────────────────────────────────────────────

interface ConvListProps {
  conversations: Conversation[];
  activeId: number | null;
  searchQuery: string;
  onSelect: (id: number) => void;
  onSearchChange: (q: string) => void;
  onNewMessage: () => void;
}

function ConversationList({ conversations, activeId, searchQuery, onSelect, onSearchChange, onNewMessage }: ConvListProps) {
  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
      background: 'var(--color-background)',
      borderRight: '1px solid var(--color-divider)',
      position: 'relative',
    }}>
      <div style={{ padding: '20px 20px 12px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-foreground)', letterSpacing: '-0.02em', marginBottom: '16px' }}>Messages</h2>

        {/* Search */}
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          background: 'var(--color-background-secondary)',
          borderRadius: '10px', padding: '0 12px', marginBottom: '4px',
        }}>
          <Search size={16} style={{ color: 'var(--color-foreground-secondary)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: 'var(--color-foreground)', fontSize: '15px',
              outline: 'none', padding: '10px 8px', fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button className="icon-btn" onClick={() => onSearchChange('')} style={{ padding: '4px' }}><X size={14} /></button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 80px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-foreground-secondary)', fontSize: '15px' }}>
            {searchQuery ? 'No results found' : 'No conversations yet'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filtered.map(conv => {
              const last = conv.messages[conv.messages.length - 1];
              const preview = last?.text?.startsWith('__reply__') ? last.text.slice(9) : last?.text ?? 'Started conversation';
              const isActive = activeId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    textAlign: 'left', padding: '12px',
                    borderRadius: '12px', border: 'none', cursor: 'pointer',
                    transition: 'all 0.15s ease', fontFamily: 'inherit',
                    background: isActive ? 'var(--color-primary-light)' : 'transparent',
                  }}
                  onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-foreground-quaternary)'; }}
                  onMouseOut={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--color-primary-light)' : 'transparent'; }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {conv.avatar_base64 ? (
                      <img src={conv.avatar_base64} alt={conv.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: '16px', background: conv.color,
                      }}>{conv.name.charAt(0).toUpperCase()}</div>
                    )}
                    {conv.online && (
                      <span style={{
                        position: 'absolute', bottom: '0', right: '0',
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: 'var(--color-success)',
                        border: '2px solid var(--color-background)',
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', marginLeft: '12px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', flexShrink: 0, marginLeft: '8px' }}>{last?.time ?? ''}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: conv.unread > 0 ? 'var(--color-foreground)' : 'var(--color-foreground-secondary)',
                        fontWeight: conv.unread > 0 ? 500 : 400,
                        flex: 1,
                      }}>
                        {last?.fromMe && <span style={{ color: 'var(--color-foreground-secondary)' }}>You: </span>}
                        {preview}
                      </span>
                      {conv.unread > 0 && (
                        <span style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'var(--color-primary)',
                          color: '#fff', fontSize: '11px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginLeft: '8px', flexShrink: 0,
                        }}>{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={onNewMessage}
        style={{
          position: 'absolute', bottom: '20px', right: '20px',
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'var(--color-primary)', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-lg)',
          transition: 'transform 0.15s ease, opacity 0.15s ease',
          zIndex: 20,
        }}
        onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

// ─── Contact Info Panel ───────────────────────────────────────────────────────

export function ContactInfoPanel({ conv, contacts: _contacts }: { conv: Conversation, contacts: ContactHint[] }) {
  return (
    <div style={{
      width: '300px', flexShrink: 0, height: '100%',
      background: 'var(--color-background)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)' }}>Contact Info</h3>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {conv.avatar_base64 ? (
            <img src={conv.avatar_base64} alt={conv.name} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '20px', background: conv.color,
            }}>{conv.name.charAt(0).toUpperCase()}</div>
          )}
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)', margin: 0 }}>{conv.name}</h3>
            <span style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>{conv.email}</span>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <InfoRow icon={<Mail size={14} />} label="Email" value={conv.email} />
          <InfoRow icon={<Phone size={14} />} label="Handle" value={conv.email.split('@')[0]} />
          {conv.bio && <InfoRow icon={<Info size={14} />} label="Bio" value={conv.bio} />}
        </div>
      </div>

      {/* Notes section */}
      <div style={{ borderTop: '1px solid var(--color-divider)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-foreground)', margin: 0 }}>Notes</h4>
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit',
          }}><Edit size={12} /> Add Note</button>
        </div>
        <div style={{
          background: 'var(--color-background-secondary)',
          borderRadius: 'var(--radius-md)',
          padding: '16px', fontSize: '13px', lineHeight: 1.5,
          color: 'var(--color-foreground)',
        }}>
          No notes yet.
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-foreground-secondary)', fontSize: '11px', marginTop: '8px' }}>
            <Calendar size={11} /> {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: 'var(--color-background-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-foreground-secondary)', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', marginBottom: '1px' }}>{label}</div>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  );
}

// ─── ChatView (exported) ──────────────────────────────────────────────────────

interface ChatViewProps {
  meName: string;
  conversations: Conversation[];
  contacts: ContactHint[];
  targetConvId: number | null;
  onUpdateConversations: (convs: Conversation[]) => void;
  onClearTarget: () => void;
  onSendMessage: (toEmail: string, text: string, attachment_urls?: string[]) => Promise<void>;
  onReadMessages?: (convId: number) => Promise<void>;
  onAddContact: (c: { name: string; email: string }) => Promise<void>;
  onVoiceCall?: (email: string, name: string) => void;
  API?: string;
  token?: string;
}

export default function ChatView({
  meName: _meName,
  conversations,
  contacts,
  targetConvId,
  onUpdateConversations,
  onClearTarget,
  onSendMessage,
  onReadMessages,
  onAddContact,
  onVoiceCall,
  API,
  token
}: ChatViewProps) {
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [_showWindow, setShowWindow] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  useEffect(() => {
    if (targetConvId !== null) {
      handleSelect(targetConvId);
      onClearTarget();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetConvId]);

  const handleSelect = useCallback((convId: number) => {
    setActiveConvId(convId);
    setSearchQuery('');
    setShowWindow(true);

    const conv = conversations.find(c => c.id === convId);
    if (conv && conv.unread > 0 && onReadMessages) {
       onReadMessages(conv.id);
    }

    onUpdateConversations(conversations.map(c =>
      c.id === convId ? { ...c, unread: 0 } : c
    ));
  }, [conversations, onReadMessages, onUpdateConversations]);

  const handleNewMsgSelect = useCallback((contact: ContactHint) => {
    setShowNewMsg(false);
    const existing = conversations.find(c => c.email === contact.email);
    if (existing) {
      handleSelect(existing.id);
    } else {
      const newConv: Conversation = {
        id: Date.now(),
        name: contact.name,
        email: contact.email,
        color: contact.color,
        online: false,
        lastSeen: 'Just added',
        messages: [],
        unread: 0,
      };
      const updated = [newConv, ...conversations];
      onUpdateConversations(updated);
      setActiveConvId(newConv.id);
      setShowWindow(true);
    }
  }, [conversations, handleSelect, onUpdateConversations]);

  const handleSend = async (convId: number, text: string, attachment_urls?: string[]) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    try {
      await onSendMessage(conv.email, text, attachment_urls);
    } catch(err) {
      console.error(err);
    }
  };

  const handleReact = useCallback((convId: number, msgId: number, emoji: string) => {
    onUpdateConversations(conversations.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: c.messages.map(m => {
          if (m.id !== msgId) return m;
          const current = m.reactions ?? [];
          const has = current.includes(emoji);
          return { ...m, reactions: has ? current.filter(r => r !== emoji) : [...current, emoji] };
        }),
      };
    }));
  }, [conversations, onUpdateConversations]);

  return (
    <AttachmentPreviewProvider>
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--color-background)' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', width: '350px', flexShrink: 0,
        borderRight: '1px solid var(--color-divider)',
      }}>
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          searchQuery={searchQuery}
          onSelect={handleSelect}
          onSearchChange={setSearchQuery}
          onNewMessage={() => setShowNewMsg(true)}
        />
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', background: 'var(--color-background)' }}>
        {activeConv ? (
          <div style={{ display: 'flex', height: '100%', width: '100%' }}>
            <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
              <ChatWindow
                conv={activeConv}
                contacts={contacts}
                onAddContact={onAddContact}
                onVoiceCall={onVoiceCall}
                onBack={() => setActiveConvId(null)}
                onSendMessage={handleSend}
                onReact={handleReact}
                API={API}
                token={token}
              />
            </div>
            <div style={{ display: 'none' }}>
              {/* Contact info panel - hidden by default, show on xl screens via media query */}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', width: '100%',
            color: 'var(--color-foreground-secondary)',
          }}>
            <div style={{ fontSize: '56px', marginBottom: '12px' }}>💬</div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-foreground)', marginBottom: '4px' }}>Your Messages</h2>
            <p style={{ fontSize: '15px', marginBottom: '20px' }}>Select a conversation or start a new one</p>
            <button className="ios-button" onClick={() => setShowNewMsg(true)}>
              <Edit size={16} /> New Message
            </button>
          </div>
        )}
      </div>

      {showNewMsg && (
        <NewMessageDialog
          contacts={contacts}
          existingConvs={conversations}
          onSelect={handleNewMsgSelect}
          onClose={() => setShowNewMsg(false)}
          token={token}
          API={API}
        />
      )}
    </div>
    </AttachmentPreviewProvider>
  );
}
