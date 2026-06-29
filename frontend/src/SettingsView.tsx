import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Trash2, Folder, User, Lock, Tag, ChevronRight, Moon } from 'lucide-react';

interface SettingsProps {
  user: any;
  token: string;
  onUpdateUser: (u: any) => void;
  API: string;
  allTags?: any[];
  allFolders?: any[];
  onRefreshData?: () => void;
  shortcutsEnabled: boolean;
  onToggleShortcuts: (enabled: boolean) => void;
}

export default function SettingsView({ user, token, onUpdateUser, API, allTags, allFolders, onRefreshData, shortcutsEnabled, onToggleShortcuts }: SettingsProps) {
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarBase64, setAvatarBase64] = useState(user?.avatar_base64 || '');

  const [aiProvider, setAiProvider] = useState(user?.ai_provider || 'ollama');
  const [aiModel, setAiModel] = useState(user?.ai_model || '');
  const [openaiKey, setOpenaiKey] = useState(user?.openai_key || '');
  const [ollamaUrl, setOllamaUrl] = useState(user?.ollama_url || 'http://localhost:11434/v1');
  const [geminiKey, setGeminiKey] = useState(user?.gemini_key || '');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [addingTag, setAddingTag] = useState(false);

  const [filterRules, setFilterRules] = useState<any[]>([]);
  const [addingRule, setAddingRule] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleCondition, setRuleCondition] = useState('sender');
  const [rulePattern, setRulePattern] = useState('');
  const [ruleAction, setRuleAction] = useState('trash');
  const [ruleActionValue, setRuleActionValue] = useState('');

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API}/rules`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setFilterRules(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchRules();
  }, [API, token]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAvatarBase64(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const res = await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          username, bio, avatar_base64: avatarBase64,
          ai_provider: aiProvider, ai_model: aiModel, openai_key: openaiKey, ollama_url: ollamaUrl, gemini_key: geminiKey
        })
      });
      if (!res.ok) throw new Error('Failed to update profile');
      onUpdateUser({ ...user, username, bio, avatar_base64: avatarBase64, ai_provider: aiProvider, ai_model: aiModel, openai_key: openaiKey, ollama_url: ollamaUrl, gemini_key: geminiKey });
      setProfileMsg('Profile and preferences updated successfully!');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err: any) {
      setProfileMsg('Error: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSaving(true);
    setPwdMsg('');
    try {
      const res = await fetch(`${API}/users/me/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to change password');
      }
      setPwdMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPwdMsg(''), 3000);
    } catch (err: any) {
      setPwdMsg('Error: ' + err.message);
    } finally {
      setPwdSaving(false);
    }
  };

  const fetchModels = async () => {
    if (aiProvider === 'ollama') return;
    setFetchingModels(true);
    try {
      const key = aiProvider === 'openai' ? openaiKey : geminiKey;
      const res = await fetch(`${API}/ai/models?provider=${aiProvider}&api_key=${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableModels(data.models || []);
      } else {
        setProfileMsg('Failed to fetch models. Check your API key and save preferences first.');
      }
    } catch (err) {
      setProfileMsg('Error fetching models.');
    } finally {
      setFetchingModels(false);
    }
  };

  useEffect(() => {
    if (aiProvider !== 'ollama') {
      fetchModels();
    }
  }, [aiProvider]);

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setAddingFolder(true);
    try {
      const res = await fetch(`${API}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      if (res.ok) {
        setNewFolderName('');
        if (onRefreshData) onRefreshData();
      }
    } finally {
      setAddingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: number) => {
    try {
      await fetch(`${API}/folders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onRefreshData) onRefreshData();
    } catch {}
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setAddingTag(true);
    try {
      const res = await fetch(`${API}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor })
      });
      if (res.ok) {
        setNewTagName('');
        if (onRefreshData) onRefreshData();
      }
    } finally {
      setAddingTag(false);
    }
  };

  const handleDeleteTag = async (id: number) => {
    try {
      await fetch(`${API}/tags/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onRefreshData) onRefreshData();
    } catch {}
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !rulePattern.trim()) return;
    setAddingRule(true);
    try {
      const res = await fetch(`${API}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: ruleName.trim(),
          condition: ruleCondition,
          pattern: rulePattern.trim(),
          action_type: ruleAction,
          action_value: ruleAction === 'tag' ? ruleActionValue : undefined
        })
      });
      if (res.ok) {
        setRuleName('');
        setRulePattern('');
        fetchRules();
      }
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await fetch(`${API}/rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRules();
    } catch {}
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 400,
    color: 'var(--color-foreground-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    padding: '0 16px',
    marginBottom: '8px',
    marginTop: '24px',
  };

  const inputRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: 'transparent',
    border: 'none',
    fontSize: '17px',
    color: 'var(--color-foreground)',
    outline: 'none',
    padding: '12px 16px',
    fontFamily: 'inherit',
  };

  const msgStyle = (msg: string): React.CSSProperties => ({
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: msg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
    padding: '8px 16px',
    paddingBottom: '0',
  });

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [accentColor, setAccentColor] = useState(localStorage.getItem('accentColor') || '#007aff');

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  };

  const changeAccentColor = (colorHex: string) => {
    setAccentColor(colorHex);
    document.documentElement.style.setProperty('--color-primary', colorHex);
    
    // Calculate a rough rgba light version for backgrounds
    let r = parseInt(colorHex.slice(1, 3), 16);
    let g = parseInt(colorHex.slice(3, 5), 16);
    let b = parseInt(colorHex.slice(5, 7), 16);
    document.documentElement.style.setProperty('--color-primary-light', `rgba(${r}, ${g}, ${b}, 0.12)`);
    
    localStorage.setItem('accentColor', colorHex);
  };

  const themeColors = [
    { name: 'Blue', hex: '#007aff' },
    { name: 'Purple', hex: '#af52de' },
    { name: 'Pink', hex: '#ff2d55' },
    { name: 'Red', hex: '#ff3b30' },
    { name: 'Orange', hex: '#ff9500' },
    { name: 'Green', hex: '#34c759' },
  ];

  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      background: 'var(--color-background-secondary)',
    }}>
      <div className="ios-list-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* iOS 18 Navigation Bar Style Large Title */}
        <div style={{ padding: '20px 16px 12px 16px' }}>
          <h1 style={{ fontSize: '34px', fontWeight: 700, color: 'var(--color-foreground)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Settings</h1>
        </div>

        {/* ═══ Appearance ═══ */}
        <div style={sectionHeaderStyle}>Appearance</div>
        <div className="ios-list-group">
          <div className="ios-list-row has-icon" style={{ borderBottom: '1px solid var(--color-divider)' }}>
            <div className="ios-list-row-content">
              <div className="ios-list-icon" style={{ background: '#000000' }}><Moon size={16} color="white" /></div>
              <div className="ios-list-text">Dark Mode</div>
            </div>
            <label className="ios-switch">
              <input type="checkbox" checked={isDark} onChange={toggleTheme} />
              <span className="ios-switch-slider"></span>
            </label>
          </div>
          
          <div className="ios-list-row has-icon">
            <div className="ios-list-row-content">
              <div className="ios-list-text" style={{ paddingLeft: '8px' }}>Accent Color</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {themeColors.map(tc => (
                <button
                  key={tc.name}
                  onClick={() => changeAccentColor(tc.hex)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                    background: tc.hex, cursor: 'pointer',
                    boxShadow: accentColor === tc.hex ? `0 0 0 3px var(--color-background), 0 0 0 5px ${tc.hex}` : 'none',
                    transition: 'box-shadow 0.2s',
                  }}
                  title={tc.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ═══ Profile ═══ */}
        <div style={sectionHeaderStyle}>Apple Account (Profile)</div>
        <div className="ios-list-group">
          {/* Avatar Row */}
          <div className="ios-list-row" style={{ minHeight: '80px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
            <div className="ios-list-row-content">
              {avatarBase64 ? (
                <img src={avatarBase64} alt="Avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'var(--color-background-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-foreground-secondary)',
                }}><User size={28} /></div>
              )}
              <div style={{ flex: 1 }}>
                <div className="ios-list-text" style={{ fontSize: '20px', fontWeight: 500 }}>{username || 'Name'}</div>
                <div className="ios-list-subtext">Apple Account, iCloud, and more</div>
              </div>
            </div>
            <ChevronRight size={20} color="var(--color-foreground-tertiary)" />
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
          
          <form onSubmit={handleSaveProfile}>
            <div className="ios-list-row" style={{ padding: 0 }}>
              <input 
                type="text" 
                style={inputRowStyle}
                placeholder="Display Name" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>
            <div className="ios-list-row" style={{ padding: 0 }}>
              <input 
                type="text" 
                style={inputRowStyle}
                placeholder="Bio / About Me" 
                value={bio} 
                onChange={e => setBio(e.target.value)} 
              />
            </div>
            <div className="ios-list-row" style={{ cursor: 'pointer' }}>
              <button 
                type="submit" 
                disabled={profileSaving}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--color-primary)', 
                  fontSize: '17px', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {profileSaving && <Loader2 size={18} className="animate-spin" />}
                Update Profile
              </button>
            </div>
          </form>
        </div>
        {profileMsg && <div style={{...msgStyle(profileMsg), marginTop: '-16px', marginBottom: '16px'}}>{profileMsg}</div>}

        {/* ═══ Security ═══ */}
        <div style={sectionHeaderStyle}>Security & Password</div>
        <div className="ios-list-group">
          <form onSubmit={handleSavePassword}>
            <div className="ios-list-row has-icon" style={{ padding: 0 }}>
              <div style={{ paddingLeft: '16px', display: 'flex', alignItems: 'center' }}>
                 <div className="ios-list-icon" style={{ background: '#34c759' }}><Lock size={16} /></div>
              </div>
              <input 
                type="password" 
                style={inputRowStyle}
                placeholder="Current Password" 
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                required 
              />
            </div>
            <div className="ios-list-row has-icon" style={{ padding: 0 }}>
              <div style={{ paddingLeft: '16px', display: 'flex', alignItems: 'center' }}>
                 <div className="ios-list-icon" style={{ background: '#5ac8fa' }}><Lock size={16} /></div>
              </div>
              <input 
                type="password" 
                style={inputRowStyle}
                placeholder="New Password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required minLength={6} 
              />
            </div>
            <div className="ios-list-row" style={{ cursor: 'pointer' }}>
              <button 
                type="submit" 
                disabled={pwdSaving}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--color-primary)', 
                  fontSize: '17px', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {pwdSaving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
        {pwdMsg && <div style={{...msgStyle(pwdMsg), marginTop: '-16px', marginBottom: '16px'}}>{pwdMsg}</div>}

        {/* ═══ AI Preferences ═══ */}
        <div style={sectionHeaderStyle}>Apple Intelligence (AI Settings)</div>
        <div className="ios-list-group">
          <div className="ios-list-row" style={{ padding: 0 }}>
            <select
              style={inputRowStyle}
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="apple-select"
            >
              <option value="ollama">Local AI (Ollama - Maximum Privacy)</option>
              <option value="openai">Cloud AI (OpenAI API)</option>
              <option value="gemini">Google Gemini API</option>
            </select>
          </div>
          
          {aiProvider === 'gemini' && (
            <div className="ios-list-row" style={{ padding: 0 }}>
              <input 
                type="password" 
                style={inputRowStyle}
                placeholder="Gemini API Key" 
                value={geminiKey} 
                onChange={e => setGeminiKey(e.target.value)} 
              />
            </div>
          )}
          
          {aiProvider === 'openai' && (
            <div className="ios-list-row" style={{ padding: 0 }}>
              <input 
                type="password" 
                style={inputRowStyle}
                placeholder="OpenAI API Key (sk-...)" 
                value={openaiKey} 
                onChange={e => setOpenaiKey(e.target.value)} 
              />
            </div>
          )}
          
          {aiProvider === 'ollama' && (
            <div className="ios-list-row" style={{ padding: 0 }}>
              <input 
                type="text" 
                style={inputRowStyle}
                placeholder="Ollama URL (default: http://localhost:11434/v1)" 
                value={ollamaUrl} 
                onChange={e => setOllamaUrl(e.target.value)} 
              />
            </div>
          )}

          {aiProvider !== 'ollama' && (
            <div className="ios-list-row" style={{ padding: 0 }}>
              <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                <select
                  style={{ ...inputRowStyle, flex: 1, borderRight: '1px solid var(--color-divider)' }}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="apple-select"
                >
                  <option value="">Select a Model...</option>
                  {availableModels.map(m => <option key={m.id || m} value={m.id || m}>{m.id || m} {m.tokens ? `(${m.tokens.toLocaleString()} tokens)` : ''}</option>)}
                  {aiModel && !availableModels.find(m => (m.id || m) === aiModel) && <option value={aiModel}>{aiModel} (Current)</option>}
                </select>
                <button
                  type="button"
                  onClick={fetchModels}
                  disabled={fetchingModels}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--color-primary)',
                    padding: '0 16px', fontSize: '15px', fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  {fetchingModels ? <Loader2 size={16} className="animate-spin" /> : 'Fetch Models'}
                </button>
              </div>
            </div>
          )}

          <div className="ios-list-row" style={{ cursor: 'pointer' }} onClick={handleSaveProfile}>
            <button 
              disabled={profileSaving}
              style={{
                background: 'transparent', border: 'none', color: 'var(--color-primary)', 
                fontSize: '17px', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              Save AI Preferences
            </button>
          </div>
        </div>

        {/* ═══ Keyboard Shortcuts ═══ */}
        <div style={sectionHeaderStyle}>Keyboard Shortcuts</div>
        <div className="ios-list-group">
          <div className="ios-list-row" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-divider)' }}>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 500, color: 'var(--color-foreground)' }}>Enable Shortcuts</div>
              <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)', marginTop: '4px' }}>Use industry-standard keyboard shortcuts</div>
            </div>
            <label className="ios-toggle">
              <input 
                type="checkbox" 
                checked={shortcutsEnabled} 
                onChange={e => onToggleShortcuts(e.target.checked)} 
                style={{ display: 'none' }}
              />
              <div className={`toggle-track ${shortcutsEnabled ? 'active' : ''}`} style={{
                width: '51px', height: '31px', borderRadius: '31px', 
                background: shortcutsEnabled ? '#34c759' : 'rgba(0,0,0,0.1)', 
                position: 'relative', cursor: 'pointer', transition: '0.3s'
              }}>
                <div className="toggle-thumb" style={{
                  width: '27px', height: '27px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '2px', left: shortcutsEnabled ? '22px' : '2px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: '0.3s'
                }} />
              </div>
            </label>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ShortcutGuideRow keys={['Cmd/Ctrl', 'K']} label="Toggle AI Action Center" />
            <ShortcutGuideRow keys={['Cmd/Ctrl', 'Enter']} label="Send Email or Chat" />
            <ShortcutGuideRow keys={['Cmd/Ctrl', '/']} label="Open Shortcuts Guide" />
            <ShortcutGuideRow keys={['Esc']} label="Close active panels" />
          </div>
        </div>

        {/* ═══ Categories ═══ */}
        <div style={sectionHeaderStyle}>Categories</div>
        <div className="ios-list-group">
          <form onSubmit={handleAddTag} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
             <div className="ios-list-row" style={{ padding: 0, flex: 1, borderBottom: '1px solid var(--color-divider)' }}>
               <input 
                 type="text" 
                 style={inputRowStyle}
                 placeholder="Add new category..." 
                 value={newTagName} 
                 onChange={e => setNewTagName(e.target.value)} 
                 required 
               />
               <input
                  type="color"
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  style={{
                    width: '28px', height: '28px', padding: '0', margin: '0 8px', border: 'none',
                    background: 'transparent', borderRadius: '50%', cursor: 'pointer', overflow: 'hidden'
                  }}
                />
               <button 
                 type="submit" 
                 disabled={addingTag || !newTagName.trim()}
                 style={{
                   background: 'transparent', border: 'none', color: 'var(--color-primary)', 
                   fontSize: '17px', paddingRight: '16px', fontWeight: 600, cursor: 'pointer'
                 }}
               >Add</button>
             </div>
          </form>

          {allTags?.map((tag) => (
            <div key={tag.id} className="ios-list-row has-icon">
              <div className="ios-list-row-content">
                <div className="ios-list-icon" style={{ background: tag.color }}><Tag size={16} color="white" /></div>
                <div className="ios-list-text">{tag.name}</div>
              </div>
              <button
                onClick={() => handleDeleteTag(tag.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)',
                }}
              ><Trash2 size={18} /></button>
            </div>
          ))}
        </div>

        {/* ═══ Folders ═══ */}
        <div style={sectionHeaderStyle}>Folders</div>
        <div className="ios-list-group">
          <form onSubmit={handleAddFolder} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
             <div className="ios-list-row" style={{ padding: 0, flex: 1, borderBottom: '1px solid var(--color-divider)' }}>
               <input 
                 type="text" 
                 style={inputRowStyle}
                 placeholder="Add new folder..." 
                 value={newFolderName} 
                 onChange={e => setNewFolderName(e.target.value)} 
                 required 
               />
               <button 
                 type="submit" 
                 disabled={addingFolder || !newFolderName.trim()}
                 style={{
                   background: 'transparent', border: 'none', color: 'var(--color-primary)', 
                   fontSize: '17px', paddingRight: '16px', fontWeight: 600, cursor: 'pointer'
                 }}
               >Add</button>
             </div>
          </form>

          {allFolders?.map((folder) => (
            <div key={folder.id} className="ios-list-row has-icon">
              <div className="ios-list-row-content">
                <div className="ios-list-icon" style={{ background: '#007aff' }}><Folder size={16} color="white" /></div>
                <div className="ios-list-text">{folder.name}</div>
              </div>
              <button
                onClick={() => handleDeleteFolder(folder.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)',
                }}
              ><Trash2 size={18} /></button>
            </div>
          ))}
        </div>

        {/* ═══ Automation Rules ═══ */}
        <div style={sectionHeaderStyle}>Automation Rules</div>
        <div className="ios-list-group">
          <form onSubmit={handleAddRule} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--color-divider)' }}>
             <input className="ios-input" placeholder="Rule Name (e.g. Delete spam)" value={ruleName} onChange={e => setRuleName(e.target.value)} required />
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select className="apple-select ios-input" value={ruleCondition} onChange={e => setRuleCondition(e.target.value)}>
                   <option value="sender">If Sender Contains</option>
                   <option value="subject">If Subject Contains</option>
                   <option value="attachment">If Has Attachment</option>
                </select>
                <input className="ios-input" placeholder="Pattern to match" value={rulePattern} onChange={e => setRulePattern(e.target.value)} required={ruleCondition !== 'attachment'} disabled={ruleCondition === 'attachment'} />
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select className="apple-select ios-input" value={ruleAction} onChange={e => setRuleAction(e.target.value)}>
                   <option value="trash">Move to Bin</option>
                   <option value="star">Star it</option>
                   <option value="tag">Add Tag</option>
                </select>
                {ruleAction === 'tag' && (
                  <select className="apple-select ios-input" value={ruleActionValue} onChange={e => setRuleActionValue(e.target.value)} required>
                     <option value="">Select a tag...</option>
                     {allTags?.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                )}
             </div>
             <button type="submit" disabled={addingRule || !ruleName} className="ios-button" style={{ marginTop: '4px' }}>
                Add Rule
             </button>
          </form>

          {filterRules.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-foreground-secondary)', fontSize: '15px' }}>
               No automation rules defined yet.
            </div>
          ) : filterRules.map(rule => (
            <div key={rule.id} className="ios-list-row" style={{ alignItems: 'flex-start' }}>
              <div className="ios-list-row-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{rule.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-foreground-secondary)' }}>
                   If <strong>{rule.condition}</strong> matches "{rule.pattern}" &rarr; <strong>{rule.action_type.toUpperCase()}</strong> {rule.action_value && `(${rule.action_value})`}
                </div>
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', alignSelf: 'center' }}
              ><Trash2 size={18} /></button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
function ShortcutGuideRow({ keys, label }: { keys: string[], label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '15px', color: 'var(--color-foreground-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', gap: '6px' }}>
        {keys.map((k, i) => (
          <kbd key={i} style={{ 
            background: 'var(--color-background)', border: '1px solid var(--color-divider)', 
            borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace', 
            color: 'var(--color-foreground)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
