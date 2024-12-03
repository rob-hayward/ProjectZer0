// src/lib/components/graphElements/nodes/previews/base/previewDrawing.ts
import type { PreviewNodeStyle } from '../styles/previewNodeStyles';
import type { PreviewTextConfig } from './previewNodeCanvas';

export function drawTitle(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: PreviewNodeStyle,
    textAlign: CanvasTextAlign = 'center'
) {
    ctx.font = `${style.font.titleSize} ${style.font.family}`;
    ctx.fillStyle = style.colors.title;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

export function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    textStyle: PreviewTextConfig
) {
    ctx.font = textStyle.font;
    ctx.fillStyle = textStyle.color;
    ctx.textAlign = textStyle.align;
    ctx.textBaseline = textStyle.baseline;
    ctx.fillText(text, x, y);
}

export function drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    style: PreviewNodeStyle,
    textAlign: CanvasTextAlign = 'center'
): number {
    ctx.font = `${style.font.textSize} ${style.font.family}`;
    ctx.fillStyle = style.colors.text;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    const words = text.split(' ');
    let line = '';
    let y = startY;

    for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, x, y);
            line = word;
            y += style.lineHeight;
        } else {
            line = testLine;
        }
    }
    
    if (line) {
        ctx.fillText(line, x, y);
        y += style.lineHeight;
    }

    return y;
}