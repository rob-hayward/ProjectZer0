interface GlowEffect {
    color: string;
    radius: number;
    intensity: number;
  }
  
  export function drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    effect: GlowEffect
  ) {
    const gradient = ctx.createRadialGradient(
      x, y, 0,
      x, y, effect.radius
    );
    
    const intensityHex = Math.floor(effect.intensity * 255)
      .toString(16)
      .padStart(2, '0');
      
    gradient.addColorStop(0, `${effect.color}`);
    gradient.addColorStop(0.5, `${effect.color}${intensityHex}`);
    gradient.addColorStop(1, `${effect.color}00`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  export function drawCursor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number = 70
  ) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }