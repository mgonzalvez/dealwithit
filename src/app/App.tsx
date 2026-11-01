import { useState } from 'react';
import { LibraryPage } from '../features/library/LibraryPage';
import { WorkshopPage } from '../features/workshop/WorkshopPage';
import { TablePage } from '../features/table/TablePage';

interface Route {
  area: 'library' | 'workshop' | 'table';
  projectId?: string;
}

function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const area = parts[0] === 'workshop' ? 'workshop' : parts[0] === 'table' ? 'table' : 'library';
  return { area, projectId: parts[1] || undefined };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  const navigate = (hash: string) => {
    window.location.hash = hash;
    setRoute(parseHash(hash));
  };

  window.addEventListener('hashchange', () => setRoute(parseHash(window.location.hash)));

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#/library">
          dealwithit<span>.</span>
        </a>
        <nav aria-label="Main navigation">
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
      </header>
      <main>
        {route.area === 'library' && <LibraryPage navigate={navigate} />}
        {route.area === 'workshop' && <WorkshopPage projectId={route.projectId} />}
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
