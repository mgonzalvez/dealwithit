import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState } from '../../components/ui';
import { Tour } from '../onboarding/Tour';
import {
  createProject,
  estimateStorage,
  getSetting,
  listDecks,
  listProjects,
  loadProjectData,
  saveProjectData,
  setSetting
} from '../../persistence/repositories';
import { deckCardCount } from '../../domain/deck-operations';
import { Project } from '../../domain/models';
import { buildProjectZip, exportFilename, readProjectZip } from '../export/export';
import { createDemoProject } from './demo';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export function LibraryPage({ navigate }: { navigate: (hash: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [deckCounts, setDeckCounts] = useState<Record<string, number>>({});
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    const projects = await listProjects();
    setProjects(projects);
    const counts: Record<string, number> = {};
    for (const project of projects) {
      const decks = await listDecks(project.id);
      counts[project.id] = decks.reduce((sum, d) => sum + deckCardCount(d), 0);
    }
    setDeckCounts(counts);
    setStorage(await estimateStorage());
  }

  useEffect(() => {
    void refresh();
    void getSetting('tour-seen').then((seen) => {
      if (!seen) setShowTutorial(true);
    });
  }, []);

  function dismissTutorial() {
    setShowTutorial(false);
    void setSetting('tour-seen', true);
  }

  function reopenTour() {
    setShowTutorial(true);
  }

  async function handleCreate() {
    const name = window.prompt('New project name');
    if (!name) return;
    await createProject(name);
    await refresh();
  }

  async function handleDemo() {
    const projectId = await createDemoProject();
    await refresh();
    return projectId;
  }

  async function handleTourDemo() {
    setShowTutorial(false);
    void setSetting('tutorial-seen', true);
    const projectId = await handleDemo();
    navigate(`#/table/${projectId}`);
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

  return (
    <section className="library">
      <div className="library-header">
        <h1>Library</h1>
        <div className="library-actions">
          <Button label="Create project" onClick={handleCreate} />
          <Button label="Tour" variant="secondary" onClick={reopenTour} />
          <Button label="Start with demo deck" variant="secondary" onClick={handleDemo} />
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

      {showTutorial && (
        <Tour onFinish={dismissTutorial} onDemo={() => void handleTourDemo()} />
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="No games yet"
          message="Upload card images or import a ZIP to start your first project."
          actions={<Button label="Start with demo deck" onClick={handleDemo} />}
        />
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <article key={project.id} className="project-card">
              <div className="project-cover" aria-hidden="true">
                <svg viewBox="0 0 64 64" width="64" height="64">
                  <rect x="8" y="12" width="40" height="40" rx="6" fill="#d8d2c4" transform="rotate(-8 28 32)" />
                  <rect x="16" y="16" width="40" height="40" rx="6" fill="#f2ead9" />
                </svg>
              </div>
              <h2>{project.name}</h2>
              <p>
                {deckCounts[project.id] ?? 0} cards · updated{' '}
                {new Date(project.updatedAt).toLocaleDateString()}
              </p>
              <div className="project-card-actions">
                <Button
                  label="Edit in Workshop"
                  onClick={() => navigate(`#/workshop/${project.id}`)}
                />
                <Button
                  label="Play on Table"
                  variant="secondary"
                  onClick={() => navigate(`#/table/${project.id}`)}
                />
                <Button
                  label="Export"
                  variant="secondary"
                  onClick={() => void handleExport(project)}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
