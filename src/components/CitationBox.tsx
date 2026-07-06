import { useState } from 'react';
import { SWT_CITATION, SWT_CITATION_BIBTEX, SWT_CITATION_TEXT } from '../models/citation';
import { Button, Section } from './ui';

/** "How to cite" panel: formatted reference + one-click BibTeX copy. */
export function CitationBox() {
  const [copied, setCopied] = useState(false);

  const copyBibtex = async () => {
    try {
      await navigator.clipboard.writeText(SWT_CITATION_BIBTEX);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Section title="How to cite" defaultOpen={false}>
      <p className="mb-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        If you use results from this tool in your work, please cite the SpinWaveToolkit paper:
      </p>
      <p className="mb-2 rounded-md bg-slate-100 px-2 py-1.5 text-xs leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {SWT_CITATION_TEXT}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={SWT_CITATION.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          DOI: {SWT_CITATION.doi}
        </a>
        <Button onClick={copyBibtex} className="!px-2 !py-1 text-xs">
          {copied ? 'Copied ✓' : 'Copy BibTeX'}
        </Button>
      </div>
    </Section>
  );
}
