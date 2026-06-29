import { useEffect, useState } from 'react';

export interface ShortcutHandlers {
  onToggleAi: () => void;
  onSend: () => void;
  onClose: () => void;
  onToggleShortcutsGuide: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers) {
  // Read initial state from localStorage, default to true
  const [shortcutsEnabled, setShortcutsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('shortcutsEnabled');
    if (saved !== null) {
      return saved === 'true';
    }
    return true; // default
  });

  const toggleShortcuts = (enabled: boolean) => {
    setShortcutsEnabled(enabled);
    localStorage.setItem('shortcutsEnabled', String(enabled));
  };

  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in a textarea or input, mostly we want shortcuts to still work but be careful
      // Cmd/Ctrl + K (Toggle AI)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlers.onToggleAi();
      }
      
      // Cmd/Ctrl + Enter (Send)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // e.preventDefault(); // Sometimes we want the default behavior if not intercepted
        handlers.onSend();
      }

      // Esc (Close modals/sidebars)
      if (e.key === 'Escape') {
        handlers.onClose();
      }

      // Cmd/Ctrl + / (Toggle Guide)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        handlers.onToggleShortcutsGuide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutsEnabled, handlers]);

  return { shortcutsEnabled, toggleShortcuts };
}
