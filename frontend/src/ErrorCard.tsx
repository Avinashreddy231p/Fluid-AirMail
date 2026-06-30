import React from 'react';
import { AlertCircle, WifiOff, ShieldAlert, ZapOff, CheckCircle } from 'lucide-react';

interface ErrorCardProps {
  error: string | Error;
  type?: 'error' | 'success' | 'warning' | 'info';
  onDismiss?: () => void;
}

interface ParsedError {
  title: string;
  description: string;
  action: string;
  icon: React.ReactNode;
  color: string;
}

export function parseError(err: string | Error): ParsedError {
  const errMsg = typeof err === 'string' ? err : err.message || String(err);
  
  // 1. Quota / Rate Limit Errors
  if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
    return {
      title: 'API Quota Exceeded',
      description: 'You have reached the rate limit for your current AI provider tier.',
      action: 'Wait about a minute before trying again, or switch to a different AI model in Settings.',
      icon: <ZapOff size={24} />,
      color: 'var(--color-warning, #f59e0b)'
    };
  }
  
  // 2. Network Errors
  if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network error')) {
    return {
      title: 'Connection Lost',
      description: 'We could not connect to the server. Please check your internet connection.',
      action: 'Ensure your backend server is running and your network is stable.',
      icon: <WifiOff size={24} />,
      color: 'var(--color-danger, #ef4444)'
    };
  }

  // 3. Auth Errors
  if (errMsg.toLowerCase().includes('unauthorized') || errMsg.includes('401') || errMsg.toLowerCase().includes('invalid credentials')) {
    return {
      title: 'Authentication Failed',
      description: 'Your session has expired or your credentials are incorrect.',
      action: 'Please try logging in again.',
      icon: <ShieldAlert size={24} />,
      color: 'var(--color-danger, #ef4444)'
    };
  }
  
  // 4. Default Fallback
  return {
    title: 'An Unexpected Error Occurred',
    description: errMsg.length > 200 ? errMsg.substring(0, 200) + '...' : errMsg,
    action: 'If this issue persists, please refresh the page or contact support.',
    icon: <AlertCircle size={24} />,
    color: 'var(--color-danger, #ef4444)'
  };
}

export default function ErrorCard({ error, type = 'error', onDismiss }: ErrorCardProps) {
  if (!error) return null;
  
  const parsed = type === 'error' ? parseError(error) : {
    title: 'Success',
    description: typeof error === 'string' ? error : (error as Error).message,
    action: '',
    icon: <CheckCircle size={24} />,
    color: 'var(--color-success, #10b981)'
  };

  return (
    <div style={{
      background: 'var(--color-background-elevated, rgba(255, 255, 255, 0.05))',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: `1px solid ${parsed.color}40`,
      borderRadius: '20px',
      padding: '20px',
      display: 'flex',
      gap: '16px',
      boxShadow: `0 12px 32px -8px ${parsed.color}20`,
      alignItems: 'flex-start',
      position: 'relative',
      margin: '16px 0',
      animation: 'toast-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      <div style={{
        background: `${parsed.color}20`,
        color: parsed.color,
        padding: '12px',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {parsed.icon}
      </div>
      
      <div style={{ flex: 1 }}>
        <h3 style={{ 
          margin: '0 0 4px 0', 
          fontSize: '16px', 
          fontWeight: 600, 
          color: 'var(--color-foreground, #fff)',
          letterSpacing: '-0.01em'
        }}>
          {parsed.title}
        </h3>
        <p style={{ 
          margin: '0 0 12px 0', 
          fontSize: '14.5px', 
          color: 'var(--color-foreground-secondary, rgba(255,255,255,0.7))',
          lineHeight: 1.5 
        }}>
          {parsed.description}
        </p>
        
        {parsed.action && (
          <div style={{ 
            background: 'rgba(0,0,0,0.2)', 
            padding: '12px', 
            borderRadius: '12px',
            borderLeft: `3px solid ${parsed.color}`,
            fontSize: '14px',
            color: 'var(--color-foreground, #fff)',
            fontWeight: 500
          }}>
            <strong style={{ opacity: 0.8, display: 'block', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How to fix</strong>
            {parsed.action}
          </div>
        )}
      </div>

      {onDismiss && (
        <button 
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-foreground-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: '0.2s ease',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      )}
    </div>
  );
}
