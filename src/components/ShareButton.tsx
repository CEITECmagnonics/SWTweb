import { useState } from 'react';
import { buildShareUrl, type ShareScope } from '../share/urlState';
import { useStore } from '../state/store';
import { Button } from './ui';

export function ShareButton({
  scope,
  className,
}: {
  scope: ShareScope;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const copyLink = async () => {
    const url = buildShareUrl(useStore.getState(), scope);
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied');
    } catch {
      window.prompt('Copy this share URL:', url);
      flash('Link ready');
    }
  };

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <Button
        onClick={() => void copyLink()}
        title={
          scope === 'app'
            ? 'Copy a link that restores every page setup'
            : 'Copy a link that restores this page setup'
        }
      >
        {scope === 'app' ? 'Share session' : 'Share link'}
      </Button>
      {message && <span className="text-xs text-emerald-600 dark:text-emerald-400">{message}</span>}
    </span>
  );
}
