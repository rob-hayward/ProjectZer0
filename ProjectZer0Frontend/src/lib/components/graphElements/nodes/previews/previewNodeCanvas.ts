// src/lib/components/graphElements/nodes/previews/previewNodeCanvas.ts

export interface PreviewTextConfig {
    font: string;
    color: string;
    align: CanvasTextAlign;
    baseline: CanvasTextBaseline;
  }
  
  export const PREVIEW_TEXT_STYLES = {
    title: {
      font: '6px "Orbitron", sans-serif',
      color: 'rgba(255, 255, 255, 0.9)',
      align: 'left' as const,
      baseline: 'middle' as const
    },
    value: {
      font: '6px "Orbitron", sans-serif',
      color: 'rgba(255, 255, 255, 1)',
      align: 'left' as const,
      baseline: 'middle' as const
    },
    hover: {
      font: '6px "Orbitron", sans-serif',
      color: 'rgba(255, 255, 255, 0.7)',
      align: 'center' as const,
      baseline: 'middle' as const
    }
  };
  
  class PreviewNodeCanvasClass {
    static initializeCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
  
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      return ctx;
    }
  
    static clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
      ctx.clearRect(0, 0, width, height);
    }
  
    static setTextStyle(ctx: CanvasRenderingContext2D, style: PreviewTextConfig): void {
      ctx.font = style.font;
      ctx.fillStyle = style.color;
      ctx.textAlign = style.align;
      ctx.textBaseline = style.baseline;
    }
  
    static drawNodeBackground(
      ctx: CanvasRenderingContext2D, 
      centerX: number, 
      centerY: number, 
      radius: number,
      isHovered: boolean
    ): void {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      
      ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fill();
  
      if (isHovered) {
        const gradient = ctx.createRadialGradient(
          centerX, centerY, radius * 0.8,
          centerX, centerY, radius * 1.2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
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
  
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && line !== '') {
          ctx.fillText(line, x, y);
          line = word;
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      
      if (line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
      }
      
      return y;
    }
  }
  
  // Export the static methods as a namespace
  export const PreviewNodeCanvas = {
    initializeCanvas: PreviewNodeCanvasClass.initializeCanvas,
    clearCanvas: PreviewNodeCanvasClass.clearCanvas,
    setTextStyle: PreviewNodeCanvasClass.setTextStyle,
    drawNodeBackground: PreviewNodeCanvasClass.drawNodeBackground,
    drawWrappedText: PreviewNodeCanvasClass.drawWrappedText
  };
  
  // Also export the type
  export type PreviewNodeCanvasType = typeof PreviewNodeCanvas;