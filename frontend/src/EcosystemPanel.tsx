import { useState, useEffect } from 'react';
import { Calendar, CheckSquare, FileText, Plus, X, Trash2 } from 'lucide-react';

interface EcosystemPanelProps {
  API: string;
  token: string;
}

export default function EcosystemPanel({ API, token }: EcosystemPanelProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'notes'>('calendar');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setItems(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, token]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setContent(''); setDueDate(''); setStartTime(''); setEndTime(''); setShowAdd(false);
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    const payload: any = { title };
    if (activeTab === 'calendar') {
      payload.description = description;
      payload.start_time = startTime || new Date().toISOString();
      payload.end_time = endTime || new Date(Date.now() + 3600000).toISOString();
    } else if (activeTab === 'tasks') {
      payload.description = description;
      if (dueDate) payload.due_date = dueDate;
    } else if (activeTab === 'notes') {
      payload.content = content;
    }

    try {
      const res = await fetch(`${API}/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchData();
        resetForm();
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API}/${activeTab}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
  };

  const handleToggleTask = async (task: any) => {
    try {
      await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: task.title, description: task.description, due_date: task.due_date, is_completed: !task.is_completed })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{
      width: '300px', flexShrink: 0,
      background: 'var(--color-background-secondary)',
      borderLeft: '1px solid var(--color-divider)',
      display: 'flex', flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ display: 'flex', padding: '16px', gap: '8px', borderBottom: '1px solid var(--color-divider)' }}>
        <button onClick={() => setActiveTab('calendar')} style={{ flex: 1, padding: '8px', border: 'none', background: activeTab === 'calendar' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'calendar' ? '#fff' : 'inherit', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
          <Calendar size={18} />
        </button>
        <button onClick={() => setActiveTab('tasks')} style={{ flex: 1, padding: '8px', border: 'none', background: activeTab === 'tasks' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'tasks' ? '#fff' : 'inherit', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
          <CheckSquare size={18} />
        </button>
        <button onClick={() => setActiveTab('notes')} style={{ flex: 1, padding: '8px', border: 'none', background: activeTab === 'notes' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'notes' ? '#fff' : 'inherit', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
          <FileText size={18} />
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'capitalize' }}>{activeTab}</h3>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
          {showAdd ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--color-divider)' }}>
          <input className="ios-input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          {activeTab === 'calendar' && (
             <>
               <input className="ios-input" placeholder="Start Time (YYYY-MM-DDTHH:MM)" type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
               <input className="ios-input" placeholder="End Time (YYYY-MM-DDTHH:MM)" type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
             </>
          )}
          {activeTab === 'tasks' && (
             <input className="ios-input" placeholder="Due Date (YYYY-MM-DD)" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          )}
          {activeTab === 'notes' && (
             <textarea className="ios-input" placeholder="Note content" value={content} onChange={e => setContent(e.target.value)} rows={4} style={{ resize: 'none' }} />
          )}
          <button className="ios-button" onClick={handleAdd}>Save</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? <div style={{ textAlign: 'center', color: 'var(--color-foreground-secondary)' }}>Loading...</div> : items.map(item => (
          <div key={item.id} style={{ background: 'var(--color-background-tertiary)', padding: '12px', borderRadius: '8px', marginBottom: '8px', position: 'relative' }}>
            <button onClick={() => handleDelete(item.id)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}>
              <Trash2 size={14} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '20px' }}>
               {activeTab === 'tasks' && (
                 <input type="checkbox" checked={item.is_completed} onChange={() => handleToggleTask(item)} />
               )}
               <div style={{ fontWeight: 600, fontSize: '14px', textDecoration: item.is_completed ? 'line-through' : 'none' }}>{item.title}</div>
            </div>
            {activeTab === 'calendar' && <div style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', marginTop: '4px' }}>{new Date(item.start_time).toLocaleString()}</div>}
            {activeTab === 'notes' && <div style={{ fontSize: '12px', color: 'var(--color-foreground-secondary)', marginTop: '4px' }}>{item.content}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
