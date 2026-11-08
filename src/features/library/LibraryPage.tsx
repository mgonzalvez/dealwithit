import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';
import { QuickStart } from '../onboarding/QuickStart';
import { DECK_ICONS, DeckIconGlyph } from '../decks/deckIcons';
import {
  createProject,
  deleteDeck,
  deleteProject,
  estimateStorage,
  listCardDefinitions,
  listDecks,
  listProjects,
  loadProjectData,
  saveDeck,
  saveProjectData,
  touchProject
} from '../../persistence/repositories';
import { deckCardCount, duplicateDeck } from '../../domain/deck-operations';
import { DeckDefinition, Project } from '../../domain/models';
import { buildProjectZip, exportFilename, readProjectZip } from '../export/export';
import { createDemoProject } from './demo';
import { createStandardDeckProject, refreshStandardDeckArt } from './standardDeck';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export function LibraryPage({ navigate, startTour }: { navigate: (hash: string) => void; startTour: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDecks, setProjectDecks] = useState<Record<string, DeckDefinition[]>>({});
  const [deckNameEdits, setDeckNameEdits] = useState<Record<string, string>>({});
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    const items = await listProjects();
    setProjects(items);
    const decks: Record<string, DeckDefinition[]> = {};
    for (const project of items) {
      decks[project.id] = await listDecks(project.id);
    }
    setProjectDecks(decks);
    setStorage(await estimateStorage());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate() {
    const name = window.prompt('New project name');
    if (!name) return;
    await createProject(name);
    await refresh();
    setMessage(`Created "${name}". Next step: import your card images in the Workshop.`);
  }

  async function handleDemo() {
    const existingDemo = (await listProjects()).find((project) => project.name === 'Demo Deck');
    if (existingDemo) {
      const cards = await listCardDefinitions(existingDemo.id);
      const isCurrentDemo = cards.some((card) => card.name === 'Dice');
      if (isCurrentDemo) {
        await refresh();
        setMessage('The demo deck already exists — open it from the library below.');
        return existingDemo.id;
      }
      // Older plain-text demo: replace it with the icon-art version.
      await deleteProject(existingDemo.id);
    }
    const projectId = await createDemoProject();
    await refresh();
    setMessage('Demo deck created with 18 sample cards — open the Table to try shuffling and dealing.');
    return projectId;
  }

  async function handleStandardDeck() {
    const existing = (await listProjects()).find((project) => project.name === 'Standard 52-card deck');
    if (existing) {
      // The artwork is generated, so an older deck can be redrawn in place
      // instead of asking people to start over.
      const refreshed = await refreshStandardDeckArt(existing.id);
      await refresh();
      setMessage(
        refreshed
          ? 'Standard deck redrawn with the new card art — open it from the library below.'
          : 'The standard deck already exists — open it from the library below.'
      );
      return existing.id;
    }
    const projectId = await createStandardDeckProject();
    await refresh();
    setMessage('A full 52-card deck is ready. Open the Table, press Launch, then shuffle and deal.');
    return projectId;
  }

  async function handleDeleteProject(project: Project) {
    if (
      !window.confirm(
        `Delete "${project.name}" and all of its images, cards, decks and tables? This cannot be undone.`
      )
    ) {
      return;
    }
    await deleteProject(project.id);
    await refresh();
    setMessage(`Deleted "${project.name}".`);
  }

  async function renameDeck(deck: DeckDefinition, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === deck.name) return;
    await saveDeck({ ...deck, name: trimmed, updatedAt: Date.now() });
    await touchProject(deck.projectId);
    await refresh();
    setMessage(`Renamed deck to "${trimmed}".`);
  }

  async function setDeckIcon(deck: DeckDefinition, icon: string) {
    await saveDeck({ ...deck, icon: icon || undefined, updatedAt: Date.now() });
    await touchProject(deck.projectId);
    await refresh();
  }

  async function duplicateDeckAction(deck: DeckDefinition) {
    const copy = duplicateDeck(deck, deck.projectId);
    await saveDeck(copy);
    await touchProject(deck.projectId);
    await refresh();
    setMessage(`Duplicated deck "${deck.name}".`);
  }

  async function deleteDeckAction(deck: DeckDefinition) {
    if (!window.confirm(`Delete deck "${deck.name}" (${deckCardCount(deck)} cards)? Tables keep cards already on them.`)) {
      return;
    }
    await deleteDeck(deck.id);
    await touchProject(deck.projectId);
    await refresh();
    setMessage(`Deleted deck "${deck.name}".`);
  }

  async function handleExport(project: Project) {
    try {
      const data = await loadProjectData(project.id);
      if (!data) return;
      const buffer = await buildProjectZip(data);
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exportFilename(project.name);
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported "${project.name}" as ${exportFilename(project.name)}.`);
    } catch (error) {
      setMessage(`Export failed: ${(error as Error).message}`);
    }
  }

  async function handleImport(file: File) {
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const result = await readProjectZip(buffer.buffer as ArrayBuffer);
      if (!result.data) {
        setMessage(result.errors.join(' '));
        return;
      }
      await saveProjectData(result.data);
      await refresh();
      setMessage(
        `Imported "${result.data.project.name}" (${result.data.assets.length} images, ${result.data.decks.length} decks).` +
          (result.info.length ? ` Notes: ${result.info.join(' ')}` : '')
      );
    } catch (error) {
      setMessage(`Import failed: ${(error as Error).message}`);
    }
  }

  const firstProjectId = projects[0]?.id ?? null;

  return (
    <section className="library">
      <div className="library-header">
        <h1>Library</h1>
        <div className="library-actions">
          <Button label="Create project" onClick={handleCreate} />
          <Button label="Tour" variant="secondary" onClick={startTour} />
          <Button label="Start with demo deck" variant="secondary" onClick={handleDemo} />
          <Button label="Play a standard 52-card deck" variant="secondary" onClick={() => void handleStandardDeck()} />
          <Button label="Import project" variant="secondary" onClick={() => importInputRef.current?.click()} />
          <input
            ref={importInputRef}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            aria-label="Choose a project archive to import"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <p className="privacy-note">
        Your game files stay on this device unless you export them.
        {storage && storage.quota > 0 && (
          <> Browser storage in use: {formatBytes(storage.usage)} of about {formatBytes(storage.quota)}.</>
        )}
      </p>
      {message && <p className="committed" aria-live="polite">{message}</p>}

      {projects.length === 0 ? (
        <QuickStart
          onCreateProject={handleCreate}
          onDemo={() => void handleDemo()}
          onStandardDeck={() => void handleStandardDeck()}
          navigate={navigate}
          firstProjectId={null}
        />
      ) : (
        <>
          <div className="handoff" role="note">
            <p>
              Finished here? Your workflow is: <strong>Workshop</strong> (import images, pair
              fronts &amp; backs, build decks) → <strong>Table</strong> (shuffle, deal, play).
            </p>
            {firstProjectId && (
              <Button label="Go to the Workshop" onClick={() => navigate(`#/workshop/${firstProjectId}`)} />
            )}
          </div>

          <div className="project-grid">
            {projects.map((project) => {
              const decks = projectDecks[project.id] ?? [];
              return (
                <article key={project.id} className="project-card">
                  <div className="project-cover" aria-hidden="true">
                    <svg viewBox="0 0 64 64" width="64" height="64">
                      <rect x="8" y="12" width="40" height="40" rx="6" fill="#d8d2c4" transform="rotate(-8 28 32)" />
                      <rect x="16" y="16" width="40" height="40" rx="6" fill="#f2ead9" />
                    </svg>
                  </div>
                  <h2>{project.name}</h2>
                  <p>
                    {decks.reduce((sum, d) => sum + deckCardCount(d), 0)} cards · {decks.length}{' '}
                    {decks.length === 1 ? 'deck' : 'decks'} · updated{' '}
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </p>

                  <div className="project-decks">
                    {decks.length === 0 ? (
                      <p className="muted">No decks yet — build one in the Workshop.</p>
                    ) : (
                      <ul className="deck-rows">
                        {decks.map((deck) => (
                          <li key={deck.id} className="deck-row">
                            <select
                              className="deck-icon-select"
                              value={deck.icon ?? ''}
              onChange={(e) => void setDeckIcon(deck, e.target.value)}
                              aria-label={`Icon for deck ${deck.name}`}
                            >
                              <option value="">No icon</option>
                              {DECK_ICONS.map((icon) => (
                                <option key={icon.id} value={icon.id}>
                                  {icon.label}
                                </option>
                              ))}
                            </select>
                            <span className="deck-row-icon">
                              {deck.icon ? (
                                <DeckIconGlyph iconId={deck.icon} />
                              ) : (
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <rect x="4" y="4" width="14" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                                  <rect x="8" y="2" width="12" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                                </svg>
                              )}
                            </span>
                            <input
                              type="text"
                              className="deck-name-input"
                              value={deckNameEdits[deck.id] ?? deck.name}
                              onChange={(e) => setDeckNameEdits((m) => ({ ...m, [deck.id]: e.target.value }))}
                              onBlur={() => {
                                const edited = deckNameEdits[deck.id];
                                if (edited !== undefined) {
                                  void renameDeck(deck, edited);
                                  setDeckNameEdits((m) => {
                                    const next = { ...m };
                                    delete next[deck.id];
                                    return next;
                                  });
                                }
                              }}
                              aria-label={`Rename deck ${deck.name}`}
                            />
                            <span className="muted">{deckCardCount(deck)} cards</span>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => void duplicateDeckAction(deck)}
                              title="Duplicate deck"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => void deleteDeckAction(deck)}
                              title="Delete deck"
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="project-card-actions">
                    <Button label="Edit in Workshop" onClick={() => navigate(`#/workshop/${project.id}`)} />
                    <Button
                      label="Play on Table"
                      variant="secondary"
                      onClick={() => navigate(`#/table/${project.id}`)}
                    />
                    <Button label="Export" variant="secondary" onClick={() => void handleExport(project)} />
                    <Button label="Delete" variant="danger" onClick={() => void handleDeleteProject(project)} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
