import { CardDefinition, DeckDefinition, ImageAsset } from '../../domain/models';
import { deckCardCount } from '../../domain/deck-operations';
import { Button } from '../../components/ui';

export interface DeckBuilderProps {
  decks: DeckDefinition[];
  activeDeckId: string | null;
  setActiveDeckId: (id: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (deck: DeckDefinition, name: string) => void;
  onDuplicate: (deck: DeckDefinition) => void;
  onDelete: (deck: DeckDefinition) => void;
  onSetDefaultBack: (deck: DeckDefinition, assetId: string | undefined) => void;
  onQuantity: (deck: DeckDefinition, entryId: string, quantity: number) => void;
  onMove: (deck: DeckDefinition, entryId: string, delta: -1 | 1) => void;
  onRemove: (deck: DeckDefinition, entryId: string) => void;
  onAddSelectedCards: (deck: DeckDefinition) => void;
  cards: CardDefinition[];
  selectedCardIds: Set<string>;
  assets: ImageAsset[];
  thumbnails: Map<string, string>;
}

export function DeckBuilder(props: DeckBuilderProps) {
  const activeDeck = props.decks.find((d) => d.id === props.activeDeckId) ?? null;

  return (
    <section className="deck-builder">
      <div className="deck-list">
        <h2>Decks</h2>
        <div className="deck-list-items">
          {props.decks.length === 0 && <p className="muted">No decks yet. Create one.</p>}
          {props.decks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              className={`deck-list-item ${deck.id === props.activeDeckId ? 'active' : ''}`}
              onClick={() => props.setActiveDeckId(deck.id)}
            >
              {deck.name}
              <span className="deck-count">{deckCardCount(deck)} cards</span>
            </button>
          ))}
        </div>
        <div className="deck-create">
          <input type="text" placeholder="New deck name" aria-label="New deck name" id="new-deck-name" />
          <Button
            label="Create deck"
            onClick={() => {
              const input = document.getElementById('new-deck-name') as HTMLInputElement | null;
              if (input?.value.trim()) {
                props.onCreate(input.value.trim());
                input.value = '';
              }
            }}
          />
        </div>
      </div>

      <div className="deck-detail">
        {!activeDeck ? (
          <p className="muted">Select a deck to edit its contents.</p>
        ) : (
          <>
            <div className="deck-detail-header">
              <input
                type="text"
                value={activeDeck.name}
                onChange={(e) => props.onRename(activeDeck, e.target.value)}
                aria-label="Deck name"
              />
              <span className="deck-count">{deckCardCount(activeDeck)} cards</span>
              <Button label="Duplicate" variant="secondary" onClick={() => props.onDuplicate(activeDeck)} />
              <Button label="Delete deck" variant="danger" onClick={() => props.onDelete(activeDeck)} />
            </div>

            <div className="deck-detail-row">
              <label>
                Default back
                <select
                  value={activeDeck.defaultBackAssetId ?? ''}
                  onChange={(e) => props.onSetDefaultBack(activeDeck, e.target.value || undefined)}
                >
                  <option value="">Neutral generated back</option>
                  {props.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.filename}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                label={`Add ${props.selectedCardIds.size} selected card(s)`}
                onClick={() => props.onAddSelectedCards(activeDeck)}
                disabled={props.selectedCardIds.size === 0}
              />
            </div>

            {activeDeck.entries.length === 0 ? (
              <p className="muted">This deck is empty. Select cards in the Cards tab, then add them here.</p>
            ) : (
              <ul className="deck-entries">
                {activeDeck.entries.map((entry, index) => {
                  const card = props.cards.find((c) => c.id === entry.cardDefinitionId);
                  return (
                    <li key={entry.id} className="deck-entry">
                      {props.thumbnails.get(card?.frontAssetId ?? '') ? (
                        <img src={props.thumbnails.get(card?.frontAssetId ?? '')} alt="" className="deck-entry-thumb" />
                      ) : null}
                      <span className="deck-entry-name">{card?.name ?? 'Missing card'}</span>
                      <div className="qty-control" role="group" aria-label={`Quantity of ${card?.name ?? 'card'}`}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-label="Decrease quantity"
                          onClick={() => props.onQuantity(activeDeck, entry.id, entry.quantity - 1)}
                        >
                          −
                        </button>
                        <span>{entry.quantity}</span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-label="Increase quantity"
                          onClick={() => props.onQuantity(activeDeck, entry.id, entry.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="entry-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => props.onMove(activeDeck, entry.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-label="Move down"
                          disabled={index === activeDeck.entries.length - 1}
                          onClick={() => props.onMove(activeDeck, entry.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          aria-label="Remove from deck"
                          onClick={() => props.onRemove(activeDeck, entry.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="table-cta">
              <button type="button" className="btn btn-primary" disabled={deckCardCount(activeDeck) === 0}>
                Play on Table (arrives in M3)
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
