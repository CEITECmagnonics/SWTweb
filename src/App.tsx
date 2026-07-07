import { useEffect } from 'react';
import { SWT_CITATION } from './models/citation';
import { BlsPage } from './components/BlsPage';
import { EngineStatusBanner } from './components/LoadingOverlay';
import { HysteresisPage } from './components/HysteresisPage';
import { PlotCustomization } from './components/PlotCustomization';
import { PlotPanel } from './components/PlotPanel';
import { Sidebar } from './components/Sidebar';
import { SweepPage } from './components/SweepPage';
import { TraceList } from './components/TraceList';
import { pageFromHash, useStore, type PageId } from './state/store';
import swtLogoUrl from './assets/spinwavetoolkit-logo-text.svg';

const PAGES: Array<{ id: PageId; label: string; title: string }> = [
  { id: 'dispersion', label: 'Dispersion', title: 'Spin-wave characteristics vs wavenumber k' },
  {
    id: 'sweep',
    label: 'Parameter sweep',
    title: 'Sweep field, thickness, angles… at fixed k or as a full dispersion map',
  },
  {
    id: 'hysteresis',
    label: 'Hysteresis',
    title: 'Hysteresis loops of a single layer (macrospin) or a SAF double layer',
  },
  {
    id: 'bls',
    label: 'µBLS',
    title: 'Micro-focused Brillouin light scattering: thermal spectra',
  },
];

function PageNav() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  return (
    <nav className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {PAGES.map((p) => (
        <button
          key={p.id}
          type="button"
          title={p.title}
          onClick={() => setPage(p.id)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            page === p.id
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {p.label}
        </button>
      ))}
    </nav>
  );
}

function Header() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const swtVersion = useStore((s) => s.swtVersion);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <a
          href="https://ceitecmagnonics.github.io/SpinWaveToolkit/stable/"
          target="_blank"
          rel="noreferrer noopener"
          className="flex shrink-0 items-center rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 transition hover:ring-slate-300 dark:ring-slate-700 dark:hover:ring-slate-500"
        >
          <img
            src={swtLogoUrl}
            alt="SpinWaveToolkit"
            className="h-8 w-auto max-w-[min(62vw,18rem)]"
          />
        </a>
        <h1 className="sr-only">SpinWaveToolkit Web</h1>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Web
        </span>
        {swtVersion && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            SWT v{swtVersion} · in-browser
          </span>
        )}
      </div>
      <PageNav />
      <div className="flex items-center gap-2">
        <a
          href="https://ceitecmagnonics.github.io/SpinWaveToolkit/stable/"
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Docs
        </a>
        <a
          href="https://github.com/CEITECmagnonics/SpinWaveToolkit"
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          GitHub
        </a>
        <button
          type="button"
          onClick={toggleTheme}
          title="Toggle light/dark theme"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const initEngine = useStore((s) => s.initEngine);
  const theme = useStore((s) => s.theme);
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [setPage]);

  if (page !== 'dispersion') {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <EngineStatusBanner />
        {page === 'sweep' ? <SweepPage /> : page === 'hysteresis' ? <HysteresisPage /> : <BlsPage />}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header />
      <EngineStatusBanner />
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
        <Sidebar />
        <main className="min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
            <PlotPanel />
            <div className="space-y-4">
              <PlotCustomization />
              <TraceList />
            </div>
          </div>
          <footer className="mt-6 space-y-1 pb-2 text-center text-xs text-slate-400 dark:text-slate-500">
            <p>
              All calculations run locally in your browser via{' '}
              <a className="underline" href="https://pyodide.org" target="_blank" rel="noreferrer noopener">
                Pyodide
              </a>{' '}
              — no data leaves your device. Powered by{' '}
              <a
                className="underline"
                href="https://github.com/CEITECmagnonics/SpinWaveToolkit"
                target="_blank"
                rel="noreferrer noopener"
              >
                SpinWaveToolkit
              </a>
              .
            </p>
            <p>
              Please cite:{' '}
              <a
                className="underline"
                href={SWT_CITATION.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {SWT_CITATION.authors.split(',')[0]} et al., {SWT_CITATION.journal}{' '}
                {SWT_CITATION.volume}, {SWT_CITATION.pages} ({SWT_CITATION.year})
              </a>
              .
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
