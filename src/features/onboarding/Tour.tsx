import { Button } from '../../components/ui';

export interface TourStep {
  title: string;
  where: string;
  body: string;
}

/**
 * Workflow-first guided tour. Each step navigates to the real section of the
 * app and shows bite-size instructions for exactly what to do there.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Start in the Library',
    where: 'Library',
    body:
      'Every game is a project. Press New project and give it a name — or, if you have nothing to upload yet, press Play a standard 52-card deck to load a real poker deck (A to K, four suits) already sitting on the felt. Everything else happens inside your project.',
  },
  {
    title: 'Import your card images',
    where: 'Workshop › Import',
    body:
      'Press Upload images or Import ZIP. A ZIP from Card Extractor pairs fronts and backs automatically. In the staging list press Select all valid, then Import N image(s). Later, Select all in the Asset library and press Create cards from selected images.',
  },
  {
    title: 'Pair fronts with backs',
    where: 'Workshop › Cards',
    body:
      'Click any card tile to flip between its front and back. Select cards, then press Choose a back for selected cards. Rotate 90° fixes sideways faces. Edit opens crop, size and rotation controls, and each card has its own Back button.',
  },
  {
    title: 'Choose a card back',
    where: 'Workshop › Decks',
    body:
      'One button does it all: Choose a back. Generate a pattern (style → colour → game name), Use an image you already imported, or No back at all. Generated backs are drawn for you from a seed, so they look identical on every device and add nothing to your export size. Surprise me gives you a random one; Shuffle the pattern keeps the colours and redraws it. Apply to this deck gives every card in it that back — individual cards can still override it.',
  },
  {
    title: 'Assemble a deck',
    where: 'Workshop › Decks',
    body:
      'Type a name and press Create deck. Select the cards you want, then Add N selected card(s). Use + and − to set how many copies, ↑ ↓ to order the deck, and pick a deck icon. When it looks right, press Play on Table.',
  },
  {
    title: 'Play on the table',
    where: 'Table',
    body:
      'Your deck sits on the felt as a stack showing its real card back. Drag to peel the top card off — or hold a stack briefly, then drag to carry the whole deck. Double-tap to flip a card. The action bar shuffles (with a propeller riffle and a riffle sound), cuts, draws, deals, gathers and changes the felt. Snap makes cards line up with the grid when they are close to it; Sound plays the pickup, flip, riffle and deal. Pinch or scroll to zoom, drag empty felt to pan — the felt has no edge, so spread out as far as you like — and Ctrl/Cmd+Z to undo. Press **Focus table** in the header to hide the panels and give the felt the whole screen.',
  },
  {
    title: 'Save and share your project',
    where: 'Library',
    body:
      'Back in the Library, press Export to download your whole project — images, decks and table setup — as a single .dealwithit.zip you can open on any other device with Import project. That\u2019s the full loop: import, build, play, share.',
  }
];

export function TourRail({
  step,
  onNext,
  onBack,
  onSkip
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];

  return (
    <aside className="tour-rail" aria-label="Guided walkthrough">
      <div className="tour-rail-head">
        <span className="tour-rail-step">Step {step + 1} of {total}</span>
        <h2>{current.title}</h2>
        <span className="tour-rail-where">{current.where}</span>
      </div>
      <p className="tour-rail-body">{current.body}</p>
      <div className="tour-rail-dots" aria-hidden="true">
        {TOUR_STEPS.map((_, i) => (
          <span key={i} className={`tour-dot ${i === step ? 'on' : ''}`} />
        ))}
      </div>
      <div className="tour-rail-actions">
        {step > 0 && <Button label="Back" variant="secondary" onClick={onBack} />}
        {step < total - 1 ? (
          <Button label="Next step" onClick={onNext} />
        ) : (
          <Button label="Finish — start playing" onClick={onSkip} />
        )}
        <Button label="Close tour" variant="secondary" onClick={onSkip} />
      </div>
    </aside>
  );
}
