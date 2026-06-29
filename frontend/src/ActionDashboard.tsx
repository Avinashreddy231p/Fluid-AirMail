import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, Calendar, Mail,
  Sparkles, Loader2, Bell, X, ArrowRight
} from 'lucide-react';

const API = 'http://127.0.0.1:8000';

interface ActionEmail {
  id: number;
  sender_name: string;
  sender_email: string;
  subject: string;
  snippet: string;
  time: string;
  ai_summary?: string;
  category?: string;
}

interface ActionTask {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  is_overdue: boolean;
}

interface ActionFollowUp {
  id: number;
  mail_id: number;
  status: string;
  trigger_date: string;
  notes: string | null;
  is_overdue: boolean;
}

interface ActionEvent {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
}

interface ActionDashboardProps {
  token: string;
  onSelectMail: (mailId: number) => void;
  onCompose: (toEmail?: string, subject?: string, body?: string) => void;
}

export default function ActionDashboard({ token, onSelectMail, onCompose }: ActionDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState<ActionEmail[]>([]);
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [followUps, setFollowUps] = useState<ActionFollowUp[]>([]);
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [dismissingFU, setDismissingFU] = useState<number | null>(null);
  const [completingTask, setCompletingTask] = useState<number | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dashboard/actions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmails(data.unread_emails || []);
        setTasks(data.tasks || []);
        setFollowUps(data.follow_ups || []);
        setEvents(data.upcoming_events || []);
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleDismissFollowUp = async (id: number) => {
    setDismissingFU(id);
    try {
      await fetch(`${API}/follow-ups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'dismissed' }),
      });
      setFollowUps(prev => prev.filter(f => f.id !== id));
    } catch (e) { console.error(e); }
    finally { setDismissingFU(null); }
  };

  const handleCompleteTask = async (id: number) => {
    setCompletingTask(id);
    try {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      await fetch(`${API}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: task.title, description: task.description, is_completed: true, due_date: task.due_date }),
      });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
    finally { setCompletingTask(null); }
  };

  const formatEventTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Today';
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch { return iso; }
  };

  if (loading) {
    return (
      <div className="action-dashboard-loading">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--color-foreground-secondary)', marginTop: '12px', fontSize: '15px' }}>
          Loading your action items...
        </p>
      </div>
    );
  }

  const urgentEmails = emails.filter(e => e.category === 'primary' || e.category === 'inbox');
  const overdueTasks = tasks.filter(t => t.is_overdue);
  const todayTasks = tasks.filter(t => !t.is_overdue);
  const overdueFollowUps = followUps.filter(f => f.is_overdue);
  const pendingFollowUps = followUps.filter(f => !f.is_overdue);

  const totalActions = urgentEmails.length + tasks.length + followUps.length;

  return (
    <div className="action-dashboard">
      {/* Header */}
      <div className="action-dashboard-header">
        <div>
          <h1 className="action-dashboard-title">
            <Sparkles size={24} style={{ color: 'var(--color-primary)' }} />
            Action Center
          </h1>
          <p className="action-dashboard-subtitle">
            {totalActions > 0
              ? `${totalActions} item${totalActions !== 1 ? 's' : ''} need your attention`
              : 'You\'re all caught up! 🎉'}
          </p>
        </div>
        <button className="action-dashboard-refresh" onClick={loadDashboard}>
          <Loader2 size={16} /> Refresh
        </button>
      </div>

      <div className="action-dashboard-grid">
        {/* Urgent Emails */}
        <div className="action-card action-card-emails">
          <div className="action-card-header">
            <div className="action-card-icon-wrap" style={{ background: 'rgba(62, 166, 255, 0.12)' }}>
              <Mail size={18} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="action-card-title">Unread Emails</h3>
            <span className="action-card-badge">{urgentEmails.length}</span>
          </div>
          <div className="action-card-body">
            {urgentEmails.length === 0 ? (
              <div className="action-empty">
                <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                <span>No unread emails</span>
              </div>
            ) : (
              urgentEmails.slice(0, 5).map(email => (
                <div
                  key={email.id}
                  className="action-email-item"
                  onClick={() => onSelectMail(email.id)}
                >
                  <div className="action-email-avatar" style={{ background: `hsl(${email.id * 47 % 360}, 60%, 55%)` }}>
                    {(email.sender_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="action-email-content">
                    <div className="action-email-from">{email.sender_name}</div>
                    <div className="action-email-subject">{email.subject || '(No Subject)'}</div>
                    {email.ai_summary && (
                      <div className="action-email-summary">
                        <Sparkles size={10} /> {email.ai_summary}
                      </div>
                    )}
                  </div>
                  <span className="action-email-time">{email.time}</span>
                </div>
              ))
            )}
            {urgentEmails.length > 5 && (
              <div className="action-see-more">+{urgentEmails.length - 5} more</div>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="action-card action-card-tasks">
          <div className="action-card-header">
            <div className="action-card-icon-wrap" style={{ background: 'rgba(52, 168, 83, 0.12)' }}>
              <CheckCircle size={18} style={{ color: '#34a853' }} />
            </div>
            <h3 className="action-card-title">Tasks</h3>
            <span className="action-card-badge">{tasks.length}</span>
          </div>
          <div className="action-card-body">
            {tasks.length === 0 ? (
              <div className="action-empty">
                <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                <span>All tasks complete</span>
              </div>
            ) : (
              <>
                {overdueTasks.length > 0 && (
                  <div className="action-task-group">
                    <div className="action-task-group-label" style={{ color: 'var(--color-danger)' }}>
                      <AlertTriangle size={12} /> Overdue
                    </div>
                    {overdueTasks.map(task => (
                      <div key={task.id} className="action-task-item overdue">
                        <button
                          className="action-task-check"
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={completingTask === task.id}
                        >
                          {completingTask === task.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <div className="action-task-checkbox" />}
                        </button>
                        <div className="action-task-content">
                          <span className="action-task-title">{task.title}</span>
                          {task.due_date && <span className="action-task-due overdue">{formatDate(task.due_date)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {todayTasks.length > 0 && (
                  <div className="action-task-group">
                    {overdueTasks.length > 0 && (
                      <div className="action-task-group-label">
                        <Clock size={12} /> Upcoming
                      </div>
                    )}
                    {todayTasks.slice(0, 5).map(task => (
                      <div key={task.id} className="action-task-item">
                        <button
                          className="action-task-check"
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={completingTask === task.id}
                        >
                          {completingTask === task.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <div className="action-task-checkbox" />}
                        </button>
                        <div className="action-task-content">
                          <span className="action-task-title">{task.title}</span>
                          {task.due_date && <span className="action-task-due">{formatDate(task.due_date)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Follow-Ups */}
        <div className="action-card action-card-followups">
          <div className="action-card-header">
            <div className="action-card-icon-wrap" style={{ background: 'rgba(251, 188, 5, 0.12)' }}>
              <Bell size={18} style={{ color: '#fbbc05' }} />
            </div>
            <h3 className="action-card-title">Follow-Ups</h3>
            <span className="action-card-badge">{followUps.length}</span>
          </div>
          <div className="action-card-body">
            {followUps.length === 0 ? (
              <div className="action-empty">
                <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                <span>No pending follow-ups</span>
              </div>
            ) : (
              [...overdueFollowUps, ...pendingFollowUps].slice(0, 5).map(fu => (
                <div key={fu.id} className={`action-followup-item ${fu.is_overdue ? 'overdue' : ''}`}>
                  <div className="action-followup-content">
                    <div className="action-followup-note">{fu.notes || `Follow up on mail #${fu.mail_id}`}</div>
                    <div className="action-followup-date">
                      {fu.is_overdue && <AlertTriangle size={11} style={{ color: 'var(--color-danger)' }} />}
                      {formatDate(fu.trigger_date)}
                    </div>
                  </div>
                  <div className="action-followup-actions">
                    <button
                      className="action-followup-btn reply"
                      onClick={() => onCompose('', `Re: Follow-up`, fu.notes || '')}
                      title="Compose follow-up"
                    >
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="action-followup-btn dismiss"
                      onClick={() => handleDismissFollowUp(fu.id)}
                      disabled={dismissingFU === fu.id}
                      title="Dismiss"
                    >
                      {dismissingFU === fu.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="action-card action-card-events">
          <div className="action-card-header">
            <div className="action-card-icon-wrap" style={{ background: 'rgba(171, 71, 188, 0.12)' }}>
              <Calendar size={18} style={{ color: '#ab47bc' }} />
            </div>
            <h3 className="action-card-title">Upcoming Events</h3>
            <span className="action-card-badge">{events.length}</span>
          </div>
          <div className="action-card-body">
            {events.length === 0 ? (
              <div className="action-empty">
                <Calendar size={20} style={{ color: 'var(--color-foreground-tertiary)' }} />
                <span>No upcoming events</span>
              </div>
            ) : (
              events.slice(0, 5).map(ev => (
                <div key={ev.id} className="action-event-item">
                  <div className="action-event-time-badge">
                    {formatEventTime(ev.start_time)}
                  </div>
                  <div className="action-event-content">
                    <div className="action-event-title">{ev.title}</div>
                    {ev.description && <div className="action-event-desc">{ev.description}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
