import React, { useMemo } from 'react';
import { Tag as TagIcon, PieChart as PieChartIcon, ChevronRight, Inbox } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface TagCategory {
  id: number;
  name: string;
  color: string;
}

interface MailMessage {
  id: number;
  tags?: TagCategory[];
  [key: string]: any;
}

interface LabelsViewProps {
  allTags: TagCategory[];
  messages: MailMessage[];
  onSelectTag: (tagId: number) => void;
}

export default function LabelsView({ allTags, messages, onSelectTag }: LabelsViewProps) {
  const chartData = useMemo(() => {
    return allTags.map(tag => {
      const count = messages.filter(m => m.tags?.some(t => t.id === tag.id)).length;
      return {
        name: tag.name,
        value: count,
        color: tag.color || '#007aff',
        id: tag.id
      };
    }).filter(data => data.value > 0);
  }, [allTags, messages]);

  const totalTaggedMails = chartData.reduce((acc, curr) => acc + curr.value, 0);
  const mostUsedLabel = chartData.length > 0 ? chartData.reduce((prev, current) => (prev.value > current.value) ? prev : current) : null;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--color-background-secondary)',
      overflowY: 'auto', padding: '32px 24px',
      alignItems: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: '700px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-foreground)', letterSpacing: '-0.02em', marginBottom: '24px' }}>Labels</h1>

        {/* OVERVIEW SECTION */}
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', marginLeft: '16px' }}>Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div style={{
            background: 'var(--color-background-elevated)', borderRadius: '20px', padding: '20px',
            boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-foreground-secondary)' }}>
              <Inbox size={18} />
              <span style={{ fontSize: '15px', fontWeight: 500 }}>Total Tagged</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-foreground)' }}>{totalTaggedMails}</div>
          </div>

          <div style={{
            background: 'var(--color-background-elevated)', borderRadius: '20px', padding: '20px',
            boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-foreground-secondary)' }}>
              <TagIcon size={18} />
              <span style={{ fontSize: '15px', fontWeight: 500 }}>Top Label</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: mostUsedLabel ? mostUsedLabel.color : 'var(--color-foreground)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mostUsedLabel ? mostUsedLabel.name : 'N/A'}
            </div>
          </div>
        </div>

        {/* CHART WIDGET */}
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', marginLeft: '16px' }}>Distribution</h2>
        <div style={{
          background: 'var(--color-background-elevated)', borderRadius: '24px', padding: '24px',
          boxShadow: 'var(--shadow-sm)', marginBottom: '32px'
        }}>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={6}
                    cornerRadius={20}
                    dataKey="value"
                    stroke="none"
                    onClick={(data) => onSelectTag(data.payload.id)}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)', background: 'var(--color-background)', color: 'var(--color-foreground)' }} 
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    cursor={false}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-foreground-secondary)', gap: '12px' }}>
              <PieChartIcon size={32} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: '15px' }}>No labeled emails found.</span>
            </div>
          )}
        </div>

        {/* INSET LIST */}
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', marginLeft: '16px' }}>All Labels</h2>
        <div className="ios-list-group">
          {allTags.map((tag, index) => {
            const count = messages.filter(m => m.tags?.some(t => t.id === tag.id)).length;
            return (
              <React.Fragment key={tag.id}>
                {index > 0 && <div style={{ height: '1px', background: 'var(--color-divider)', marginLeft: '48px' }} />}
                <div 
                  className="ios-list-row" 
                  style={{ cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s' }}
                  onClick={() => onSelectTag(tag.id)}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-foreground-quaternary)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: tag.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TagIcon size={14} color="#ffffff" />
                    </div>
                    <span style={{ fontSize: '17px', color: 'var(--color-foreground)' }}>{tag.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-foreground-secondary)' }}>
                    <span style={{ fontSize: '17px' }}>{count}</span>
                    <ChevronRight size={20} style={{ opacity: 0.4 }} />
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {allTags.length === 0 && (
            <div className="ios-list-row" style={{ padding: '16px', color: 'var(--color-foreground-secondary)' }}>
              No labels created yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
