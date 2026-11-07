import { CardDefinition, DeckDefinition, ImageAsset } from '../../domain/models';
import { deckCardCount } from '../../domain/deck-operations';
import { Button } from '../../components/ui';
import { DECK_ICONS, DeckIconGlyph } from '../decks/deckIcons';
import { BackChip } from '../backdesign/BackChip';

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
  onTransfer: (deck: DeckDefinition, entryId: string, targetDeckId: string) => void;
  onAddSelectedCards: (deck: DeckDefinition) => void;
  onPlay: (deck: DeckDefinition) => void;
  onSetIcon: (deck: DeckDefinition, icon: string) => void;
  onDesignBack: (deck: DeckDefinition) => void;
  cards: CardDefinition[];
  selectedCardIds: Set<string>;
  assets: ImageAsset[];
  thumbnails: Map<string, string>;
}

function entryThumb(card: CardDefinition | undefined, thumbnails: Map<string, string>): string | null {
  if (!card) return null;
  return thumbnails.get(card.frontAssetId) ?? null;
}

export function DeckBuilder(props: DeckBuilderProps) {
  const activeDeck = props.decks.find((d) => d.id === props.activeDeckId) ?? null;

  return (
    <section className="deck-builder">
      <div className="deck-gallery">
        {props.decks.length === 0 && (
          <p className="muted">No decks yet. Create one below — imported images become cards you can add here.</p>
        )}
        {props.decks.map((deck) => (
          <article
            key={deck.id}
            className={`deck-tile ${deck.id === props.activeDeckId ? 'active' : ''}`}
            onClick={() => props.setActiveDeckId(deck.id)}
          >
            {deck.icon && (
              <DeckIconGlyph iconId={deck.icon} />
            )}
            <div className="deck-tile-stack" aria-hidden="true">
              {deck.entries.slice(0, 4).map((entry, i) => {
                const card = props.cards.find((c) => c.id === entry.cardDefinitionId);
                const thumb = entryThumb(card, props.thumbnails);
                return thumb ? (
                  <img key={entry.id} src={thumb} alt="" className={`deck-tile-card deck-tile-card-${i}`} />
                ) : null;
              })}
              {deck.entries.length === 0 && <div className="deck-tile-empty" />}
            </div>
            <div className="deck-tile-info">
              <strong>{deck.name}</strong>
              <span className="muted">{deckCardCount(deck)} cards · {deck.entries.length} kinds</span>
            </div>
            <div className="deck-tile-actions">
              <Button
                label="Rename"
                variant="secondary"
                onClick={() => {
                  const name = window.prompt('Deck name', deck.name);
                  if (name) props.onRename(deck, name);
                }}
              />
              <Button label="Duplicate" variant="secondary" onClick={() => props.onDuplicate(deck)} />
              <Button label="Delete" variant="danger" onClick={() => props.onDelete(deck)} />
            </div>
          </article>
        ))}
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

      {activeDeck && (
        <div className="deck-detail">
          <div className="deck-detail-header">
            <h2>{activeDeck.name}</h2>
            <span className="deck-count">{deckCardCount(activeDeck)} cards</span>
            <Button label="Play on Table" onClick={() => props.onPlay(activeDeck)} disabled={deckCardCount(activeDeck) === 0} />
          </div>

          <div className="deck-detail-row">
            <label className="deck-back-picker">
              Icon
              <select
                value={activeDeck.icon ?? ''}
                onChange={(e) => props.onSetIcon(activeDeck, e.target.value)}
                aria-label="Deck icon"
              >
                <option value="">No icon</option>
                {DECK_ICONS.map((icon) => (
                  <option key={icon.id} value={icon.id}>
                    {icon.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="deck-back-picker">
              Default back
              <select
                value={activeDeck.defaultBackAssetId ?? ''}
                onChange={(e) => props.onSetDefaultBack(activeDeck, e.target.value || undefined)}
              >
                <option value="">Generated back (choose one below)</option>
                {props.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </label>
            <Button label="Generate a back" variant="secondary" onClick={() => props.onDesignBack(activeDeck)} />
            {activeDeck.defaultBackDesign && <BackChip design={activeDeck.defaultBackDesign} />}
            <Button
              label={`Add ${props.selectedCardIds.size} selected card(s)`}
              onClick={() => props.onAddSelectedCards(activeDeck)}
              disabled={props.selectedCardIds.size === 0}
            />
          </div>

          {activeDeck.entries.length === 0 ? (
            <p className="muted">This deck is empty. Select cards in the Cards tab and add them here.</p>
          ) : (
            <ul className="deck-entries">
              {activeDeck.entries.map((entry, index) => {
                const card = props.cards.find((c) => c.id === entry.cardDefinitionId);
                const thumb = entryThumb(card, props.thumbnails);
                return (
                  <li key={entry.id} className="deck-entry">
                    {thumb ? <img src={thumb} alt="" className="deck-entry-thumb" /> : <div className="deck-entry-thumb placeholder" />}
                    <div className="deck-entry-name">
                      <strong>{card?.name ?? 'Missing card'}</strong>
                      {card && (
                        <span className="muted">
                          {card.widthMm}×{card.heightMm} mm
                          {card.backAssetId ? ' · custom back' : ''}
                        </span>
                      )}
                    </div>
                    <div className="qty-control" role="group" aria-label={`Quantity of ${card?.name ?? 'card'}`}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        aria-label="Decrease quantity"
                        onClick={() => props.onQuantity(activeDeck, entry.id, entry.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="qty-value">{entry.quantity}</span>
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
                        className="icon-btn"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => props.onMove(activeDeck, entry.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Move down"
                        disabled={index === activeDeck.entries.length - 1}
                        onClick={() => props.onMove(activeDeck, entry.id, 1)}
                      >
                        ↓
                      </button>
                      {props.decks.length > 1 && (
                        <label className="entry-transfer">
                          Move to
                          <select
                            value=""
                            aria-label={`Move ${card?.name ?? 'card'} to another deck`}
                            onChange={(e) => {
                              if (e.target.value) props.onTransfer(activeDeck, entry.id, e.target.value);
                            }}
                          >
                            <option value="">Another deck…</option>
                            {props.decks
                              .filter((d) => d.id !== activeDeck.id)
                              .map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      <button
                        type="button"
                        className="icon-btn danger"
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
        </div>
      )}
    </section>
  );
}
