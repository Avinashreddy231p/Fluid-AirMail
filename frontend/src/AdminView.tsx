import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Mail, MessageSquare, Activity, RefreshCw, Loader2, Shield,
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Trash2, Edit3, Check, X, Database, AlertTriangle, ChevronsLeft, ChevronsRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminStats {
  total_users: number;
  total_emails: number;
  total_messages: number;
  active_users: number;
  words_exchanged: number;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  last_seen: string;
  created_at: string;
}

interface TableDataResponse {
  columns: string[];
  pk_columns: string[];
  rows: Record<string, any>[];
  total: number;
  page: number;
  limit: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface DeleteConfirm {
  row: Record<string, any>;
  pk_columns: string[];
}

interface AdminViewProps {
  token: string;
  API: string;
}

// ── Toast Component ───────────────────────────────────────────────────────────

function ToastNotification({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className="animate-slide-in-right"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '13px 18px', borderRadius: '12px',
            background: t.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: t.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            fontSize: '14px', fontWeight: 500, letterSpacing: '-0.01em',
            boxShadow: `0 8px 32px -8px ${t.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            border: `1px solid ${t.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            maxWidth: '340px',
          }}
          onClick={() => onDismiss(t.id)}
        >
          {t.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          <span style={{ flex: 1, color: 'var(--color-foreground)' }}>{t.message}</span>
          <X size={14} style={{ opacity: 0.7 }} />
        </div>
      ))}
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({
  confirm,
  onCancel,
  onConfirm,
  loading,
}: {
  confirm: DeleteConfirm;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onCancel}
    >
      <div
        className="animate-scale-in"
        style={{
          background: 'var(--color-background-elevated)',
          borderRadius: '20px',
          padding: '32px',
          width: '360px',
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-divider)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255,59,48,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={22} style={{ color: 'var(--color-danger)' }} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-foreground)' }}>Delete Row</div>
            <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>This action cannot be undone</div>
          </div>
        </div>

        <div style={{
          background: 'var(--color-background-secondary)',
          borderRadius: '12px', padding: '14px', marginBottom: '24px',
          fontSize: '13px', fontFamily: 'monospace',
          color: 'var(--color-foreground-secondary)',
          lineHeight: 1.7, wordBreak: 'break-all',
        }}>
          {confirm.pk_columns.map(pk => (
            <div key={pk}><span style={{ color: 'var(--color-foreground)', fontWeight: 600 }}>{pk}</span>: {String(confirm.row[pk])}</div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px', borderRadius: '12px', border: 'none',
              background: 'var(--color-foreground-quaternary)',
              color: 'var(--color-foreground)', fontSize: '15px', fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '11px', borderRadius: '12px', border: 'none',
              background: 'var(--color-danger)',
              color: '#fff', fontSize: '15px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Editable Cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  col,
  isPk,
  onSave,
}: {
  value: any;
  col: string;
  isPk: boolean;
  onSave: (newVal: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayVal = value === null ? 'null' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const isNull = value === null;

  const startEdit = () => {
    if (isPk) return; // PK columns are read-only
    setDraft(displayVal === 'null' ? '' : displayVal);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const cancelEdit = () => { setEditing(false); };

  const commitEdit = async () => {
    if (draft === displayVal) { cancelEdit(); return; }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <td style={{ padding: '4px 8px', position: 'relative', minWidth: '120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
            onBlur={commitEdit}
            autoFocus
            style={{
              flex: 1, padding: '5px 8px', border: '2px solid var(--color-primary)',
              borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit',
              background: 'var(--color-background)', color: 'var(--color-foreground)',
              outline: 'none', minWidth: 0,
            }}
          />
          {saving && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
        </div>
      </td>
    );
  }

  return (
    <td
      onClick={isPk ? undefined : startEdit}
      title={isPk ? `${col} — primary key (read only)` : `Click to edit ${col}`}
      style={{
        padding: '12px 14px',
        fontSize: '13px',
        color: isNull ? 'var(--color-foreground-tertiary)' : isPk ? 'var(--color-primary)' : 'var(--color-foreground)',
        fontStyle: isNull ? 'italic' : 'normal',
        fontWeight: isPk ? 600 : 400,
        maxWidth: '200px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: isPk ? 'default' : 'pointer',
        transition: 'background 0.12s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isPk) (e.currentTarget.style.background = 'var(--color-primary-light)'); }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {displayVal}
        {!isPk && (
          <Edit3 size={11} style={{ opacity: 0, transition: 'opacity 0.15s', color: 'var(--color-primary)' }}
            className="edit-icon" />
        )}
      </span>
    </td>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminView({ token, API }: AdminViewProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [error, setError] = useState('');

  // DB view state
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  // ── Toast helpers ─────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resStats, resUsers, resTables] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers }),
        fetch(`${API}/admin/users`, { headers }),
        fetch(`${API}/admin/tables`, { headers }),
      ]);

      if (!resStats.ok || !resUsers.ok || !resTables.ok) {
        throw new Error('Failed to fetch admin data (unauthorized)');
      }

      setStats(await resStats.json());
      setUsers(await resUsers.json());

      const tablesJson = await resTables.json();
      setTables(tablesJson.tables);
      if (tablesJson.tables?.length > 0 && !selectedTable) {
        setSelectedTable(tablesJson.tables[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = useCallback(async (
    tableName: string,
    opts?: { page?: number; sortBy?: string | null; sortOrder?: 'asc' | 'desc'; search?: string }
  ) => {
    setLoadingTable(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams();
      params.set('page', String(opts?.page ?? 1));
      params.set('limit', String(limit));
      if (opts?.sortBy) { params.set('sort_by', opts.sortBy); params.set('sort_order', opts?.sortOrder ?? 'asc'); }
      if (opts?.search) params.set('search', opts.search);

      const res = await fetch(`${API}/admin/tables/${tableName}?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch table data');
      setTableData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTable(false);
    }
  }, [token, API, limit]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { fetchAdminData(); }, [token]);

  useEffect(() => {
    if (selectedTable) {
      setPage(1);
      setSortBy(null);
      setSortOrder('asc');
      setSearch('');
      setSearchInput('');
      fetchTableData(selectedTable, { page: 1 });
    }
  }, [selectedTable]);

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchInput]);

  // Fetch when search/sort/page changes (after initial)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    if (selectedTable) {
      fetchTableData(selectedTable, { page, sortBy, sortOrder, search });
    }
  }, [page, sortBy, sortOrder, search]);

  // ── Sorting handler ───────────────────────────────────────────────────────

  const handleSort = (col: string) => {
    const newOrder = sortBy === col && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(col);
    setSortOrder(newOrder);
    setPage(1);
  };

  // ── Inline edit handler ───────────────────────────────────────────────────

  const handleCellSave = async (row: Record<string, any>, col: string, newVal: string) => {
    if (!selectedTable || !tableData) return;
    try {
      const res = await fetch(`${API}/admin/tables/${selectedTable}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: row, updated: { [col]: newVal } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Update failed' }));
        throw new Error(err.detail ?? 'Update failed');
      }
      addToast(`Updated ${col} successfully`, 'success');
      // Refresh current page
      await fetchTableData(selectedTable, { page, sortBy, sortOrder, search });
    } catch (err: any) {
      addToast(err.message ?? 'Update failed', 'error');
      throw err;
    }
  };

  // ── Delete handler ────────────────────────────────────────────────────────

  const handleDeleteRow = async () => {
    if (!deleteConfirm || !selectedTable || !tableData) return;
    setLoadingDelete(true);
    try {
      const payload: Record<string, any> = {};
      for (const pk of deleteConfirm.pk_columns) payload[pk] = deleteConfirm.row[pk];

      const res = await fetch(`${API}/admin/tables/${selectedTable}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Delete failed' }));
        throw new Error(err.detail ?? 'Delete failed');
      }
      addToast('Row deleted successfully', 'success');
      setDeleteConfirm(null);
      // Go back a page if we just deleted the last row on this page
      const newTotal = (tableData.total ?? 1) - 1;
      const maxPage = Math.max(1, Math.ceil(newTotal / limit));
      const newPage = Math.min(page, maxPage);
      setPage(newPage);
      await fetchTableData(selectedTable, { page: newPage, sortBy, sortOrder, search });
    } catch (err: any) {
      addToast(err.message ?? 'Delete failed', 'error');
    } finally {
      setLoadingDelete(false);
    }
  };

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading && !stats) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', width: '100%', gap: '12px',
        color: 'var(--color-foreground-secondary)',
        background: 'var(--color-background-secondary)',
      }}>
        <Loader2 size={28} className="animate-spin" />
        <span style={{ fontSize: '17px' }}>Loading Admin Dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', background: 'var(--color-background-secondary)', width: '100%' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-danger)', marginBottom: '8px' }}>Access Denied</h2>
        <p style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)' }}>{error}</p>
      </div>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const totalPages = tableData ? Math.max(1, Math.ceil(tableData.total / limit)) : 1;
  const startRow = tableData ? (page - 1) * limit + 1 : 0;
  const endRow = tableData ? Math.min(page * limit, tableData.total) : 0;

  const statCards = [
    { icon: <Users size={22} />, iconColor: '#3ea6ff', title: 'Total Users', value: stats?.total_users ?? 0 },
    { icon: <Activity size={22} />, iconColor: '#34c759', title: 'Active (24h)', value: stats?.active_users ?? 0 },
    { icon: <Mail size={22} />, iconColor: '#ffcc00', title: 'Emails Sent', value: stats?.total_emails ?? 0 },
    { icon: <MessageSquare size={22} />, iconColor: '#af52de', title: 'Chat Msgs', value: stats?.total_messages ?? 0 },
    { icon: <MessageSquare size={22} />, iconColor: '#ff3b30', title: 'Words Exchanged', value: stats?.words_exchanged ?? 0 },
  ];

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 400,
    color: 'var(--color-foreground-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.02em',
    padding: '0 16px', marginBottom: '8px', marginTop: '24px',
  };

  return (
    <>
      <style>{`
        td:hover .edit-icon { opacity: 1 !important; }
        .db-th-sortable:hover { background: var(--color-foreground-quaternary) !important; }
        .db-row:hover td { background: var(--color-foreground-quaternary); }
        .page-btn { 
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px; border: none;
          background: var(--color-background-elevated); color: var(--color-foreground-secondary);
          cursor: pointer; font-size: 14px; font-weight: 500;
          transition: all 0.15s ease; box-shadow: var(--shadow-sm);
        }
        .page-btn:hover:not(:disabled) { background: var(--color-primary); color: #fff; }
        .page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .page-btn.active { background: var(--color-primary); color: #fff; box-shadow: var(--shadow-md); }
        .delete-row-btn {
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px;
          color: var(--color-foreground-tertiary);
          transition: all 0.15s ease;
          opacity: 0;
        }
        .db-row:hover .delete-row-btn { opacity: 1; }
        .delete-row-btn:hover { background: rgba(255,59,48,0.12); color: var(--color-danger); }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-background-secondary)' }}>
        <div className="ios-list-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* ── Large Title Header ─────────────────────────────────────── */}
          <div style={{ padding: '20px 16px 12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{
              fontSize: '34px', fontWeight: 700, color: 'var(--color-foreground)',
              letterSpacing: '-0.02em', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <Shield size={32} style={{ color: 'var(--color-primary)' }} />
              Admin Dashboard
            </h1>
            <button
              onClick={fetchAdminData}
              className="icon-btn"
              style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)' }}
              title="Refresh all data"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* ── Stats Grid ─────────────────────────────────────────────── */}
          <div style={sectionHeaderStyle}>Overview</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px', marginBottom: '24px', padding: '0 16px',
          }}>
            {statCards.map((card, i) => (
              <div key={i} style={{
                background: 'var(--color-background-elevated)', borderRadius: '24px',
                padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid var(--color-divider)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ color: card.iconColor }}>{card.icon}</div>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-foreground-secondary)' }}>{card.title}</span>
                </div>
                <div style={{
                  fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em',
                  color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums',
                }}>{card.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* ── Registered Users ───────────────────────────────────────── */}
          <div style={sectionHeaderStyle}>Registered Users</div>
          <div className="ios-list-group" style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.04)', border: '1px solid var(--color-divider)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    {['ID', 'Username', 'Email', 'Role', 'Last Seen', 'Joined'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', fontSize: '12px', fontWeight: 600,
                        color: 'var(--color-foreground-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <tr
                      key={u.id}
                      className="db-row"
                      style={{ borderBottom: idx !== users.length - 1 ? '1px solid var(--color-divider)' : 'none' }}
                    >
                      <td style={{ padding: '13px 16px', fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>{u.id}</td>
                      <td style={{ padding: '13px 16px', fontSize: '15px', fontWeight: 600, color: 'var(--color-foreground)' }}>{u.username}</td>
                      <td style={{ padding: '13px 16px', fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '13px 16px' }}>
                        {u.is_admin ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                            borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                            background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                          }}>Admin</span>
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>User</span>
                        )}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: '12px', color: 'var(--color-foreground-secondary)', fontVariantNumeric: 'tabular-nums' }}>{u.last_seen}</td>
                      <td style={{ padding: '13px 16px', fontSize: '12px', color: 'var(--color-foreground-secondary)', fontVariantNumeric: 'tabular-nums' }}>{u.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Advanced Database View ─────────────────────────────────── */}
          <div style={sectionHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={13} />
              Advanced Database View
            </span>
          </div>

          <div style={{ marginBottom: '40px', padding: '0 0' }}>

            {/* Table Selector Pills */}
            <div style={{
              display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '14px',
              scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
              paddingLeft: '16px', paddingRight: '16px',
            }}>
              {tables.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTable(t)}
                  style={{
                    padding: '7px 16px', borderRadius: '100px', flexShrink: 0,
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
                    transition: 'all 0.2s ease',
                    background: selectedTable === t ? 'var(--color-primary)' : 'var(--color-background-elevated)',
                    color: selectedTable === t ? '#ffffff' : 'var(--color-foreground)',
                    boxShadow: selectedTable === t ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    transform: selectedTable === t ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Toolbar: Search + Row count */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '0 16px', marginBottom: '12px', flexWrap: 'wrap',
            }}>
              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--color-background-elevated)',
                borderRadius: '10px', padding: '8px 14px',
                flex: '1', minWidth: '200px',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <Search size={16} style={{ color: 'var(--color-foreground-secondary)', flexShrink: 0 }} />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={`Search ${selectedTable ?? 'table'}…`}
                  style={{
                    flex: 1, border: 'none', background: 'transparent',
                    fontSize: '14px', color: 'var(--color-foreground)', outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-foreground-secondary)', display: 'flex', padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Row count info */}
              {tableData && (
                <div style={{
                  fontSize: '13px', color: 'var(--color-foreground-secondary)',
                  whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                  background: 'var(--color-background-elevated)',
                  borderRadius: '10px', padding: '8px 14px',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {search ? `${tableData.total.toLocaleString()} match${tableData.total !== 1 ? 'es' : ''}` : `${tableData.total.toLocaleString()} row${tableData.total !== 1 ? 's' : ''}`}
                </div>
              )}

              {/* Refresh table */}
              <button
                onClick={() => selectedTable && fetchTableData(selectedTable, { page, sortBy, sortOrder, search })}
                className="icon-btn"
                title="Refresh table"
                style={{ flexShrink: 0, background: 'var(--color-background-elevated)', boxShadow: 'var(--shadow-sm)', borderRadius: '10px', padding: '8px' }}
              >
                <RefreshCw size={15} className={loadingTable ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Data Table */}
            <div className="ios-list-group" style={{ margin: '0 0', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.04)', border: '1px solid var(--color-divider)' }}>
              <div style={{ overflowX: 'auto', position: 'relative' }}>

                {loadingTable && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(var(--color-background-elevated-rgb, 255,255,255), 0.7)',
                    backdropFilter: 'blur(4px)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-primary)' }}>
                      <Loader2 size={22} className="animate-spin" />
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>Loading…</span>
                    </div>
                  </div>
                )}

                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '500px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-divider)' }}>
                      {tableData?.columns.map(col => {
                        const isSorted = sortBy === col;
                        const isPk = tableData.pk_columns.includes(col);
                        return (
                          <th
                            key={col}
                            className="db-th-sortable"
                            onClick={() => handleSort(col)}
                            style={{
                              padding: '11px 14px',
                              fontSize: '11px', fontWeight: 700,
                              color: isSorted ? 'var(--color-primary)' : 'var(--color-foreground-secondary)',
                              textTransform: 'uppercase', letterSpacing: '0.06em',
                              cursor: 'pointer', userSelect: 'none',
                              borderRadius: '0',
                              transition: 'background 0.12s, color 0.12s',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              {isPk && <span style={{ color: 'var(--color-primary)', fontSize: '10px', fontWeight: 800 }}>PK</span>}
                              {col}
                              {isSorted ? (
                                sortOrder === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                              ) : (
                                <span style={{ opacity: 0.3 }}><ChevronUp size={11} /></span>
                              )}
                            </span>
                          </th>
                        );
                      })}
                      {/* Delete column header */}
                      <th style={{ width: '44px', padding: '11px 8px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData && tableData.rows.length > 0 ? (
                      tableData.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="db-row"
                          style={{
                            borderBottom: rIdx !== tableData.rows.length - 1 ? '1px solid var(--color-divider)' : 'none',
                          }}
                        >
                          {tableData.columns.map(col => (
                            <EditableCell
                              key={col}
                              value={row[col]}
                              col={col}
                              isPk={tableData.pk_columns.includes(col)}
                              onSave={async (newVal) => { await handleCellSave(row, col, newVal); }}
                            />
                          ))}
                          {/* Delete button */}
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <button
                              className="delete-row-btn"
                              title="Delete row"
                              onClick={() => setDeleteConfirm({ row, pk_columns: tableData.pk_columns })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={(tableData?.columns.length ?? 1) + 1}
                          style={{ padding: '48px', textAlign: 'center', color: 'var(--color-foreground-secondary)' }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Database size={28} style={{ opacity: 0.3 }} />
                            <span style={{ fontSize: '15px' }}>
                              {search ? `No rows match "${search}"` : 'Table is empty'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Pagination ───────────────────────────────────────────── */}
            {tableData && tableData.total > limit && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px 0 16px', flexWrap: 'wrap', gap: '12px',
              }}>
                {/* Info */}
                <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  Showing <strong style={{ color: 'var(--color-foreground)' }}>{startRow}–{endRow}</strong> of <strong style={{ color: 'var(--color-foreground)' }}>{tableData.total.toLocaleString()}</strong>
                </div>

                {/* Page buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button className="page-btn" disabled={page <= 1} onClick={() => setPage(1)} title="First page">
                    <ChevronsLeft size={14} />
                  </button>
                  <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)} title="Previous page">
                    <ChevronLeft size={14} />
                  </button>

                  {/* Page number pills */}
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = page - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`page-btn${page === pageNum ? ' active' : ''}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} title="Next page">
                    <ChevronRight size={14} />
                  </button>
                  <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)} title="Last page">
                    <ChevronsRight size={14} />
                  </button>
                </div>
              </div>
            )}

          </div>{/* end Advanced DB View */}
        </div>
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
      {deleteConfirm && (
        <DeleteModal
          confirm={deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteRow}
          loading={loadingDelete}
        />
      )}

      {/* ── Toast Notifications ────────────────────────────────────────────── */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
