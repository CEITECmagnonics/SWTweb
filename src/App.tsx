import { useEffect } from 'react';
import { SWT_CITATION } from './models/citation';
import { EngineStatusBanner } from './components/LoadingOverlay';
import { PlotCustomization } from './components/PlotCustomization';
import { PlotPanel } from './components/PlotPanel';
import { Sidebar } from './components/Sidebar';
import { TraceList } from './components/TraceList';
import { useStore } from './state/store';

function Header() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const swtVersion = useStore((s) => s.swtVersion);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          SpinWave<span className="text-blue-600 dark:text-blue-400">Toolkit</span>{' '}
          <span className="font-normal text-slate-400">Web</span>
        </h1>
        {swtVersion && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            SWT v{swtVersion} · in-browser
          </span>
        )}
      </div>
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

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
