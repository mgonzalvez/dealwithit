import { useEffect, useRef, useState } from 'react';
import {
  GeneratedBack,
  BACK_STYLES,
  BACK_COLORS,
  makeBackDesign,
  reshuffleBack,
  deriveAccent
} from '../../domain/back-designs';
import { drawGeneratedBack } from '../workshop/cardRenderer';
import { Button } from '../../components/ui';
import { Coach } from '../../components/Coach';
import { ImageAsset } from '../../domain/models';

const PREVIEW_W = 220;
const PREVIEW_H = 308;
const SWATCH_W = 72;
const SWATCH_H = 100;

export type BackMode = 'pattern' | 'image' | 'none';

export interface CardBackDesignerProps {
  /** Name of the deck or card the back is being chosen for. */
  targetName: string;
  projectName: string;
  scope: 'deck' | 'cards' | 'card';
  initialDesign?: GeneratedBack;
  initialImageAssetId?: string;
  assets: ImageAsset[];
  thumbnails: Map<string, string>;
  onApplyPattern: (design: GeneratedBack) => void;
  onApplyImage: (assetId: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}

/**
 * One screen, three choices: a generated pattern, an image you already
 * imported, or nothing. Everything updates the preview live.
 */
export function CardBackDesigner({
  targetName,
  projectName,
  scope,
  initialDesign,
  initialImageAssetId,
  assets,
  thumbnails,
  onApplyPattern,
  onApplyImage,
  onRemove,
  onCancel
}: CardBackDesignerProps) {
  const [mode, setMode] = useState<BackMode>(
    initialImageAssetId ? 'image' : initialDesign ? 'pattern' : 'pattern'
  );
  const [design, setDesign] = useState<GeneratedBack>(
    initialDesign ?? makeBackDesign({ pattern: 'diamonds', title: projectName, showTitle: true })
  );
  const [imageAssetId, setImageAssetId] = useState(initialImageAssetId ?? assets[0]?.id ?? '');

  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const swatchRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (mode === 'pattern') {
      drawGeneratedBack(ctx, design, PREVIEW_W, PREVIEW_H);
    } else {
      ctx.fillStyle = mode === 'none' ? '#f6f1e7' : '#dfe4ea';
      ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
      ctx.strokeStyle = '#b8c2cd';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, PREVIEW_W - 4, PREVIEW_H - 4);
    }
    swatchRefs.current.forEach((element, index) => {
      if (!element) return;
      element.width = SWATCH_W;
      element.height = SWATCH_H;
      const swatchCtx = element.getContext('2d');
      if (swatchCtx) {
        drawGeneratedBack(swatchCtx, { ...design, pattern: BACK_STYLES[index].id, showTitle: false }, SWATCH_W, SWATCH_H);
      }
    });
  }, [design, mode]);

  const applyLabel =
    scope === 'deck' ? 'Apply to this deck' : scope === 'cards' ? 'Apply to selected cards' : 'Apply to this card';

  return (
    <div className="back-center">
      <div className="back-center-preview">
        {mode === 'image' ? (
          thumbnails.get(imageAssetId) ? (
            <img src={thumbnails.get(imageAssetId)} alt="Selected back image" />
          ) : (
            <span className="back-none">no image selected</span>
          )
        ) : (
          <canvas ref={previewRef} aria-label="Card back preview" />
        )}
        <p className="muted back-center-preview-note">
          {mode === 'pattern'
            ? `${BACK_STYLES.find((s) => s.id === design.pattern)?.label} · ${design.showTitle && design.title ? 'with the name' : 'pattern only'}`
            : mode === 'image'
              ? 'Your own image'
              : 'No back — cards will show a plain neutral back'}
        </p>
      </div>

      <div className="back-center-body">
        <div className="back-mode-tabs" role="tablist" aria-label="Type of card back">
          <button type="button" role="tab" aria-selected={mode === 'pattern'} className={`back-mode ${mode === 'pattern' ? 'on' : ''}`} onClick={() => setMode('pattern')}>
            Generate a pattern
          </button>
          <button type="button" role="tab" aria-selected={mode === 'image'} className={`back-mode ${mode === 'image' ? 'on' : ''}`} onClick={() => setMode('image')}>
            Use an image
          </button>
          <button type="button" role="tab" aria-selected={mode === 'none'} className={`back-mode ${mode === 'none' ? 'on' : ''}`} onClick={() => setMode('none')}>
            No back
          </button>
        </div>

        {mode === 'pattern' && (
          <>
            <div className="back-section">
              <h3>1. Pick a pattern</h3>
              <div className="back-options">
                {BACK_STYLES.map((style, index) => (
                  <button
                    type="button"
                    key={style.id}
                    className={`back-option ${design.pattern === style.id ? 'selected' : ''}`}
                    onClick={() => setDesign((current) => ({ ...current, pattern: style.id }))}
                    title={style.hint}
                  >
                    <canvas ref={(element) => { swatchRefs.current[index] = element; }} aria-hidden="true" />
                    <span>{style.label}</span>
                  </button>
                ))}
              </div>
              <Coach
                text="Diamonds is the classic playing-card look. Crosshatch and rings read as “premium”. Solid colour is best when you want the name to stand out."
                action={{ label: 'Surprise me', onClick: () => setDesign(makeBackDesign({ title: design.title, showTitle: design.showTitle })) }}
              />
            </div>

            <div className="back-section">
              <h3>2. Pick a colour</h3>
              <div className="back-colors">
                {BACK_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color.label}
                    className={`back-color ${design.base === color.base && design.ink === color.ink ? 'selected' : ''}`}
                    onClick={() =>
                      setDesign((current) => ({
                        ...current,
                        base: color.base,
                        ink: color.ink,
                        accent: deriveAccent(color.ink, color.base)
                      }))
                    }
                    style={{ background: color.base, borderColor: color.ink, color: color.ink }}
                  >
                    <span>{color.label}</span>
                  </button>
                ))}
              </div>
              <div className="back-custom">
                <label>
                  Background
                  <input type="color" value={design.base} onChange={(e) => setDesign((c) => ({ ...c, base: e.target.value }))} />
                </label>
                <label>
                  Pattern
                  <input
                    type="color"
                    value={design.ink}
                    onChange={(e) => setDesign((c) => ({ ...c, ink: e.target.value, accent: deriveAccent(e.target.value, c.base) }))}
                  />
                </label>
                <button type="button" className="btn btn-secondary" onClick={() => setDesign((current) => reshuffleBack(current))}>
                  Shuffle the pattern
                </button>
              </div>
            </div>

            <div className="back-section">
              <h3>3. Put the game name on it? <span className="muted">optional</span></h3>
              <input
                type="text"
                value={design.title}
                maxLength={60}
                placeholder={projectName || 'Leave blank for pattern only'}
                onChange={(e) =>
                  setDesign((current) => ({ ...current, title: e.target.value, showTitle: e.target.value.trim().length > 0 }))
                }
              />
              <Coach text="The name is printed at both ends, so it still reads when a card is flipped." />
            </div>
          </>
        )}

        {mode === 'image' && (
          <div className="back-section">
            <h3>Which image?</h3>
            {assets.length === 0 ? (
              <p className="muted">
                You have not imported any images in this project yet. Import them in the Import tab first, or generate a pattern instead.
              </p>
            ) : (
              <div className="back-image-grid">
                {assets.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    className={`back-image ${imageAssetId === asset.id ? 'selected' : ''}`}
                    onClick={() => setImageAssetId(asset.id)}
                  >
                    {thumbnails.get(asset.id) ? <img src={thumbnails.get(asset.id)} alt={asset.filename} /> : <span className="muted">{asset.filename}</span>}
                    <span>{asset.filename}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'none' && (
          <div className="back-section">
            <h3>Plain back</h3>
            <p className="muted">
              Cards will show the neutral grey back. You can give this deck or individual cards a proper back any time.
            </p>
          </div>
        )}

        <div className="back-center-actions">
          <Button
            label={applyLabel}
            onClick={() => {
              if (mode === 'pattern') onApplyPattern(design);
              else if (mode === 'image' && imageAssetId) onApplyImage(imageAssetId);
              else onRemove();
            }}
            disabled={mode === 'image' && !imageAssetId}
          />
          <Button label="Cancel" variant="secondary" onClick={onCancel} />
          <span className="muted">for {targetName}</span>
        </div>
      </div>
    </div>
  );
}
