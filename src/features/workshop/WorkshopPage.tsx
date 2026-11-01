import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui';
import { listDecks } from '../../persistence/repositories';
import { deckCardCount } from '../../domain/deck-operations';

/**
 * M0 scaffold: the real staging/validation pipeline arrives in M1/M2.
 * Upload Images and Import ZIP are presented as equal primary actions,
 * as required by the build spec.
 */
export function WorkshopPage({ projectId }: { projectId?: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [deckSummary, setDeckSummary] = useState<string>('');

  useEffect(() => {
    void loadDecks();
  }, [projectId]);

  async function loadDecks() {
    if (!projectId) return;
    const decks = await listDecks(projectId);
    setDeckSummary(
      decks.map((d) => `${d.name} (${deckCardCount(d)} cards)`).join(', ') || 'No decks yet.'
    );
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    setStatus(`Selected ${files.length} file(s). Import pipeline lands in M1.`);
  }

  return (
    <section className="workshop">
      <h1>Workshop</h1>
      {deckSummary && <p className="workshop-summary">{deckSummary}</p>}
      {status && <p className="workshop-status">{status}</p>}

      {projectId ? (
        <div className="import-actions">
          <label className="btn btn-primary import-action">
            Upload Images
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
          <label className="btn btn-primary import-action">
            Import ZIP
            <input type="file" accept=".zip" onChange={(e) => onFiles(e.target.files)} />
          </label>
          <a
            className="btn btn-secondary import-action"
            href="https://extractor.gonzhome.us"
            target="_blank"
            rel="noopener noreferrer"
          >
            Use Card Extractor
          </a>
        </div>
      ) : (
        <EmptyState
          title="Choose a project first"
          message="Open a project from the Library to import cards and build decks."
        />
      )}
    </section>
  );
}
