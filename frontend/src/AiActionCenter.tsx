import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, X, Activity, Mail, MessageCircle, Trash2, Folder, Tag as TagIcon, Check, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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

export default function AiActionCenter({ token, API, onClose, onRefreshData, messages, setMessages, onClientAction, contextSettings }: AiActionCenterProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingMap, setExecutingMap] = useState<Record<string, boolean>>({});
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    
    // Prepare history for backend
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    
    try {
      const res = await fetch(`${API}/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: userMsg.text, history, context_settings: contextSettings })
      });
      if (res.ok) {
        const data = await res.json();
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.answer,
          actions: data.actions || []
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "I couldn't process that right now." }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "Failed to connect to the intelligence core." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (msgId: string, actions: any[]) => {
    if (!actions || actions.length === 0) return;

    // Filter out client actions
    const backendActions = actions.filter(a => a.type !== 'change_theme' && a.type !== 'draft_email');
    const clientActions = actions.filter(a => a.type === 'change_theme' || a.type === 'draft_email');

    clientActions.forEach(a => onClientAction?.(a));

    if (backendActions.length === 0) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, executedCount: clientActions.length } : m));
      return;
    }

    setExecutingMap(prev => ({ ...prev, [msgId]: true }));
    try {
      const res = await fetch(`${API}/ai/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actions: backendActions })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, executedCount: (data.results?.length || 0) + clientActions.length } : m));
        onRefreshData();
      }
    } finally {
      setExecutingMap(prev => ({ ...prev, [msgId]: false }));
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998
        }}
      />

      {/* Sidebar */}
      <motion.div 
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px',
          zIndex: 9999,
          background: 'var(--color-background-elevated)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderLeft: '1px solid var(--color-border-premium)',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column',
          padding: '32px 24px',
        }}
      >
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 10, background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
        >
          <X size={20} color="var(--color-foreground)" />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'inline-block', marginBottom: '10px' }}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 60%, #FF8C00 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 6px rgba(255, 165, 0, 0.15), 0 10px 40px rgba(255, 165, 0, 0.5)',
            }}>
              <Sun size={32} color="#fff" strokeWidth={2.5} />
            </div>
          </motion.div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, background: 'linear-gradient(90deg, #FF8C00, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2 }}>
            Surya
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-foreground-secondary)', fontWeight: 500 }}>Your radiant AI assistant</p>
        </div>

        {/* Chat Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '24px', paddingRight: '8px' }}>
          {messages.length === 0 && !loading && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-foreground-secondary)', fontSize: '15px' }}>
              <Sun size={36} color="#FFB347" style={{ marginBottom: '10px', opacity: 0.5 }} />
              <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>Namaste! I'm Surya.</div>
              <div>Ask me anything about your inbox, contacts, or let me take action for you.</div>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: '18px',
                border: '1px solid var(--color-border-premium)',
                background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-background-secondary)',
                color: msg.role === 'user' ? '#ffffff' : 'var(--color-foreground)',
                fontSize: '15px',
                lineHeight: 1.5,
              }}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              
              {/* Proposed Actions inline */}
              {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                <div style={{ marginTop: '16px', width: '100%' }}>
                  <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-foreground-secondary)', marginBottom: '12px', fontWeight: 600 }}>Proposed Actions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {msg.actions.map((act, i) => (
                      <ActionCard key={i} action={act} />
                    ))}
                  </div>
                  
                  {msg.executedCount !== undefined && msg.executedCount > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, fontSize: '14px' }}>
                      <Check size={18} /> Successfully executed {msg.executedCount} action{msg.executedCount !== 1 ? 's' : ''}!
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleExecute(msg.id, msg.actions!)}
                      disabled={executingMap[msg.id]}
                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: '1px solid var(--color-border-premium)', borderRadius: '12px', padding: '12px 20px', fontSize: '15px', fontWeight: 600, cursor: executingMap[msg.id] ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)', opacity: executingMap[msg.id] ? 0.7 : 1 }}
                    >
                      {executingMap[msg.id] ? <Activity size={18} className="animate-spin" /> : <Sparkles size={18} />}
                      {executingMap[msg.id] ? 'Executing...' : 'Execute All Actions'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignSelf: 'flex-start', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '18px', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-premium)' }}>
              <Sun size={18} color="#FFA500" className="animate-spin" />
              <span style={{ fontSize: '14px', color: 'var(--color-foreground-secondary)' }}>Surya is thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleAsk} style={{ position: 'relative', marginTop: '16px' }}>
          <input 
            type="text" 
            autoFocus
            placeholder="Follow up..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', fontSize: '15px', padding: '16px 20px', paddingRight: '50px', borderRadius: '24px', border: '1px solid var(--color-border-premium)', background: 'var(--color-background-secondary)', outline: 'none', color: 'var(--color-foreground)', transition: 'all 0.3s' }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary-light)'}
            onBlur={e => e.currentTarget.style.boxShadow = 'none'}
          />
          <button type="submit" disabled={loading || !query.trim()} style={{ position: 'absolute', right: '8px', top: '8px', width: '34px', height: '34px', borderRadius: '17px', background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || !query.trim() ? 'default' : 'pointer', opacity: loading || !query.trim() ? 0.5 : 1, boxShadow: '0 4px 12px rgba(255, 165, 0, 0.4)' }}>
            <Sun size={16} />
          </button>
        </form>

      </motion.div>
    </AnimatePresence>
  );
}

function ActionCard({ action }: { action: any }) {
  const getIcon = () => {
    switch (action.type) {
      case 'draft_email': return <Mail size={20} color="#3b82f6" />;
      case 'send_chat': return <MessageCircle size={20} color="#10b981" />;
      case 'trash_mail': return <Trash2 size={20} color="#ef4444" />;
      case 'create_folder': return <Folder size={20} color="#f59e0b" />;
      case 'group_mail': return <Folder size={20} color="#8b5cf6" />;
      case 'tag_mail': return <TagIcon size={20} color="#6366f1" />;
      default: return <Sparkles size={20} color="var(--color-primary)" />;
    }
  };

  const getTitle = () => {
    switch (action.type) {
      case 'draft_email': return `Draft Email to ${action.to}`;
      case 'send_chat': return `Send Chat to ${action.to}`;
      case 'trash_mail': return `Trash Mail (ID: ${action.mail_id})`;
      case 'create_folder': return `Create Folder "${action.name}"`;
      case 'group_mail': return `Move Mail to "${action.folder_name}"`;
      case 'tag_mail': return `Tag Mail as "${action.tag_name}"`;
      case 'change_theme': return `Change Theme to "${action.theme}"`;
      case 'send_mail': return `Send Email to ${action.to?.join(', ')}`;
      default: return 'Unknown Action';
    }
  };

  const getPreview = () => {
    if (action.subject) return `Subject: ${action.subject}`;
    if (action.text) return action.text.substring(0, 50) + (action.text.length > 50 ? '...' : '');
    return null;
  };

  return (
    <div style={{ background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-premium)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {getIcon()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--color-foreground)', fontSize: '15px' }}>{getTitle()}</div>
        {getPreview() && <div style={{ fontSize: '14px', color: 'var(--color-foreground-secondary)', marginTop: '4px' }}>{getPreview()}</div>}
      </div>
    </div>
  );
}
