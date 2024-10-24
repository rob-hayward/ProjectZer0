import type { UserProfile } from '$lib/types/user';
import type { UserActivity } from '$lib/services/userActivity';
import { drawGlow, drawCursor } from '$lib/utils/canvasAnimations';
import { NetworkBackground } from '$lib/components/graphElements/backgrounds/ZoomBackground';

let networkBg: NetworkBackground | null = null;
let time = 0;

export function drawDynamicBackground(
  ctx: CanvasRenderingContext2D,
  mx: number,
  my: number
) {
  time += 0.01;

  if (!networkBg) {
    networkBg = new NetworkBackground(15, ctx.canvas.width, ctx.canvas.height);
  }

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

  networkBg.update(ctx.canvas.width, ctx.canvas.height);
  networkBg.draw(ctx);

  drawCursor(ctx, mx, my);
}

export function drawUserNode(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  node: UserProfile,
  activity?: UserActivity
) {
  const circleRadius = 285; // Increased radius

  // Draw outer glow
  drawGlow(ctx, centerX, centerY, {
    color: '#4A90E2',
    radius: circleRadius + 10,
    intensity: 0.1
  });

  // Draw the circle
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
  ctx.stroke();

  // Draw pulsing inner circle
  const pulseRadius = circleRadius - 5 + Math.sin(time * 2) * 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
  ctx.stroke();

  // Center all content within a wider column
  const contentWidth = 350; // Increased width
  const startX = centerX - (contentWidth / 2);
  let y = centerY - 180; // Start higher to accommodate content

  // Draw ProjectZer0 logo
  ctx.font = '26px "Orbitron", sans-serif'; // Smaller logo font
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ProjectZer0', centerX, y);

  // Set consistent text styling
  ctx.font = '14px "Orbitron", sans-serif'; // Slightly smaller content font
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Move down for user info section
  y += 40; // Reduced spacing

  // Draw name label and value on separate lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('name:', startX, y);
  y += 20; // Reduced spacing
  ctx.fillStyle = 'white';
  const name = node.preferred_username || node.name || node.nickname || 'User';
  ctx.fillText(name, startX, y);

  // Mission statement section
  y += 35; // Reduced spacing
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('mission statement:', startX, y);
  
  // Handle mission statement wrapping
  y += 20; // Reduced spacing
  const mission = node.mission_statement || "no mission statement set.";
  const words = mission.split(' ');
  let line = '';

  ctx.fillStyle = 'white';
  
  for (let word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > contentWidth && line !== '') {
      ctx.fillText(line, startX, y);
      line = word + ' ';
      y += 20; // Reduced line height
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, startX, y);

  // Activity metrics section
  if (activity) {
    y += 35; // Reduced spacing

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('activity stats:', startX, y);
    
    y += 25; // Reduced spacing

    // Fixed positions for alignment
    const labelX = startX;
    const equalsX = startX + 140;
    const valueX = equalsX + 30;

    // Draw metrics with exact positioning
    const metrics = [
      { label: 'nodes created', value: activity.nodesCreated },
      { label: 'votes cast', value: activity.votesCast },
      { label: 'comments made', value: activity.commentsMade }
    ];

    metrics.forEach(metric => {
      // Label in full white
      ctx.fillStyle = 'white';
      ctx.fillText(metric.label, labelX, y);
      
      // Equals sign in white
      ctx.fillStyle = 'white';
      ctx.fillText('=', equalsX, y);
      
      // Value in white
      ctx.fillStyle = 'white';
      ctx.fillText(metric.value.toString(), valueX, y);
      
      y += 25; // Reduced spacing
    });
  }
}

function canvasContext(): CanvasRenderingContext2D {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('Canvas not found');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  return ctx;
}