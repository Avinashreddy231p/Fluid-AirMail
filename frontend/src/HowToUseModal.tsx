import { Shield, Mail, Users, Check } from 'lucide-react';

export default function HowToUseModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        background: 'var(--color-background-elevated)',
        width: '100%', maxWidth: '440px',
        borderRadius: '24px', padding: '32px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        border: '1px solid var(--color-divider)',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'var(--color-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 16px rgba(0,113,227,0.3)'
          }}>
            <Mail size={32} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-foreground)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Welcome to MailNet
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)' }}>
            A secure, modern platform for your communication needs.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: 'var(--color-primary)', marginTop: '2px' }}><Mail size={24} /></div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>Send & Receive Mail</h3>
              <p style={{ fontSize: '14px', color: 'var(--color-foreground-secondary)', lineHeight: 1.4 }}>Communicate with other MailNet users seamlessly. Filter by labels and folders.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: '#34c759', marginTop: '2px' }}><Users size={24} /></div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>Real-time Chat & Voice</h3>
              <p style={{ fontSize: '14px', color: 'var(--color-foreground-secondary)', lineHeight: 1.4 }}>Switch to the Chats tab to instantly message or voice call your contacts.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: '#af52de', marginTop: '2px' }}><Shield size={24} /></div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '4px' }}>Secure & Private</h3>
              <p style={{ fontSize: '14px', color: 'var(--color-foreground-secondary)', lineHeight: 1.4 }}>End-to-end encryption for your messages keeps your conversations private.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: '14px',
            background: 'var(--color-primary)', color: '#fff',
            fontSize: '16px', fontWeight: 600, border: 'none',
            cursor: 'pointer', transition: 'transform 0.1s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Check size={20} />
          Get Started
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
