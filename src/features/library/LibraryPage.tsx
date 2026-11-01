import { useEffect, useState } from 'react';
import { Button, EmptyState } from '../../components/ui';
import { createProject, listDecks, listProjects } from '../../persistence/repositories';
import { deckCardCount } from '../../domain/deck-operations';
import { Project } from '../../domain/models';
import { createDemoProject } from './demo';

export function LibraryPage({ navigate }: { navigate: (hash: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [deckCounts, setDeckCounts] = useState<Record<string, number>>({});

  async function refresh() {
    const projects = await listProjects();
    setProjects(projects);
    const counts: Record<string, number> = {};
    for (const project of projects) {
      const decks = await listDecks(project.id);
      counts[project.id] = decks.reduce((sum, d) => sum + deckCardCount(d), 0);
    }
    setDeckCounts(counts);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate() {
    const name = window.prompt('New project name');
    if (!name) return;
    await createProject(name);
    await refresh();
  }

  async function handleDemo() {
    await createDemoProject();
    await refresh();
  }

  return (
    <section className="library">
      <div className="library-header">
        <h1>Library</h1>
        <div className="library-actions">
          <Button label="Create project" onClick={handleCreate} />
          <Button label="Start with demo deck" variant="secondary" onClick={handleDemo} />
        </div>
      </div>
      <p className="privacy-note">Your game files stay on this device unless you export them.</p>

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
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
