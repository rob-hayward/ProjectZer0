// src/lib/components/graphElements/nodes/navigationNode/NavigationNode.ts
import type { NavigationOption } from '$lib/types/navigation';
import { drawGlow } from '$lib/utils/canvasAnimations';
import { getNavigationColor } from './navigationColors';

export function drawNavigationNode(
  ctx: CanvasRenderingContext2D,
  option: NavigationOption,
  x: number,
  y: number,
  scale: number = 1,
  isHovered: boolean = false
) {
  const color = getNavigationColor(option.id);  // Changed from getActionColor

  // Draw a very subtle glow when hovered
  if (isHovered) {
    drawGlow(ctx, x, y, {
      color,
      radius: 25 * scale,
      intensity: 0.05
    });
  }

  // Draw the icon
  ctx.font = `${24 * scale}px "Orbitron", sans-serif`;
  ctx.fillStyle = isHovered ? color : 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(option.icon, x, y);

  // Draw label with fade effect
  const opacity = (scale - 1) / 0.5;
  if (isHovered || opacity > 0) {
    ctx.font = '14px "Orbitron", sans-serif';
    ctx.fillStyle = isHovered ? 
      color : 
      `rgba(255, 255, 255, ${opacity})`;
    ctx.fillText(option.label, x, y + 30);
  }

  // Draw very subtle connection line when hovered
  if (isHovered) {
    ctx.beginPath();
    ctx.strokeStyle = `${color}50`;
    ctx.lineWidth = 1;
    ctx.moveTo(x, y);
    ctx.lineTo(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function isNavigationNodeHovered(
  x: number,
  y: number,
  nodeX: number,
  nodeY: number,
  hoverRadius: number = 30
): boolean {
  const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
  return distance < hoverRadius;
}