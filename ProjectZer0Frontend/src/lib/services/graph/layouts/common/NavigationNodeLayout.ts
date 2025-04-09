// src/lib/services/graph/layouts/common/NavigationNodeLayout.ts
import * as d3 from 'd3';
import type { EnhancedNode, EnhancedLink } from '../../../../types/graph/enhanced';
import { asD3Nodes, asD3Links } from '../../../../types/graph/enhanced';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../../constants/graph';

/**
 * Utility class for positioning and configuring navigation nodes
 * 
 * This class provides common functionality for handling navigation nodes
 * that can be reused across different layout strategies.
 */
export class NavigationNodeLayout {
    // Private static variable to track control-related nodes
    private static controlRelatedNodes = new Set<string>();

    /**
     * Position navigation nodes in a circle around the central node,
     * adjusting the distance based on central node size
     * 
     * @param nodes All nodes in the simulation
     * @param getNodeRadius Function to calculate node radius
     * @returns The radius used for the navigation circle
     */
    static positionNavigationNodes(
        nodes: EnhancedNode[], 
        getNodeRadius: (node: EnhancedNode) => number
    ): number {
        // Clear control-related nodes set before positioning
        this.controlRelatedNodes.clear();

        // Find central node
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (!centralNode) {
            console.warn('[NavigationNodeLayout] No central node found, cannot position navigation nodes');
            return 0;
        }
        
        // Get navigation nodes
        const navNodes = nodes.filter(n => n.type === 'navigation');
        if (navNodes.length === 0) {
            console.debug('[NavigationNodeLayout] No navigation nodes to position');
            return 0;
        }
        
        // Set central node position at origin
        centralNode.x = 0;
        centralNode.y = 0;
        centralNode.fx = 0;
        centralNode.fy = 0;
        
        // Calculate ring radius based on central node size
        const centralRadius = getNodeRadius(centralNode);
        
        // Determine if central node is in preview or detail mode
        const isPreview = centralNode.mode === 'preview';
        
        // Determine if this is a control node by checking both type and data
        // In statement-network view, the central node is a dashboard type with sub="controls"
        const isControlNode = centralNode.type === 'dashboard' && 
            centralNode.data && 
            typeof centralNode.data === 'object' && 
            'sub' in centralNode.data && 
            centralNode.data.sub === 'controls';
            
        console.debug('[NavigationNodeLayout] Analyzing central node:', {
            id: centralNode.id,
            type: centralNode.type,
            data: centralNode.data && typeof centralNode.data === 'object' ? 
                'sub' in centralNode.data ? centralNode.data.sub : 'no sub property' : 
                'not an object',
            isControlNode: isControlNode,
            mode: centralNode.mode,
            isPreview: isPreview,
            radius: centralRadius
        });
        
        // Use the appropriate distance constant based on central node type and mode
        let navigationDistance;
        if (isControlNode) {
            // Use control-specific distances for the smaller control node
            navigationDistance = isPreview
                ? COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.CONTROL.PREVIEW_MODE
                : COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.CONTROL.DETAIL_MODE;
                
            console.debug('[NavigationNodeLayout] Using CONTROL-specific distances:', {
                distanceValue: navigationDistance,
                previewMode: isPreview ? 'true (using PREVIEW distance)' : 'false (using DETAIL distance)',
                detailValue: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.CONTROL.DETAIL_MODE,
                previewValue: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.CONTROL.PREVIEW_MODE
            });
        } else {
            // Use standard distances for other node types (word, etc.)
            navigationDistance = isPreview
                ? COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.PREVIEW_MODE
                : COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.DETAIL_MODE;
                
            console.debug('[NavigationNodeLayout] Using standard distances:', {
                distanceValue: navigationDistance,
                previewMode: isPreview ? 'true (using PREVIEW distance)' : 'false (using DETAIL distance)',
                detailValue: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.DETAIL_MODE,
                previewValue: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.PREVIEW_MODE
            });
        }
        
        // Calculate final distance from center (central node radius + constant distance)
        // For control nodes, use a different approach based on mode
        let nodeDistanceFromCenter;
        
        if (isControlNode) {
            if (isPreview) {
                // For preview mode control nodes, use a tighter fixed distance from the constants
                nodeDistanceFromCenter = COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2 + 
                                        COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.FIXED_DISTANCE.PREVIEW_MODE;
            } else {
                // For detail mode control nodes, use the fixed distance from constants
                nodeDistanceFromCenter = COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 + 
                                        COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.FIXED_DISTANCE.DETAIL_MODE;
            }
            console.debug('[NavigationNodeLayout] Control node distance:', {
                mode: isPreview ? 'preview' : 'detail',
                radius: centralRadius,
                addedDistance: isPreview ? 
                    COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.FIXED_DISTANCE.PREVIEW_MODE : 
                    COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.FIXED_DISTANCE.DETAIL_MODE,
                finalDistance: nodeDistanceFromCenter
            });
        } else {
            // Standard calculation for other node types
            nodeDistanceFromCenter = centralRadius + navigationDistance;
        }
        
        console.debug('[NavigationNodeLayout] Navigation ring calculation:', {
            centralNodeType: centralNode.type,
            centralNodeMode: centralNode.mode,
            isControlNode,
            centralRadius,
            navigationDistance,
            isPreview,
            finalDistance: nodeDistanceFromCenter,
            distanceFromPerimeter: navigationDistance,
            totalDistanceFromCenter: nodeDistanceFromCenter,
            distanceValues: {
                standard: {
                    detail: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.DETAIL_MODE,
                    preview: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.PREVIEW_MODE
                },
                control: {
                    detail: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.CONTROL.DETAIL_MODE,
                    preview: COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.CONTROL.PREVIEW_MODE
                }
            }
        });

        // Position navigation nodes in a circle
        navNodes.forEach((node, index) => {
            const count = navNodes.length;
            // Use exact angle calculation to ensure precise 12 o'clock positioning
            const angle = Math.PI * (-0.5 + (2 * index) / count);
            
            // Calculate position
            const posX = Math.cos(angle) * nodeDistanceFromCenter;
            const posY = Math.sin(angle) * nodeDistanceFromCenter;
            
            // Set both position and fixed position
            node.x = posX;
            node.y = posY;
            node.fx = posX; // CRITICAL: Fix X position
            node.fy = posY; // CRITICAL: Fix Y position
            
            // Clear any velocities
            node.vx = 0;
            node.vy = 0;
            
            // Store angle and radius in metadata for connection calculations
            if (node.metadata) {
                node.metadata.angle = angle;
                node.metadata.radius = nodeDistanceFromCenter; // Store the actual distance used
                node.metadata.centralRadius = centralRadius;
            }
            
            // Track which nodes are control-related in our Set
            if (isControlNode) {
                this.controlRelatedNodes.add(node.id);
            }
            
            // Extra verification for bottom nodes (positive Y values)
            if (posY > 0) {
                // Bottom node - ensure fixed position is exactly set
                node.x = posX;
                node.y = posY;
                
                // Log bottom node positions for extra debugging
                console.debug('[NavigationNodeLayout] Bottom node position:', {
                    id: node.id,
                    index,
                    angle: angle * (180 / Math.PI), // degrees for readability
                    distance: nodeDistanceFromCenter,
                    position: { x: posX, y: posY },
                    fixedPosition: { fx: posX, fy: posY }
                });
            }
            
            console.debug('[NavigationNodeLayout] Fixed navigation node position:', {
                id: node.id,
                index,
                angle: angle * (180 / Math.PI), // degrees for readability
                distance: nodeDistanceFromCenter,
                position: { x: posX, y: posY },
                fixedPosition: { fx: posX, fy: posY }
            });
        });
        
        return nodeDistanceFromCenter;
    }

    /**
     * Check if a node is control-related (connected to a control node)
     */
    static isControlRelated(nodeId: string): boolean {
        return this.controlRelatedNodes.has(nodeId);
    }

    /**
     * Ensure navigation nodes maintain their fixed positions
     * Call this after any interaction or update
     */
    static enforceFixedPositions(nodes: EnhancedNode[]): void {
        nodes.forEach(node => {
            if (node.fixed || node.group === 'central') {
                // Central nodes always at origin
                node.x = 0;
                node.y = 0;
                node.fx = 0;
                node.fy = 0;
                // Zero velocity
                node.vx = 0;
                node.vy = 0;
            } else if (node.type === 'navigation') {
                // Navigation nodes fixed at their assigned positions
                if (node.fx !== null && node.fx !== undefined) {
                    node.x = node.fx;
                }
                if (node.fy !== null && node.fy !== undefined) {
                    node.y = node.fy;
                }
                
                // Additional enforcement for nodes in the bottom half
                // These seem particularly prone to movement
                if ((node.y || 0) > 0) {
                    // Force exact position
                    if (node.fx !== null && node.fx !== undefined) {
                        node.x = node.fx;
                    }
                    if (node.fy !== null && node.fy !== undefined) {
                        node.y = node.fy;
                    }
                }
                
                // Zero velocity
                node.vx = 0;
                node.vy = 0;
            }
        });
    }

    /**
     * Completely remove all forces that could affect navigation nodes
     * This ensures they stay exactly where positioned
     */
    static configureNoForces(
        simulation: d3.Simulation<any, any>
    ): void {
        // Get all current forces from the simulation
        const sim: any = simulation;
        const currentForces = Object.keys(sim._forces || {});
        
        // Log current forces for debugging
        console.debug('[NavigationNodeLayout] Current forces before removal:', currentForces);
        
        // Expanded list of potential forces to remove
        const potentialForceNames = [
            // Standard D3 forces
            'charge', 'collision', 'link', 'center', 'x', 'y', 'manyBody', 
            
            // Custom navigation forces 
            'navigationRadial', 'navigationCharge', 'navigationCollision',
            
            // Central node forces
            'centralCharge', 'centralCollision',
            
            // Additional forces that might be added by different layouts
            'radial', 'positioning', 'custom', 'cluster',
            
            // All current forces (dynamic removal)
            ...currentForces
        ];
        
        // Remove all forces
        potentialForceNames.forEach(name => {
            this.safelyRemoveForce(simulation, name);
        });
        
        // Log forces after removal
        console.debug('[NavigationNodeLayout] Forces after removal:', 
            Object.keys(sim._forces || {}));
        
        // Extra check - if any forces remain, try to remove them
        const remainingForces = Object.keys(sim._forces || {});
        if (remainingForces.length > 0) {
            console.warn('[NavigationNodeLayout] Some forces still remain after removal:', remainingForces);
            remainingForces.forEach(name => {
                this.safelyRemoveForce(simulation, name);
            });
        }
        
        console.debug('[NavigationNodeLayout] Removed all navigation forces');
    }

    /**
     * Apply the specified transformation to ensure the force call works with TypeScript
     * This is a utility function to handle D3's quirky typing
     */
    static safelyRemoveForce(
        simulation: d3.Simulation<any, any>,
        forceName: string
    ): void {
        try {
            // Use explicit type casting to work around TypeScript errors
            const simAny = simulation as any;
            simAny.force(forceName, null);
        } catch (error) {
            console.error(`[NavigationNodeLayout] Error removing force ${forceName}:`, error);
        }
    }

    /**
     * Update navigation node positions when central node changes size
     * Call this when the central node mode changes
     */
    static updateNavigationPositions(
        nodes: EnhancedNode[],
        getNodeRadius: (node: EnhancedNode) => number
    ): void {
        console.debug('[NavigationNodeLayout] Updating navigation positions due to central node mode change');
        
        // Find central node to determine if it's a control node
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        const isControlNode = centralNode?.type === 'dashboard' && 
            centralNode.data && 
            typeof centralNode.data === 'object' && 
            'sub' in centralNode.data && 
            centralNode.data.sub === 'controls';
        
        const isPreview = centralNode?.mode === 'preview';
        
        console.debug('[NavigationNodeLayout] Central node for update:', {
            id: centralNode?.id,
            type: centralNode?.type,
            mode: centralNode?.mode,
            isControlNode,
            radius: centralNode ? getNodeRadius(centralNode) : 0
        });
        
        // Clear the control related nodes set - we'll rebuild it during positioning
        this.controlRelatedNodes.clear();
        
        // Reposition all navigation nodes based on the new central node size
        this.positionNavigationNodes(nodes, getNodeRadius);
        
        // Ensure positions are fixed
        this.enforceFixedPositions(nodes);
        
        // Force zero velocities for all nodes
        nodes.forEach(node => {
            if (node.type === 'navigation') {
                node.vx = 0;
                node.vy = 0;
            }
        });
    }

    /**
     * Calculate endpoint on the central node's perimeter for connection lines
     * @param navNodeAngle The angle of the navigation node relative to center
     * @param centralRadius The radius of the central node
     * @param nodeId The ID of the node to check if it's control-related
     * @returns Coordinates for the endpoint on the central node's perimeter
     */
    static calculateCentralNodeConnectionPoint(
        navNodeAngle: number,
        centralRadius: number,
        nodeId: string
    ): { x: number, y: number } {
        // Check if this node is control-related
        const isControlRelated = this.isControlRelated(nodeId);
        
        // Apply empirical scaling factor to radius - with additional reduction for control nodes
        const effectiveRadius = isControlRelated 
            ? centralRadius / 18  // Extra reduction for control nodes (smaller endpoint)
            : centralRadius / 9;  // Standard reduction for other nodes
        
        // Calculate point on perimeter based on angle
        const x = Math.cos(navNodeAngle) * effectiveRadius;
        const y = Math.sin(navNodeAngle) * effectiveRadius;
        
        return { x, y };
    }
    
    /**
     * Calculate the connection point from a navigation node to the dashboard perimeter
     * @param nodePosition The position of the navigation node
     * @param dashboardRadius The radius of the dashboard node
     * @param nodeId The ID of the node to check if it's control-related
     * @returns Vector from the navigation node to the point on the dashboard perimeter
     */
    static calculateConnectionVector(
        nodePosition: { x: number, y: number },
        dashboardRadius: number,
        nodeId: string
    ): { x: number, y: number } {
        // Vector from node to center (0,0)
        const vectorX = -nodePosition.x;
        const vectorY = -nodePosition.y;
        
        // Length of vector (distance to center)
        const distance = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
        
        if (distance === 0) return { x: 0, y: 0 };
        
        // Unit vector components (normalized direction toward center)
        const unitX = vectorX / distance;
        const unitY = vectorY / distance;
        
        // Check if this node is control-related
        const isControlRelated = this.isControlRelated(nodeId);
        
        // Use empirical scaling factor for dashboard radius - stronger for control nodes
        const effectiveRadius = isControlRelated
            ? dashboardRadius / 18  // Extra reduction for control node connections
            : dashboardRadius / 9;  // Standard reduction
        
        // Calculate point on perimeter in local coordinates
        return {
            x: unitX * effectiveRadius,
            y: unitY * effectiveRadius
        };
    }
}