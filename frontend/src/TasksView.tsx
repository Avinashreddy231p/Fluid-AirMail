import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, CheckCircle2, Circle, Trash2, Calendar,
  Flag, ChevronRight, X, AlignLeft, Clock, Star,
  Loader2, Sparkles, Search
} from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description: string;
  is_completed: boolean;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  color: string;
  created_at: string;
}

const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '🔴' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🟡' },
  low:    { label: 'Low',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  icon: '🟢' },
};

const TASK_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#22c55e','#06b6d4','#3b82f6'];

export default function TasksView({ token, API }: { token: string; API: string }) {
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [adding, setAdding]             = useState(false);
  const [filter, setFilter]             = useState<'all' | 'active' | 'done'>('all');
  const [search, setSearch]             = useState('');
  const [savingId, setSavingId]         = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: Task[] = await res.json();
        setTasks(data.sort((a, b) => {
          const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
          if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
          return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
        }));
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [token]);

  useEffect(() => {
    if (selected) {
      const fresh = tasks.find(t => t.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [tasks]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAdding(true);
    const res = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newTaskTitle.trim(), priority: 'medium', color: '#6366f1' }),
    });
    if (res.ok) { setNewTaskTitle(''); fetchTasks(); }
    setAdding(false);
  };

  const toggleTask = async (task: Task) => {
    await fetch(`${API}/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_completed: !task.is_completed }),
    });
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await fetch(`${API}/tasks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (selected?.id === id) setSelected(null);
    fetchTasks();
  };

  const updateSelectedField = (field: Partial<Task>) => {
    if (!selected) return;
    const updated = { ...selected, ...field };
    setSelected(updated);
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavingId(updated.id);
    saveTimer.current = setTimeout(async () => {
      await fetch(`${API}/tasks/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(field),
      });
      setSavingId(null);
    }, 600);
  };

  const visible = tasks.filter(t => {
    const matchFilter = filter === 'all' || (filter === 'active' ? !t.is_completed : t.is_completed);
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const activeTasks = tasks.filter(t => !t.is_completed);
  const doneTasks   = tasks.filter(t =>  t.is_completed);
  const overdueCount = activeTasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--color-background)', position: 'relative' }}>
      {/* Left: task list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)', marginRight: selected ? '420px' : '0' }}>

        <div style={{ padding: '28px 32px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>My Tasks</h1>
              <p style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)', margin: '4px 0 0' }}>
                {activeTasks.length} active · {doneTasks.length} completed
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {overdueCount > 0 && (
                <div style={{ padding: '4px 10px', borderRadius: '9999px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠️ {overdueCount} Overdue
                </div>
              )}
              {(['all','active','done'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 16px', borderRadius: '9999px', fontSize: '13px', fontWeight: 600,
                  border: filter === f ? 'none' : '1px solid var(--color-border-premium)',
                  background: filter === f ? 'var(--color-primary)' : 'transparent',
                  color: filter === f ? '#fff' : 'var(--color-foreground-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-foreground-secondary)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." className="ios-input"
              style={{ width: '100%', padding: '10px 16px 10px 42px', borderRadius: '9999px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>

          <form onSubmit={addTask} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-background-secondary)', border: '2px solid var(--color-border-premium)', borderRadius: '16px', padding: '10px 16px' }}>
              <Plus size={18} color="var(--color-primary)" />
              <input ref={inputRef} value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Add a task (Press Enter to focus)..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '15px', color: 'var(--color-foreground)', fontFamily: 'inherit' }} />
            </div>
            <button type="submit" disabled={!newTaskTitle.trim() || adding} style={{
              background: newTaskTitle.trim() ? 'var(--color-primary)' : 'var(--color-background-secondary)',
              color: newTaskTitle.trim() ? '#fff' : 'var(--color-foreground-secondary)',
              border: 'none', borderRadius: '14px', padding: '0 20px',
              fontSize: '14px', fontWeight: 600, cursor: newTaskTitle.trim() ? 'pointer' : 'default',
              transition: 'all 0.25s', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
            </button>
          </form>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <Loader2 className="animate-spin" size={28} color="var(--color-primary)" />
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-foreground-secondary)' }}>
              <Sparkles size={40} style={{ margin: '0 auto 16px', opacity: 0.4, display: 'block' }} />
              <p style={{ fontSize: '16px', fontWeight: 500 }}>
                {search ? 'No tasks match your search' : filter === 'done' ? 'No completed tasks yet' : 'All caught up! 🎉'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visible.map(task => (
                <TaskRow key={task.id} task={task} selected={selected?.id === task.id} saving={savingId === task.id}
                  onSelect={() => setSelected(selected?.id === task.id ? null : task)}
                  onToggle={() => toggleTask(task)} onDelete={() => deleteTask(task.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '420px',
        background: 'var(--color-background-elevated)', borderLeft: '1px solid var(--color-border-premium)',
        display: 'flex', flexDirection: 'column',
        transform: selected ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 50, boxShadow: selected ? '-8px 0 40px rgba(0,0,0,0.15)' : 'none',
      }}>
        {selected && (
          <TaskDetail task={selected} saving={savingId === selected.id}
            onClose={() => setSelected(null)} onChange={updateSelectedField}
            onDelete={() => deleteTask(selected.id)} onToggle={() => toggleTask(selected)} />
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, selected, saving, onSelect, onToggle, onDelete }: {
  task: Task; selected: boolean; saving: boolean;
  onSelect: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isOverdue = task.due_date && !task.is_completed && new Date(task.due_date) < new Date();

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '16px',
        background: selected ? `linear-gradient(135deg, ${task.color}18, ${task.color}08)` : hovered ? 'var(--color-background-secondary)' : 'transparent',
        border: selected ? `1.5px solid ${task.color}50` : '1.5px solid transparent',
        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden',
        transform: hovered && !selected ? 'translateY(-1px) scale(1.005)' : 'none',
      }}>
      <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', borderRadius: '9999px', background: task.color, opacity: selected ? 1 : 0, transition: 'opacity 0.2s' }} />
      <button onClick={e => { e.stopPropagation(); onToggle(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0, color: task.is_completed ? task.color : 'var(--color-foreground-secondary)', transition: 'all 0.2s' }}>
        {task.is_completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 500, color: task.is_completed ? 'var(--color-foreground-secondary)' : 'var(--color-foreground)', textDecoration: task.is_completed ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          {task.due_date && (
            <span style={{ fontSize: '12px', color: isOverdue ? '#ef4444' : 'var(--color-foreground-secondary)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
              <Calendar size={11} /> {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span style={{ fontSize: '12px', color: pCfg.color, fontWeight: 600, background: pCfg.bg, padding: '1px 7px', borderRadius: '99px' }}>
            {pCfg.icon} {pCfg.label}
          </span>
          {task.description && (
            <span style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <AlignLeft size={11} /> Note
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
        {saving && <Loader2 size={14} className="animate-spin" color="var(--color-primary)" />}
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
          <Trash2 size={13} />
        </button>
      </div>
      <ChevronRight size={16} color="var(--color-foreground-secondary)" style={{ opacity: 0.5, flexShrink: 0 }} />
    </div>
  );
}

function TaskDetail({ task, saving, onClose, onChange, onDelete, onToggle }: {
  task: Task; saving: boolean;
  onClose: () => void; onChange: (f: Partial<Task>) => void;
  onDelete: () => void; onToggle: () => void;
}) {
  const isOverdue = task.due_date && !task.is_completed && new Date(task.due_date) < new Date();
  const dueDateValue = task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : '';

  return (
    <>
      <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: task.color }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Detail</span>
            {saving && <Loader2 size={13} className="animate-spin" color="var(--color-primary)" />}
          </div>
          <button onClick={onClose} style={{ background: 'var(--color-background-secondary)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-foreground-secondary)' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
          <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '3px', flexShrink: 0, color: task.is_completed ? task.color : 'var(--color-foreground-secondary)' }}>
            {task.is_completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
          </button>
          <input value={task.title} onChange={e => onChange({ title: e.target.value })}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '20px', fontWeight: 700, color: 'var(--color-foreground)', fontFamily: 'inherit', lineHeight: '1.3', textDecoration: task.is_completed ? 'line-through' : 'none', opacity: task.is_completed ? 0.6 : 1 }}
            placeholder="Task title..." />
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--color-border-premium)', margin: '16px 24px' }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-foreground-secondary)' }}>
            <AlignLeft size={16} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</span>
          </div>
          <textarea value={task.description || ''} onChange={e => onChange({ description: e.target.value })} placeholder="Add notes..."
            style={{ width: '100%', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-premium)', borderRadius: '12px', padding: '12px', fontSize: '14px', color: 'var(--color-foreground)', fontFamily: 'inherit', resize: 'none', minHeight: '90px', outline: 'none', lineHeight: '1.6', boxSizing: 'border-box' }} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: isOverdue ? '#ef4444' : 'var(--color-foreground-secondary)' }}>
            <Calendar size={16} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{isOverdue ? '⚠️ Overdue' : 'Due Date'}</span>
          </div>
          <input type="date" value={dueDateValue} onChange={e => onChange({ due_date: e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : null })}
            className="ios-input" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} />
          {task.due_date && (
            <button onClick={() => onChange({ due_date: null })} style={{ marginTop: '6px', background: 'none', border: 'none', color: 'var(--color-foreground-secondary)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
              Clear due date
            </button>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-foreground-secondary)' }}>
            <Flag size={16} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['high','medium','low'] as const).map(p => {
              const cfg = PRIORITY_CONFIG[p];
              return (
                <button key={p} onClick={() => onChange({ priority: p })} style={{
                  flex: 1, padding: '10px 0', borderRadius: '12px', border: '1.5px solid',
                  borderColor: task.priority === p ? cfg.color : 'var(--color-border-premium)',
                  background: task.priority === p ? cfg.bg : 'transparent',
                  color: task.priority === p ? cfg.color : 'var(--color-foreground-secondary)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}>
                  <span style={{ fontSize: '18px' }}>{cfg.icon}</span>{cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-foreground-secondary)' }}>
            <Star size={16} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Color Label</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {TASK_COLORS.map(c => (
              <button key={c} onClick={() => onChange({ color: c })} style={{
                width: '32px', height: '32px', borderRadius: '50%', background: c,
                border: task.color === c ? '3px solid white' : '3px solid transparent',
                outline: task.color === c ? `3px solid ${c}` : '3px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s',
              }} />
            ))}
          </div>
        </div>

        {task.created_at && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-foreground-secondary)' }}>
              <Clock size={16} />
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>
              {new Date(task.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', gap: '10px' }}>
          <button onClick={onToggle} style={{
            flex: 1, padding: '12px', borderRadius: '14px', border: 'none',
            background: task.is_completed ? 'rgba(99,102,241,0.1)' : task.color,
            color: task.is_completed ? 'var(--color-primary)' : '#fff',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {task.is_completed ? <><Circle size={16} /> Mark Incomplete</> : <><CheckCircle2 size={16} /> Complete</>}
          </button>
          <button onClick={onDelete} style={{
            padding: '12px 16px', borderRadius: '14px', border: 'none',
            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
