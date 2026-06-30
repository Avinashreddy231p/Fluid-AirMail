import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, CheckSquare, X, Plus, GripVertical, Calendar, CheckCircle2 } from 'lucide-react';

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  color?: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  is_completed: boolean;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  color: string;
}

const PRIORITY_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

const toLocalISO = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function CalendarView({ token, API }: { token: string; API: string }) {
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [loading, setLoading]         = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView]               = useState<'week'|'day'>('week');
  const [showModal, setShowModal]     = useState(false);
  const [editEvent, setEditEvent]     = useState<CalendarEvent | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [modalData, setModalData]     = useState({
    title: '', start_time: '', end_time: '', description: '', color: '#6366f1',
  });
  const [modalLoading, setModalLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const nowRef  = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [evRes, taskRes] = await Promise.all([
        fetch(`${API}/calendar`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/tasks`,    { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (evRes.ok)   setEvents(await evRes.json());
      if (taskRes.ok) setTasks(await taskRes.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [token]);

  // Scroll to current time on mount
  useEffect(() => {
    setTimeout(() => {
      if (nowRef.current) nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  }, [loading]);

  /* ── week helpers ─────────────────────────────────────────── */
  const getDaysInWeek = () => {
    const days: Date[] = [];
    const curr = new Date(currentDate);
    curr.setDate(curr.getDate() - curr.getDay());
    for (let i = 0; i < 7; i++) { days.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
    return days;
  };
  const getDayView = () => [new Date(currentDate)];

  const days  = view === 'week' ? getDaysInWeek() : getDayView();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  /* ── navigation ───────────────────────────────────────────── */
  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else                 d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  /* ── modal helpers ────────────────────────────────────────── */
  const openNewEvent = (hour: number, day: Date) => {
    const start = new Date(day); start.setHours(hour, 0, 0, 0);
    const end   = new Date(start); end.setHours(hour + 1);
    setEditEvent(null);
    setModalData({ title: '', description: '', start_time: toLocalISO(start), end_time: toLocalISO(end), color: '#6366f1' });
    setShowModal(true);
  };

  const openEditEvent = (ev: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditEvent(ev);
    setModalData({
      title: ev.title, description: ev.description,
      start_time: toLocalISO(new Date(ev.start_time)),
      end_time:   toLocalISO(new Date(ev.end_time)),
      color: '#6366f1',
    });
    setShowModal(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData.title) return;
    setModalLoading(true);
    try {
      const body = JSON.stringify({
        title: modalData.title, description: modalData.description,
        start_time: new Date(modalData.start_time).toISOString(),
        end_time:   new Date(modalData.end_time).toISOString(),
      });
      if (editEvent) {
        await fetch(`${API}/calendar/${editEvent.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        await fetch(`${API}/calendar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body,
        });
      } else {
        await fetch(`${API}/calendar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body,
        });
      }
      setShowModal(false);
      fetchAll();
    } finally { setModalLoading(false); }
  };

  const deleteEventFromModal = async () => {
    if (!editEvent) return;
    await fetch(`${API}/calendar/${editEvent.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setShowModal(false);
    fetchAll();
  };

  /* ── drag & drop: task → calendar ────────────────────────── */
  const handleDrop = async (e: React.DragEvent, hour: number, day: Date) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const taskData = JSON.parse(raw) as { id: number; title: string; color: string };
      const start = new Date(day); start.setHours(hour, 0, 0, 0);
      const end   = new Date(start); end.setHours(hour + 1);
      await fetch(`${API}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: taskData.title, description: 'Scheduled task', start_time: start.toISOString(), end_time: end.toISOString(), color: taskData.color, task_id: taskData.id }),
      });
      // Set task due date to this day
      await fetch(`${API}/tasks/${taskData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ due_date: start.toISOString() }),
      });
      // Show success toast (basic implementation via alert for now if no toast system, but let's just fetch)
      fetchAll();
    } catch (err) { console.error('Drop error', err); }
  };


  /* ── current time indicator ───────────────────────────────── */
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTopPercent = (nowMinutes / (24 * 60)) * 100;

  const CELL_HEIGHT = 60; // px per hour

  const activeTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  // Mini month view
  const miniMonthDays = () => {
    const d = new Date(currentDate);
    d.setDate(1);
    const dayOfWeek = d.getDay();
    const mm = [];
    d.setDate(d.getDate() - dayOfWeek);
    for (let i = 0; i < 42; i++) {
      mm.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return mm;
  };
  const mmDays = miniMonthDays();

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'inherit' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div style={{ width: '260px', borderRight: '1px solid var(--color-border-premium)', background: 'var(--color-background-secondary)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Mini Month */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border-premium)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--color-foreground)' }}>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--color-foreground-secondary)' }}><ChevronLeft size={14} /></button>
              <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--color-foreground-secondary)' }}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '10px', color: 'var(--color-foreground-secondary)', fontWeight: 600, marginBottom: '4px' }}>
            {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {mmDays.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              const isSelected = d.toDateString() === currentDate.toDateString();
              const isCurrentMonth = d.getMonth() === currentDate.getMonth();
              return (
                <button
                  key={i}
                  onClick={() => setCurrentDate(d)}
                  style={{
                    padding: '4px 0', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                    background: isSelected ? 'var(--color-primary)' : 'transparent',
                    color: isSelected ? '#fff' : isToday ? 'var(--color-primary)' : isCurrentMonth ? 'var(--color-foreground)' : 'var(--color-foreground-secondary)',
                    fontWeight: isSelected || isToday ? 700 : 500,
                  }}
                >{d.getDate()}</button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--color-border-premium)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={17} color="var(--color-primary)" /> Tasks
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', margin: '4px 0 0' }}>
            Drag to schedule on calendar
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {activeTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--color-foreground-secondary)', fontSize: '13px' }}>
              🎉 No pending tasks!
            </div>
          ) : (
            <>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px', marginBottom: '8px' }}>
                Active ({activeTasks.length})
              </div>
              {activeTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: task.id, title: task.title, color: task.color || '#6366f1' }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{
                    padding: '10px 12px', borderRadius: '12px', marginBottom: '6px', cursor: 'grab',
                    background: 'var(--color-background)', border: `1px solid ${task.color || '#6366f1'}30`,
                    borderLeft: `3px solid ${task.color || '#6366f1'}`,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', userSelect: 'none',
                  }}
                  onMouseEnter={e => { 
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${task.color || '#6366f1'}25`; 
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px) scale(1.01)';
                  }}
                  onMouseLeave={e => { 
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none'; 
                    (e.currentTarget as HTMLElement).style.transform = 'none';
                  }}
                >
                  <GripVertical size={14} color="var(--color-foreground-secondary)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                    {task.due_date && (
                      <div style={{ fontSize: '11px', color: 'var(--color-foreground-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={10} /> {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORITY_COLOR[task.priority] || '#6366f1', flexShrink: 0 }} />
                </div>
              ))}

              {completedTasks.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px', marginBottom: '8px', marginTop: '16px' }}>
                    Completed ({completedTasks.length})
                  </div>
                  {completedTasks.slice(0, 5).map(task => (
                    <div key={task.id} style={{ padding: '8px 12px', borderRadius: '10px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                      <CheckCircle2 size={14} color={task.color || '#6366f1'} />
                      <span style={{ fontSize: '12px', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main Calendar ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-premium)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-premium)', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
              <ChevronLeft size={17} />
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, minWidth: '160px', textAlign: 'center' }}>
              {view === 'day'
                ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : `${getDaysInWeek()[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${getDaysInWeek()[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </h1>
            <button onClick={() => navigate(1)} style={{ background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-premium)', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} style={{ padding: '6px 14px', borderRadius: '9999px', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-premium)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
              Today
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(['day','week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 16px', borderRadius: '9999px', fontSize: '13px', fontWeight: 600,
                border: view === v ? 'none' : '1px solid var(--color-border-premium)',
                background: view === v ? 'var(--color-primary)' : 'transparent',
                color: view === v ? '#fff' : 'var(--color-foreground-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
            <button onClick={() => { setEditEvent(null); const n = new Date(); setModalData({ title: '', description: '', start_time: toLocalISO(n), end_time: toLocalISO(new Date(n.getTime()+3600000)), color: '#6366f1' }); setShowModal(true); }}
              style={{ padding: '8px 18px', borderRadius: '9999px', background: 'var(--color-primary)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
              <Plus size={16} /> New Event
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={30} color="var(--color-primary)" />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} ref={gridRef}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${days.length}, 1fr)`, position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-background)', borderBottom: '1px solid var(--color-border-premium)' }}>
              <div />
              {days.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderLeft: '1px solid var(--color-border-premium)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: isToday ? 'var(--color-primary)' : 'var(--color-foreground-secondary)', letterSpacing: '0.04em' }}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div style={{
                      fontSize: '22px', fontWeight: 800, lineHeight: 1.2, marginTop: '2px',
                      color: isToday ? '#fff' : 'var(--color-foreground)',
                      background: isToday ? 'var(--color-primary)' : 'transparent',
                      borderRadius: '50%', width: isToday ? '36px' : 'auto', height: isToday ? '36px' : 'auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: isToday ? '4px auto 0' : '4px auto 0',
                    }}>
                      {day.getDate()}
                    </div>
                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '6px', height: '6px' }}>
                      {activeTasks
                        .filter(t => t.due_date && new Date(t.due_date).toDateString() === day.toDateString())
                        .map((t, idx) => (
                          idx < 3 && <div key={t.id} style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.color || '#6366f1' }} title={t.title} />
                        ))}
                      {activeTasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === day.toDateString()).length > 3 && (
                        <div style={{ fontSize: '9px', lineHeight: '6px', color: 'var(--color-foreground-secondary)', fontWeight: 700 }}>+</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${days.length}, 1fr)`, position: 'relative' }}>
              {/* Time labels column */}
              <div style={{ position: 'relative' }}>
                {hours.map(hour => (
                  <div key={hour} style={{ height: `${CELL_HEIGHT}px`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '10px', paddingTop: '2px' }}>
                    {hour > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-foreground-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour-12} PM`}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day, dIdx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const dayEvents = events.filter(ev => {
                  const d = new Date(ev.start_time);
                  return d.toDateString() === day.toDateString();
                });

                return (
                  <div key={dIdx} style={{ borderLeft: '1px solid var(--color-border-premium)', position: 'relative', background: isToday ? 'rgba(99,102,241,0.02)' : 'transparent' }}>
                    {/* Hour cells */}
                    {hours.map(hour => {
                      const cellKey = `${dIdx}-${hour}`;
                      const isDragOver = dragOverCell === cellKey;
                      return (
                        <div
                          key={hour}
                          style={{
                            height: `${CELL_HEIGHT}px`, borderTop: '1px solid var(--color-border-premium)',
                            background: isDragOver ? 'rgba(99,102,241,0.08)' : 'transparent',
                            cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
                          }}
                          onClick={() => openNewEvent(hour, day)}
                          onDragEnter={e => e.preventDefault()}
                          onDragOver={e => { e.preventDefault(); setDragOverCell(cellKey); }}
                          onDragLeave={() => setDragOverCell(null)}
                          onDrop={e => handleDrop(e, hour, day)}
                          onMouseEnter={e => { if (!isDragOver) (e.currentTarget as HTMLElement).style.background = 'var(--color-background-secondary)'; }}
                          onMouseLeave={e => { if (!isDragOver) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          {isDragOver && (
                            <div style={{ position: 'absolute', inset: '2px', border: '2px dashed var(--color-primary)', borderRadius: '8px', opacity: 0.6, pointerEvents: 'none' }} />
                          )}
                        </div>
                      );
                    })}

                    {/* Events overlay */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                      {dayEvents.map(ev => {
                        const start = new Date(ev.start_time);
                        const end   = new Date(ev.end_time);
                        const startMin = start.getHours() * 60 + start.getMinutes();
                        const durationMin = Math.max(30, (end.getTime() - start.getTime()) / 60000);
                        const eventColor = ev.color || '#6366f1';
                        return (
                          <div
                            key={ev.id}
                            onClick={e => openEditEvent(ev, e)}
                            style={{
                              position: 'absolute',
                              top:    `${(startMin / 60) * CELL_HEIGHT}px`,
                              height: `${(durationMin / 60) * CELL_HEIGHT - 3}px`,
                              left: '3px', right: '3px',
                              background: `linear-gradient(135deg, ${eventColor}dd, ${eventColor}aa)`,
                              borderRadius: '8px',
                              padding: '4px 8px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              pointerEvents: 'all',
                              zIndex: 3,
                              boxShadow: `0 2px 8px ${eventColor}40`,
                              borderLeft: `3px solid ${eventColor}`,
                              backdropFilter: 'blur(4px)',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                            {durationMin >= 45 && (
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                                {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                {' – '}
                                {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Current time indicator */}
                    {isToday && (
                      <div ref={nowRef} style={{ position: 'absolute', left: 0, right: 0, top: `${nowTopPercent}%`, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                        <div style={{ flex: 1, height: '2px', background: '#ef4444', opacity: 0.8 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Event Modal ────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowModal(false)}>
          <div className="glass-panel" style={{ width: '480px', maxWidth: '95vw', background: 'var(--color-background-elevated)', borderRadius: '24px', padding: '32px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', border: '1px solid var(--color-border-premium)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>{editEvent ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--color-background-secondary)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-foreground-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event Title *</label>
                <input autoFocus value={modalData.title} onChange={e => setModalData({...modalData, title: e.target.value})} className="ios-input"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', fontSize: '16px', boxSizing: 'border-box' }} placeholder="Meeting, call, task..." required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-foreground-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</label>
                  <input type="datetime-local" value={modalData.start_time} onChange={e => setModalData({...modalData, start_time: e.target.value})} className="ios-input"
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-foreground-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</label>
                  <input type="datetime-local" value={modalData.end_time} onChange={e => setModalData({...modalData, end_time: e.target.value})} className="ios-input"
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }} required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-foreground-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
                <textarea value={modalData.description} onChange={e => setModalData({...modalData, description: e.target.value})} className="ios-input"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '14px', minHeight: '80px', resize: 'none', fontSize: '15px', boxSizing: 'border-box' }} placeholder="Add details..." />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                {editEvent && (
                  <button type="button" onClick={deleteEventFromModal} style={{ padding: '14px 20px', borderRadius: '14px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', fontWeight: 600, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                    Delete
                  </button>
                )}
                <button type="submit" disabled={modalLoading} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                  {modalLoading ? <Loader2 size={18} className="animate-spin" /> : (editEvent ? 'Update Event' : 'Create Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
