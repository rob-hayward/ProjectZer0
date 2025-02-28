// ProjectZer0Frontend/src/lib/services/graph/simulation/layouts/SingleNodeLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { EnhancedNode, EnhancedLink } from '../../../types/graph/enhanced';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink
} from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../constants/graph';

/**
 * Layout strategy for single central node views (dashboard, edit-profile, etc.)
 * 
 * Features:
 * - Central node fixed at the center (0,0)
 * - Navigation nodes in a circle around the central node
 * - No special handling for node state changes
 */
export class SingleNodeLayout extends BaseLayoutStrategy {
    private navNodeDistance: number = 0;
    
    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug(`[SingleNodeLayout] Created for view: ${viewType}`);
    }

    /**
     * Set initial positions for all nodes
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.debug(`[SingleNodeLayout] Initializing positions for ${nodes.length} nodes`);
        
        // Stop simulation during initialization
        this.simulation.stop();
        
        // Clear ALL existing forces
        this.clearAllForces();

        // Position central node at center
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (centralNode) {
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.x = 0;
            centralNode.y = 0;
            
            console.debug(`[SingleNodeLayout] Positioned central node at origin`, {
                id: centralNode.id,
                type: centralNode.type
            });
        }

        // Position navigation nodes using the utility class
        this.navNodeDistance = NavigationNodeLayout.positionNavigationNodes(
            nodes, 
            this.getNodeRadius.bind(this)
        );
        
        // Verify fixed positions are enforced
        NavigationNodeLayout.enforceFixedPositions(nodes);
    }
    
    /**
     * Clear all forces that could affect node positions
     */
    private clearAllForces(): void {
        // Get all force names
        const forceNames = [];
        const sim = this.simulation as any;
        
        // List all forces that might be present
        const potentialForceNames = [
            'charge', 'collision', 'link', 'center', 'x', 'y',
            'manyBody', 'radial', 'navigationRadial', 'navigationCharge',
            'navigationCollision', 'centralCharge', 'centralCollision'
        ];
        
        // Remove all forces
        potentialForceNames.forEach(name => {
            try {
                sim.force(name, null);
            } catch (e) {
                // Ignore errors
            }
        });
        
        console.debug(`[SingleNodeLayout] Cleared all forces`);
    }

    /**
     * Configure forces for this layout - MINIMAL FORCES
     */
    configureForces(): void {
        console.debug(`[SingleNodeLayout] Configuring forces`);
        
        // NO FORCES - rely purely on fixed positions
        // This ensures stability of the layout
        
        // Start with a very mild alpha
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Make sure positions stay fixed during updates
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        console.debug(`[SingleNodeLayout:Update] Updating data`, {
            nodeCount: nodes.length,
            linkCount: links.length,
            skipAnimation
        });

        super.updateData(nodes, links, true); // Always skip animation
        
        // Enforce fixed positions for all nodes
        NavigationNodeLayout.enforceFixedPositions(nodes);
    }
    
    /**
     * Handle node state changes - ensure fixed positions
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        // First call the parent method
        super.handleNodeStateChange(nodeId, mode);
        
        // Then ensure all fixed positions are maintained
        const nodes = this.simulation.nodes();
        NavigationNodeLayout.enforceFixedPositions(nodes);
    }
}