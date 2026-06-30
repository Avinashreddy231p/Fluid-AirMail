import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import ErrorCard from './ErrorCard';

export default function ForgotPassword() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setError('Please enter your email address.');
    setError('');
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/recover-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Could not find account');
      }
      const data = await res.json();
      setSecurityQuestion(data.security_question);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityAnswer) return setError('Please answer your security question.');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    
    setError('');
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, security_answer: securityAnswer, new_password: newPassword })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to reset password');
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '40px 16px', boxSizing: 'border-box', background: 'var(--color-background)',
    }}>
      <div className="apple-auth-container" style={{ position: 'relative' }}>
        <RouterLink to="/login" style={{ position: 'absolute', top: '24px', left: '24px', color: 'var(--color-foreground-secondary)' }}>
          <ArrowLeft size={24} />
        </RouterLink>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <div style={{ color: 'var(--color-foreground)' }}><Mail size={42} strokeWidth={2.5} /></div>
          <h1 className="apple-title">Account Recovery</h1>
          <p className="apple-subtitle">Recover access to your MailNet account.</p>
        </div>

        {error && <ErrorCard error={error} onDismiss={() => setError('')} />}

        {step === 1 && (
          <form onSubmit={handleFetchQuestion} noValidate className="apple-form" style={{ marginTop: '24px' }}>
            <div className="apple-fields-group">
              <div className="apple-field-row">
                <div className="apple-field-col">
                  <div className="apple-input-wrapper">
                    <span className="apple-input-label">Email Address</span>
                    <input
                      type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                      required disabled={loading} className="apple-input" autoComplete="email"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="apple-btn-continue" style={{ marginTop: '20px' }}>
              {loading ? <span className="spinner" /> : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} noValidate className="apple-form" style={{ marginTop: '24px' }}>
            <div className="apple-fields-group">
              <div className="apple-field-row">
                <div className="apple-field-col" style={{ padding: '16px 16px 8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)', fontWeight: 600 }}>Security Question</span>
                  <div style={{ fontSize: '15px', color: 'var(--color-foreground)', marginTop: '4px', fontWeight: 500 }}>{securityQuestion}</div>
                </div>
              </div>
              <div className="apple-field-row">
                <div className="apple-field-col">
                  <div className="apple-input-wrapper">
                    <span className="apple-input-label">Answer</span>
                    <input
                      type="text" placeholder="Your answer" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)}
                      required disabled={loading} className="apple-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="apple-form-section-title" style={{ marginTop: '24px' }}>New Password</div>
            <div className="apple-fields-group">
              <div className="apple-field-row">
                <div className="apple-field-col">
                  <div className="apple-input-wrapper">
                    <span className="apple-input-label">New Password</span>
                    <input
                      type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      required disabled={loading} className="apple-input"
                    />
                  </div>
                </div>
              </div>
              <div className="apple-field-row">
                <div className="apple-field-col">
                  <div className="apple-input-wrapper">
                    <span className="apple-input-label">Confirm New Password</span>
                    <input
                      type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      required disabled={loading} className="apple-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="apple-btn-continue" style={{ marginTop: '20px' }}>
              {loading ? <span className="spinner" /> : 'Reset Password'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', gap: '16px' }}>
            <CheckCircle size={64} style={{ color: 'var(--color-success)' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-foreground)' }}>Password Reset Successful</h2>
            <p style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)', textAlign: 'center' }}>You can now sign in with your new password.</p>
            <button onClick={() => navigate('/login')} className="apple-btn-continue" style={{ marginTop: '20px' }}>
              Return to Sign In
            </button>
          </div>
        )}
      </div>
      <style>{`
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #ffffff; border-radius: 50%; display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
