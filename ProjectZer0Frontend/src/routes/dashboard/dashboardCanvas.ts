// routes/dashboard/dashboardCanvas.ts
import type { UserProfile } from '$lib/types/user';

export function drawDynamicBackground(ctx: CanvasRenderingContext2D, mx: number, my: number) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath();
  ctx.arc(mx, my, 100, 0, 2 * Math.PI);
  ctx.fill();
}

export function drawUserNode(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, node: UserProfile) {
  // Draw the existing circle
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 150, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Draw "P0" at the top
  ctx.font = '30px "Orbitron", sans-serif';  // Larger font size for P0
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ProjectZer0', centerX, centerY - 70);  // Positioned above the user name
  
  // Draw user name
  ctx.font = '16px "Roboto", sans-serif';
  const name = node.preferred_username || node.name || node.nickname || 'User';
  ctx.fillText(name.toLowerCase(), centerX, centerY - 20);
  
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