import type { UserProfile } from '$lib/types/user';
import { drawGlow, NetworkBackground, drawCursor } from '$lib/utils/canvasAnimations';

let networkBg: NetworkBackground | null = null;
let time = 0;

export function drawDynamicBackground(
  ctx: CanvasRenderingContext2D,
  mx: number,
  my: number
) {
  time += 0.01;

  // Initialize network background if needed
  if (!networkBg) {
    networkBg = new NetworkBackground(15, ctx.canvas.width, ctx.canvas.height);
  }

  // Clear canvas with a very subtle gradient
  const gradient = ctx.createRadialGradient(
    ctx.canvas.width / 2,
    ctx.canvas.height / 2,
    0,
    ctx.canvas.width / 2,
    ctx.canvas.height / 2,
    ctx.canvas.width / 2
  );
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Update and draw network background
  networkBg.update(ctx.canvas.width, ctx.canvas.height);
  networkBg.draw(ctx);

  // Draw cursor
  drawCursor(ctx, mx, my);
}

export function drawUserNode(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  node: UserProfile
) {
  // Draw outer glow
  drawGlow(ctx, centerX, centerY, {
    color: '#4A90E2',
    radius: 160,
    intensity: 0.1
  });

  // Draw the circle
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 150, 0, 2 * Math.PI);
  ctx.stroke();

  // Draw pulsing inner circle
  const pulseRadius = 145 + Math.sin(time * 2) * 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Draw ProjectZer0 text
  ctx.font = '30px "Orbitron", sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ProjectZer0', centerX, centerY - 70);
  
  // Draw user name
  ctx.font = '16px "Roboto", sans-serif';
  const name = node.preferred_username || node.name || node.nickname || 'User';
  ctx.fillText(name, centerX, centerY - 20);
  
  // Draw mission statement
  const mission = node.mission_statement || "no mission statement set.";
  const words = mission.split(' ');
  let line = '';
  let y = centerY + 20;
  
  for (let word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 250 && line !== '') {
      ctx.fillText(line, centerX, y);
      line = word + ' ';
      y += 25;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, centerX, y);
}