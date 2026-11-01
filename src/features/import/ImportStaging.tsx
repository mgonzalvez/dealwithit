import { DeckDefinition } from '../../domain/models';
import { PairingInfo } from './zipImport';
import { StagedItem } from './pipeline';
import { Button } from '../../components/ui';

export type ImportDestination = 'library' | 'draft' | 'existing';

export interface ImportStagingProps {
  items: StagedItem[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onSelectAllValid: () => void;
  onDeselectAll: () => void;
  busy: boolean;
  progress: { processed: number; total: number };
  zipErrors: string[];
  pairing: PairingInfo | null;
  onCommit: () => void;
  onCancel: () => void;
  destination: ImportDestination;
  setDestination: (value: ImportDestination) => void;
  draftName: string;
  setDraftName: (value: string) => void;
  existingDeckId: string;
  setExistingDeckId: (value: string) => void;
  decks: DeckDefinition[];
  committedMessage: string | null;
}

export function ImportStaging(props: ImportStagingProps) {
  const validCount = props.items.filter((i) => i.status === 'valid').length;
  const duplicateCount = props.items.filter((i) => i.status === 'duplicate').length;
  const failedCount = props.items.filter((i) => i.status === 'invalid' || i.status === 'unsupported').length;
  const selectedCount = props.items.filter((i) => props.selected.has(i.key) && i.status === 'valid').length;

  if (props.items.length === 0 && !props.committedMessage) return null;

  return (
    <section className="staging">
      <h2>Import staging</h2>
      {props.busy && (
        <p className="progress" aria-live="polite">
            Processing {props.progress.processed} of {props.progress.total} files…
        </p>
      )}
      {!props.busy && props.items.length > 0 && (
        <p className="staging-summary">
          {validCount} ready · {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} ·{' '}
          {failedCount} failed
        </p>
      )}

      {props.zipErrors.length > 0 && (
        <ul className="zip-errors">
          {props.zipErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {props.pairing?.hasFrontsBacks && props.pairing.source === 'card-extractor' && !props.pairing.uncertain && (
        <p className="info">
          Importing from <strong>Card Extractor</strong>: {props.pairing.frontCount} front(s) and
          {props.pairing.backCount} back(s) detected. Backs are paired by number
          (001_front.png ↔ 001_back.png) and assigned automatically — they will not appear as
          separate cards.
        </p>
      )}
      {props.pairing?.uncertain && (
        <p className="warning">
          This archive has <strong>fronts/</strong> and <strong>backs/</strong> folders but the
          pairing is ambiguous. You can review and correct pairings in the card editor.
        </p>
      )}
      {props.pairing?.sharedBack && (
        <p className="info">
          Detected a shared card back: <strong>{props.pairing.sharedBack}</strong>. It will be
          used as the default back for decks created from this import.
        </p>
      )}

      {props.items.length > 0 && (
        <>
          <div className="staging-actions">
            <Button label="Select all valid" variant="secondary" onClick={props.onSelectAllValid} />
            <Button label="Deselect all" variant="secondary" onClick={props.onDeselectAll} />
          </div>
          <div className="staging-grid">
            {props.items.map((item) => (
              <div
                key={item.key}
                className={`staging-item staging-${item.status}`}
                title={item.error ?? item.warning ?? item.filename}
              >
                <input
                  type="checkbox"
                  checked={props.selected.has(item.key)}
                  disabled={item.status !== 'valid'}
                  onChange={() => props.onToggle(item.key)}
                  aria-label={`Select ${item.filename}`}
                />
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt="" className="staging-thumb" />
                ) : (
                  <span className="staging-thumb placeholder" aria-hidden="true">?</span>
                )}
                <div className="staging-meta">
                  <span className="staging-name">{item.filename}</span>
                  <span className={`status status-${item.status}`}>
                    {item.status}
                    {item.error ? ` — ${item.error}` : ''}
                    {item.warning ? ` — ${item.warning}` : ''}
                  </span>
                  {item.widthPx ? (
                    <span className="dims">
                      {item.widthPx}×{item.heightPx}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="staging-footer">
            <fieldset className="destination">
              <legend>After import</legend>
              <label>
                <input
                  type="radio"
                  name="destination"
                  value="library"
                  checked={props.destination === 'library'}
                  onChange={() => props.setDestination('library')}
                />
                Keep in Library
              </label>
              <label>
                <input
                  type="radio"
                  name="destination"
                  value="draft"
                  checked={props.destination === 'draft'}
                  onChange={() => props.setDestination('draft')}
                />
                Create draft deck
              </label>
              <label>
                <input
                  type="radio"
                  name="destination"
                  value="existing"
                  checked={props.destination === 'existing'}
                  onChange={() => props.setDestination('existing')}
                />
                Add to existing deck
              </label>
              {props.destination === 'draft' && (
                <input
                  type="text"
                  value={props.draftName}
                  onChange={(e) => props.setDraftName(e.target.value)}
                  placeholder="Draft deck name"
                  aria-label="Draft deck name"
                />
              )}
              {props.destination === 'existing' && (
                <select
                  value={props.existingDeckId}
                  onChange={(e) => props.setExistingDeckId(e.target.value)}
                  aria-label="Existing deck"
                >
                  {props.decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              )}
            </fieldset>
            <div className="staging-commit">
              <Button label={`Import ${selectedCount} image(s)`} onClick={props.onCommit} disabled={selectedCount === 0 || props.busy} />
              <Button label="Cancel import" variant="danger" onClick={props.onCancel} />
            </div>
          </div>
        </>
      )}

      {props.committedMessage && <p className="committed">{props.committedMessage}</p>}
    </section>
  );
}
