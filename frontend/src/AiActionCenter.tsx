import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, X, Activity, Mail, Trash2, Folder,
  Check, Sparkles, Calendar, CheckSquare,
  FileText, Clock, Flag, AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ErrorCard from './ErrorCard';

interface AiActionCenterProps {
  token: string;
  API: string;
  onClose: () => void;
  onRefreshData: () => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onClientAction?: (action: any) => void;
  contextSettings?: Record<string, any>;
}

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: any[];
  executedCount?: number;
};

const QUICK_PROMPTS = [
  { icon: '📅', text: "What is on my calendar today?" },
  { icon: '✅', text: 'Show my pending tasks' },
  { icon: '📝', text: 'Summarize my notes for me' },
  { icon: '📧', text: 'Summarize my recent emails' },
  { icon: '✨', text: 'Create a task to review my goals this week' },
  { icon: '🗓️', text: 'Schedule a focus block tomorrow at 9am' },
];

export default function AiActionCenter({ token, API, onClose, onRefreshData, messages, setMessages, onClientAction, contextSettings }: AiActionCenterProps) {
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleAsk = async (e: React.FormEvent | null, overrideQuery?: string) => {
    e?.preventDefault();
    const q = overrideQuery ?? query;
    if (!q.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    try {
      const res = await fetch(API + '/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ query: q, history, context_settings: contextSettings }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: data.answer, actions: data.actions || [] }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "I could not process that right now." }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: 'Failed to connect to the intelligence core.' }]);
    } finally { setLoading(false); }
  };

  const executeSingle = async (msgId: string, idx: number, action: any) => {
    const key = msgId + '-' + idx;
    setActionStates(prev => ({ ...prev, [key]: 'executing' }));
    const clientTypes = ['change_theme', 'draft_email'];
    if (clientTypes.includes(action.type)) {
      onClientAction?.(action);
      setActionStates(prev => ({ ...prev, [key]: 'done' }));
      return;
    }
    try {
      const res = await fetch(API + '/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ actions: [action] }),
      });
      const data = res.ok ? await res.json() : null;
      const success = data?.results?.[0]?.status === 'success';
      setActionStates(prev => ({ ...prev, [key]: success ? 'done' : 'error' }));
      if (success) onRefreshData();
    } catch {
      setActionStates(prev => ({ ...prev, [key]: 'error' }));
    }
  };

  const rejectAction = (msgId: string, idx: number) => {
    setActionStates(prev => ({ ...prev, [msgId + '-' + idx]: 'rejected' }));
  };

  const executeAll = async (msgId: string, actions: any[]) => {
    for (let i = 0; i < actions.length; i++) {
      const s = actionStates[msgId + '-' + i];
      if (s === 'rejected' || s === 'done') continue;
      await executeSingle(msgId, i, actions[i]);
    }
  };

  const allSettled = (msgId: string, actions: any[]) =>
    actions.every((_, i) => { const s = actionStates[msgId + '-' + i]; return s === 'done' || s === 'rejected'; });

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(4px)', zIndex: 9998 }} />

      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '460px', zIndex: 9999, background: 'var(--color-background-elevated)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', borderLeft: '1px solid var(--color-border-premium)', boxShadow: '-10px 0 40px rgba(0,0,0,0.13)', display: 'flex', flexDirection: 'column', padding: '28px 20px 16px' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.12)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'}
        >
          <X size={18} color="var(--color-foreground)" />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: '8px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 60%, #FF8C00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 5px rgba(255,165,0,0.12), 0 8px 32px rgba(255,165,0,0.4)' }}>
              <Sun size={28} color="#fff" strokeWidth={2.5} />
            </div>
          </motion.div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #FF8C00, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2 }}>Surya</h1>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-foreground-secondary)' }}>Your radiant AI assistant</p>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '12px', paddingRight: '2px' }}>

          {/* Quick prompts — shown only when no messages */}
          {messages.length === 0 && !loading && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', textAlign: 'center', marginBottom: '10px', fontWeight: 500 }}>Try asking Surya:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
                {QUICK_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => handleAsk(null, p.text)}
                    style={{ padding: '10px 11px', borderRadius: '12px', border: '1px solid var(--color-border-premium)', background: 'var(--color-background-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: 'var(--color-foreground)', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '7px', transition: 'all 0.15s', lineHeight: 1.35 }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-primary)'; el.style.background = 'var(--color-background)'; el.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border-premium)'; el.style.background = 'var(--color-background-secondary)'; el.style.transform = 'none'; }}
                  >
                    <span style={{ fontSize: '15px', flexShrink: 0, lineHeight: 1 }}>{p.icon}</span>
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => {
            const isErrorMsg = msg.role === 'assistant' && (msg.text.startsWith('AI Query failed:') || msg.text.startsWith('Error:') || msg.text.startsWith('Failed to connect'));
            return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
              {isErrorMsg ? (
                <div style={{ width: '100%' }}>
                  <ErrorCard error={msg.text} />
                </div>
              ) : (
                <div style={{ maxWidth: '88%', padding: '11px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', border: '1px solid var(--color-border-premium)', background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-background-secondary)', color: msg.role === 'user' ? '#fff' : 'var(--color-foreground)', fontSize: '14px', lineHeight: 1.55 }}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}

              {/* Action cards */}
              {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                <div style={{ marginTop: '12px', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-foreground-secondary)', marginBottom: '2px' }}>
                    {msg.actions.length} Proposed Action{msg.actions.length !== 1 ? 's' : ''}
                  </div>

                  {msg.actions.map((act, i) => {
                    const key = msg.id + '-' + i;
                    return (
                      <ActionCard key={i} action={act} state={actionStates[key] || 'pending'}
                        onConfirm={() => executeSingle(msg.id, i, act)}
                        onReject={() => rejectAction(msg.id, i)} />
                    );
                  })}

                  {!allSettled(msg.id, msg.actions) ? (
                    <button onClick={() => executeAll(msg.id, msg.actions!)}
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)', alignSelf: 'flex-start', marginTop: '2px', transition: 'all 0.2s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
                    >
                      <Sparkles size={14} /> Execute All
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
                      <Check size={15} /> All done!
                    </div>
                  )}
                </div>
              )}
            </div>
          )})}

          {loading && (
            <div style={{ display: 'flex', alignSelf: 'flex-start', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: '18px 18px 18px 4px', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-premium)' }}>
              <Sun size={16} color="#FFA500" className="animate-spin" />
              <span style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>Surya is thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleAsk} style={{ position: 'relative', marginTop: '12px' }}>
          <input type="text" autoFocus placeholder="Ask Surya anything..." value={query} onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', fontSize: '14px', padding: '13px 18px', paddingRight: '46px', borderRadius: '22px', border: '1px solid var(--color-border-premium)', background: 'var(--color-background-secondary)', outline: 'none', color: 'var(--color-foreground)', transition: 'all 0.2s', boxSizing: 'border-box' }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary-light)'}
            onBlur={e => e.currentTarget.style.boxShadow = 'none'}
          />
          <button type="submit" disabled={loading || !query.trim()}
            style={{ position: 'absolute', right: '7px', top: '7px', width: '32px', height: '32px', borderRadius: '16px', background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || !query.trim() ? 'default' : 'pointer', opacity: loading || !query.trim() ? 0.45 : 1, boxShadow: '0 4px 10px rgba(255,165,0,0.3)', transition: 'all 0.2s' }}>
            <Sun size={14} />
          </button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}

// ── ActionCard ─────────────────────────────────────────────────
function ActionCard({ action, state, onConfirm, onReject }: { action: any; state: string; onConfirm: () => void; onReject: () => void }) {
  const isDelete    = action.type.startsWith('delete_');
  const isDone      = state === 'done';
  const isRejected  = state === 'rejected';
  const isExecuting = state === 'executing';
  const isError     = state === 'error';

  const { icon, bg, label } = getActionMeta(action);

  const fmtTime = (t: string) => {
    try { return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return t; }
  };

  const cardBorder = isDone ? '#10b98140' : isRejected ? 'var(--color-border-premium)' : isError ? '#ef444440' : isDelete ? '#ef444420' : 'var(--color-border-premium)';
  const cardBg = isDone ? 'rgba(16,185,129,0.05)' : isRejected ? 'transparent' : isError ? 'rgba(239,68,68,0.05)' : 'var(--color-background-secondary)';

  return (
    <div style={{ background: cardBg, border: '1.5px solid ' + cardBorder, borderRadius: '14px', padding: '12px 13px', opacity: isRejected ? 0.4 : 1, transition: 'all 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: isDelete ? '#ef4444' : 'var(--color-foreground)', flex: 1 }}>{label}</span>
        {isDone      && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}><Check size={12} /> Done</span>}
        {isError     && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Error</span>}
        {isRejected  && <span style={{ fontSize: '11px', color: 'var(--color-foreground-secondary)', fontWeight: 600 }}>Skipped</span>}
      </div>

      {/* Preview */}
      <div style={{ background: 'var(--color-background)', borderRadius: '9px', padding: '9px 11px', marginBottom: '9px', fontSize: '13px' }}>
        {(action.type === 'create_task' || action.type === 'edit_task') && (
          <>
            <div style={{ fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>{action.title || 'Task ID: ' + action.task_id}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {action.due_date && <span style={{ fontSize: '11px', color: 'var(--color-foreground-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} />{fmtTime(action.due_date)}</span>}
              {action.priority && <span style={{ fontSize: '11px', fontWeight: 600, color: action.priority === 'high' ? '#ef4444' : action.priority === 'medium' ? '#f59e0b' : '#22c55e', display: 'flex', alignItems: 'center', gap: '2px' }}><Flag size={10} />{action.priority}</span>}
              {action.description && <span style={{ fontSize: '11px', color: 'var(--color-foreground-secondary)' }}>{action.description.slice(0, 55)}{action.description.length > 55 ? '…' : ''}</span>}
            </div>
          </>
        )}
        {(action.type === 'create_note' || action.type === 'edit_note') && (
          <>
            <div style={{ fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>{action.title || 'Note ID: ' + action.note_id}</div>
            {action.content && <div style={{ fontSize: '11.5px', color: 'var(--color-foreground-secondary)', lineHeight: 1.45 }}>{action.content.slice(0, 110)}{action.content.length > 110 ? '…' : ''}</div>}
          </>
        )}
        {(action.type === 'create_calendar_event' || action.type === 'edit_calendar_event') && (
          <>
            <div style={{ fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>{action.title || 'Event ID: ' + action.event_id}</div>
            {(action.start_time || action.end_time) && (
              <div style={{ fontSize: '11.5px', color: 'var(--color-foreground-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} /> {action.start_time ? fmtTime(action.start_time) : ''}{action.end_time ? ' → ' + fmtTime(action.end_time) : ''}
              </div>
            )}
          </>
        )}
        {(action.type === 'toggle_task' || action.type === 'complete_task') && (
          <div style={{ color: 'var(--color-foreground)' }}>
            <span style={{ fontWeight: 600 }}>Task ID: {action.task_id}</span>
            <span style={{ color: 'var(--color-foreground-secondary)', fontSize: '12px', marginLeft: '8px' }}>
              {action.type === 'complete_task' ? '→ Mark as complete' : '→ Toggle completion'}
            </span>
          </div>
        )}
        {!['create_task','edit_task','create_note','edit_note','create_calendar_event','edit_calendar_event','toggle_task','complete_task'].includes(action.type) && (
          <div style={{ color: 'var(--color-foreground-secondary)', fontSize: '12px', fontFamily: 'monospace' }}>
            {JSON.stringify(action, null, 2).slice(0, 130)}
          </div>
        )}
      </div>

      {/* Delete warning */}
      {isDelete && !isDone && !isRejected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ef4444', marginBottom: '8px', background: 'rgba(239,68,68,0.07)', padding: '6px 9px', borderRadius: '8px' }}>
          <AlertTriangle size={12} /> Cannot be undone
        </div>
      )}

      {/* Buttons */}
      {!isDone && !isRejected && (
        <div style={{ display: 'flex', gap: '7px' }}>
          <button onClick={onConfirm} disabled={isExecuting}
            style={{ flex: 1, padding: '8px 0', borderRadius: '9px', border: 'none', background: isDelete ? '#ef4444' : 'var(--color-primary)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isExecuting ? 'default' : 'pointer', opacity: isExecuting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.15s' }}>
            {isExecuting ? <Activity size={13} className="animate-spin" /> : <Check size={13} />}
            {isExecuting ? 'Running…' : isDelete ? 'Delete' : 'Apply'}
          </button>
          <button onClick={onReject} disabled={isExecuting}
            style={{ padding: '8px 13px', borderRadius: '9px', border: '1px solid var(--color-border-premium)', background: 'transparent', color: 'var(--color-foreground-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}>
            <X size={12} /> Skip
          </button>
        </div>
      )}
    </div>
  );
}

function getActionMeta(action: any): { icon: React.ReactNode; bg: string; label: string } {
  switch (action.type) {
    case 'create_task':           return { icon: <CheckSquare size={15} color="#10b981" />, bg: 'rgba(16,185,129,0.12)',  label: 'Create Task' };
    case 'edit_task':             return { icon: <CheckSquare size={15} color="#3b82f6" />, bg: 'rgba(59,130,246,0.12)',  label: 'Edit Task' };
    case 'delete_task':           return { icon: <Trash2      size={15} color="#ef4444" />, bg: 'rgba(239,68,68,0.12)',   label: 'Delete Task' };
    case 'toggle_task':           return { icon: <CheckSquare size={15} color="#8b5cf6" />, bg: 'rgba(139,92,246,0.12)',  label: 'Toggle Task' };
    case 'complete_task':         return { icon: <Check       size={15} color="#10b981" />, bg: 'rgba(16,185,129,0.12)',  label: 'Complete Task' };
    case 'create_note':           return { icon: <FileText    size={15} color="#f59e0b" />, bg: 'rgba(245,158,11,0.12)',  label: 'Create Note' };
    case 'edit_note':             return { icon: <FileText    size={15} color="#3b82f6" />, bg: 'rgba(59,130,246,0.12)',  label: 'Edit Note' };
    case 'delete_note':           return { icon: <Trash2      size={15} color="#ef4444" />, bg: 'rgba(239,68,68,0.12)',   label: 'Delete Note' };
    case 'create_calendar_event': return { icon: <Calendar    size={15} color="#f43f5e" />, bg: 'rgba(244,63,94,0.12)',   label: 'Schedule Event' };
    case 'edit_calendar_event':   return { icon: <Calendar    size={15} color="#3b82f6" />, bg: 'rgba(59,130,246,0.12)',  label: 'Edit Event' };
    case 'delete_calendar_event': return { icon: <Trash2      size={15} color="#ef4444" />, bg: 'rgba(239,68,68,0.12)',   label: 'Delete Event' };
    case 'draft_email':           return { icon: <Mail        size={15} color="#3b82f6" />, bg: 'rgba(59,130,246,0.12)',  label: 'Draft Email' };
    case 'send_mail':             return { icon: <Mail        size={15} color="#10b981" />, bg: 'rgba(16,185,129,0.12)',  label: 'Send Email' };
    case 'trash_mail':            return { icon: <Trash2      size={15} color="#ef4444" />, bg: 'rgba(239,68,68,0.12)',   label: 'Trash Email' };
    case 'create_folder':         return { icon: <Folder      size={15} color="#f59e0b" />, bg: 'rgba(245,158,11,0.12)',  label: 'Create Folder "' + action.name + '"' };
    case 'change_theme':          return { icon: <Sparkles    size={15} color="#8b5cf6" />, bg: 'rgba(139,92,246,0.12)',  label: 'Theme → ' + action.theme };
    default:                      return { icon: <Sparkles    size={15} color="var(--color-primary)" />, bg: 'rgba(99,102,241,0.1)', label: action.type };
  }
}
