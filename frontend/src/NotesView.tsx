import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, FileText, Loader2, Search,
  Bold, Italic, Strikethrough, Code, Quote, Underline,
  List, ListOrdered, Link2, Clock, AlignLeft,
  GripVertical, CheckSquare, AlignRight, Type, Hexagon, Hash
} from 'lucide-react';

interface Note {
  id: number;
  title: string;
  content: string;
  updated_at: string;
}

type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'todo' | 'ul' | 'ol' | 'quote' | 'callout' | 'code' | 'divider' | 'table' | 'bullet' | 'num';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

function mdToBlocks(md: string): Block[] {
  if (!md || !md.trim()) return [{ id: generateId(), type: 'p', content: '' }];
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let inCode = false;
  let codeContent = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inCode) {
        blocks.push({ id: generateId(), type: 'code', content: codeContent.trim() });
        inCode = false;
        codeContent = '';
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeContent += line + '\n';
      continue;
    }

    if (line.startsWith('# ')) { blocks.push({ id: generateId(), type: 'h1', content: inlineToHtml(line.slice(2)) }); continue; }
    if (line.startsWith('## ')) { blocks.push({ id: generateId(), type: 'h2', content: inlineToHtml(line.slice(3)) }); continue; }
    if (line.startsWith('### ')) { blocks.push({ id: generateId(), type: 'h3', content: inlineToHtml(line.slice(4)) }); continue; }
    if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      blocks.push({ id: generateId(), type: 'todo', content: inlineToHtml(line.slice(6)), checked: line.startsWith('- [x] ') });
      continue;
    }
    if (/^[-*] /.test(line)) { blocks.push({ id: generateId(), type: 'bullet', content: inlineToHtml(line.slice(2)) }); continue; }
    const olM = line.match(/^(\d+)\. (.*)/);
    if (olM) { blocks.push({ id: generateId(), type: 'num', content: inlineToHtml(olM[2]) }); continue; }
    if (line.startsWith('> ')) {
      if (line.includes('CALLOUT')) {
        blocks.push({ id: generateId(), type: 'callout', content: inlineToHtml(line.replace('> CALLOUT ', '')) });
      } else {
        blocks.push({ id: generateId(), type: 'quote', content: inlineToHtml(line.slice(2)) });
      }
      continue;
    }
    if (line.startsWith('---')) { blocks.push({ id: generateId(), type: 'divider', content: '' }); continue; }
    if (line.trim().startsWith('|')) { blocks.push({ id: generateId(), type: 'table', content: line }); continue; }
    if (line.trim() === '') { blocks.push({ id: generateId(), type: 'p', content: '' }); continue; }
    blocks.push({ id: generateId(), type: 'p', content: inlineToHtml(line) });
  }
  if (inCode) blocks.push({ id: generateId(), type: 'code', content: codeContent.trim() });
  if (blocks.length === 0) blocks.push({ id: generateId(), type: 'p', content: '' });
  return blocks;
}

function blocksToMd(blocks: Block[]): string {
  return blocks.map(b => {
    const c = b.type === 'table' ? b.content : htmlToMdInline(b.content);
    switch (b.type) {
      case 'h1': return '# ' + c;
      case 'h2': return '## ' + c;
      case 'h3': return '### ' + c;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ` + c;
      case 'bullet': return '- ' + c;
      case 'num': return '1. ' + c;
      case 'quote': return '> ' + c;
      case 'callout': return '> CALLOUT ' + c;
      case 'code': return '```\n' + c + '\n```';
      case 'divider': return '---';
      default: return c;
    }
  }).join('\n');
}

function inlineToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function htmlToMdInline(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const kids = Array.from(el.childNodes).map(walk).join('');
    switch (tag) {
      case 'strong': case 'b': return '**' + kids + '**';
      case 'em': case 'i': return '*' + kids + '*';
      case 's': case 'strike': case 'del': return '~~' + kids + '~~';
      case 'code': return '`' + kids + '`';
      case 'a': return '[' + kids + '](' + (el.getAttribute('href') || '') + ')';
      case 'br': return '';
      case 'div': case 'p': return kids;
      default: return kids;
    }
  }
  return walk(div);
}

function timeAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days < 7) return days + 'd ago';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function wc(blocks: Block[]): number {
  return blocks.reduce((acc, b) => {
    const text = htmlToMdInline(b.content);
    return acc + text.trim().split(/\s+/).filter(Boolean).length;
  }, 0);
}

const SLASH_COMMANDS = [
  { id: 'p', name: 'Text', desc: 'Just start writing with plain text.', icon: Type },
  { id: 'h1', name: 'Heading 1', desc: 'Big section heading.', icon: Hash },
  { id: 'h2', name: 'Heading 2', desc: 'Medium section heading.', icon: Hash },
  { id: 'h3', name: 'Heading 3', desc: 'Small section heading.', icon: Hash },
  { id: 'todo', name: 'To-do list', desc: 'Track tasks with a to-do list.', icon: CheckSquare },
  { id: 'bullet', name: 'Bulleted list', desc: 'Create a simple bulleted list.', icon: List },
  { id: 'num', name: 'Numbered list', desc: 'Create a list with numbering.', icon: ListOrdered },
  { id: 'quote', name: 'Quote', desc: 'Capture a quote.', icon: Quote },
  { id: 'callout', name: 'Callout', desc: 'Make writing stand out.', icon: Hexagon },
  { id: 'code', name: 'Code', desc: 'Capture a code snippet.', icon: Code },
  { id: 'table', name: 'Table', desc: 'Add a table structure.', icon: AlignLeft },
  { id: 'divider', name: 'Divider', desc: 'Visually divide blocks.', icon: AlignRight },
];

export default function NotesView({ token, API }: { token: string; API: string }) {
  const [notes, setNotes]       = useState<Note[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeNote, setActive] = useState<Note | null>(null);
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [title, setTitle]       = useState('');
  const [blocks, setBlocks]     = useState<Block[]>([]);
  const [toolbarPosition, setToolbarPosition] = useState<{top: number, left: number} | null>(null);
  const [slashMenu, setSlashMenu] = useState<{top: number, left: number, index: number, search: string} | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<Note | null>(null);
  const titleRef  = useRef('');
  const blocksRef = useRef<Block[]>([]);
  
  activeRef.current = activeNote;
  titleRef.current  = title;
  blocksRef.current = blocks;

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/notes', { headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) setNotes(await r.json());
    } finally { setLoading(false); }
  }, [token, API]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    if (activeNote) {
      setBlocks(mdToBlocks(activeNote.content));
      setTitle(activeNote.title);
    }
  }, [activeNote?.id]);

  const triggerSave = useCallback((newTitle?: string, newBlocks?: Block[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      const note = activeRef.current;
      if (!note) { setSaving(false); return; }
      const t = newTitle !== undefined ? newTitle : titleRef.current;
      const b = newBlocks !== undefined ? newBlocks : blocksRef.current;
      const c = blocksToMd(b);
      await fetch(API + '/notes/' + note.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: t, content: c }),
      });
      setSaving(false);
      fetchNotes();
    }, 800);
  }, [token, API, fetchNotes]);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    triggerSave(v, undefined);
  };

  const updateBlock = (idx: number, content: string) => {
    const newBlocks = [...blocksRef.current];
    newBlocks[idx].content = content;
    setBlocks(newBlocks);
    triggerSave(undefined, newBlocks);
  };

  const setBlockType = (idx: number, type: BlockType, content: string = '') => {
    const newBlocks = [...blocksRef.current];
    newBlocks[idx].type = type;
    newBlocks[idx].content = content;
    setBlocks(newBlocks);
    triggerSave(undefined, newBlocks);
    setSlashMenu(null);
    setTimeout(() => {
      const el = document.getElementById(`block-${newBlocks[idx].id}`);
      if (el) {
        el.focus();
        if (type !== 'table') {
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
    const el = e.currentTarget as HTMLElement;
    if (e.key === '/') {
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          setSlashMenu({ top: rect.bottom + 5, left: rect.left, index: idx, search: '' });
        }
      }, 0);
      return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newBlocks = [...blocksRef.current];
      newBlocks.splice(idx + 1, 0, { id: generateId(), type: 'p', content: '' });
      setBlocks(newBlocks);
      triggerSave(undefined, newBlocks);
      setTimeout(() => { document.getElementById(`block-${newBlocks[idx+1].id}`)?.focus(); }, 0);
    }
    else if (e.key === 'Backspace' && el.textContent === '' && blocksRef.current[idx].type !== 'p') {
      e.preventDefault();
      setBlockType(idx, 'p', '');
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>, idx: number) => {
    const el = e.currentTarget as HTMLElement;
    updateBlock(idx, el.innerHTML);
  };

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.anchorNode) {
        setToolbarPosition(null);
        return;
      }
      const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode as Element : sel.anchorNode.parentElement;
      if (!el?.closest('.notion-block')) {
        setToolbarPosition(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbarPosition({ top: rect.top - 46, left: rect.left + rect.width / 2 });
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  const createNote = async () => {
    const r = await fetch(API + '/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ title: 'Untitled', content: '' }),
    });
    if (r.ok) { const n = await r.json(); setNotes(p => [n, ...p]); setActive(n); }
  };

  const deleteNote = async (id: number) => {
    await fetch(API + '/notes/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    if (activeNote?.id === id) setActive(null);
    fetchNotes();
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => { e.dataTransfer.setData('text/plain', idx.toString()); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const dragIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(dragIdx) || dragIdx === dropIdx) return;
    const newBlocks = [...blocksRef.current];
    const [dragged] = newBlocks.splice(dragIdx, 1);
    newBlocks.splice(dropIdx, 0, dragged);
    setBlocks(newBlocks);
    triggerSave(undefined, newBlocks);
  };

  const filtered = [...notes]
    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const executeCommand = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: '256px', flexShrink: 0, borderRight: '1px solid var(--color-border-premium)', background: 'var(--color-background-secondary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 14px', borderBottom: '1px solid var(--color-border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={17} color="var(--color-primary)" />
            <span style={{ fontSize: '16px', fontWeight: 800 }}>Notes</span>
          </div>
          <button onClick={createNote} title="New note" style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={15} />
          </button>
        </div>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border-premium)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-foreground-secondary)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: '8px', border: '1px solid var(--color-border-premium)', background: 'var(--color-background)', fontSize: '12.5px', color: 'var(--color-foreground)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}><Loader2 size={20} className="animate-spin" color="var(--color-primary)" /></div>
          ) : filtered.map(note => {
            const isActive = activeNote?.id === note.id;
            return (
              <div key={note.id} onClick={() => setActive(note)} style={{ padding: '10px 10px', borderRadius: '10px', cursor: 'pointer', background: isActive ? 'var(--color-primary)' : 'transparent', border: '1px solid transparent' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#fff' : 'var(--color-foreground)' }}>{note.title || 'Untitled'}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-background)', position: 'relative' }}>
        {activeNote ? (
          <>
            <div style={{ padding: '8px 48px', borderBottom: '1px solid var(--color-border-premium)', display: 'flex', gap: '4px', background: 'var(--color-background-elevated)', zIndex: 10, alignItems: 'center' }}>
              <button onClick={() => executeCommand('bold')} title="Bold" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', color: 'var(--color-foreground)' }}><Bold size={15} /></button>
              <button onClick={() => executeCommand('italic')} title="Italic" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', color: 'var(--color-foreground)' }}><Italic size={15} /></button>
              <button onClick={() => executeCommand('underline')} title="Underline" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', color: 'var(--color-foreground)' }}><Underline size={15} /></button>
              <button onClick={() => executeCommand('strikeThrough')} title="Strikethrough" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', color: 'var(--color-foreground)' }}><Strikethrough size={15} /></button>
              <div style={{ width: '1px', height: '16px', background: 'var(--color-border-premium)', margin: '0 8px' }} />
              <button onClick={() => { const url = prompt('Enter URL:'); if (url) executeCommand('createLink', url); }} title="Link" style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', color: 'var(--color-foreground)' }}><Link2 size={15} /></button>
            </div>
            {toolbarPosition && (
              <div style={{ position: 'fixed', top: `${toolbarPosition.top}px`, left: `${toolbarPosition.left}px`, transform: 'translateX(-50%)', zIndex: 1000, padding: '6px', borderRadius: '12px', background: 'var(--color-background-elevated)', border: '1px solid var(--color-border-premium)', display: 'flex', gap: '2px', backdropFilter: 'blur(10px)' }}>
                <TB onClick={() => executeCommand('bold')} title="Bold"><Bold size={14} /></TB>
                <TB onClick={() => executeCommand('italic')} title="Italic"><Italic size={14} /></TB>
                <TB onClick={() => executeCommand('underline')} title="Underline"><span style={{fontWeight: 800}}>U</span></TB>
                <TB onClick={() => executeCommand('strikeThrough')} title="Strikethrough"><Strikethrough size={14} /></TB>
                <Sep />
              </div>
            )}
            {slashMenu && (
              <div style={{ position: 'absolute', top: `${slashMenu.top}px`, left: `${slashMenu.left}px`, zIndex: 1000, width: '300px', background: 'var(--color-background-elevated)', border: '1px solid var(--color-border-premium)', borderRadius: '8px', padding: '8px' }}>
                {SLASH_COMMANDS.map((cmd) => (
                  <div key={cmd.id} onClick={() => setBlockType(slashMenu.index, cmd.id as BlockType, '')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', cursor: 'pointer' }}>
                    <cmd.icon size={16} />
                    <div style={{ fontSize: '13px' }}>{cmd.name}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px 80px' }}>
              <div style={{ maxWidth: '740px', margin: '0 auto' }}>
                <input value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="Untitled" style={{ display: 'block', width: '100%', fontSize: '38px', fontWeight: 800, border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-foreground)', marginBottom: '8px', letterSpacing: '-0.5px', lineHeight: 1.2, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                
                <div style={{ display: 'flex', gap: '14px', marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-premium)', fontSize: '12.5px', color: 'var(--color-foreground-secondary)', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {timeAgo(activeNote.updated_at)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlignLeft size={12} /> {wc(blocks)} words · {Math.max(1, Math.ceil(wc(blocks) / 200))} min read</span>
                  <div style={{ flex: 1 }} />
                  {saving && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)' }}><Loader2 size={12} className="animate-spin" /> Saving...</span>}
                  <button onClick={() => deleteNote(activeNote.id)} title="Delete Note"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {blocks.map((b, idx) => (
                    <div key={b.id} className="notion-block-container" onDragOver={handleDragOver} onDrop={e => handleDrop(e, idx)} style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
                      <div draggable onDragStart={(e) => handleDragStart(e, idx)} className="notion-drag-handle" style={{ width: '24px', opacity: 0, cursor: 'grab', color: 'var(--color-foreground-secondary)', marginLeft: '-24px' }}><GripVertical size={16} /></div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        {b.type === 'todo' && <input type="checkbox" checked={b.checked} onChange={e => { const newB = [...blocks]; newB[idx].checked = e.target.checked; setBlocks(newB); triggerSave(undefined, newB); }} style={{ marginTop: '5px' }} />}
                        {b.type === 'bullet' && <span style={{ marginTop: '2px', fontSize: '18px' }}>•</span>}
                        {b.type === 'num' && <span style={{ marginTop: '2px', fontSize: '15px', fontWeight: 600 }}>{idx + 1}.</span>}
                        {b.type === 'divider' ? <div style={{ width: '100%', height: '1px', background: 'var(--color-border-premium)', margin: '12px 0' }} /> : b.type === 'table' ? (
                          <textarea id={`block-${b.id}`} value={b.content} onChange={e => { const newB = [...blocks]; newB[idx].content = e.target.value; setBlocks(newB); triggerSave(undefined, newB); }} style={{ width: '100%', minHeight: '100px', fontFamily: 'monospace', padding: '12px', border: '1px solid var(--color-border-premium)', background: 'var(--color-background-secondary)', resize: 'vertical' }} />
                        ) : (
                          <div
                            id={`block-${b.id}`}
                            className="notion-block"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={e => handleInput(e, idx)}
                            onKeyDown={e => handleKeyDown(e, idx)}
                            dangerouslySetInnerHTML={{ __html: b.content }}
                            data-placeholder={b.type === 'p' ? 'Type / for commands' : b.type === 'h1' ? 'Heading 1' : b.type === 'h2' ? 'Heading 2' : b.type === 'h3' ? 'Heading 3' : b.type === 'quote' ? 'Quote' : b.type === 'code' ? 'Code...' : b.type === 'callout' ? 'Callout text...' : ''}
                            style={{
                              flex: 1, outline: 'none', minHeight: '24px', lineHeight: 1.6,
                              fontSize: b.type === 'h1' ? '32px' : b.type === 'h2' ? '24px' : b.type === 'h3' ? '20px' : b.type === 'quote' ? '17px' : b.type === 'callout' ? '15px' : b.type === 'code' ? '13px' : '15px',
                              fontWeight: b.type.startsWith('h') ? 700 : 400,
                              fontFamily: b.type === 'code' ? 'monospace' : 'inherit',
                              color: b.type === 'quote' ? 'var(--color-foreground-secondary)' : 'inherit',
                              borderLeft: b.type === 'quote' ? '3px solid var(--color-foreground-secondary)' : 'none',
                              background: b.type === 'code' ? 'var(--color-background-secondary)' : b.type === 'callout' ? 'rgba(99,102,241,0.1)' : 'transparent',
                              border: b.type === 'code' || b.type === 'callout' ? '1px solid var(--color-border-premium)' : 'none',
                              padding: b.type === 'code' || b.type === 'callout' ? '16px' : b.type === 'quote' ? '4px 0 4px 16px' : '4px 0',
                              borderRadius: b.type === 'code' || b.type === 'callout' ? '8px' : '0',
                            }}
                          />
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--color-foreground-secondary)' }}>
            <FileText size={60} style={{ opacity: 0.1 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-foreground)', marginBottom: '6px' }}>No note selected</div>
              <div style={{ fontSize: '14px', marginBottom: '16px' }}>Pick from the sidebar, or create a new one</div>
              <button onClick={createNote}
                style={{ padding: '10px 24px', borderRadius: '12px', background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', transition: 'all 0.2s' }}>
                <Plus size={16} /> New Note
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Add CSS for block hover states */}
      <style>{`
        .notion-block-container:hover .notion-drag-handle { opacity: 1 !important; }
        .notion-block:empty:before { content: attr(data-placeholder); color: var(--color-foreground-secondary); opacity: 0.6; pointer-events: none; }
      `}</style>
    </div>
  );
}

function TB({ onClick, title, children, label }: { onClick?: () => void; title?: string; children?: React.ReactNode; label?: string }) {
  return (
    <button onClick={onClick} title={title} onMouseDown={e => e.preventDefault()}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 7px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--color-foreground-secondary)', fontSize: '12px', fontWeight: 700, transition: 'all 0.12s', minWidth: '26px', height: '26px' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--color-background)'; el.style.color = 'var(--color-foreground)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--color-foreground-secondary)'; }}
    >{label ?? children}</button>
  );
}

function Sep() {
  return <div style={{ width: '1px', height: '18px', background: 'var(--color-border-premium)', margin: '0 3px', flexShrink: 0 }} />;
}
