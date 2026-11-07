import { useEffect, useRef } from 'react';
import { CardDefinition } from '../../domain/models';
import { backLabel, resolveBack } from '../../domain/back-designs';
import { CARD_SIZE_PRESETS, rotateTransform } from '../../domain/transforms';
import { getImageBlob } from '../../persistence/repositories';
import { loadImage, renderCardPreview } from './cardRenderer';
import { Button } from '../../components/ui';
import { Coach } from '../../components/Coach';

export interface CardEditorProps {
  card: CardDefinition;
  onSave: (card: CardDefinition) => void;
  onDelete: (card: CardDefinition) => void;
  onDesignBack: (card: CardDefinition) => void;
}

export function CardEditor({ card, onSave, onDelete, onDesignBack }: CardEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceRef = useRef<'front' | 'back'>('front');
  const imagesRef = useRef<{ front: HTMLImageElement | null; back: HTMLImageElement | null }>({
    front: null,
    back: null
  });

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCardPreview(card, imagesRef.current.front, imagesRef.current.back, faceRef.current, canvas, 420, card.backDesign);
  }

  useEffect(() => {
    let cancelled = false;
    imagesRef.current = { front: null, back: null };
    void (async () => {
      const frontBlob = await getImageBlob(card.frontAssetId);
      if (frontBlob) imagesRef.current.front = await loadImage(frontBlob);
      if (card.backAssetId) {
        const backBlob = await getImageBlob(card.backAssetId);
        if (backBlob) imagesRef.current.back = await loadImage(backBlob);
      }
      if (!cancelled) draw();
    })();
    return () => {
      cancelled = true;
    };
  }, [card.id, card.frontAssetId, card.backAssetId]);

  useEffect(draw, [card]);

  const transform = card.frontTransform;

  return (
    <div className="card-editor">
      <div className="card-editor-preview">
        <canvas ref={canvasRef} aria-label={`Preview of ${card.name}`} />
        <div className="card-editor-face-toggle" role="group" aria-label="Card face">
          <button
            type="button"
            className={`btn btn-secondary ${faceRef.current === 'front' ? 'active' : ''}`}
            onClick={() => {
              faceRef.current = 'front';
              draw();
            }}
          >
            Front
          </button>
          <button
            type="button"
            className={`btn btn-secondary ${faceRef.current === 'back' ? 'active' : ''}`}
            onClick={() => {
              faceRef.current = 'back';
              draw();
            }}
          >
            Back
          </button>
        </div>
      </div>

      <div className="card-editor-controls">
        <label>
          Card name
          <input type="text" value={card.name} onChange={(e) => onSave({ ...card, name: e.target.value })} />
        </label>

        <div className="control-row">
          <button type="button" className="btn btn-secondary" onClick={() => onSave({ ...card, frontTransform: rotateTransform(transform, 90) })}>
            Rotate front 90°
          </button>
          {card.backAssetId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                onSave({
                  ...card,
                  backTransform: rotateTransform(card.backTransform ?? { rotationDeg: 0, scale: 1, offsetX: 0, offsetY: 0, fit: 'contain' }, 90)
                })
              }
            >
              Rotate back 90°
            </button>
          )}
        </div>

        <div className="control-row">
          <label>
            Fit
            <select
              value={transform.fit}
              onChange={(e) => onSave({ ...card, frontTransform: { ...transform, fit: e.target.value as 'contain' | 'cover' } })}
            >
              <option value="contain">Contain (whole image)</option>
              <option value="cover">Cover (crop to fill)</option>
            </select>
          </label>
          <label>
            Zoom
            <input
              type="number"
              min="0.5"
              max="3"
              step="0.05"
              value={transform.scale}
              onChange={(e) => onSave({ ...card, frontTransform: { ...transform, scale: Math.max(0.1, Number(e.target.value) || 1) } })}
            />
          </label>
          <label>
            Pan X
            <input
              type="number"
              value={transform.offsetX}
              onChange={(e) => onSave({ ...card, frontTransform: { ...transform, offsetX: Number(e.target.value) || 0 } })}
            />
          </label>
          <label>
            Pan Y
            <input
              type="number"
              value={transform.offsetY}
              onChange={(e) => onSave({ ...card, frontTransform: { ...transform, offsetY: Number(e.target.value) || 0 } })}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSave({ ...card, frontTransform: { rotationDeg: 0, scale: 1, offsetX: 0, offsetY: 0, fit: 'contain' } })}
          >
            Reset crop
          </button>
        </div>

        <div className="control-row">
          <label>
            Size preset
            <select
              onChange={(e) => {
                const preset = CARD_SIZE_PRESETS[e.target.value as keyof typeof CARD_SIZE_PRESETS];
                if (preset) onSave({ ...card, widthMm: preset.widthMm, heightMm: preset.heightMm });
              }}
            >
              <option value="poker">Poker (63.5 × 88.9 mm)</option>
              <option value="bridge">Bridge (57.2 × 88.9 mm)</option>
              <option value="square">Square (63.5 × 63.5 mm)</option>
              <option value="mini">Mini (44.5 × 68 mm)</option>
            </select>
          </label>
          <label>
            Width (mm)
            <input
              type="number"
              min="1"
              value={card.widthMm}
              onChange={(e) => onSave({ ...card, widthMm: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <label>
            Height (mm)
            <input
              type="number"
              min="1"
              value={card.heightMm}
              onChange={(e) => onSave({ ...card, heightMm: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
        </div>

        <div className="card-back-panel">
          <div className="card-back-copy">
            <strong>Card back</strong>
            <span className="muted">
              {backLabel(resolveBack(card))}
              {card.backDesign?.title ? ` — “${card.backDesign.title}”` : ''}
            </span>
          </div>
          <Button label="Choose a back" onClick={() => onDesignBack(card)} />
          <Coach
            text="This back only affects this card. If you do not set one, the card uses the back of the deck it belongs to."
            action={{ label: 'Choose a back', onClick: () => onDesignBack(card) }}
          />
        </div>

        <div className="control-row">
          <Button label="Delete card definition" variant="danger" onClick={() => onDelete(card)} />
          <p className="muted">
            Deleting a card definition never removes the underlying image from the library.
          </p>
        </div>
      </div>
    </div>
  );
}
