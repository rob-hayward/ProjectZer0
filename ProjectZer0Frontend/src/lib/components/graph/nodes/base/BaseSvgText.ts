// src/lib/components/graph/nodes/base/BaseSvgText.ts
export interface SvgTextOptions {
    x: number;
    y: number;
    fontFamily?: string;
    fontSize?: string;
    fill?: string;
    textAnchor?: 'start' | 'middle' | 'end';
    maxWidth?: number;
    lineHeight?: number;
}

export function wrapSvgText(text: string, maxWidth: number): string[] {
    const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    document.body.appendChild(tempText);
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        tempText.textContent = testLine;
        
        if (tempText.getComputedTextLength() > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    document.body.removeChild(tempText);
    return lines;
}

// Helper component usage example in Svelte:
/*
<text
    x={x}
    y={y}
    font-family={fontFamily}
    font-size={fontSize}
    fill={fill}
    text-anchor={textAnchor}
>
    {#each lines as line, i}
        <tspan
            x={x}
            dy={i === 0 ? 0 : lineHeight}
        >
            {line}
        </tspan>
    {/each}
</text>
*/