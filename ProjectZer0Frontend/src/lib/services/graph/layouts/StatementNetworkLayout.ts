// src/lib/services/graph/layouts/StatementNetworkLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
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
 * Layout strategy for displaying multiple statement nodes in a network view
 * 
 * Features:
 * - Force-directed layout for statements and their relationships
 * - Sorting based on votes (net positive towards center by default)
 * - Support for preview/detail mode transitions
 * - Dynamic link distance based on relationship strength
 */
export class StatementNetworkLayout extends BaseLayoutStrategy {
    private sortType: 'netPositive' | 'totalVotes' | 'chronological' = 'netPositive';
    private sortDirection: 'asc' | 'desc' = 'desc';

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug(`[StatementNetworkLayout] Created for view: ${viewType}, dimensions: ${width}x${height}`);
    }

    /**
     * Clear ALL forces from the simulation
     */
    private clearAllForces(): void {
        console.debug('[StatementNetworkLayout] Clearing all forces');
        
        // Get all force names
        const sim = this.simulation as any;
        
        // List all forces that might be present
        const potentialForceNames = [
            'link', 'charge', 'collision', 'center', 'x', 'y',
            'manyBody', 'radial', 'positioning', 'custom'
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
            console.warn('[StatementNetworkLayout] Some forces still remain:', remainingForces);
            
            // Try to remove these as well
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    console.warn(`[StatementNetworkLayout] Cannot remove force: ${name}`);
                }
            });
        }
    }

    /**
     * Set initial positions for all nodes
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.debug(`[StatementNetworkLayout] Initializing positions for ${nodes.length} nodes`);
        
        // Stop simulation during initialization
        this.simulation.stop();
        
        // Clear ALL existing forces
        this.clearAllForces();

        // Reset velocities for all nodes
        nodes.forEach(node => {
            node.vx = 0;
            node.vy = 0;
            
            // Clear any fixed positions from previous layouts
            if (!node.fixed && node.group !== 'central') {
                node.fx = undefined;
                node.fy = undefined;
            }
            
            // Generate random initial positions for more natural force layout
            if (node.type === 'statement') {
                // Randomize statement nodes around center (0, 0)
                // Use deterministic randomization based on node ID for consistency
                const seed = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const radius = 200 + (seed % 300); // 200-500 radius
                const angle = (seed % 360) * (Math.PI / 180); // Convert to radians
                
                node.x = Math.cos(angle) * radius;
                node.y = Math.sin(angle) * radius;
            }
        });
    }
    
    /**
     * Configure forces for this layout
     */
    configureForces(): void {
        console.debug(`[StatementNetworkLayout] Configuring forces`);
        
        // Clear all existing forces
        this.clearAllForces();
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Link force - connects statements by shared keywords or direct relationships
        const linkForce = d3.forceLink<any, any>()
            .id((d: any) => d.id)
            .links(this.getForceLinks())
            .distance(link => this.calculateLinkDistance(link as EnhancedLink))
            .strength(link => this.calculateLinkStrength(link as EnhancedLink));

        // Charge force - general repulsion between nodes
        const chargeForce = d3.forceManyBody()
            .strength(-300) // Moderate repulsion
            .distanceMin(50)
            .distanceMax(500);

        // Collision force - prevents node overlap
        const collisionForce = d3.forceCollide()
            .radius(d => (d as EnhancedNode).radius + COORDINATE_SPACE.NODES.PADDING.COLLISION.STATEMENT)
            .strength(0.8);

        // Center force - keeps network centered in viewable area
        const centerForce = d3.forceCenter(0, 0);

        // Apply forces to simulation
        this.simulation
            .force('link', linkForce)
            .force('charge', chargeForce)
            .force('collision', collisionForce)
            .force('center', centerForce);
            
        // Apply sorting forces
        this.applySortingForces();
        
        // Start with moderate alpha to allow movement but not too chaotic
        this.simulation.alpha(0.5).restart();
    }
    
    /**
     * Get links for the force simulation
     */
    private getForceLinks(): EnhancedLink[] {
        // Get the link force from the simulation
        const linkForce = this.simulation.force('link');
        
        // Check if it's a ForceLink and has links
        if (!linkForce || typeof (linkForce as any).links !== 'function') {
            return [];
        }
        
        // Get links from the force
        const links = (linkForce as any).links() as EnhancedLink[];
        
        // Add relationship type property if not already present
        links.forEach(link => {
            if (!link.relationshipType) {
                link.relationshipType = link.type === 'related' ? 'direct' : 'keyword';
            }
        });
        
        return links;
    }
    
    /**
     * Calculate appropriate distance for link based on relationship type and strength
     */
    private calculateLinkDistance(link: EnhancedLink): number {
        if (!link) return 200;
        
        // Direct relationships (statement-to-statement) should be closer
        if (link.relationshipType === 'direct' || link.type === 'related') {
            return 150;
        }
        
        // Keyword relationships distance inversely related to strength
        const strength = link.strength || 0.1;
        return 300 - strength * 100; // Range: 200-290 (stronger links = shorter distance)
    }
    
    /**
     * Calculate appropriate strength for link based on relationship type
     */
    private calculateLinkStrength(link: EnhancedLink): number {
        if (!link) return 0.1;
        
        // Direct relationships should have stronger pull
        if (link.relationshipType === 'direct' || link.type === 'related') {
            return 0.5;
        }
        
        // Keyword relationships strength proportional to relationship strength
        return (link.strength || 0.1) * 0.3; // Scale down to avoid too much tension
    }
    
    /**
     * Apply forces based on current sorting criteria
     */
    private applySortingForces(): void {
        // Remove any existing positioning forces
        this.simulation.force('positioning', null);
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        switch(this.sortType) {
            case 'netPositive':
                // Create radial force based on net votes - provide radius function as first parameter
                const netVoteForce = d3.forceRadial(
                    (d: any) => {
                        const node = d as EnhancedNode;
                        const netVotes = this.getNetVotes(node);
                        
                        // Higher voted statements closer to center (with direction)
                        const baseRadius = 400;
                        const maxEffect = 300; // Maximum distance adjustment
                        
                        if (this.sortDirection === 'desc') {
                            // Higher votes = closer to center (default)
                            return baseRadius - Math.min(Math.max(netVotes, -20), 20) * (maxEffect / 40);
                        } else {
                            // Higher votes = further from center
                            return baseRadius + Math.min(Math.max(netVotes, -20), 20) * (maxEffect / 40);
                        }
                    }
                )
                .x(0)
                .y(0)
                .strength(0.6);
                    
                this.simulation.force('positioning', netVoteForce);
                break;
                
            case 'totalVotes':
                // Implementation for total votes sorting
                // Create radial force based on total votes
                const totalVoteForce = d3.forceRadial(
                    (d: any) => {
                        const node = d as EnhancedNode;
                        const totalVotes = this.getTotalVotes(node);
                        
                        // Higher total votes = closer to center (with direction)
                        const baseRadius = 400;
                        const maxEffect = 300;
                        
                        if (this.sortDirection === 'desc') {
                            // More votes = closer to center
                            return baseRadius - Math.min(totalVotes, 40) * (maxEffect / 40);
                        } else {
                            // More votes = further from center
                            return baseRadius + Math.min(totalVotes, 40) * (maxEffect / 40);
                        }
                    }
                )
                .x(0)
                .y(0)
                .strength(0.6);
                
                this.simulation.force('positioning', totalVoteForce);
                break;
                
            case 'chronological':
                // Implementation for chronological sorting
                // Create x-positions based on creation date
                
                // Find min and max dates
                const dates = nodes
                    .filter(n => n.type === 'statement')
                    .map(n => new Date(n.metadata?.createdAt || Date.now()).getTime());
                
                const minTime = Math.min(...dates);
                const maxTime = Math.max(...dates);
                const timeRange = maxTime - minTime || 1; // Avoid division by zero
                
                nodes.forEach(node => {
                    if (node.type === 'statement') {
                        const createdAt = new Date(node.metadata?.createdAt || Date.now()).getTime();
                        // Normalize time to a value between 0 and 1
                        const normalizedTime = (createdAt - minTime) / timeRange;
                        
                        // Create x position in range -500 to 500
                        const xPos = this.sortDirection === 'desc' 
                            ? 500 - (normalizedTime * 1000) // Newest on left
                            : -500 + (normalizedTime * 1000); // Oldest on left
                            
                        // Create force to push node to its time position
                        const timeForce = d3.forceX(xPos).strength(0.7);
                        this.simulation.force(`x-${node.id}`, timeForce);
                        
                        // Add a small y force to keep nodes vertically centered
                        const yForce = d3.forceY(0).strength(0.3);
                        this.simulation.force(`y-${node.id}`, yForce);
                    }
                });
                
                break;
        }
        
        // Restart with low alpha for smooth transition
        this.simulation.alpha(0.3).restart();
    }
    
    /**
     * Get net votes for a node
     */
    private getNetVotes(node: EnhancedNode): number {
        if (node.type !== 'statement') return 0;
        
        if (node.data && 'positiveVotes' in node.data && 'negativeVotes' in node.data) {
            const positiveVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
            const negativeVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
            return positiveVotes - negativeVotes;
        }
        
        return 0;
    }
    
    /**
     * Get total votes for a node
     */
    private getTotalVotes(node: EnhancedNode): number {
        if (node.type !== 'statement') return 0;
        
        if (node.data && 'positiveVotes' in node.data && 'negativeVotes' in node.data) {
            const positiveVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
            const negativeVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
            return positiveVotes + negativeVotes;
        }
        
        return 0;
    }
    
    /**
     * Helper method to get number from Neo4j number objects
     */
    private getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    /**
     * Handle node mode changes (preview/detail)
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug(`[StatementNetworkLayout] Node state change`, { 
            nodeId, 
            mode 
        });
        
        // Get current nodes from simulation
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find the target node
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) {
            console.warn(`[StatementNetworkLayout] Node not found for state change:`, nodeId);
            return;
        }
        
        const node = nodes[nodeIndex];
        
        // Store old values for comparison
        const oldMode = node.mode;
        const oldRadius = node.radius;
        
        // Update the node properties
        node.mode = mode;
        node.expanded = mode === 'detail';
        node.radius = this.getNodeRadius(node);
        
        if (node.metadata) {
            node.metadata.isDetail = mode === 'detail';
        }
        
        console.debug(`[StatementNetworkLayout] Node updated:`, {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius: node.radius
        });
        
        // Update the simulation with the new node properties
        this.simulation.nodes(nodes);
        
        // Reconfigure forces to account for the new node size
        this.configureForces();
        
        // Force tick to immediately apply changes
        for (let i = 0; i < 3; i++) {
            this.simulation.tick();
        }
    }
    
    /**
     * Override updateData to set up the network layout
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        console.debug(`[StatementNetworkLayout] Updating data`, {
            nodeCount: nodes.length,
            linkCount: links.length,
            skipAnimation
        });

        // Stop any existing simulation
        this.simulation.stop();
        
        // Initialize node positions
        this.initializeNodePositions(nodes);
        
        // Update nodes in the simulation
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Configure forces with the updated data
        this.configureForces();
        
        // Start simulation with appropriate alpha
        const alpha = skipAnimation ? 0.01 : 0.5;
        this.simulation.alpha(alpha).restart();
    }
}