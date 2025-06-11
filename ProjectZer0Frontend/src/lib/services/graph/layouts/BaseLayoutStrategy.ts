// ProjectZer0Frontend/src/lib/services/graph/layouts/BaseLayoutStrategy.ts
import * as d3 from 'd3';
import type { EnhancedNode, EnhancedLink } from '../../../types/graph/enhanced';
import { asD3Nodes, asD3Links } from '../../../types/graph/enhanced';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink
} from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE } from '../../../constants/graph';
import { coordinateSystem } from '../CoordinateSystem';

/**
 * Base class for all layout strategies
 * 
 * Layouts are responsible for:
 * 1. Setting up initial node positions
 * 2. Configuring forces for the simulation
 * 3. Handling node state changes (preview/detail)
 */
export abstract class BaseLayoutStrategy {
    protected simulation: d3.Simulation<any, any>;
    protected width: number;
    protected height: number;
    protected viewType: ViewType;
    protected strategyId: string;

    /**
     * Create a new layout strategy
     */
    constructor(width: number, height: number, viewType: ViewType) {
        this.strategyId = Math.random().toString(36).substr(2, 9);
        this.width = width;
        this.height = height;
        this.viewType = viewType;
        this.simulation = this.initializeBaseSimulation();
    }

    /**
     * Initialize basic simulation with shared parameters
     */
    protected initializeBaseSimulation(): d3.Simulation<any, any> {
        const simulation = d3.forceSimulation()
            .velocityDecay(COORDINATE_SPACE.ANIMATION.VELOCITY_DECAY)
            .alphaDecay(COORDINATE_SPACE.ANIMATION.ALPHA_DECAY)
            .alphaMin(COORDINATE_SPACE.ANIMATION.ALPHA_MIN);

        simulation.on('tick', () => {
            // Ensure fixed nodes stay fixed during simulation
            const simNodes = simulation.nodes() as unknown as EnhancedNode[];
            simNodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    // Aggressively enforce central node position
                    node.x = 0;
                    node.y = 0;
                    node.fx = 0;
                    node.fy = 0;
                    node.vx = 0;
                    node.vy = 0;
                } else if (node.type === 'navigation') {
                    // Ensure navigation nodes stay fixed
                    if (node.fx !== null && node.fx !== undefined) {
                        node.x = node.fx;
                    }
                    if (node.fy !== null && node.fy !== undefined) {
                        node.y = node.fy;
                    }
                    node.vx = 0;
                    node.vy = 0;
                }
                
                // For detail mode nodes, maintain fixed positions if set
                if (node.mode === 'detail' && node.fx !== undefined && node.fy !== undefined) {
                    node.x = node.fx;
                    node.y = node.fy;
                    node.vx = 0;
                    node.vy = 0;
                }
            });
        });

        return simulation;
    }

    /**
     * Set simulation for this layout
     */
    public setSimulation(simulation: d3.Simulation<any, any>): void {
        this.simulation = simulation;
    }

    /**
     * Initialize node positions based on layout strategy
     * Each strategy will implement this differently
     */
    public abstract initializeNodePositions(nodes: EnhancedNode[]): void;

    /**
     * Configure forces for this layout
     * Each strategy will implement this differently
     */
    public abstract configureForces(): void;

    /**
     * Handle node state changes (e.g., preview to detail)
     * Provides a base implementation, derived classes may override
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        // Basic implementation - derived classes may override
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            return;
        }
        
        // Stop simulation temporarily during state change
        this.simulation.alpha(0).alphaTarget(0);
        
        // Update node mode
        node.mode = mode;
        node.expanded = mode === 'detail';
        node.metadata.isDetail = mode === 'detail';
        
        // Update node radius based on new mode
        node.radius = this.getNodeRadius(node);
        
        // For central nodes, ensure position is exactly at center
        if (node.group === 'central' || node.fixed) {
            // Central nodes always at origin with VERY explicit position setting
            node.x = 0;
            node.y = 0;
            node.fx = 0;
            node.fy = 0;
            node.vx = 0;
            node.vy = 0;
        }
        
        // For detail mode nodes, fix position - apply this even in base strategy
        if (mode === 'detail' && !node.fixed && node.group !== 'central') {
            // Fix position at current location
            node.fx = node.x;
            node.fy = node.y;
        } else if (mode === 'preview' && !node.fixed && node.group !== 'central') {
            // Release fixed position for preview mode
            node.fx = undefined;
            node.fy = undefined;
        }
        
        // Always restart with very low alpha to minimize movement
        this.simulation.alpha(0.05).restart();
    }

    /**
     * Handle node visibility changes
     * Provides a base implementation, derived classes may override
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        // Basic implementation - derived classes may override
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            return;
        }
        
        // Stop simulation temporarily during visibility change
        this.simulation.alpha(0).alphaTarget(0);
        
        // Update node visibility
        node.isHidden = isHidden;
        
        // Update node radius based on new visibility
        node.radius = this.getNodeRadius(node);
        
        // For special node types, ensure proper position updates
        if (node.group === 'central') {
            // Central nodes should ALWAYS remain at origin
            node.x = 0;
            node.y = 0;
            node.fx = 0;
            node.fy = 0;
            node.vx = 0;
            node.vy = 0;
        } else if (node.type === 'navigation') {
            // Ensure navigation nodes keep their fixed positions
            if (node.fx !== undefined && node.fy !== undefined) {
                node.x = node.fx;
                node.y = node.fy;
                node.vx = 0;
                node.vy = 0;
            }
        }
        
        // If node is hidden, always release fixed position
        if (isHidden) {
            node.fx = undefined;
            node.fy = undefined;
        } else if (node.mode === 'detail') {
            // If node is visible and in detail mode, fix its position
            node.fx = node.x;
            node.fy = node.y;
        }
        
        // Always restart with very low alpha to minimize movement
        this.simulation.alpha(0.1).restart();
    }

    /**
     * Get the current simulation
     */
    public getSimulation(): d3.Simulation<any, any> {
        return this.simulation;
    }

    /**
     * Stop the simulation
     */
    public stop(): void {
        this.simulation.stop();
        
        // Explicitly clear all forces when stopping
        try {
            const sim = this.simulation as any;
            const forces = Object.keys(sim._forces || {});
            forces.forEach(forceName => {
                sim.force(forceName, null);
            });
        } catch (e) {
            // Ignore errors during cleanup
        }
    }

    /**
     * Restart the simulation
     */
    public restart(alpha: number = 1): void {
        this.simulation.alpha(alpha).restart();
    }

    /**
     * Update dimensions
     */
    public updateDimensions(width: number, height: number): void {
        this.width = width;
        this.height = height;
        
        // Restart with low alpha
        this.restart(0.3);
    }

    /**
     * Calculate node radius based on type, mode, and visibility
     * This is a utility method for derived classes
     */
    protected getNodeRadius(node: EnhancedNode): number {
        // First check if node is hidden - hidden nodes have the smallest radius
        if (node.isHidden) {
            return COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2;
        }
        
        // If not hidden, calculate based on type and mode
        switch(node.type) {
            case 'word':
                return node.mode === 'detail' ? 
                    COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2 : 
                    COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
                
            case 'definition':
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2;
                
            case 'statement':
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2;
                    
            case 'openquestion':  // ADD THIS CASE
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.PREVIEW / 2;

            case 'quantity':
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.QUANTITY.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.QUANTITY.PREVIEW / 2;
                    
            case 'comment':
            case 'comment-form':
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.COMMENT.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
                
            case 'navigation':
                return COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
                
            case 'dashboard':  // ADD SPECIFIC HANDLING
                // Check if this is the control node (smaller dashboard variant)
                if (node.data && 'sub' in node.data && node.data.sub === 'controls') {
                    return node.mode === 'detail' ?
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 :
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
                }
                // Regular dashboard nodes
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.DASHBOARD.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.DASHBOARD.PREVIEW / 2;
                    
            case 'control':  // ADD THIS CASE
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
                
            case 'edit-profile':
            case 'create-node':
                return COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
                
            case 'statement-answer-form':
                return node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW / 2;    
                
            default:
                console.warn(`[BaseLayoutStrategy] Unknown node type in getNodeRadius: ${node.type}, using standard size`);
                return COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
        }
    }

    /**
     * Force simulation to tick a specified number of times
     * Useful for ensuring positions are applied immediately
     */
    public forceTick(ticks: number = 1): void {
        // Temporarily pause any running transitions
        this.simulation.alpha(0).alphaTarget(0);
        
        for (let i = 0; i < ticks; i++) {
            // Enforce fixed positions before and after each tick
            this.enforceFixedPositions();
            this.simulation.tick();
            this.enforceFixedPositions();
        }
    }
    
    /**
     * Ensure fixed nodes stay at their fixed positions
     * This should be called at strategic points to maintain stability
     */
    public enforceFixedPositions(): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        nodes.forEach(node => {
            if (node.fixed || node.group === 'central') {
                // Central nodes always at origin with VERY explicit position setting
                node.x = 0;
                node.y = 0;
                node.fx = 0;
                node.fy = 0;
                node.vx = 0;
                node.vy = 0;
            } else if (node.type === 'navigation') {
                // Navigation nodes fixed at assigned positions
                if (node.fx !== null && node.fx !== undefined) {
                    node.x = node.fx;
                }
                if (node.fy !== null && node.fy !== undefined) {
                    node.y = node.fy;
                }
                node.vx = 0;
                node.vy = 0;
            } else if (node.mode === 'detail' && node.fx !== undefined && node.fy !== undefined) {
                // Detail mode nodes with fixed positions should maintain them
                node.x = node.fx;
                node.y = node.fy;
                node.vx = 0;
                node.vy = 0;
            }
        });
    }

    /**
     * Update the simulation with new data
     * This provides a consistent implementation across all layouts
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        // Always stop simulation during update
        this.simulation.stop();
        
        // Special handling for statement-network view
        const isStatementNetwork = this.viewType === 'statement-network';
        if (isStatementNetwork) {
            skipAnimation = true; // Always skip animation for statement network
            
            // Pre-enforce central node position for statement network view
            const centralNode = nodes.find(n => n.group === 'central');
            if (centralNode) {
                centralNode.x = 0;
                centralNode.y = 0;
                centralNode.fx = 0;
                centralNode.fy = 0;
                centralNode.vx = 0;
                centralNode.vy = 0;
                centralNode.fixed = true;
            }
        }
        
        // Initialize positions for nodes
        this.initializeNodePositions(nodes);
        
        // Update nodes in simulation
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Configure forces for this layout
        this.configureForces();
        
        // Update link force if it exists
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any> | null;
        if (linkForce && links.length > 0) {
            linkForce.links(asD3Links(links));
        }
        
        // Enforce fixed positions before starting
        this.enforceFixedPositions();
        
        // Start simulation with appropriate alpha
        const alpha = skipAnimation ? 0 : 1;
        this.simulation.alpha(alpha).restart();
        
        // For statement network, force additional ticks
        if (isStatementNetwork) {
            this.forceTick(5);
        }
    }
    
    /**
     * Create SVG transform attribute string for a node
     */
    protected createNodeTransform(x: number, y: number, scale: number = 1): string {
        return coordinateSystem.createSVGTransform(x, y, scale);
    }
}