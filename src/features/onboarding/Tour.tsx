import { useState } from 'react';

interface TourStep {
  title: string;
  body: string;
  art: 'library' | 'workshop' | 'table' | 'share';
}

const STEPS: TourStep[] = [
  {
    title: 'Your games live on your device',
    body:
      'Deal With It stores everything in your browser — no accounts, no servers, no tracking. Create a project and your artwork, decks and table layouts are instantly available, even offline.',
    art: 'library'
  },
  {
    title: 'Turn any images into decks',
    body:
      'In the Workshop, drop in single images, whole ZIPs (Card Extractor exports included), or hundreds of files at once. Rotate, crop, size, and pair fronts with backs — then shape them into decks with quantities you control.',
    art: 'workshop'
  },
  {
    title: 'Play like a real table',
    body:
      'Launch a deck onto the felt. Drag a stack to draw a card. Hold a stack to grab the whole deck. Right-click anything for quick actions. Scroll or pinch to zoom, and drag the felt to pan. Undo at any time.',
    art: 'table'
  },
  {
    title: 'Backups, sharing and offline play',
    body:
      'Export any project as a self-contained .dealwithit.zip — decks, table state and artwork — and import it on any other device. Install Deal With It from the browser for a full offline app.',
    art: 'share'
  }
];

function Art({ kind }: { kind: TourStep['art'] }) {
  switch (kind) {
    case 'library':
      return (
        <>
          <rect x="10" y="14" width="52" height="36" rx="8" />
          <rect x="70" y="14" width="52" height="36" rx="8" />
          <rect x="130" y="14" width="52" height="36" rx="8" />
          <circle cx="36" cy="32" r="9" />
        </>
      );
    case 'workshop':
      return (
        <>
          <rect x="14" y="20" width="44" height="60" rx="8" />
          <rect x="64" y="20" width="44" height="60" rx="8" />
          <path d="M64 50h44" />
          <path d="M120 30l18 18M138 30l-18 18" />
        </>
      );
    case 'table':
      return (
        <>
          <rect x="10" y="16" width="180" height="68" rx="12" />
          <rect x="24" y="28" width="30" height="42" rx="6" />
          <rect x="30" y="30" width="30" height="42" rx="6" />
          <rect x="80" y="44" width="30" height="42" rx="6" transform="rotate(8 95 65)" />
          <circle cx="140" cy="40" r="10" />
        </>
      );
    case 'share':
      return (
        <>
          <path d="M40 44h92M40 44l20-20M40 44l20 20" />
          <rect x="120" y="26" width="60" height="36" rx="8" />
          <path d="M150 44h18M150 44l-8-8M150 44l-8 8" />
        </>
      );
  }
}

export function Tour({ onFinish, onDemo }: { onFinish: () => void; onDemo: () => void }) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];

  return (
    <div className="dialog-backdrop" role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Deal With It tour" className="tour">
        <div className="tour-head">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="6" width="10" height="14" rx="2" transform="rotate(-12 9 13)" />
              <rect x="9" y="4" width="10" height="14" rx="2" transform="rotate(6 14 11)" />
              <circle cx="14" cy="11" r="2.2" />
            </svg>
          </span>
          <div>
            <h2>Welcome to Deal With It</h2>
            <p className="muted">A 30-second tour · everything stays local</p>
          </div>
        </div>

        <div className="tour-art" aria-hidden="true">
          <svg viewBox="0 0 200 96">
            <g stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <Art kind={current.art} />
            </g>
          </svg>
        </div>

        <h3 className="tour-title">{current.title}</h3>
        <p className="tour-body">{current.body}</p>

        <div className="tour-dots" aria-label={`Step ${step + 1} of ${total}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={`tour-dot ${i === step ? 'on' : ''}`} />
          ))}
        </div>

        <div className="tour-actions">
          {step > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < total - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onDemo}>
              Open the demo table
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onFinish}>
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
