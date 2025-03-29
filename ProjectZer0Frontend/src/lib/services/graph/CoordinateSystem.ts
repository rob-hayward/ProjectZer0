// src/lib/services/graph/CoordinateSystem.ts
import { writable, derived, get } from 'svelte/store';
import type { ZoomTransform } from 'd3';
import * as d3 from 'd3';
import { COORDINATE_SPACE } from '$lib/constants/graph';
import type { NodeMode, ViewType } from '$lib/types/graph/enhanced';

/**
 * Service that handles coordinate transformations between
 * logical coordinates (D3 space) and screen coordinates (SVG space).
 * 
 * This service is the single source of truth for coordinate transformations
 * and ensures consistent handling of positions across the application.
 */
export class CoordinateSystem {
    // Empirically determined scaling factor for node radius calculations
    private static RADIUS_SCALE_FACTOR = 1/9;
    
    // Current transform store (updated during zooming)
    private transformStore = writable<ZoomTransform>(
        d3.zoomIdentity.scale(COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM)
    );
    
    // Public readable store for components that need the transform
    public readonly transform = { subscribe: this.transformStore.subscribe };
    
    /**
     * Update the transform when zoom changes
     */
    public updateTransform(newTransform: ZoomTransform): void {
        this.transformStore.set(newTransform);
    }
    
    /**
     * Get the current transform
     */
    public getCurrentTransform(): ZoomTransform {
        return get(this.transformStore);
    }
    
    /**
     * Convert world coordinates (D3 space) to view coordinates (SVG space)
     */
    public worldToView(x: number, y: number): { x: number, y: number } {
        const transform = get(this.transformStore);
        return {
            x: transform.applyX(x),
            y: transform.applyY(y)
        };
    }
    
    /**
     * Convert view coordinates (SVG space) to world coordinates (D3 space)
     */
    public viewToWorld(x: number, y: number): { x: number, y: number } {
        const transform = get(this.transformStore);
        return {
            x: transform.invertX(x),
            y: transform.invertY(y)
        };
    }
    
    /**
     * Convert a radius/distance in world coordinates to view coordinates
     */
    public worldToViewSize(size: number): number {
        const transform = get(this.transformStore);
        return size * transform.k; // k is the scale factor
    }
    
    /**
     * Convert a radius/distance in view coordinates to world coordinates
     */
    public viewToWorldSize(size: number): number {
        const transform = get(this.transformStore);
        return size / transform.k;
    }
    
    /**
     * Create SVG transform string from world coordinates
     * This ensures transforms are consistently applied across the system
     */
    public createSVGTransform(x: number, y: number, scale: number = 1): string {
        return `translate(${x}, ${y})${scale !== 1 ? ` scale(${scale})` : ''}`;
    }
    
    /**
     * Calculate point on node perimeter along a line to another node
     */
    public calculatePerimeterPoint(
        fromX: number, 
        fromY: number, 
        toX: number, 
        toY: number, 
        viewRadius: number
    ): { x: number, y: number } {
        // Vector from source to target
        const dx = toX - fromX;
        const dy = toY - fromY;
        
        // Distance between points
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return { x: toX, y: toY };
        
        // Unit vector
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Apply empirical scaling factor to radius
        const effectiveRadius = viewRadius * CoordinateSystem.RADIUS_SCALE_FACTOR;
        
        // Calculate point on perimeter
        return {
            x: toX - unitX * effectiveRadius,
            y: toY - unitY * effectiveRadius
        };
    }
    
    /**
     * Calculate connection point from a node to the dashboard perimeter
     */
    public calculateDashboardConnectionPoint(
        nodePosition: { x: number, y: number },
        dashboardViewRadius: number
    ): { x: number, y: number } {
        // Vector from node to center (0,0)
        const dx = -nodePosition.x;
        const dy = -nodePosition.y;
        
        // Distance to center
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return { x: 0, y: 0 };
        
        // Unit vector toward center
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Apply empirical scaling factor to radius
        const effectiveRadius = dashboardViewRadius * CoordinateSystem.RADIUS_SCALE_FACTOR;
        
        // Calculate endpoint in node's local coordinates
        return {
            x: unitX * effectiveRadius,
            y: unitY * effectiveRadius
        };
    }

    /**
     * Calculate the connection endpoint for a navigation node based on its position
     * and the inferred central node mode.
     */
    public calculateNavigationConnectionEndpoint(
        nodePosition: { x: number, y: number },
        viewType: ViewType
    ): { x: number, y: number } {
        // Vector from navigation node to center (0,0)
        const vectorX = -nodePosition.x;
        const vectorY = -nodePosition.y;
        
        // Distance between points
        const distance = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
        
        if (distance === 0) return { x: 0, y: 0 };
        
        // Unit vector toward center
        const unitX = vectorX / distance;
        const unitY = vectorY / distance;
        
        // Infer central node mode based on navigation node distance
        let centralNodeMode: NodeMode = 'detail';
        
        // For word view, determine mode based on distance
        if (viewType === 'word') {
            const ourDistance = Math.sqrt(nodePosition.x * nodePosition.x + nodePosition.y * nodePosition.y);
            const detailModeDistance = COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2 + 
                                    COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.DETAIL_MODE;
            const previewModeDistance = COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2 + 
                                    COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.PREVIEW_MODE;
                                
            if (Math.abs(ourDistance - previewModeDistance) < Math.abs(ourDistance - detailModeDistance)) {
                centralNodeMode = 'preview';
            }
        }
        // For statement view, determine mode based on distance
        else if (viewType === 'statement') {
            const ourDistance = Math.sqrt(nodePosition.x * nodePosition.x + nodePosition.y * nodePosition.y);
            const detailModeDistance = COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2 + 
                                    COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.DETAIL_MODE;
            const previewModeDistance = COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2 + 
                                    COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.PREVIEW_MODE;
                                
            if (Math.abs(ourDistance - previewModeDistance) < Math.abs(ourDistance - detailModeDistance)) {
                centralNodeMode = 'preview';
            }
        }
        
        // Get appropriate radius based on view type and inferred mode
        let centralNodeRadius;
        
        // Explicit mapping for each view type and mode
        if (viewType === 'word') {
            if (centralNodeMode === 'preview') {
                centralNodeRadius = COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
            } else {
                centralNodeRadius = COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2;
            }
        } 
        else if (viewType === 'statement') {
            if (centralNodeMode === 'preview') {
                centralNodeRadius = COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2;
            } else {
                centralNodeRadius = COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2;
            }
        }
        else {
            centralNodeRadius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
        }
        
        // Get appropriate scaling factor - use specific factors for statement nodes
        let scalingFactor;
        
        if (viewType === 'statement') {
            // Use different scaling factors for statement nodes to fix link penetration
            if (centralNodeMode === 'preview') {
                // Higher factor for preview mode to make links shorter
                scalingFactor = 1/3.25; 
            } else {
                // Smaller factor for detail mode
                scalingFactor = 1/4.35;  
            }
        } else {
            // Default factors for other node types
            scalingFactor = centralNodeMode === 'preview'
                ? COORDINATE_SPACE.LAYOUT.NAVIGATION.CONNECTION_SCALING.PREVIEW_MODE
                : COORDINATE_SPACE.LAYOUT.NAVIGATION.CONNECTION_SCALING.DETAIL_MODE;
        }
        
        // Calculate effective radius
        const effectiveRadius = centralNodeRadius * scalingFactor;
        
        return {
            x: unitX * effectiveRadius,
            y: unitY * effectiveRadius
        };
    }
}

// Singleton instance for app-wide use
export const coordinateSystem = new CoordinateSystem();