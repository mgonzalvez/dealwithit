import { useEffect, useRef, useState } from 'react';
import { CardDefinition, DeckDefinition, ImageAsset } from '../../domain/models';
import { resolveBack } from '../../domain/back-designs';
import { getImageBlob } from '../../persistence/repositories';
import { loadImage, renderCardPreview } from './cardRenderer';
import { Button } from '../../components/ui';

/** Cache decoded images by asset id so tiles render instantly. */
const imageCache = new Map<string, HTMLImageElement | null>();

async function getCardImages(
  card: CardDefinition
): Promise<{ front: HTMLImageElement | null; back: HTMLImageElement | null }> {
  if (!imageCache.has(card.frontAssetId)) {
    const blob = await getImageBlob(card.frontAssetId);
    imageCache.set(card.frontAssetId, blob ? await loadImage(blob) : null);
  }
  if (card.backAssetId && !imageCache.has(card.backAssetId)) {
    const blob = await getImageBlob(card.backAssetId);
    imageCache.set(card.backAssetId, blob ? await loadImage(blob) : null);
  }
  return {
    front: imageCache.get(card.frontAssetId) ?? null,
    back: card.backAssetId ? imageCache.get(card.backAssetId) ?? null : null
  };
}

export interface CardGridProps {
  cards: CardDefinition[];
  decks: DeckDefinition[];
  assets: ImageAsset[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (card: CardDefinition) => void;
  onDelete: (card: CardDefinition) => void;
  onAssignBack: (card: CardDefinition, backAssetId: string | undefined) => void;
  onBulkAssignBack: (backAssetId: string | null) => void;
  onDesignBack: () => void;
  onRotateSelected: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function copiesInDecks(cardId: string, decks: DeckDefinition[]): number {
  return decks.reduce(
    (sum, deck) =>
      sum + deck.entries.filter((e) => e.cardDefinitionId === cardId).reduce((s, e) => s + e.quantity, 0),
    0
  );
}

function deckForCard(card: CardDefinition, decks: DeckDefinition[]): DeckDefinition | undefined {
  return decks.find((deck) => deck.entries.some((entry) => entry.cardDefinitionId === card.id));
}

interface TileProps {
  card: CardDefinition;
  decks: DeckDefinition[];
  assets: ImageAsset[];
  isSelected: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (card: CardDefinition) => void;
  onDelete: (card: CardDefinition) => void;
  onAssignBack: (card: CardDefinition, backAssetId: string | undefined) => void;
}

function CardTile(props: TileProps) {
  const { card, decks, assets, isSelected } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [face, setFace] = useState<'front' | 'back'>('front');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const images = await getCardImages(card);
      const source = resolveBack(card, deckForCard(card, decks));
      const design = source.kind === 'generated' ? source.design : undefined;
      if (!cancelled && canvasRef.current) {
        renderCardPreview(card, images.front, images.back, face, canvasRef.current, 220, design);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card, face, decks]);

  const copies = copiesInDecks(card.id, decks);

  return (
    <div className={`card-tile ${isSelected ? 'selected' : ''}`}>
      <button
        type="button"
        className="card-tile-face"
        onClick={() => setFace((f) => (f === 'front' ? 'back' : 'front'))}
        aria-label={`Show ${face === 'front' ? 'back' : 'front'} of ${card.name}`}
      >
        <canvas ref={canvasRef} />
        <span className="card-tile-face-label">
          {face === 'front' ? 'Front' : card.backAssetId ? 'Back' : card.backDesign ? 'Generated back' : 'Neutral back'}
        </span>
      </button>
      <div className="card-tile-meta">
        <strong>{card.name}</strong>
        <span className="muted">
          {card.widthMm}×{card.heightMm} mm · {copies > 0 ? `${copies} in decks` : 'not in any deck'}
        </span>
        <label className="card-tile-back">
          Back
          <select
            value={card.backAssetId ?? ''}
            onChange={(e) => props.onAssignBack(card, e.target.value || undefined)}
            aria-label={`Assign a back image to ${card.name}`}
          >
            <option value="">Neutral (generated)</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.filename}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="card-tile-actions">
        <label className="card-tile-select">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => props.onToggle(card.id)}
            aria-label={`Select ${card.name} for bulk actions`}
          />
          <span>select</span>
        </label>
        <button type="button" className="icon-btn" onClick={() => props.onEdit(card.id)}>
          Edit
        </button>
        <button type="button" className="icon-btn" onClick={() => props.onDuplicate(card)}>
          Duplicate
        </button>
        <button type="button" className="icon-btn danger" onClick={() => props.onDelete(card)}>
          Delete
        </button>
      </div>
    </div>
  );
}

export function CardGrid(props: CardGridProps) {
  return (
    <div className="card-grid-v2">
      <div className="card-grid-toolbar">
        <Button label="Select all" variant="secondary" onClick={props.onSelectAll} disabled={props.cards.length === 0} />
        <Button label="Deselect all" variant="secondary" onClick={props.onDeselectAll} disabled={props.selected.size === 0} />
        <span className="muted">{props.selected.size} selected</span>
        {props.selected.size > 0 && (
          <>
            <Button label="Design a generated back" variant="secondary" onClick={props.onDesignBack} />
            <Button label="Rotate 90°" variant="secondary" onClick={props.onRotateSelected} />
            <label className="card-grid-bulk-back">
              Apply back to selected
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value === '__none__') props.onBulkAssignBack(null);
                  else if (e.target.value) props.onBulkAssignBack(e.target.value);
                }}
                aria-label="Apply a back image to all selected cards"
              >
                <option value="">Choose a back…</option>
                <option value="__none__">Remove backs</option>
                {props.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <div className="card-grid-v2-list">
        {props.cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            decks={props.decks}
            assets={props.assets}
            isSelected={props.selected.has(card.id)}
            onToggle={props.onToggle}
            onEdit={props.onEdit}
            onDuplicate={props.onDuplicate}
            onDelete={props.onDelete}
            onAssignBack={props.onAssignBack}
          />
        ))}
      </div>
    </div>
  );
}
