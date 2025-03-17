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
        
        // Count node types for debugging
        const nodeTypes = nodes.reduce((acc, node) => {
            acc[node.type] = (acc[node.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        console.debug(`[StatementNetworkLayout] Node type distribution:`, nodeTypes);
        
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
        });
        
        // First position navigation nodes in a circle
        const navigationNodes = nodes.filter(n => n.type === 'navigation');
        navigationNodes.forEach((node, i) => {
            const angle = (i / navigationNodes.length) * Math.PI * 2;
            const radius = 1200; // Large radius to keep navigation nodes on periphery
            
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            node.fx = node.x; // Fix navigation nodes in place
            node.fy = node.y;
            
            console.debug(`[StatementNetworkLayout] Positioned navigation node:`, {
                id: node.id,
                index: i,
                count: navigationNodes.length,
                angle: angle * 180 / Math.PI,
                x: node.x,
                y: node.y
            });
        });
        
        // Then position statement nodes in a smaller circle
        const statementNodes = nodes.filter(n => n.type === 'statement');
        statementNodes.forEach((node, i) => {
            // Calculate position in a circle to start
            const angle = (i / statementNodes.length) * Math.PI * 2;
            // Use smaller radius for statements - they should be inside the navigation nodes
            const radius = 450; 
            
            // Assign position
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            
            // Add a small random offset to avoid perfect overlap
            node.x += (Math.random() - 0.5) * 100;
            node.y += (Math.random() - 0.5) * 100;
            
            console.debug(`[StatementNetworkLayout] Positioned statement node:`, {
                id: node.id.substring(0, 8),
                index: i,
                x: node.x,
                y: node.y,
                radius: node.radius
            });
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
        
        // Log detailed force configuration
        console.debug(`[StatementNetworkLayout] Configuring forces for ${nodes.length} nodes:`, {
            statementNodes: nodes.filter(n => n.type === 'statement').length,
            navigationNodes: nodes.filter(n => n.type === 'navigation').length
        });
        
        // Link force - connects statements by shared keywords or direct relationships
        const linkForce = d3.forceLink<any, any>()
            .id((d: any) => d.id)
            .links(this.getForceLinks())
            .distance(link => this.calculateLinkDistance(link as EnhancedLink))
            .strength(link => this.calculateLinkStrength(link as EnhancedLink));

        // Charge force - general repulsion between nodes
        const chargeForce = d3.forceManyBody()
            .strength(d => {
                const node = d as EnhancedNode;
                // Use stronger repulsion for statement nodes, less for navigation
                return node.type === 'navigation' ? -100 : -1000; 
            })
            .distanceMin(50)
            .distanceMax(1000); // Increased to allow more spreading

        // Collision force - prevents node overlap
        const collisionForce = d3.forceCollide()
            .radius(d => {
                const node = d as EnhancedNode;
                
                // Add extra padding for statement nodes
                const padding = node.type === 'statement' ? 
                    COORDINATE_SPACE.NODES.PADDING.COLLISION.STATEMENT : 
                    COORDINATE_SPACE.NODES.PADDING.COLLISION.NAVIGATION;
                
                // Use full node radius plus padding for collision detection
                return node.radius + padding;
            })
            .strength(1.0) // Maximum strength to ensure absolutely no overlap
            .iterations(4); // More iterations for better collision detection

        // Center force - keeps network centered in viewable area
        const centerForce = d3.forceCenter(0, 0).strength(0.05);

        // Apply forces to simulation
        this.simulation
            .force('link', linkForce)
            .force('charge', chargeForce)
            .force('collision', collisionForce)
            .force('center', centerForce);
            
        // Apply sorting forces
        this.applySortingForces();
        
        // Start with high alpha for better initial layout
        this.simulation.alpha(1.0).restart();
        
        // Force several ticks immediately to better position nodes
        for (let i = 0; i < 20; i++) {
            this.simulation.tick();
        }
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
        console.debug(`[StatementNetworkLayout] Retrieved ${links.length} force links`);
        
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
            return 180; // Reduced for closer direct relationships
        }
        
        // Keyword relationships distance inversely related to strength
        const strength = link.strength || 0.1;
        return 300 - strength * 120; // Slightly reduced range for better overall appearance
    }
    
    /**
     * Calculate appropriate strength for link based on relationship type
     */
    private calculateLinkStrength(link: EnhancedLink): number {
        if (!link) return 0.1;
        
        // Direct relationships should have stronger pull
        if (link.relationshipType === 'direct' || link.type === 'related') {
            return 0.8; // Increased for stronger direct connections
        }
        
        // Keyword relationships strength proportional to relationship strength
        return (link.strength || 0.1) * 0.6; // Increased for better connections
    }
    
    /**
     * Apply forces based on current sorting criteria
     */
    private applySortingForces(): void {
        // Remove any existing positioning forces
        this.simulation.force('positioning', null);
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // For statement network, we need simpler forces
        // Just add a basic radial force to keep statements in view
        const basicRadial = d3.forceRadial(
            (d: any) => {
                const node = d as EnhancedNode;
                // Keep navigation nodes at edge, statements more centered
                return node.type === 'navigation' ? 1200 : 450;
            },
            0, 0
        ).strength(d => {
            const node = d as EnhancedNode;
            return node.type === 'navigation' ? 1.0 : 0.3;
        });
        
        this.simulation.force('radial', basicRadial);
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
        for (let i = 0; i < 5; i++) {
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
        
        // Print breakdown of node types
        const nodeTypes = nodes.reduce((acc, node) => {
            acc[node.type] = (acc[node.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        console.debug(`[StatementNetworkLayout] Node type distribution:`, nodeTypes);
        
        // Print breakdown of link types
        const linkTypes = links.reduce((acc, link) => {
            acc[link.type] = (acc[link.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        console.debug(`[StatementNetworkLayout] Link type distribution:`, linkTypes);

        // Stop any existing simulation
        this.simulation.stop();
        
        // Initialize node positions
        this.initializeNodePositions(nodes);
        
        // Update nodes in the simulation
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Configure forces with the updated data
        this.configureForces();
        
        // Start simulation with appropriate alpha
        const alpha = skipAnimation ? 0.01 : 1.0;
        this.simulation.alpha(alpha).restart();
        
        // Force several ticks immediately to better position nodes
        for (let i = 0; i < 30; i++) {
            this.simulation.tick();
        }
    }
}