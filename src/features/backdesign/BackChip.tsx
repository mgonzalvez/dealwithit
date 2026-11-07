import { useEffect, useRef } from 'react';
import { GeneratedBack, backLabel } from '../../domain/back-designs';
import { drawGeneratedBack } from '../workshop/cardRenderer';

/** Tiny live thumbnail of a generated back. */
export function BackChip({ design, label }: { design: GeneratedBack; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 34;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) drawGeneratedBack(ctx, design, 34, 48);
  }, [design]);

  return (
    <span className="back-chip">
      <canvas ref={canvasRef} aria-hidden="true" />
      <span>{label ?? backLabel({ kind: 'generated', design })}</span>
    </span>
  );
}
