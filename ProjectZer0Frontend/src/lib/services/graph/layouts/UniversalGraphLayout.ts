// src/lib/services/graph/layouts/UniversalGraphLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import type { EnhancedNode, EnhancedLink, NodeMode, ViewType } from '$lib/types/graph/enhanced';

// Interface for storing universal-specific node data
interface UniversalNodeData {
    targetRadius?: number;
    targetAngle?: number;
}

/**
 * Layout strategy for the universal graph view
 * Implements consensus-based positioning where high consensus nodes gravitate toward center
 */
export class UniversalGraphLayout extends BaseLayoutStrategy {
    private readonly centerX: number;
    private readonly centerY: number;
    private readonly maxRadius: number;
    private sortType: 'consensus' | 'participants' | 'net_positive' | 'chronological' = 'consensus';
    private sortDirection: 'asc' | 'desc' = 'desc';
    // Store universal-specific data separately
    private nodeDataMap: Map<string, UniversalNodeData> = new Map();

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        this.centerX = 0;
        this.centerY = 0;
        // Maximum distance from center for lowest consensus/value nodes
        this.maxRadius = Math.min(width, height) * 0.4;
    }

    /**
     * Initialize node positions based on their consensus/sort value
     */
    public initializeNodePositions(nodes: EnhancedNode[]): void {
        // Position navigation nodes in a circle - back to normal distance
        const navNodes = nodes.filter(n => n.type === 'navigation');
        const navRadius = this.maxRadius * 1.2; // Back to original 1.2
        
        navNodes.forEach((node, i) => {
            const angle = (i / navNodes.length) * 2 * Math.PI - Math.PI / 2;
            node.x = this.centerX + Math.cos(angle) * navRadius;
            node.y = this.centerY + Math.sin(angle) * navRadius;
            node.fx = node.x;
            node.fy = node.y;
            node.fixed = true;
        });

        // Position control node at center
        const controlNode = nodes.find(n => n.group === 'central' || n.id.includes('control'));
        if (controlNode) {
            controlNode.x = this.centerX;
            controlNode.y = this.centerY;
            controlNode.fx = this.centerX;
            controlNode.fy = this.centerY;
            controlNode.fixed = true;
        }

        // Position content nodes based on their sort value
        const contentNodes = nodes.filter(n => 
            n.type === 'statement' || n.type === 'openquestion' || n.type === 'quantity'
        );

        if (contentNodes.length > 0) {
            // Calculate sort values for each node
            const nodesWithValues = contentNodes.map(node => ({
                node,
                value: this.getNodeSortValue(node)
            }));

            // Sort nodes by value
            nodesWithValues.sort((a, b) => {
                return this.sortDirection === 'desc' 
                    ? b.value - a.value 
                    : a.value - b.value;
            });

            // Position nodes in concentric circles based on their rank
            const rings = this.calculateRings(nodesWithValues.length);
            let nodeIndex = 0;

            rings.forEach((ring, ringIndex) => {
                // Increase ring spacing
                const ringRadius = ((ringIndex + 1) / rings.length) * this.maxRadius * 0.9; // Scale down slightly to leave room
                const nodesInRing = ring.nodeCount;
                const angleStep = (2 * Math.PI) / nodesInRing;

                for (let i = 0; i < nodesInRing && nodeIndex < nodesWithValues.length; i++) {
                    const { node } = nodesWithValues[nodeIndex];
                    const angle = i * angleStep + (ringIndex * Math.PI / rings.length); // Offset each ring
                    
                    // Add some randomness to prevent perfect circles
                    const jitter = 0.2; // 20% position variation
                    const jitterRadius = ringRadius * (1 + (Math.random() - 0.5) * jitter);
                    const jitterAngle = angle + (Math.random() - 0.5) * 0.3;
                    
                    node.x = this.centerX + Math.cos(jitterAngle) * jitterRadius;
                    node.y = this.centerY + Math.sin(jitterAngle) * jitterRadius;
                    
                    // Store the target position for the consensus force
                    this.nodeDataMap.set(node.id, {
                        targetRadius: ringRadius,
                        targetAngle: angle
                    });
                    
                    nodeIndex++;
                }
            });
        }
    }

    /**
     * Calculate how many rings and nodes per ring for optimal distribution
     */
    private calculateRings(totalNodes: number): Array<{ nodeCount: number }> {
        const rings: Array<{ nodeCount: number }> = [];
        let remainingNodes = totalNodes;
        let ringNumber = 1;

        while (remainingNodes > 0) {
            // Fewer nodes per ring for better spacing
            // First ring: 1-6 nodes, then 8, 12, 16, etc.
            const baseNodesPerRing = ringNumber === 1 ? 6 : 4 * ringNumber;
            const nodesInRing = Math.min(remainingNodes, baseNodesPerRing);
            rings.push({ nodeCount: nodesInRing });
            remainingNodes -= nodesInRing;
            ringNumber++;
        }

        return rings;
    }

    /**
     * Get the sort value for a node based on current sort type
     */
    private getNodeSortValue(node: EnhancedNode): number {
        switch (this.sortType) {
            case 'consensus':
                return node.metadata.consensus_ratio || 0;
            
            case 'participants':
                return node.metadata.participant_count || 0;
            
            case 'net_positive':
                return node.metadata.net_votes || 0;
            
            case 'chronological':
                if (node.metadata.createdAt) {
                    return new Date(node.metadata.createdAt).getTime();
                }
                return 0;
            
            default:
                return 0;
        }
    }

    /**
     * Configure forces for the universal layout
     */
    public configureForces(): void {
        if (!this.simulation) return;

        // Remove all existing forces first
        this.simulation
            .force('charge', null)
            .force('link', null)
            .force('collision', null)
            .force('x', null)
            .force('y', null)
            .force('radial', null)
            .force('consensus', null);

        // Many-body force - even stronger repulsion for maximum spacing
        this.simulation.force('charge', 
            d3.forceManyBody()
                .strength(d => {
                    const node = d as EnhancedNode;
                    // Very strong repulsion for all nodes
                    if (node.mode === 'detail') return -1500;
                    if (node.group === 'central') return -2000;
                    if (node.type === 'navigation') return -1000;
                    return -1000; // Much stronger base repulsion
                })
                .distanceMin(100) // Minimum distance between nodes
                .distanceMax(800) // Increased max distance for effect
        );

        // Collision detection - even larger radius to prevent overlap
        this.simulation.force('collision',
            d3.forceCollide()
                .radius(d => {
                    const node = d as EnhancedNode;
                    // Add significant padding
                    return this.getNodeRadius(node) + 80; // Increased from 40
                })
                .strength(0.95) // Very strong collision avoidance
                .iterations(5) // More iterations for better separation
        );

        // Link force - much longer distances between connected nodes
        const links = this.simulation.force('link') as d3.ForceLink<any, any> | null;
        if (links) {
            links
                .distance(d => {
                    const link = d as EnhancedLink;
                    // Much longer distance for all links
                    const baseDistance = 400; // Increased from 250
                    const strength = link.metadata?.strength || 0.5;
                    return baseDistance * (1 - strength * 0.2); // Even less strength influence
                })
                .strength(d => {
                    const link = d as EnhancedLink;
                    return (link.metadata?.strength || 0.5) * 0.3; // Weaker link force
                });
        }

        // Custom consensus force - very gentle to allow spacing
        this.simulation.force('consensus', this.createConsensusForce());

        // Almost no centering force to allow maximum spread
        this.simulation
            .force('x', d3.forceX(this.centerX).strength(0.005)) // Very weak
            .force('y', d3.forceY(this.centerY).strength(0.005)); // Very weak

        // Configure for quick settling - no jiggling
        this.simulation
            .alphaMin(0.01) // Stop simulation sooner
            .alphaDecay(0.05) // Much faster decay to stop jiggling quickly
            .velocityDecay(0.7); // High damping to stop movement quickly
    }

    /**
     * Create custom force that positions nodes based on consensus/sort value
     */
    private createConsensusForce() {
        return (alpha: number) => {
            const nodes = this.simulation.nodes() as EnhancedNode[];
            
            nodes.forEach(node => {
                // Skip fixed nodes
                if (node.fixed || node.fx !== undefined) return;
                
                // Only apply to content nodes
                if (node.type !== 'statement' && 
                    node.type !== 'openquestion' && 
                    node.type !== 'quantity') return;

                // Get stored universal data for this node
                const nodeData = this.nodeDataMap.get(node.id);
                
                // If node has target position, gently pull it there
                if (nodeData && 
                    nodeData.targetRadius !== undefined && 
                    nodeData.targetAngle !== undefined) {
                    
                    const targetX = this.centerX + Math.cos(nodeData.targetAngle) * nodeData.targetRadius;
                    const targetY = this.centerY + Math.sin(nodeData.targetAngle) * nodeData.targetRadius;
                    
                    // Apply force proportional to distance from target
                    const dx = targetX - (node.x ?? 0);
                    const dy = targetY - (node.y ?? 0);
                    
                    // Very gentle force that gets stronger as nodes get further from target
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const strength = Math.min(0.02, distance / 3000); // Even gentler
                    
                    // Only update velocity if it's defined
                    if (node.vx !== null && node.vx !== undefined) {
                        node.vx += dx * alpha * strength;
                    }
                    if (node.vy !== null && node.vy !== undefined) {
                        node.vy += dy * alpha * strength;
                    }
                }
            });
        };
    }

    /**
     * Update sort settings
     */
    public setSortType(sortType: 'consensus' | 'participants' | 'net_positive' | 'chronological', direction: 'asc' | 'desc') {
        this.sortType = sortType;
        this.sortDirection = direction;
        
        // Clear the data map so it gets rebuilt with new positions
        this.nodeDataMap.clear();
        
        // Re-initialize positions with new sort
        if (this.simulation) {
            const nodes = this.simulation.nodes() as EnhancedNode[];
            this.initializeNodePositions(nodes);
            
            // Restart simulation with moderate alpha for re-sorting
            this.simulation.alpha(0.5).restart(); // Reduced from 0.8
        }
    }

    /**
     * Handle node state changes
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        super.handleNodeStateChange(nodeId, mode);
        
        // When a node expands/contracts, we may need to adjust forces
        if (this.simulation) {
            // Restart with very low alpha for smooth transition
            this.simulation.alpha(0.1).restart(); // Reduced from 0.3
        }
    }

    /**
     * Get node radius based on type and mode
     */
    protected getNodeRadius(node: EnhancedNode): number {
        // Use the node's radius if set
        if (node.radius) return node.radius;
        
        // Default radii based on node type and mode
        if (node.mode === 'detail') {
            return 150;
        }
        
        switch (node.type) {
            case 'navigation':
                return 40;
            case 'dashboard':
                return 100;
            case 'statement':
            case 'openquestion':
            case 'quantity':
                return 60;
            default:
                return 50;
        }
    }
}