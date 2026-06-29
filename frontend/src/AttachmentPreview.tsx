import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  X, Download, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
  FileText, Film, Music, File, FileArchive, FileCode, FileSpreadsheet,
  Maximize2, Volume2, VolumeX, Play, Pause, SkipBack, SkipForward,
  Loader2, AlertCircle, Eye,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttachmentType =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'csv'
  | 'zip'
  | 'code'
  | 'text'
  | 'other';

export interface AttachmentInfo {
  url: string;
  name?: string;
  size?: number;
  type?: AttachmentType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function detectAttachmentType(url: string): AttachmentType {
  const lower = url.toLowerCase().split('?')[0];
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg|heic|heif|bmp|tiff?)$/i.test(lower)) return 'image';
  if (/\.(mp4|webm|ogg|mov|avi|mkv|m4v|flv|wmv)$/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|flac|aac|m4a|opus|wma)$/i.test(lower)) return 'audio';
  if (/\.pdf$/i.test(lower)) return 'pdf';
  if (/\.(docx?|rtf|odt)$/i.test(lower)) return 'docx';
  if (/\.csv$/i.test(lower)) return 'csv';
  if (/\.(xlsx?|ods)$/i.test(lower)) return 'xlsx';
  if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(lower)) return 'zip';
  if (/\.(js|ts|jsx|tsx|py|rb|go|java|c|cpp|h|cs|php|html|css|json|yaml|yml|sh|rs|swift|kt|md)$/i.test(lower)) return 'code';
  if (/\.(txt|log)$/i.test(lower)) return 'text';
  return 'other';
}

export function getFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || 'file');
  } catch {
    return url.split('/').pop()?.split('?')[0] || 'file';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function humanType(type: AttachmentType): string {
  const map: Record<AttachmentType, string> = {
    image: 'Image', video: 'Video', audio: 'Audio', pdf: 'PDF Document',
    docx: 'Word Document', xlsx: 'Spreadsheet', csv: 'CSV Spreadsheet',
    zip: 'Archive', code: 'Source Code', text: 'Text File', other: 'File',
  };
  return map[type];
}

function FileTypeIcon({ type, size = 28 }: { type: AttachmentType; size?: number }) {
  const colors: Record<AttachmentType, string> = {
    image: '#007aff', video: '#ff2d55', audio: '#af52de', pdf: '#ff3b30',
    docx: '#2563eb', xlsx: '#16a34a', csv: '#059669', zip: '#f59e0b',
    code: '#06b6d4', text: '#6b7280', other: '#6b7280',
  };
  const color = colors[type];
  const icons: Record<AttachmentType, React.ReactNode> = {
    image: <ZoomIn size={size} color={color} />,
    video: <Film size={size} color={color} />,
    audio: <Music size={size} color={color} />,
    pdf: <FileText size={size} color={color} />,
    docx: <FileText size={size} color={color} />,
    xlsx: <FileSpreadsheet size={size} color={color} />,
    csv: <FileSpreadsheet size={size} color={color} />,
    zip: <FileArchive size={size} color={color} />,
    code: <FileCode size={size} color={color} />,
    text: <FileText size={size} color={color} />,
    other: <File size={size} color={color} />,
  };
  return <>{icons[type]}</>;
}

// ─── Inline Document Viewers ──────────────────────────────────────────────────

/** Spreadsheet viewer (XLSX / XLS / ODS + CSV) */
function SpreadsheetViewer({ url, isCSV }: { url: string; isCSV?: boolean }) {
  const [sheets, setSheets] = useState<{ name: string; data: string[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const wb = XLSX.read(buf, { type: 'array' });
        const parsed = wb.SheetNames.map(sheetName => ({
          name: sheetName,
          data: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
            header: 1, defval: '',
          }) as string[][],
        }));
        setSheets(parsed);
        setLoading(false);
      })
      .catch(() => { setError('Could not load spreadsheet.'); setLoading(false); });
  }, [url]);

  if (loading) return <DocViewerLoading label={isCSV ? 'CSV' : 'Spreadsheet'} />;
  if (error || sheets.length === 0) return <DocViewerError label={isCSV ? 'CSV' : 'Spreadsheet'} />;

  const current = sheets[activeSheet];

  return (
    <div className="doc-viewer-container doc-sheet-container">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="doc-sheet-tabs">
          {sheets.map((s, i) => (
            <button
              key={i}
              className={`doc-sheet-tab ${i === activeSheet ? 'doc-sheet-tab-active' : ''}`}
              onClick={() => setActiveSheet(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="doc-sheet-scroll">
        <table className="doc-sheet-table">
          <thead>
            {current.data[0] && (
              <tr>
                <th className="doc-sheet-row-num">#</th>
                {current.data[0].map((cell, ci) => (
                  <th key={ci} className="doc-sheet-th">{cell ?? ''}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {current.data.slice(1).map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'doc-sheet-row-even' : 'doc-sheet-row-odd'}>
                <td className="doc-sheet-row-num">{ri + 2}</td>
                {row.map((cell, ci) => (
                  <td key={ci} className="doc-sheet-td">{cell ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** DOCX viewer (mammoth → HTML) */
function DocxViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true); setError(false);
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then(result => { setHtml(result.value); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [url]);

  if (loading) return <DocViewerLoading label="Document" />;
  if (error || html === null) return <DocViewerError label="Document" />;

  return (
    <div className="doc-viewer-container doc-docx-container">
      <div className="doc-docx-page">
        <div
          className="doc-docx-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

/** Plain text / code viewer */
function TextViewer({ url, isCode }: { url: string; isCode?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true); setError(false);
    fetch(url)
      .then(r => r.text())
      .then(t => { setText(t); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [url]);

  if (loading) return <DocViewerLoading label={isCode ? 'Code' : 'Text'} />;
  if (error || text === null) return <DocViewerError label="File" />;

  const lineCount = (text.match(/\n/g) || []).length + 1;

  return (
    <div className="doc-viewer-container doc-text-container">
      <div className="doc-text-scroll">
        <div className="doc-text-gutter">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i} className="doc-text-line-num">{i + 1}</span>
          ))}
        </div>
        <pre className={`doc-text-pre ${isCode ? 'doc-code-pre' : ''}`}>{text}</pre>
      </div>
    </div>
  );
}

/** Shared loading/error states */
function DocViewerLoading({ label }: { label: string }) {
  return (
    <div className="doc-viewer-state">
      <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      <p className="doc-viewer-state-text">Loading {label}…</p>
    </div>
  );
}

function DocViewerError({ label }: { label: string }) {
  return (
    <div className="doc-viewer-state">
      <AlertCircle size={36} style={{ color: 'rgba(255,255,255,0.4)' }} />
      <p className="doc-viewer-state-text">Couldn't preview this {label}.</p>
      <p className="doc-viewer-state-sub">Try downloading it instead.</p>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  attachments: AttachmentInfo[];
  initialIndex: number;
  onClose: () => void;
}

function Lightbox({ attachments, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const current = attachments[index];
  const type = current.type ?? detectAttachmentType(current.url);
  const name = current.name ?? getFileName(current.url);

  const prev = useCallback(() => { setIndex(i => Math.max(0, i - 1)); setZoom(1); setRotation(0); setProgress(0); setDuration(0); setPlaying(false); }, []);
  const next = useCallback(() => { setIndex(i => Math.min(attachments.length - 1, i + 1)); setZoom(1); setRotation(0); setProgress(0); setDuration(0); setPlaying(false); }, [attachments.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(4, z + 0.25));
      if (e.key === '-') setZoom(z => Math.max(0.25, z - 0.25));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, prev, next]);

  const handleTimeUpdate = () => {
    const el = videoRef.current ?? audioRef.current;
    if (el) { setProgress(el.currentTime); setDuration(el.duration || 0); }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current ?? audioRef.current;
    const t = parseFloat(e.target.value);
    if (el) { el.currentTime = t; setProgress(t); }
  };

  const togglePlay = () => {
    const el = videoRef.current ?? audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); }
    else { el.pause(); setPlaying(false); }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  // Viewer types that get their own toolbar controls
  const isViewable = ['docx', 'xlsx', 'csv', 'text', 'code'].includes(type);

  return (
    <div className="lb-overlay animate-fade-in" onClick={onClose}>

      {/* ── Top Bar ── */}
      <div className="lb-topbar" onClick={e => e.stopPropagation()}>
        <div className="lb-file-info">
          <FileTypeIcon type={type} size={16} />
          <span className="lb-file-name">{name}</span>
          <span className="lb-file-badge">{humanType(type)}</span>
          {current.size && <span className="lb-file-size">{formatBytes(current.size)}</span>}
          {attachments.length > 1 && (
            <span className="lb-counter">{index + 1} / {attachments.length}</span>
          )}
        </div>
        <div className="lb-actions">
          {type === 'image' && (
            <>
              <button className="lb-btn" onClick={() => setZoom(z => Math.min(4, z + 0.25))} title="Zoom in"><ZoomIn size={15} /></button>
              <button className="lb-btn" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} title="Zoom out"><ZoomOut size={15} /></button>
              <button className="lb-btn" onClick={() => setRotation(r => (r + 90) % 360)} title="Rotate"><RotateCw size={15} /></button>
            </>
          )}
          {isViewable && (
            <span className="lb-preview-badge"><Eye size={12} /> Live Preview</span>
          )}
          <a className="lb-btn" href={current.url} download={name} title="Download" onClick={e => e.stopPropagation()}>
            <Download size={15} />
          </a>
          <button className="lb-btn lb-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="lb-body" onClick={e => e.stopPropagation()}>

        {/* Nav arrows */}
        {attachments.length > 1 && index > 0 && (
          <button className="lb-nav lb-nav-prev" onClick={prev}><ChevronLeft size={24} /></button>
        )}
        {attachments.length > 1 && index < attachments.length - 1 && (
          <button className="lb-nav lb-nav-next" onClick={next}><ChevronRight size={24} /></button>
        )}

        {/* ── IMAGE ── */}
        {type === 'image' && (
          <div className="lb-img-container">
            <img src={current.url} alt={name} className="lb-img"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, cursor: zoom > 1 ? 'grab' : 'default' }}
              draggable={false} />
          </div>
        )}

        {/* ── VIDEO ── */}
        {type === 'video' && (
          <div className="lb-video-container">
            <video ref={videoRef} src={current.url} className="lb-video" muted={muted}
              onTimeUpdate={handleTimeUpdate} onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} playsInline />
            <div className="lb-media-controls">
              <button className="lb-ctrl-btn" onClick={togglePlay}>
                {playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
              </button>
              <span className="lb-time">{fmt(progress)}</span>
              <input type="range" min={0} max={duration || 100} step={0.1}
                value={progress} onChange={handleSeek} className="lb-seek" />
              <span className="lb-time">{fmt(duration)}</span>
              <button className="lb-ctrl-btn" onClick={() => setMuted(m => !m)}>
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <a className="lb-ctrl-btn" href={current.url} download={name} title="Download"><Maximize2 size={16} /></a>
            </div>
          </div>
        )}

        {/* ── AUDIO ── */}
        {type === 'audio' && (
          <div className="lb-audio-container">
            <div className="lb-audio-art"><Music size={64} color="var(--color-primary)" /></div>
            <p className="lb-audio-name">{name}</p>
            <audio ref={audioRef} src={current.url}
              onTimeUpdate={handleTimeUpdate} onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
            <div className="lb-media-controls lb-audio-controls">
              <button className="lb-ctrl-btn" onClick={() => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - 10); }}><SkipBack size={20} /></button>
              <button className="lb-ctrl-btn lb-play-btn" onClick={togglePlay}>
                {playing ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
              </button>
              <button className="lb-ctrl-btn" onClick={() => { const a = audioRef.current; if (a) a.currentTime = Math.min(duration, a.currentTime + 10); }}><SkipForward size={20} /></button>
              <span className="lb-time">{fmt(progress)}</span>
              <input type="range" min={0} max={duration || 100} step={0.1}
                value={progress} onChange={handleSeek} className="lb-seek" />
              <span className="lb-time">{fmt(duration)}</span>
            </div>
          </div>
        )}

        {/* ── PDF (iframe) ── */}
        {type === 'pdf' && (
          <div className="lb-pdf-container">
            <iframe src={current.url} className="lb-pdf-frame" title={name} />
          </div>
        )}

        {/* ── DOCX (mammoth → rich HTML) ── */}
        {type === 'docx' && <DocxViewer url={current.url} />}

        {/* ── XLSX / XLS ── */}
        {type === 'xlsx' && <SpreadsheetViewer url={current.url} />}

        {/* ── CSV ── */}
        {type === 'csv' && <SpreadsheetViewer url={current.url} isCSV />}

        {/* ── TXT ── */}
        {type === 'text' && <TextViewer url={current.url} />}

        {/* ── CODE / MD ── */}
        {type === 'code' && <TextViewer url={current.url} isCode />}

        {/* ── ZIP / Other: icon + download ── */}
        {(type === 'zip' || type === 'other') && (
          <div className="lb-generic-container">
            <div className="lb-generic-icon"><FileTypeIcon type={type} size={72} /></div>
            <p className="lb-generic-name">{name}</p>
            {current.size && <p className="lb-generic-size">{formatBytes(current.size)}</p>}
            <a href={current.url} download={name} className="lb-download-btn">
              <Download size={18} /> Download File
            </a>
          </div>
        )}
      </div>

      {/* ── Thumbnail Strip ── */}
      {attachments.length > 1 && (
        <div className="lb-strip" onClick={e => e.stopPropagation()}>
          {attachments.map((att, i) => {
            const t = att.type ?? detectAttachmentType(att.url);
            return (
              <button key={i}
                className={`lb-thumb ${i === index ? 'lb-thumb-active' : ''}`}
                onClick={() => { setIndex(i); setZoom(1); setRotation(0); }}>
                {t === 'image'
                  ? <img src={att.url} alt="" className="lb-thumb-img" />
                  : <div className="lb-thumb-icon"><FileTypeIcon type={t} size={18} /></div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Inline Attachment Bubble ─────────────────────────────────────────────────

interface AttachmentBubbleProps {
  url: string;
  isSent: boolean;
  onPreview?: (url: string) => void;
}

export function AttachmentBubble({ url, isSent, onPreview }: AttachmentBubbleProps) {
  const type = detectAttachmentType(url);
  const name = getFileName(url);

  const handleClick = (e: React.MouseEvent) => { e.stopPropagation(); onPreview?.(url); };

  if (type === 'image') {
    return (
      <div className="att-img-wrap" onClick={handleClick} title="Click to preview">
        <img src={url} alt={name} className="att-img" />
        <div className="att-img-overlay"><ZoomIn size={20} color="#fff" /></div>
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="att-video-wrap" onClick={handleClick} title="Click to preview">
        <video src={url} className="att-video-thumb" muted playsInline preload="metadata" />
        <div className="att-play-overlay">
          <div className="att-play-btn"><Play size={22} fill="#fff" color="#fff" /></div>
        </div>
      </div>
    );
  }

  // All pill types
  type PillConfig = { icon: React.ReactNode; iconClass: string; sub: string; action: React.ReactNode };
  const pillMap: Partial<Record<AttachmentType, PillConfig>> = {
    audio: { icon: <Music size={14} />, iconClass: 'att-audio-icon', sub: 'Audio file', action: <Play size={14} fill="currentColor" /> },
    pdf:   { icon: <FileText size={14} />, iconClass: 'att-pdf-icon', sub: 'PDF Document', action: <Eye size={14} /> },
    docx:  { icon: <FileText size={14} />, iconClass: 'att-docx-icon', sub: 'Word Document', action: <Eye size={14} /> },
    xlsx:  { icon: <FileSpreadsheet size={14} />, iconClass: 'att-xlsx-icon', sub: 'Spreadsheet', action: <Eye size={14} /> },
    csv:   { icon: <FileSpreadsheet size={14} />, iconClass: 'att-csv-icon', sub: 'CSV Spreadsheet', action: <Eye size={14} /> },
    text:  { icon: <FileText size={14} />, iconClass: 'att-text-icon', sub: 'Text File', action: <Eye size={14} /> },
    code:  { icon: <FileCode size={14} />, iconClass: 'att-code-icon', sub: 'Source Code', action: <Eye size={14} /> },
    zip:   { icon: <FileArchive size={14} />, iconClass: 'att-zip-icon', sub: 'Archive', action: <Download size={14} /> },
    other: { icon: <File size={14} />, iconClass: 'att-generic-icon', sub: 'File', action: <Download size={14} /> },
  };

  const cfg = pillMap[type] ?? pillMap.other!;
  return (
    <div className={`att-pill att-${type}-pill ${isSent ? 'att-pill-sent' : 'att-pill-recv'}`} onClick={handleClick} title="Click to preview">
      <div className={`att-pill-icon ${cfg.iconClass}`}>{cfg.icon}</div>
      <div className="att-pill-info">
        <span className="att-pill-name">{name}</span>
        <span className="att-pill-sub">{cfg.sub}</span>
      </div>
      <div className="att-pill-arrow">{cfg.action}</div>
    </div>
  );
}

// ─── Compose Attachment Preview Chip ──────────────────────────────────────────

interface ComposeAttachmentProps {
  url: string;
  fileName?: string;
  onRemove: () => void;
}

export function ComposeAttachment({ url, fileName, onRemove }: ComposeAttachmentProps) {
  const type = detectAttachmentType(url);
  const name = fileName ?? getFileName(url);

  return (
    <div className="compose-att animate-slide-up">
      {type === 'image' ? (
        <div className="compose-att-img-wrap">
          <img src={url} alt={name} className="compose-att-img" />
          <button className="compose-att-remove" onClick={onRemove}><X size={10} /></button>
        </div>
      ) : (
        <div className="compose-att-pill">
          <div className="compose-att-icon"><FileTypeIcon type={type} size={16} /></div>
          <span className="compose-att-name">{name}</span>
          <button className="compose-att-remove compose-att-remove-inline" onClick={onRemove}><X size={10} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Attachment Preview Context / Provider ────────────────────────────────────

interface AttachmentPreviewContextValue {
  openPreview: (attachments: AttachmentInfo[], index?: number) => void;
}

export const AttachmentPreviewContext = React.createContext<AttachmentPreviewContextValue>({
  openPreview: () => {},
});

export function AttachmentPreviewProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<AttachmentInfo[] | null>(null);
  const [startIndex, setStartIndex] = useState(0);

  const openPreview = useCallback((attachments: AttachmentInfo[], index = 0) => {
    setItems(attachments); setStartIndex(index);
  }, []);

  const closePreview = useCallback(() => setItems(null), []);

  useEffect(() => {
    if (items) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [items]);

  return (
    <AttachmentPreviewContext.Provider value={{ openPreview }}>
      {children}
      {items && <Lightbox attachments={items} initialIndex={startIndex} onClose={closePreview} />}
    </AttachmentPreviewContext.Provider>
  );
}

export function useAttachmentPreview() {
  return React.useContext(AttachmentPreviewContext);
}
