import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Mail, RefreshCw, Volume2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import ErrorCard from './ErrorCard';

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('United States');
  
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [securityQuestion, setSecurityQuestion] = useState('What was the name of your first pet?');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate a random captcha code
  const generateCaptchaCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    return code;
  };

  // Draw captcha inside Canvas
  const drawCaptcha = (code: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and fill background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f3f3f3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw noise lines
    ctx.strokeStyle = 'rgba(120, 120, 128, 0.2)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Draw noise dots
    ctx.fillStyle = 'rgba(120, 120, 128, 0.4)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw characters
    ctx.font = 'bold 26px "Courier New", Courier, monospace';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const angle = (Math.random() - 0.5) * 0.4; // random tilt
      const x = 20 + i * 26 + Math.random() * 5;
      const y = canvas.height / 2 + (Math.random() - 0.5) * 8;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      const colors = ['#111111', '#222222', '#333333', '#0071e3', '#8624db'];
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  };

  // Speak captcha using Speech Synthesis for "Vision Impaired" narration
  const speakCaptcha = () => {
    if ('speechSynthesis' in window) {
      const spokenText = captchaCode.split('').join(', ');
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.8; 
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in this browser.');
    }
  };

  useEffect(() => {
    const code = generateCaptchaCode();
    drawCaptcha(code);
  }, []);

  useEffect(() => {
    if (captchaCode) {
      drawCaptcha(captchaCode);
    }
  }, [captchaCode]);

  const handleRefreshCaptcha = () => {
    generateCaptchaCode();
    setCaptchaInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Field validation
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }

    if (!birthMonth || !birthDay || !birthYear) {
      setError('Please enter your complete birthday.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!securityAnswer.trim()) {
      setError('Please provide a security answer.');
      return;
    }

    if (captchaInput.toUpperCase() !== captchaCode) {
      setError('The characters you typed do not match the image. Please try again.');
      handleRefreshCaptcha();
      return;
    }

    setLoading(true);

    // Initial display name as "First Last"
    const initialUsername = `${firstName.trim()} ${lastName.trim()}`;
    const userPayload = {
      username: initialUsername,
      email: email.trim().toLowerCase(),
      password,
      security_question: securityQuestion,
      security_answer: securityAnswer.trim(),
    };

    try {
      let response = await fetch('http://127.0.0.1:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload),
      });

      if (!response.ok) {
        const errData = await response.json();
        const detail = errData?.detail || '';

        // If conflict is likely username, try once with randomized suffix username
        if (detail.includes('already registered')) {
          const suffixUsername = `${firstName.trim()} ${lastName.trim()} ${Math.floor(100 + Math.random() * 900)}`;
          const retryResponse = await fetch('http://127.0.0.1:8000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...userPayload, username: suffixUsername }),
          });

          if (!retryResponse.ok) {
            const retryErr = await retryResponse.json();
            throw new Error(retryErr?.detail || 'This email address is already in use.');
          }

          const data = await retryResponse.json();
          if (data.access_token) {
            login(data.access_token);
            navigate('/');
          } else {
            navigate('/login');
          }
          return;
        }

        throw new Error(detail || 'Registration failed. Please try again.');
      }

      const data = await response.json();
      if (data.access_token) {
        login(data.access_token);
        navigate('/');
      } else {
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
      handleRefreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  // Range array helpers
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Australia', 'India',
    'Germany', 'France', 'Japan', 'Brazil', 'South Africa'
  ];



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
      <div className="fluid-auth-container">
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: 'var(--color-foreground)' }}>
            <Mail size={42} strokeWidth={2.5} />
          </div>
          <h1 className="fluid-title" style={{ fontSize: '28px' }}>Create Your MailNet Account</h1>
          <p className="fluid-subtitle" style={{ fontSize: '15px', maxWidth: '400px' }}>
            One MailNet Account is all you need to access all MailNet services. Already have a MailNet Account?{' '}
            <RouterLink to="/login" className="fluid-link">
              Sign In &rarr;
            </RouterLink>
          </p>
        </div>

        {/* Error Notification */}
        {error && <ErrorCard error={error} onDismiss={() => setError('')} />}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} noValidate className="fluid-form">
          
          {/* Name group */}
          <div className="fluid-fields-group">
            <div className="fluid-field-row">
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">First Name</span>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={loading}
                    className="fluid-input"
                  />
                </div>
              </div>
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Last Name</span>
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                    className="fluid-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Country / Region */}
          <div className="fluid-form-section-title">Country / Region</div>
          <div className="fluid-field-standalone">
            <div className="fluid-input-wrapper">
              <span className="fluid-input-label">Country/Region</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={loading}
                className="fluid-select"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="fluid-select-icon">&#9662;</span>
            </div>
          </div>

          {/* Birthday */}
          <div className="fluid-form-section-title">Birthday</div>
          <div className="fluid-fields-group">
            <div className="fluid-field-row">
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Month</span>
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    disabled={loading}
                    className="fluid-select"
                    required
                  >
                    <option value="" disabled hidden>Month</option>
                    {months.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <span className="fluid-select-icon">&#9662;</span>
                </div>
              </div>
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Day</span>
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    disabled={loading}
                    className="fluid-select"
                    required
                  >
                    <option value="" disabled hidden>Day</option>
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="fluid-select-icon">&#9662;</span>
                </div>
              </div>
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Year</span>
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    disabled={loading}
                    className="fluid-select"
                    required
                  >
                    <option value="" disabled hidden>Year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <span className="fluid-select-icon">&#9662;</span>
                </div>
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div className="fluid-form-section-title">Account Credentials</div>
          <div className="fluid-fields-group">
            <div className="fluid-field-row">
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Email Address</span>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="fluid-input"
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>
            <div className="fluid-field-row">
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Password</span>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="fluid-input"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>
            <div className="fluid-field-row">
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Confirm Password</span>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="fluid-input"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Question */}
          <div className="fluid-form-section-title">Account Recovery</div>
          <div className="fluid-fields-group">
            <div className="fluid-field-row">
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Security Question</span>
                  <select
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    disabled={loading}
                    className="fluid-select"
                  >
                    <option value="What was the name of your first pet?">What was the name of your first pet?</option>
                    <option value="What is your mother's maiden name?">What is your mother's maiden name?</option>
                    <option value="What was the make and model of your first car?">What was the make and model of your first car?</option>
                    <option value="What was the name of your elementary school?">What was the name of your elementary school?</option>
                  </select>
                  <span className="fluid-select-icon">&#9662;</span>
                </div>
              </div>
            </div>
            <div className="fluid-field-row">
              <div className="fluid-field-col">
                <div className="fluid-input-wrapper">
                  <span className="fluid-input-label">Answer</span>
                  <input
                    type="text"
                    placeholder="Security Answer"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    required
                    disabled={loading}
                    className="fluid-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Captcha Section */}
          <div className="fluid-form-section-title">Security Verification</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="fluid-captcha-container">
              <div className="fluid-captcha-visual">
                <canvas
                  ref={canvasRef}
                  width="160"
                  height="58"
                  style={{ display: 'block' }}
                />
              </div>
              <div className="fluid-captcha-actions">
                <button
                  type="button"
                  onClick={handleRefreshCaptcha}
                  className="fluid-captcha-btn"
                  title="Generate new image code"
                >
                  <RefreshCw size={14} />
                  <span>New Code</span>
                </button>
                <button
                  type="button"
                  onClick={speakCaptcha}
                  className="fluid-captcha-btn"
                  title="Read characters out loud"
                >
                  <Volume2 size={14} />
                  <span>Vision Impaired</span>
                </button>
              </div>
            </div>

            <div className="fluid-field-standalone">
              <div className="fluid-input-wrapper">
                <span className="fluid-input-label">Security Captcha Code</span>
                <input
                  type="text"
                  placeholder="Type the characters in the image"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  required
                  disabled={loading}
                  className="fluid-input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="fluid-btn-continue"
            style={{ marginTop: '20px' }}
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

        {/* Privacy Footer */}
        <div className="fluid-privacy-footer" style={{ marginTop: '12px' }}>
          <svg className="fluid-privacy-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="fluid-privacy-text">
            Your MailNet Account information is used to allow you to sign in securely and access your data. MailNet records certain data for security, support and reporting purposes. See how your data is managed...
          </p>
        </div>
      </div>
    </div>
  );
}
