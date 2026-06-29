import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Edit3, Trash2, X, Loader2, Check, Sparkles, Copy
} from 'lucide-react';

const API = 'http://127.0.0.1:8000';

interface Template {
  id: number;
  name: string;
  content: string;
  tone: string;
  created_at: string;
}

interface TemplatesViewProps {
  token: string;
  onUseTemplate: (subject: string, body: string) => void;
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'formal', label: 'Formal', emoji: '📋' },
  { value: 'casual', label: 'Casual', emoji: '🎯' },
  { value: 'sales', label: 'Sales', emoji: '📈' },
];

const STARTER_TEMPLATES = [
  { name: 'Meeting Follow-up', content: 'Hi {{recipient_name}},\n\nThank you for meeting with me today. I wanted to follow up on the key points we discussed:\n\n- {{key_point_1}}\n- {{key_point_2}}\n\nPlease let me know if you have any questions or need further clarification.\n\nBest regards,\n{{sender_name}}', tone: 'professional' },
  { name: 'Introduction Email', content: 'Dear {{recipient_name}},\n\nI hope this email finds you well. My name is {{sender_name}} from {{company}}.\n\nI\'m reaching out because {{reason}}.\n\nI would love to schedule a brief call to discuss this further. Would you be available for a 15-minute call this week?\n\nLooking forward to hearing from you.\n\nBest regards,\n{{sender_name}}', tone: 'professional' },
  { name: 'Thank You Note', content: 'Hi {{recipient_name}},\n\nI just wanted to take a moment to thank you for {{reason}}. It really meant a lot and made a big difference.\n\nPlease don\'t hesitate to reach out if there\'s anything I can help you with in return!\n\nWarmly,\n{{sender_name}}', tone: 'friendly' },
];

export default function TemplatesView({ token, onUseTemplate }: TemplatesViewProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [tone, setTone] = useState('professional');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const url = editingTemplate
        ? `${API}/templates/${editingTemplate.id}`
        : `${API}/templates`;
      const method = editingTemplate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, content, tone }),
      });
      if (res.ok) {
        await loadTemplates();
        closeEditor();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${API}/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  };

  const handleUseDraft = async (template: Template) => {
    setDraftingId(template.id);
    try {
      const res = await fetch(`${API}/ai/draft-from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template_id: template.id,
          placeholders: {},
          tone: template.tone,
          context: '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onUseTemplate(data.subject || '', data.body || template.content);
      } else {
        // Fallback: use template content directly
        onUseTemplate('', template.content);
      }
    } catch (e) {
      // Fallback: use template content directly
      onUseTemplate('', template.content);
    } finally {
      setDraftingId(null);
    }
  };

  const handleUseDirectly = (template: Template) => {
    onUseTemplate('', template.content);
  };

  const handleCopy = (template: Template) => {
    navigator.clipboard.writeText(template.content);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEditor = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setName(template.name);
      setContent(template.content);
      setTone(template.tone);
    } else {
      setEditingTemplate(null);
      setName('');
      setContent('');
      setTone('professional');
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingTemplate(null);
    setName('');
    setContent('');
    setTone('professional');
  };

  const handleAddStarter = async (starter: typeof STARTER_TEMPLATES[0]) => {
    try {
      const res = await fetch(`${API}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(starter),
      });
      if (res.ok) await loadTemplates();
    } catch (e) { console.error(e); }
  };

  const getToneEmoji = (t: string) => TONE_OPTIONS.find(o => o.value === t)?.emoji || '📝';

  if (loading) {
    return (
      <div className="templates-loading">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--color-foreground-secondary)', marginTop: '12px' }}>Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="templates-view">
      {/* Header */}
      <div className="templates-header">
        <div>
          <h1 className="templates-title">
            <FileText size={24} style={{ color: 'var(--color-primary)' }} />
            Email Templates
          </h1>
          <p className="templates-subtitle">
            Create reusable templates with dynamic placeholders like {'{{recipient_name}}'}
          </p>
        </div>
        <button className="templates-create-btn" onClick={() => openEditor()}>
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="templates-empty">
          <FileText size={48} style={{ color: 'var(--color-foreground-tertiary)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '8px' }}>No templates yet</h3>
          <p style={{ fontSize: '14px', color: 'var(--color-foreground-secondary)', marginBottom: '24px' }}>
            Get started with a pre-built template or create your own.
          </p>
          <div className="templates-starters">
            {STARTER_TEMPLATES.map((st, i) => (
              <button key={i} className="template-starter-btn" onClick={() => handleAddStarter(st)}>
                <Plus size={14} /> {st.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map(template => (
            <div key={template.id} className="template-card">
              <div className="template-card-header">
                <div className="template-card-tone-badge">{getToneEmoji(template.tone)}</div>
                <h3 className="template-card-name">{template.name}</h3>
                <span className="template-card-tone-label">{template.tone}</span>
              </div>
              <div className="template-card-preview">
                {template.content.substring(0, 150)}
                {template.content.length > 150 ? '...' : ''}
              </div>
              <div className="template-card-actions">
                <button
                  className="template-action-btn primary"
                  onClick={() => handleUseDraft(template)}
                  disabled={draftingId === template.id}
                  title="AI Draft: Fill placeholders and adjust tone"
                >
                  {draftingId === template.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Sparkles size={14} />}
                  AI Draft
                </button>
                <button
                  className="template-action-btn"
                  onClick={() => handleUseDirectly(template)}
                  title="Use template content as-is"
                >
                  <FileText size={14} /> Use
                </button>
                <button
                  className="template-action-btn"
                  onClick={() => handleCopy(template)}
                  title="Copy to clipboard"
                >
                  {copiedId === template.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button className="template-action-btn" onClick={() => openEditor(template)} title="Edit">
                  <Edit3 size={14} />
                </button>
                <button
                  className="template-action-btn danger"
                  onClick={() => handleDelete(template.id)}
                  disabled={deletingId === template.id}
                  title="Delete"
                >
                  {deletingId === template.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Starter Suggestions (shown when templates exist) */}
      {templates.length > 0 && templates.length < 5 && (
        <div className="templates-starters-row">
          <span className="templates-starters-label">Add a starter:</span>
          {STARTER_TEMPLATES.filter(st => !templates.find(t => t.name === st.name)).map((st, i) => (
            <button key={i} className="template-starter-chip" onClick={() => handleAddStarter(st)}>
              <Plus size={12} /> {st.name}
            </button>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="template-editor-overlay animate-fade-in">
          <div className="template-editor animate-scale-in">
            <div className="template-editor-header">
              <h2>{editingTemplate ? 'Edit Template' : 'Create Template'}</h2>
              <button className="template-editor-close" onClick={closeEditor}><X size={20} /></button>
            </div>
            <div className="template-editor-body">
              <div className="template-editor-field">
                <label>Template Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Meeting Follow-up"
                  className="ios-input"
                />
              </div>
              <div className="template-editor-field">
                <label>Tone</label>
                <div className="template-tone-selector">
                  {TONE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`template-tone-btn ${tone === opt.value ? 'active' : ''}`}
                      onClick={() => setTone(opt.value)}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="template-editor-field">
                <label>
                  Content
                  <span className="template-hint">Use {'{{variable_name}}'} for dynamic placeholders</span>
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={'Hi {{recipient_name}},\n\nI wanted to reach out regarding {{topic}}...\n\nBest,\n{{sender_name}}'}
                  rows={12}
                  className="ios-input"
                  style={{ resize: 'vertical', minHeight: '200px' }}
                />
              </div>
            </div>
            <div className="template-editor-footer">
              <button className="template-editor-cancel" onClick={closeEditor}>Cancel</button>
              <button
                className="template-editor-save"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
