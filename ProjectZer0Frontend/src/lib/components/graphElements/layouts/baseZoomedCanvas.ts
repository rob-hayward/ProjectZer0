// ProjectZer0Frontend/src/lib/components/graphElements/layouts/baseZoomedCanvas.ts
import { drawGlow } from '$lib/utils/canvasAnimations';

export interface TextConfig {
  font: string;
  color: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
}

// Core text styling configurations
export const TEXT_STYLES = {
  logo: {
    font: '30px "Orbitron", sans-serif',
    color: 'white',
    align: 'center' as const,
    baseline: 'middle' as const,
  },
  label: {
    font: '14px "Orbitron", sans-serif',
    color: 'rgba(255, 255, 255, 0.7)',
    align: 'left' as const,
    baseline: 'middle' as const
  },
  value: {
    font: '14px "Orbitron", sans-serif',
    color: 'white',
    align: 'left' as const,
    baseline: 'middle' as const
  }
};

// Constants
export const CIRCLE_RADIUS = 290;

export class BaseZoomedCanvas {
  static setTextStyle(ctx: CanvasRenderingContext2D, style: TextConfig) {
    ctx.font = style.font;
    ctx.fillStyle = style.color;
    ctx.textAlign = style.align;
    ctx.textBaseline = style.baseline;
  }

  static drawCentralCircle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, time: number) {
    // Draw glow effect around main circle
    drawGlow(ctx, centerX, centerY, {
        color: '#FFFFFF',
        radius: CIRCLE_RADIUS, 
        intensity: 0.3,              
        fade: true
    });

    // Draw main circle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, CIRCLE_RADIUS, 0, 2 * Math.PI);
    ctx.stroke();
}

  static drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight: number
  ): number {
    const words = text.split(' ');
    let line = '';
    let y = startY;

    for (let word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, x, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
    return y;
  }
}