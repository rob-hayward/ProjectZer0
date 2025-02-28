// ProjectZer0Frontend/src/lib/services/graph/simulation/layouts/BaseLayoutStrategy.ts
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
        console.debug(`[BaseLayoutStrategy:${this.strategyId}:Init] Constructor`, {
            width: width,
            height: height,
            viewType
        });

        this.width = width;
        this.height = height;
        this.viewType = viewType;
        this.simulation = this.initializeBaseSimulation();
    }

    /**
     * Initialize basic simulation with shared parameters
     */
    protected initializeBaseSimulation(): d3.Simulation<any, any> {
        console.debug(`[BaseLayoutStrategy:${this.strategyId}:Init] Creating simulation`);

        const simulation = d3.forceSimulation()
            .velocityDecay(COORDINATE_SPACE.ANIMATION.VELOCITY_DECAY)
            .alphaDecay(COORDINATE_SPACE.ANIMATION.ALPHA_DECAY)
            .alphaMin(COORDINATE_SPACE.ANIMATION.ALPHA_MIN);

        simulation.on('tick', () => {
            // Debug on lower alpha values to reduce noise
            if (simulation.alpha() < 0.3) {
                const nodes = simulation.nodes() as unknown as EnhancedNode[];
                const centralNode = nodes.find(n => n.fixed || n.group === 'central');
                if (centralNode) {
                    console.debug(`[BaseLayoutStrategy:${this.strategyId}:Simulation] Tick`, {
                        alpha: simulation.alpha(),
                        centralNode: {
                            id: centralNode.id,
                            type: centralNode.type,
                            position: { x: centralNode.x ?? 0, y: centralNode.y ?? 0 },
                            fixed: { fx: centralNode.fx, fy: centralNode.fy }
                        }
                    });
                }
            }
            
            // Ensure fixed nodes stay fixed during simulation
            const simNodes = simulation.nodes() as unknown as EnhancedNode[];
            simNodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    node.x = 0;
                    node.y = 0;
                    node.fx = 0;
                    node.fy = 0;
                } else if (node.type === 'navigation') {
                    // Ensure navigation nodes stay fixed
                    if (node.fx !== null && node.fx !== undefined) {
                        node.x = node.fx;
                    }
                    if (node.fy !== null && node.fy !== undefined) {
                        node.y = node.fy;
                    }
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
     * Each strategy may implement this differently
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug(`[BaseLayoutStrategy:${this.strategyId}:State] Node state change`, {
            nodeId,
            mode
        });
        
        // Basic implementation - derived classes may override
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn(`[BaseLayoutStrategy:${this.strategyId}:State] Node not found:`, nodeId);
            return;
        }
        
        // Update node mode
        node.mode = mode;
        node.expanded = mode === 'detail';
        node.metadata.isDetail = mode === 'detail';
        
        // Update node radius based on new mode
        node.radius = this.getNodeRadius(node);
        
        // Apply any special positioning rules
        // (Derived classes should override this for specific behavior)
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
        console.debug(`[BaseLayoutStrategy:${this.strategyId}:Lifecycle] Stopping`);
        this.simulation.stop();
    }

    /**
     * Restart the simulation
     */
    public restart(alpha: number = 1): void {
        console.debug(`[BaseLayoutStrategy:${this.strategyId}:Lifecycle] Restarting with alpha: ${alpha}`);
        this.simulation.alpha(alpha).restart();
    }

    /**
     * Update dimensions
     */
    public updateDimensions(width: number, height: number): void {
        console.debug(`[BaseLayoutStrategy:${this.strategyId}:Lifecycle] Updating dimensions`, {
            from: { width: this.width, height: this.height },
            to: { width, height }
        });

        this.width = width;
        this.height = height;
        
        // Restart with low alpha
        this.restart(0.3);
    }

    /**
     * Calculate node radius based on type and mode
     * This is a utility method for derived classes
     */
    protected getNodeRadius(node: EnhancedNode): number {
        if (node.type === 'word') {
            return node.mode === 'detail' ? 
                COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2 : 
                COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
        } else if (node.type === 'definition') {
            return node.mode === 'detail' ?
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2 :
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2;
        } else if (node.type === 'navigation') {
            return COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
        } else {
            // Dashboard, edit-profile, etc.
            return COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
        }
    }

    /**
     * Update the simulation with new data
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        console.debug(`[BaseLayoutStrategy:${this.strategyId}:Update] Updating data`, {
            nodeCount: nodes.length,
            linkCount: links.length,
            skipAnimation
        });

        this.simulation.stop();
        
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
        
        // Start simulation with appropriate alpha
        const alpha = skipAnimation ? 0 : 1;
        this.simulation.alpha(alpha).restart();
    }
}