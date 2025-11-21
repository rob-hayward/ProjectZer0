// src/lib/services/graph/universal/NavigationRingPositioning.ts
// Calculate fixed ring positions for navigation nodes around central control node

import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
import type { NodeMode } from '$lib/types/graph/enhanced';

export interface NavigationPosition {
    x: number;
    y: number;
    angle: number;
}

/**
 * Calculate ring radius based on control node mode
 * The ring radius is measured from the center (0,0) to the center of each navigation node
 */
function calculateRingRadius(controlNodeMode: NodeMode): number {
    // Control node radius (half of diameter)
    const controlRadius = controlNodeMode === 'detail'
        ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2  // 225px
        : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2; // 50px
    
    // Navigation node radius
    const navRadius = COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2; // 40px
    
    // Gap distance between control node edge and navigation node edge
    const gapDistance = controlNodeMode === 'detail'
        ? COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.FIXED_DISTANCE.DETAIL_MODE  // 70px
        : COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.FIXED_DISTANCE.PREVIEW_MODE; // 50px
    
    // Ring radius = control radius + gap + navigation radius
    const ringRadius = controlRadius + gapDistance + navRadius;
    
    console.log('[NavigationRingPositioning] Ring radius calculation:', {
        controlNodeMode,
        controlRadius,
        navRadius,
        gapDistance,
        ringRadius
    });
    
    return ringRadius;
}

/**
 * Calculate positions for navigation nodes in a ring around the central control node
 * 
 * @param navigationNodeCount - Number of navigation nodes to position
 * @param controlNodeMode - Mode of the central control node (detail or preview)
 * @param startAngle - Starting angle in radians (default: -Math.PI/2 for top position)
 * @returns Array of positions with x, y coordinates and angle
 */
export function calculateNavigationRingPositions(
    navigationNodeCount: number,
    controlNodeMode: NodeMode = 'preview',
    startAngle: number = -Math.PI / 2 // Start at top (12 o'clock)
): NavigationPosition[] {
    if (navigationNodeCount <= 0) {
        return [];
    }
    
    const ringRadius = calculateRingRadius(controlNodeMode);
    const angleStep = (2 * Math.PI) / navigationNodeCount;
    
    const positions: NavigationPosition[] = [];
    
    for (let i = 0; i < navigationNodeCount; i++) {
        const angle = startAngle + (i * angleStep);
        const x = ringRadius * Math.cos(angle);
        const y = ringRadius * Math.sin(angle);
        
        positions.push({ x, y, angle });
    }
    
    console.log('[NavigationRingPositioning] Calculated positions:', {
        count: navigationNodeCount,
        controlNodeMode,
        ringRadius,
        positions: positions.map(p => ({
            x: p.x.toFixed(1),
            y: p.y.toFixed(1),
            angleDeg: ((p.angle * 180 / Math.PI) % 360).toFixed(1)
        }))
    });
    
    return positions;
}

/**
 * Calculate position for a single navigation node by index
 * Useful for updating individual nodes
 */
export function calculateNavigationNodePosition(
    nodeIndex: number,
    totalNodes: number,
    controlNodeMode: NodeMode = 'preview',
    startAngle: number = -Math.PI / 2
): NavigationPosition {
    const positions = calculateNavigationRingPositions(totalNodes, controlNodeMode, startAngle);
    return positions[nodeIndex] || { x: 0, y: 0, angle: 0 };
}

/**
 * Get the ring radius for a given control node mode
 * Useful for other calculations that need to know the ring size
 */
export function getNavigationRingRadius(controlNodeMode: NodeMode): number {
    return calculateRingRadius(controlNodeMode);
}