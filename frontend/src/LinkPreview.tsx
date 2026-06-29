import React from 'react';
import DOMPurify from 'dompurify';

// ─── URL Extraction ───────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;

export function extractUrls(text: string): string[] {
  return [...new Set([...text.matchAll(URL_REGEX)].map(m => m[0]))];
}

export function renderTextWithLinks(text: string): React.ReactNode {
  // If the text seems to contain HTML tags, sanitize and render it directly.
  if (/<[a-z][\s\S]*>/i.test(text)) {
    const cleanHtml = DOMPurify.sanitize(text, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form']
    });
    return <div className="apple-mail-content" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  }

  // Otherwise, fallback to plain text parsing with Markdown-like formatting and links
  const lines = text.split('\n');
  
  return (
    <div className="apple-mail-content">
      {lines.map((line, i) => {
        // Simple Markdown parsing for each line
        // We'll replace bold, italic, underline, and links
        const parseFormatting = (str: string) => {
          // URLs
          const parts: React.ReactNode[] = [];
          let last = 0;
          const matches = [...str.matchAll(URL_REGEX)];
        
          for (const match of matches) {
            const start = match.index!;
            const end = start + match[0].length;
            if (start > last) parts.push(parseMarkdown(str.slice(last, start)));
            parts.push(
              <a
                key={start}
                href={match[0]}
                target="_blank"
                rel="noreferrer"
                className="msg-link"
                onClick={e => e.stopPropagation()}
              >
                {match[0]}
              </a>
            );
            last = end;
          }
          if (last < str.length) parts.push(parseMarkdown(str.slice(last)));
          return parts;
        };

        const parseMarkdown = (s: string) => {
          let html = s
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/__(.*?)__/g, '<u>$1</u>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>');
          return <span dangerouslySetInnerHTML={{ __html: html }} />;
        };

        return (
          <React.Fragment key={i}>
            {parseFormatting(line)}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function LinkPreviews() {
  return null;
}

