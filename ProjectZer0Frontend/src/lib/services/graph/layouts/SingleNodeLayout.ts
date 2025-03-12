// ProjectZer0Frontend/src/lib/services/graph/layouts/SingleNodeLayout.ts
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
 * - Handles node state changes and navigation node repositioning
 * - Supports preview/detail mode transitions for central node
 */
export class SingleNodeLayout extends BaseLayoutStrategy {
    private navNodeDistance: number = 0;
    private expansionState: Map<string, boolean> = new Map();
    
    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug(`[SingleNodeLayout] Created for view: ${viewType}`);
    }

    /**
     * Clear ALL forces from the simulation
     * This ensures no forces can affect node positions
     */
    private clearAllForces(): void {
        console.debug('[SingleNodeLayout] Clearing all forces');
        
        // Get all force names
        const sim = this.simulation as any;
        
        // List all forces that might be present
        const potentialForceNames = [
            'charge', 'collision', 'link', 'center', 'x', 'y',
            'manyBody', 'radial', 'navigationRadial', 'navigationCharge',
            'navigationCollision', 'centralCharge', 'centralCollision',
            'positioning', 'custom'
        ];
        
        // Remove all forces
        potentialForceNames.forEach(name => {
            try {
                sim.force(name, null);
            } catch (e) {
                // Ignore errors
            }
        });
        
        // Check if there are still any forces left
        const remainingForces = Object.keys(sim._forces || {});
        if (remainingForces.length > 0) {
            console.warn('[SingleNodeLayout] Some forces still remain:', remainingForces);
            
            // Try to remove these as well
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    console.warn(`[SingleNodeLayout] Cannot remove force: ${name}`);
                }
            });
        }
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

        // Update expansion state tracking
        this.updateExpansionState(nodes);

        // Position central node at center
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (centralNode) {
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.x = 0;
            centralNode.y = 0;
            
            console.debug(`[SingleNodeLayout] Positioned central node at origin`, {
                id: centralNode.id,
                type: centralNode.type,
                radius: centralNode.radius
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
     * Enhanced node state change handler with proper navigation node repositioning
     * This is the key method to handle node transitions correctly
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug(`[SingleNodeLayout] Node state change`, { 
            nodeId, 
            mode 
        });
        
        // Get current nodes from simulation
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find the target node with its original properties
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) {
            console.warn(`[SingleNodeLayout] Node not found for state change:`, nodeId);
            return;
        }
        
        const node = nodes[nodeIndex];
        
        // Store old values for comparison and logging
        const oldMode = node.mode;
        const oldRadius = node.radius;
        
        // Calculate new radius based on node type and mode
        let newRadius = this.getNodeRadius({
            ...node,
            mode: mode
        });
        
        // Create a completely new node object to ensure reactivity
        const updatedNode = {
            ...node,
            mode: mode,
            expanded: mode === 'detail',
            metadata: {
                ...node.metadata,
                isDetail: mode === 'detail'
            },
            radius: newRadius
        };
        
        // Replace the old node with the updated one
        nodes[nodeIndex] = updatedNode;
        
        console.debug(`[SingleNodeLayout] Node updated with new properties`, {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius,
            nodeType: updatedNode.type
        });
        
        // Store expansion state
        this.expansionState.set(nodeId, mode === 'detail');

        // For central node, we need to reposition all navigation nodes
        if (updatedNode.fixed || updatedNode.group === 'central') {
            console.debug(`[SingleNodeLayout] Central node mode changed, repositioning navigation nodes`);
            
            // Reposition navigation nodes to account for new central node size
            this.navNodeDistance = NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
        }
        
        // Update the simulation with the new node array
        // Critical: Replace the entire nodes array in the simulation
        this.simulation.nodes(nodes);
        
        // CRITICAL: Stop simulation and enforce fixed positions
        this.simulation.stop();
        this.enforceFixedPositions();
        
        // Force tick to immediately apply changes
        for (let i = 0; i < 3; i++) {
            this.simulation.tick();
        }
        
        // Restart with very minimal alpha to avoid movement
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Additional method to ensure fixed positions are properly maintained
     */
    public enforceFixedPositions(): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Central node should always be at origin
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (centralNode) {
            centralNode.x = 0;
            centralNode.y = 0;
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.vx = 0;
            centralNode.vy = 0;
            
            console.debug('[SingleNodeLayout] Enforced central node position', {
                id: centralNode.id,
                type: centralNode.type,
                radius: centralNode.radius,
                position: { x: 0, y: 0 }
            });
        }
        
        // Ensure navigation nodes maintain their positions
        NavigationNodeLayout.enforceFixedPositions(nodes);
    }
    
    /**
     * Update expansion state for nodes
     */
    private updateExpansionState(nodes: EnhancedNode[]): void {
        // Update our expansion state map
        nodes.forEach(node => {
            const wasExpanded = this.expansionState.get(node.id) || false;
            const isExpanded = node.mode === 'detail';
            
            if (wasExpanded !== isExpanded) {
                console.debug('[SingleNodeLayout] Node expansion state changed:', {
                    nodeId: node.id,
                    from: wasExpanded,
                    to: isExpanded,
                    type: node.type,
                    radius: node.radius
                });
            }
            
            this.expansionState.set(node.id, isExpanded);
        });
    }
    
    /**
     * Handle node visibility changes
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        console.debug(`[SingleNodeLayout] Node visibility change`, {
            nodeId,
            isHidden
        });
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) {
            console.warn(`[SingleNodeLayout] Node not found for visibility change:`, nodeId);
            return;
        }

        const node = nodes[nodeIndex];
        
        // Update node visibility
        const oldHiddenState = node.isHidden;
        const oldRadius = node.radius;
        
        // Calculate new radius
        const newRadius = this.getNodeRadius({
            ...node,
            isHidden: isHidden
        });
        
        // Create a completely new node object to ensure reactivity
        const updatedNode = {
            ...node,
            isHidden: isHidden,
            radius: newRadius
        };
        
        // Replace the old node with the updated one
        nodes[nodeIndex] = updatedNode;

        console.debug(`[SingleNodeLayout] Node visibility updated`, {
            nodeId,
            oldHiddenState,
            newHiddenState: isHidden,
            oldRadius,
            newRadius: updatedNode.radius,
            type: updatedNode.type
        });
        
        // For central node, we need to reposition all navigation nodes
        if (updatedNode.fixed || updatedNode.group === 'central') {
            console.debug(`[SingleNodeLayout] Central node visibility changed, repositioning navigation nodes`);
            
            // Reposition navigation nodes to account for new central node size
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
        }
        
        // Update the simulation with the new node array
        this.simulation.nodes(nodes);
        
        // CRITICAL: Stop simulation and enforce fixed positions
        this.simulation.stop();
        this.enforceFixedPositions();
        
        // Force tick to immediately apply changes
        for (let i = 0; i < 3; i++) {
            this.simulation.tick();
        }
        
        // Restart with very minimal alpha to avoid movement
        this.simulation.alpha(0.01).restart();
    }
}