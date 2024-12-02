// ProjectZer0Frontend/src/lib/components/graphElements/nodes/previews/base/previewDrawing.ts
import type { PreviewNodeStyle } from '../styles/previewNodeStyles';

export function drawTitle(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: PreviewNodeStyle
) {
    ctx.font = `${style.font.titleSize} ${style.font.family}`;
    ctx.fillStyle = style.colors.title;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

export function drawTruncatedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    style: PreviewNodeStyle
) {
    ctx.font = `${style.font.textSize} ${style.font.family}`;
    ctx.fillStyle = style.colors.text;
    
    if (ctx.measureText(text).width > maxWidth) {
        let truncated = text;
        while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '...', x, y);
    } else {
        ctx.fillText(text, x, y);
    }
}

export function drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    style: PreviewNodeStyle
): number {
    ctx.font = `${style.font.textSize} ${style.font.family}`;
    ctx.fillStyle = style.colors.text;

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