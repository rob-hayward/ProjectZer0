// src/lib/components/graphElements/nodes/navigationNode/NavigationNode.ts
import type { NavigationOption } from '$lib/types/navigation';

export function drawNavigationNode(
  ctx: CanvasRenderingContext2D,
  option: NavigationOption,
  x: number,
  y: number,
  scale: number = 1,
  isHovered: boolean = false
) {
  // Calculate opacity based on scale
  const opacity = (scale - 1) / 0.5;

  // Draw the icon with scaling
  ctx.font = `${24 * scale}px "Roboto", sans-serif`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(option.icon, x, y);

  // Draw label with fade effect
  if (isHovered || opacity > 0) {
    ctx.font = '14px "Roboto", sans-serif';
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.fillText(option.label, x, y + 30);
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