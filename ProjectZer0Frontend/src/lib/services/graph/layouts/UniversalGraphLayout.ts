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
        // Position navigation nodes in a circle
        const navNodes = nodes.filter(n => n.type === 'navigation');
        const navRadius = this.maxRadius * 1.2; // Navigation nodes outside main content
        
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
                const ringRadius = (ringIndex + 1) / rings.length * this.maxRadius;
                const nodesInRing = ring.nodeCount;
                const angleStep = (2 * Math.PI) / nodesInRing;

                for (let i = 0; i < nodesInRing && nodeIndex < nodesWithValues.length; i++) {
                    const { node } = nodesWithValues[nodeIndex];
                    const angle = i * angleStep + (ringIndex * Math.PI / rings.length); // Offset each ring
                    
                    node.x = this.centerX + Math.cos(angle) * ringRadius;
                    node.y = this.centerY + Math.sin(angle) * ringRadius;
                    
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
            // Each ring can hold approximately 6 * ringNumber nodes
            const nodesInRing = Math.min(remainingNodes, Math.max(1, 6 * ringNumber));
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

        // Many-body force - repulsion between nodes
        this.simulation.force('charge', 
            d3.forceManyBody()
                .strength(d => {
                    // Stronger repulsion for larger nodes
                    const node = d as EnhancedNode;
                    if (node.mode === 'detail') return -300;
                    if (node.group === 'central') return -400;
                    return -150;
                })
                .distanceMin(50)
                .distanceMax(300)
        );

        // Collision detection - prevent overlap
        this.simulation.force('collision',
            d3.forceCollide()
                .radius(d => {
                    const node = d as EnhancedNode;
                    return this.getNodeRadius(node) + 10; // Add padding
                })
                .strength(0.8)
                .iterations(3)
        );

        // Link force - attraction between connected nodes
        const links = this.simulation.force('link') as d3.ForceLink<any, any> | null;
        if (links) {
            links
                .distance(d => {
                    const link = d as EnhancedLink;
                    // Shorter distance for stronger relationships
                    const baseDistance = 150;
                    const strength = link.metadata?.strength || 0.5;
                    return baseDistance * (1 - strength * 0.5);
                })
                .strength(d => {
                    const link = d as EnhancedLink;
                    return link.metadata?.strength || 0.5;
                });
        }

        // Custom consensus force - pull nodes toward their target positions
        this.simulation.force('consensus', this.createConsensusForce());

        // Gentle centering force to keep the graph centered
        this.simulation
            .force('x', d3.forceX(this.centerX).strength(0.02))
            .force('y', d3.forceY(this.centerY).strength(0.02));

        // Configure alpha decay for smooth animation
        this.simulation
            .alphaDecay(0.02)
            .velocityDecay(0.4);
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
                    
                    // Gentle force that gets stronger as nodes get further from target
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const strength = Math.min(0.1, distance / 1000);
                    
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
            
            // Restart simulation with higher alpha for re-sorting
            this.simulation.alpha(0.8).restart();
        }
    }

    /**
     * Handle node state changes
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        super.handleNodeStateChange(nodeId, mode);
        
        // When a node expands/contracts, we may need to adjust forces
        if (this.simulation) {
            // Restart with low alpha for smooth transition
            this.simulation.alpha(0.3).restart();
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