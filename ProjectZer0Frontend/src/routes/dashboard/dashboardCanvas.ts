import type { UserProfile } from '$lib/types/user';
import type { UserActivity } from '$lib/services/userActivity';
import { BaseZoomedCanvas, TEXT_STYLES } from '$lib/components/graphElements/layouts/baseZoomedCanvas';

// Constants
const CONTENT_WIDTH = 350;
const METRICS_SPACING = {
  labelX: 0,
  equalsX: 140,
  valueX: 170
};

function drawActivityMetrics(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  activity: UserActivity
): number {
  let y = startY;

  // Activity stats header
  BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
  ctx.fillText('activity stats:', startX, y);
  y += 25;

  // Define metrics with fixed positions
  const metrics = [
    { label: 'nodes created', value: activity.nodesCreated },
    { label: 'votes cast', value: activity.votesCast },
    { label: 'comments made', value: activity.commentsMade }
  ];

  metrics.forEach(metric => {
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
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
  const startX = centerX - (CONTENT_WIDTH / 2);
  let y = centerY - 180;

  // Draw ProjectZer0 logo
  BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.logo);
  ctx.fillText('ProjectZer0', centerX, y);
  y += 40;

  // Draw name section
  BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
  ctx.fillText('name:', startX, y);
  y += 20;
  
  BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
  const name = node.preferred_username || node.name || node.nickname || 'User';
  ctx.fillText(name, startX, y);
  y += 35;

  // Draw mission statement section
  BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
  ctx.fillText('mission statement:', startX, y);
  y += 20;

  BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
  const mission = node.mission_statement || "no mission statement set.";
  y = BaseZoomedCanvas.drawWrappedText(ctx, mission, startX, y, CONTENT_WIDTH, 20);
  y += 35;

  // Draw activity metrics if available
  if (activity) {
    y = drawActivityMetrics(ctx, startX, y, activity);
  }
}