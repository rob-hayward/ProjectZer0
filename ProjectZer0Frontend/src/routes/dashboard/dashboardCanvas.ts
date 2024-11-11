import type { UserProfile } from '$lib/types/user';
import type { UserActivity } from '$lib/services/userActivity';
import { drawGlow } from '$lib/utils/canvasAnimations';

let time = 0;

interface TextConfig {
  font: string;
  color: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
}

// Text styling configurations
const TEXT_STYLES = {
  logo: {
    font: '26px "Orbitron", sans-serif',
    color: 'white',
    align: 'center' as const,
    baseline: 'middle' as const
  },
  label: {
    font: '14px "Orbitron", sans-serif',
    color: 'rgba(255, 255, 255, 0.7)',
    align: 'left' as const,
    baseline: 'middle' as const
  },
  value: {
    font: '14px "Orbitron", sans-serif',
    color: 'white',
    align: 'left' as const,
    baseline: 'middle' as const
  }
};

// Constants
const CIRCLE_RADIUS = 285;
const CONTENT_WIDTH = 350;
const METRICS_SPACING = {
  labelX: 0,
  equalsX: 140,
  valueX: 170
};

function setTextStyle(ctx: CanvasRenderingContext2D, style: TextConfig) {
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align;
  ctx.textBaseline = style.baseline;
}

function drawCircle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
  // Draw outer glow
  drawGlow(ctx, centerX, centerY, {
    color: '#4A90E2',
    radius: CIRCLE_RADIUS + 10,
    intensity: 0.1
  });

  // Draw main circle
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, CIRCLE_RADIUS, 0, 2 * Math.PI);
  ctx.stroke();

  // Draw pulsing inner circle
  const pulseRadius = CIRCLE_RADIUS - 5 + Math.sin(time * 2) * 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
  ctx.stroke();
}

function drawWrappedText(
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

  for (let word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, y);
      line = word + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y;
}

function drawActivityMetrics(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  activity: UserActivity
): number {
  let y = startY;

  // Activity stats header
  setTextStyle(ctx, TEXT_STYLES.label);
  ctx.fillText('activity stats:', startX, y);
  y += 25;

  // Define metrics with fixed positions
  const metrics = [
    { label: 'nodes created', value: activity.nodesCreated },
    { label: 'votes cast', value: activity.votesCast },
    { label: 'comments made', value: activity.commentsMade }
  ];

  metrics.forEach(metric => {
    setTextStyle(ctx, TEXT_STYLES.value);
    ctx.fillText(metric.label, startX + METRICS_SPACING.labelX, y);
    ctx.fillText('=', startX + METRICS_SPACING.equalsX, y);
    ctx.fillText(metric.value.toString(), startX + METRICS_SPACING.valueX, y);
    y += 25;
  });

  return y;
}

export function drawUserNode(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  node: UserProfile,
  activity?: UserActivity
) {
  time += 0.01;

  // Draw the base circle and its effects
  drawCircle(ctx, centerX, centerY);

  const startX = centerX - (CONTENT_WIDTH / 2);
  let y = centerY - 180;

  // Draw ProjectZer0 logo
  setTextStyle(ctx, TEXT_STYLES.logo);
  ctx.fillText('ProjectZer0', centerX, y);
  y += 40;

  // Draw name section
  setTextStyle(ctx, TEXT_STYLES.label);
  ctx.fillText('name:', startX, y);
  y += 20;
  
  setTextStyle(ctx, TEXT_STYLES.value);
  const name = node.preferred_username || node.name || node.nickname || 'User';
  ctx.fillText(name, startX, y);
  y += 35;

  // Draw mission statement section
  setTextStyle(ctx, TEXT_STYLES.label);
  ctx.fillText('mission statement:', startX, y);
  y += 20;

  setTextStyle(ctx, TEXT_STYLES.value);
  const mission = node.mission_statement || "no mission statement set.";
  y = drawWrappedText(ctx, mission, startX, y, CONTENT_WIDTH, 20);
  y += 35;

  // Draw activity metrics if available
  if (activity) {
    y = drawActivityMetrics(ctx, startX, y, activity);
  }
}