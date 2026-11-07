import { useTips } from '../app/tips';

export interface CoachProps {
  text: string;
  action?: { label: string; onClick: () => void };
}

/**
 * A short, contextual hint attached to a decision point. Hidden when Tips are
 * switched off in the header.
 */
export function Coach({ text, action }: CoachProps) {
  const { enabled } = useTips();
  if (!enabled) return null;
  return (
    <div className="coach" role="note">
      <span className="coach-mark" aria-hidden="true">?</span>
      <p>{text}</p>
      {action && (
        <button type="button" className="coach-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
