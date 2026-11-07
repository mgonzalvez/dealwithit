import { Button } from '../../components/ui';

interface QuickStartProps {
  onCreateProject: () => void;
  onDemo: () => void;
  onStandardDeck: () => void;
  navigate: (hash: string) => void;
  firstProjectId: string | null;
}

export function QuickStart({
  onCreateProject,
  onDemo,
  onStandardDeck,
  navigate,
  firstProjectId
}: QuickStartProps) {
  const workshopLink = firstProjectId ? `#/workshop/${firstProjectId}` : null;

  return (
    <section className="quickstart" aria-label="Quick start guide">
      <h2>Quick start</h2>
      <ol className="quickstart-steps">
        <li className="quickstart-step">
          <span className="step-num">1</span>
          <div>
            <strong>Nothing to upload? Play a standard deck</strong>
            <p>
              Deal With It can build a real 52-card deck (four suits, A to K) on the spot, with a
              classic back. Shuffle, deal, flip and cut it on the felt immediately.
            </p>
          </div>
          <div className="quickstart-actions">
            <Button label="Play a standard deck" onClick={onStandardDeck} />
          </div>
        </li>
        <li className="quickstart-step">
          <span className="step-num">2</span>
          <div>
            <strong>Create a project</strong>
            <p>
              A project keeps your images, cards, decks and tables together. Start blank, or try
              the built-in demo.
            </p>
          </div>
          <div className="quickstart-actions">
            <Button label="New project" variant="secondary" onClick={onCreateProject} />
            <Button label="Try the demo" variant="secondary" onClick={onDemo} />
          </div>
        </li>
        <li className="quickstart-step">
          <span className="step-num">3</span>
          <div>
            <strong>Import your card images</strong>
            <p>
              Upload photos, PNGs/JPGs, or a ZIP — ZIPs from Card Extractor pair fronts and backs
              automatically.
            </p>
          </div>
          <div className="quickstart-actions">
            {workshopLink && <Button label="Open the Workshop" onClick={() => navigate(workshopLink)} />}
          </div>
        </li>
        <li className="quickstart-step">
          <span className="step-num">4</span>
          <div>
            <strong>Build decks, then play</strong>
            <p>
              Turn images into cards, pair each front with a back — upload one or generate a
              pattern with the game name on it — assemble decks, and deal them on the felt.
            </p>
          </div>
          <div className="quickstart-actions">
            {firstProjectId && <Button label="Open the Table" variant="secondary" onClick={() => navigate(`#/table/${firstProjectId}`)} />}
          </div>
        </li>
      </ol>
      <p className="attribution">
        Deck icons: <a href="https://fractalsymbols.com" target="_blank" rel="noopener noreferrer">Fractal Symbols</a>
        by Felix Thalin (CC BY 4.0), reused from GonzHome tools.
      </p>
    </section>
  );
}
