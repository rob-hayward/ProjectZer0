// src/components/graph/nodes/base/BaseNodeDisplay.ts
export class BaseNodeDisplay {
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
  
    static drawNodeBackground(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, isHovered: boolean): void {
      // Draw main circle background
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fill();
  
      // Draw glow effect
      if (isHovered) {
        const gradient = ctx.createRadialGradient(
          centerX, centerY, radius * 0.8,
          centerX, centerY, radius * 1.1
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
      }
  
      // Draw borders
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }