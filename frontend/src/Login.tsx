import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from './AuthContext';
import ErrorCard from './ErrorCard';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let detail = 'Incorrect email or password. Please try again.';
        try {
          const errData = await response.json();
          if (errData?.detail) detail = errData.detail;
        } catch { /* ignore parse errors */ }
        throw new Error(detail);
      }

      const data = await response.json();
      login(data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '40px 16px',
      boxSizing: 'border-box',
      background: 'var(--color-background)',
    }}>
      <div className="apple-auth-container">
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: 'var(--color-foreground)' }}>
            <Mail size={42} strokeWidth={2.5} />
          </div>
          <h1 className="apple-title">Sign In with MailNet</h1>
          <p className="apple-subtitle">
            Use your MailNet Account to access all MailNet services.
          </p>
        </div>

        {/* Error message */}
        {error && <ErrorCard error={error} onDismiss={() => setError('')} />}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="apple-form">
          <div className="apple-fields-group">
            <div className="apple-field-row">
              <div className="apple-field-col">
                <div className="apple-input-wrapper">
                  <span className="apple-input-label">MailNet Account ID</span>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="apple-input"
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>

            <div className="apple-field-row">
              <div className="apple-field-col">
                <div className="apple-input-wrapper">
                  <span className="apple-input-label">Password</span>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="apple-input"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '0 4px',
            marginTop: '-4px'
          }}>
            <label className="apple-checkbox-label" style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>
              <input type="checkbox" className="apple-checkbox-input" defaultChecked />
              <span className="apple-checkbox-custom" />
              <span>Remember me</span>
            </label>
            
            <RouterLink 
              to="/forgot-password"
              className="apple-link"
              style={{ fontSize: '13px' }}
            >
              Forgot Password?
            </RouterLink>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="apple-btn-continue"
            style={{ marginTop: '16px' }}
          >
            {loading ? (
              <span style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 1s linear infinite'
              }} />
            ) : 'Continue'}
          </button>
        </form>

        {/* Footer info link */}
        <div style={{ textAlign: 'center', marginTop: '4px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-foreground-secondary)' }}>
            Don't have a MailNet Account?{' '}
            <RouterLink to="/register" className="apple-link">
              Create yours now
            </RouterLink>
          </p>
        </div>

        {/* Privacy Footer */}
        <div className="apple-privacy-footer">
          <svg className="apple-privacy-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="apple-privacy-text">
            Your MailNet Account information is used to allow you to sign in securely and access your data. MailNet records certain data for security, support and reporting purposes. See how your data is managed...
          </p>
        </div>
      </div>
    </div>
  );
}
