'use client';

import * as React from 'react';

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.02 4.13H5.06l12.02 15.64Z" />
    </svg>
  );
}

function RedditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22 11.8a2.2 2.2 0 0 0-3.73-1.57 10.9 10.9 0 0 0-5.63-1.77l.96-4.5 3.13.66a1.86 1.86 0 1 0 .2-1.24l-3.72-.79a.62.62 0 0 0-.74.48l-1.1 5.17a10.9 10.9 0 0 0-5.7 1.77 2.2 2.2 0 1 0-2.4 3.6 4.3 4.3 0 0 0-.05.67c0 3.42 3.98 6.2 8.9 6.2 4.9 0 8.89-2.78 8.89-6.2 0-.22-.02-.44-.05-.66A2.2 2.2 0 0 0 22 11.8ZM7.1 13.4a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0Zm8.9 4.2c-1.1 1.1-3.2 1.18-3.81 1.18-.61 0-2.72-.08-3.81-1.18a.42.42 0 0 1 .59-.59c.69.69 2.17.94 3.22.94 1.06 0 2.53-.25 3.23-.94a.42.42 0 0 1 .59.59Zm-.29-2.6a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.24M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (insecure context, or the user said no). Fall back to
      // selecting the text so they can still copy it by hand.
      window.prompt('Copy this link', url);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [url]);

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const redditHref = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      <a href={xHref} target="_blank" rel="noreferrer" className="btn btn-secondary">
        <XIcon /> Share on X
      </a>
      <a href={redditHref} target="_blank" rel="noreferrer" className="btn btn-secondary">
        <RedditIcon /> Post to Reddit
      </a>
      <button type="button" onClick={copy} className="btn btn-secondary" aria-live="polite">
        <LinkIcon /> {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
