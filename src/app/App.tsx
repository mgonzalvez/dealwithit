import { useEffect, useState } from 'react';
import { LibraryPage } from '../features/library/LibraryPage';
import { WorkshopPage } from '../features/workshop/WorkshopPage';
import { TablePage } from '../features/table/TablePage';
import { getSetting, setSetting } from '../persistence/repositories';

const RELATED_TOOLS = [
  { name: 'GonzHome — all tools', url: 'https://gonzhome.us' },
  { name: 'Card Extractor', url: 'https://extractor.gonzhome.us' },
  { name: 'Card Formatter', url: 'https://formatter.gonzhome.us' },
  { name: 'Token Maker', url: 'https://tokenmaker.gonzhome.us' },
  { name: 'Board Splitter', url: 'https://boardsplitter.gonzhome.us' },
  { name: 'Prototyper', url: 'https://prototyper.gonzhome.us' },
  { name: 'Launchpad', url: 'https://launchpad.gonzhome.us' }
];

interface Route {
  area: 'library' | 'workshop' | 'table';
  projectId?: string;
}

function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const area = parts[0] === 'workshop' ? 'workshop' : parts[0] === 'table' ? 'table' : 'library';
  return { area, projectId: parts[1] || undefined };
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const navigate = (hash: string) => {
    window.location.hash = hash;
    setRoute(parseHash(hash));
  };

  window.addEventListener('hashchange', () => setRoute(parseHash(window.location.hash)));

  useEffect(() => {
    void getSetting('theme').then((stored) => {
      const next = stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      setTheme(next);
      applyTheme(next);
    });
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    void setSetting('theme', next);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#/library">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="6" width="10" height="14" rx="2" transform="rotate(-12 9 13)" />
                <rect x="9" y="4" width="10" height="14" rx="2" transform="rotate(6 14 11)" />
                <circle cx="14" cy="11" r="2.2" />
              </svg>
            </span>
            <span className="brand-copy">
              <strong>Deal With It</strong>
              <span>Upload your print-and-play card images, form them into decks, and play your PnP games on a virtual table.</span>
            </span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <button
              type="button"
              className={`nav-link ${route.area === 'library' ? 'active' : ''}`}
              onClick={() => navigate('#/library')}
            >
              Library
            </button>
            <button
              type="button"
              className={`nav-link ${route.area === 'workshop' ? 'active' : ''}`}
              onClick={() => navigate(route.projectId ? `#/workshop/${route.projectId}` : '#/workshop')}
            >
              Workshop
            </button>
            <button
              type="button"
              className={`nav-link ${route.area === 'table' ? 'active' : ''}`}
              onClick={() => navigate(route.projectId ? `#/table/${route.projectId}` : '#/table')}
            >
              Table
            </button>
          </nav>
          <div className="header-actions">
            <details className="tools-menu">
              <summary className="tools-trigger">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M8 9h8M8 13h5" />
                </svg>
                More tools
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="tools-panel">
                {RELATED_TOOLS.map((tool) => (
                  <a key={tool.url} href={tool.url} target="_blank" rel="noopener noreferrer">
                    {tool.name}
                  </a>
                ))}
              </div>
            </details>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`}
              title="Switch appearance"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {theme === 'dark' ? (
                  <circle cx="12" cy="12" r="7" />
                ) : (
                  <path d="M20 14a8 8 0 1 1-8-8 6 6 0 0 0 8 8z" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>
      <main>
        {route.area === 'library' && <LibraryPage navigate={navigate} />}
        {route.area === 'workshop' && <WorkshopPage projectId={route.projectId} navigate={navigate} />}
        {route.area === 'table' && <TablePage projectId={route.projectId} navigate={navigate} />}
      </main>
      <footer className="footer">
        <p>
          Deal With It — The Print-and-Play Card Sandbox ·{' '}
          <a href="https://gonzhome.us" target="_blank" rel="noopener noreferrer">
            GonzHome tools
          </a>
        </p>
      </footer>
    </div>
  );
}
