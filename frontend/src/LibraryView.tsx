import React from 'react';
import { Clock, Trash2, Folder, Send, Star } from 'lucide-react';
import { TagCategory, MailFolder } from './App'; // Needs to export these types

interface LibraryViewProps {
  allTags: TagCategory[];
  allFolders: MailFolder[];
  snoozedCount: number;
  binCount: number;
  sentCount?: number;
  starredCount?: number;
  onNavigate: (sectionId: string) => void;
}

export default function LibraryView({ allTags, allFolders, snoozedCount, binCount, sentCount, starredCount, onNavigate }: LibraryViewProps) {
  return (
    <div className="animate-slide-in-right" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '32px', color: 'var(--color-foreground)' }}>
        Library
      </h1>

      <div style={{ display: 'grid', gap: '32px' }}>
        
        {/* Smart Mailboxes */}
        <section>
          <h2 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-foreground-secondary)', marginBottom: '16px', fontWeight: 600 }}>
            Smart Mailboxes
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <LibraryCard 
              title="Sent" 
              icon={<Send size={24} color="#3b82f6" />} 
              count={sentCount} 
              onClick={() => onNavigate('sent')} 
            />
            <LibraryCard 
              title="Starred" 
              icon={<Star size={24} color="#eab308" />} 
              count={starredCount} 
              onClick={() => onNavigate('starred')} 
            />
            <LibraryCard 
              title="Snoozed" 
              icon={<Clock size={24} color="#f59e0b" />} 
              count={snoozedCount} 
              onClick={() => onNavigate('snoozed')} 
            />
            <LibraryCard 
              title="Bin" 
              icon={<Trash2 size={24} color="#ef4444" />} 
              count={binCount} 
              onClick={() => onNavigate('bin')} 
            />
          </div>
        </section>

        {/* Labels */}
        <section>
          <h2 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-foreground-secondary)', marginBottom: '16px', fontWeight: 600 }}>
            Labels
          </h2>
          {allTags.length === 0 ? (
            <p style={{ color: 'var(--color-foreground-secondary)', fontSize: '15px' }}>No labels created yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {allTags.map(tag => (
                <LibraryCard 
                  key={tag.id}
                  title={tag.name} 
                  icon={<div style={{ width: '16px', height: '16px', borderRadius: '50%', background: tag.color }} />} 
                  onClick={() => onNavigate(`tag_${tag.id}`)} 
                />
              ))}
            </div>
          )}
        </section>

        {/* Folders */}
        <section>
          <h2 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-foreground-secondary)', marginBottom: '16px', fontWeight: 600 }}>
            Folders
          </h2>
          {allFolders.length === 0 ? (
            <p style={{ color: 'var(--color-foreground-secondary)', fontSize: '15px' }}>No custom folders yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {allFolders.map(folder => (
                <LibraryCard 
                  key={folder.id}
                  title={folder.name} 
                  icon={<Folder size={24} color="#3b82f6" />} 
                  onClick={() => onNavigate(`folder_${folder.id}`)} 
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function LibraryCard({ title, icon, count, onClick }: { title: string, icon: React.ReactNode, count?: number, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--color-background-elevated)',
        border: '1px solid var(--color-divider)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        outline: 'none',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <div style={{ background: 'var(--color-background)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-foreground-secondary)' }}>
            {count}
          </span>
        )}
      </div>
      <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-foreground)' }}>
        {title}
      </span>
    </button>
  );
}
