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

const PREVIEW_W = 220;
const PREVIEW_H = 308; // poker proportions
const SWATCH_W = 72;
const SWATCH_H = 100;

function paint(canvas: HTMLCanvasElement | null, design: GeneratedBack, width: number, height: number) {
  if (!canvas) return;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawGeneratedBack(ctx, design, width, height);
}

export interface CardBackDesignerProps {
  projectName: string;
  initial?: GeneratedBack;
  /** What the back will be attached to — changes the Apply wording. */
  scope: 'deck' | 'cards' | 'card';
  onApply: (design: GeneratedBack) => void;
  onCancel: () => void;
}

/**
 * Three-step wizard: 1) style, 2) colour, 3) name.
 * Every choice updates the live preview immediately.
 */
export function CardBackDesigner({ projectName, initial, scope, onApply, onCancel }: CardBackDesignerProps) {
  const [design, setDesign] = useState<GeneratedBack>(
    initial ?? makeBackDesign({ pattern: 'diamonds', title: projectName, showTitle: true })
  );
  const [step, setStep] = useState(0);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const swatchRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    paint(previewRef.current, design, PREVIEW_W, PREVIEW_H);
    swatchRefs.current.forEach((canvas, index) => {
      if (canvas) paint(canvas, { ...design, pattern: BACK_STYLES[index].id, showTitle: false }, SWATCH_W, SWATCH_H);
    });
  }, [design]);

  const steps = ['Style', 'Colour', 'Name'];

  return (
    <div className="back-designer">
      <div className="back-designer-preview">
        <canvas ref={previewRef} aria-label="Card back preview" />
        <button
          type="button"
          className="btn btn-secondary back-designer-shuffle"
          onClick={() => setDesign((current) => reshuffleBack(current))}
        >
          Shuffle pattern
        </button>
      </div>

      <div className="back-designer-steps">
        <div className="back-designer-tabs" role="tablist" aria-label="Card back wizard steps">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={step === index}
              className={`back-step ${step === index ? 'on' : ''}`}
              onClick={() => setStep(index)}
            >
              <span className="back-step-num">{index + 1}</span>
              {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="back-options" role="group" aria-label="Choose a pattern style">
            {BACK_STYLES.map((style, index) => (
              <button
                type="button"
                key={style.id}
                className={`back-option ${design.pattern === style.id ? 'selected' : ''}`}
                onClick={() => {
                  setDesign((current) => ({ ...current, pattern: style.id }));
                  setStep(1);
                }}
                title={style.hint}
              >
                <canvas ref={(element) => { swatchRefs.current[index] = element; }} aria-hidden="true" />
                <span>{style.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDesign(makeBackDesign({ title: projectName, showTitle: true }))}
            >
              Surprise me
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="back-colors" role="group" aria-label="Choose a colour">
            {BACK_COLORS.map((color) => (
              <button
                type="button"
                key={color.label}
                className={`back-color ${design.base === color.base && design.ink === color.ink ? 'selected' : ''}`}
                onClick={() => {
                  setDesign((current) => ({
                    ...current,
                    base: color.base,
                    ink: color.ink,
                    accent: deriveAccent(color.ink, color.base)
                  }));
                  setStep(2);
                }}
                style={{ background: color.base, borderColor: color.ink }}
              >
                <span>{color.label}</span>
              </button>
            ))}
            <div className="back-custom">
              <label>
                Background
                <input
                  type="color"
                  value={design.base}
                  onChange={(e) => setDesign((c) => ({ ...c, base: e.target.value }))}
                  aria-label="Custom background colour"
                />
              </label>
              <label>
                Pattern
                <input
                  type="color"
                  value={design.ink}
                  onChange={(e) =>
                    setDesign((c) => ({ ...c, ink: e.target.value, accent: deriveAccent(e.target.value, c.base) }))
                  }
                  aria-label="Custom pattern colour"
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="back-name">
            <label>
              Game name on the back
              <input
                type="text"
                value={design.title}
                maxLength={60}
                placeholder={projectName || 'Leave blank for no name'}
                onChange={(e) =>
                  setDesign((current) => ({
                    ...current,
                    title: e.target.value,
                    showTitle: e.target.value.trim().length > 0
                  }))
                }
              />
            </label>
            <p className="muted">
              The name appears at both ends, so it reads correctly whichever way the card is flipped.
            </p>
          </div>
        )}

        <div className="back-designer-actions">
          {step > 0 && <Button label="Back" variant="secondary" onClick={() => setStep((s) => s - 1)} />}
          {step < 2 && <Button label="Next" onClick={() => setStep((s) => s + 1)} />}
          <Button
            label={
              scope === 'deck'
                ? 'Apply to this deck'
                : scope === 'cards'
                ? 'Apply to selected cards'
                : 'Apply to this card'
            }
            onClick={() => onApply(design)}
          />
          <Button label="Cancel" variant="secondary" onClick={onCancel} />
        </div>
      </div>
    </div>
  );
}
