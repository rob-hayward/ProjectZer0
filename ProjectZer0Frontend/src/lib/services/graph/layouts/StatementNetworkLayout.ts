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
    // Default zoom level for initial view - tuned for optimal viewing
    private initialZoom = COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM;
    private storeSubscription: (() => void) | null = null;

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug(`[StatementNetworkLayout] Created for view: ${viewType}, dimensions: ${width}x${height}`);
        
        // Subscribe to the statementNetworkStore to get sort changes
        this.subscribeToStoreChanges();
    }

    /**
     * Subscribe to statementNetworkStore changes to get updates on sort settings
     * Call this in the constructor
     */
    private subscribeToStoreChanges(): void {
        try {
            // Import it here to avoid circular dependencies
            const { statementNetworkStore } = require('../../../stores/statementNetworkStore');
            
            // Subscribe to the store
            this.storeSubscription = statementNetworkStore.subscribe((state: any) => {
                // Only update if sort settings have changed
                if (this.sortType !== state.sortType || this.sortDirection !== state.sortDirection) {
                    console.debug('[StatementNetworkLayout] Sort settings changed in store:', {
                        oldType: this.sortType,
                        newType: state.sortType,
                        oldDirection: this.sortDirection,
                        newDirection: state.sortDirection
                    });
                    
                    this.sortType = state.sortType;
                    this.sortDirection = state.sortDirection;
                    
                    // Only reconfigure if we have an active simulation
                    if (this.simulation) {
                        // Reconfigure forces with new sort settings
                        this.configureForces();
                        
                        // Force several ticks to immediately apply the new layout
                        for (let i = 0; i < 20; i++) {
                            this.simulation.tick();
                        }
                        
                        // Restart simulation with low alpha for smooth transition
                        this.simulation.alpha(0.3).restart();
                    }
                }
            });
            
            console.debug('[StatementNetworkLayout] Successfully subscribed to statementNetworkStore');
        } catch (error) {
            console.error('[StatementNetworkLayout] Error subscribing to statementNetworkStore:', error);
        }
    }

    /**
     * Clean up resources when this layout is no longer needed
     */
    public dispose(): void {
        // Unsubscribe from the store
        if (this.storeSubscription) {
            this.storeSubscription();
            this.storeSubscription = null;
        }
        
        // Stop the simulation
        this.stop();
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
        
        // Position navigation nodes in a circle
        const navigationNodes = nodes.filter(n => n.type === 'navigation');
        navigationNodes.forEach((node, i) => {
            const angle = (i / navigationNodes.length) * Math.PI * 2;
            
            // Scale navigation node radius based on statement node count
            // More statement nodes = navigation nodes moved closer in
            const statementNodes = nodes.filter(n => n.type === 'statement');
            const nodeCount = statementNodes.length;
            
            // Adaptive radius calculation:
            // - For few nodes (<10), keep navigation nodes farther out (600)
            // - For many nodes (50+), bring navigation nodes closer (450)
            // - Scale smoothly between these values
            const minRadius = 450; // Minimum radius for navigation nodes
            const maxRadius = 600; // Maximum radius for navigation nodes
            const radiusRange = maxRadius - minRadius;
            
            // Inverse logarithmic scaling - more nodes = closer navigation
            const scaleFactor = Math.max(0, 1 - (Math.log(nodeCount + 1) / Math.log(60)));
            const radius = minRadius + (radiusRange * scaleFactor);
            
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            node.fx = node.x; // Fix navigation nodes in place
            node.fy = node.y;
        });
        
        // Position statement nodes based on the number of nodes
        const statementNodes = nodes.filter(n => n.type === 'statement');
        const nodeCount = statementNodes.length;
        
        // Create a more adaptive layout based on node count
        // For fewer nodes (< 20), use a more spread-out arrangement
        // For many nodes (> 20), use a more compact grid-like arrangement
        if (nodeCount <= 20) {
            this.positionNodesInSpiral(statementNodes);
        } else {
            this.positionNodesInGrid(statementNodes);
        }
    }
    
    /**
     * Position nodes in a spiral pattern - good for smaller datasets
     */
    private positionNodesInSpiral(nodes: EnhancedNode[]): void {
        const nodeCount = nodes.length;
        // Ultra-compact base radius - significantly tighter than before
        const baseRadius = Math.min(100, 80 + Math.sqrt(nodeCount) * 3);
        
        nodes.forEach((node, i) => {
            // Use golden ratio for pleasing distribution
            const goldenRatio = (1 + Math.sqrt(5)) / 2;
            const goldenAngle = (2 - goldenRatio) * (2 * Math.PI);
            const angle = i * goldenAngle;
            
            // Create an extremely compact spiral with logarithmic scaling
            // Much slower radius growth than before
            const spiralFactor = Math.log(i + 1) * 10;
            const radius = baseRadius + spiralFactor;
            
            // Assign position with spiral pattern
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            
            // Store the golden angle in metadata for possible future use
            if (node.metadata) {
                node.metadata.golden = angle;
            }
        });
    }
    
    /**
     * Position nodes in a grid pattern - better for larger datasets
     */
    private positionNodesInGrid(nodes: EnhancedNode[]): void {
        const nodeCount = nodes.length;
        
        // Calculate optimal grid dimensions with fewer rows for better visibility
        // Rectangular grid with more columns than rows for better screen fit
        const aspectRatio = 1.5; // Wider than tall
        const approxCols = Math.ceil(Math.sqrt(nodeCount * aspectRatio));
        const cols = approxCols;
        const rows = Math.ceil(nodeCount / cols);
        
        // Calculate ultra-compact spacing based on node count
        // Dramatically reduced spacing for maximum density
        // Inverse logarithmic scaling - more nodes = much tighter packing
        const minSpacing = 45; // Absolute minimum spacing
        const spacingMultiplier = 300 / Math.log(nodeCount + 10);
        const baseSpacing = Math.max(minSpacing, spacingMultiplier);
        
        // Use slightly wider horizontal spacing for better readability
        const xSpacing = baseSpacing * 1.2;
        const ySpacing = baseSpacing;
        
        // Calculate total grid dimensions
        const gridWidth = cols * xSpacing;
        const gridHeight = rows * ySpacing;
        
        // Position nodes in grid, starting from top-left
        nodes.forEach((node, i) => {
            // Calculate row and column
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Calculate position, centered on origin
            const x = (col * xSpacing) - (gridWidth / 2) + (xSpacing / 2);
            const y = (row * ySpacing) - (gridHeight / 2) + (ySpacing / 2);
            
            // Minimal jitter to break grid perfection but maintain density
            const jitterX = (Math.random() - 0.5) * (xSpacing * 0.15);
            const jitterY = (Math.random() - 0.5) * (ySpacing * 0.15);
            
            // Assign position
            node.x = x + jitterX;
            node.y = y + jitterY;
        });
    }
    
    /**
     * Configure forces for this layout with optimized parameters
     */
    configureForces(): void {
        console.debug(`[StatementNetworkLayout] Configuring forces`);
        
        // Clear all existing forces
        this.clearAllForces();
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const statementNodes = nodes.filter(n => n.type === 'statement');
        const nodeCount = statementNodes.length;
        
        // Determine if we're dealing with a large or small network
        const isLargeNetwork = nodeCount > 20;
        
        // Get links
        const links = this.getForceLinks();
        
        // Link force with ultra-minimal distances for maximum density
        const linkForce = d3.forceLink<any, any>()
            .id((d: any) => d.id)
            .links(links)
            .distance(link => {
                // Get count of statement nodes for adaptive sizing
                const statementNodes = this.simulation.nodes().filter((n: any) => n.type === 'statement');
                const nodeCount = statementNodes.length;
                
                // Scale base distance inversely with node count
                // More nodes = shorter links to maintain density
                let baseDist;
                if (nodeCount > 50) {
                    baseDist = 40; // Ultra-short for very large networks
                } else if (isLargeNetwork) {
                    baseDist = 50; // Very short for large networks
                } else {
                    baseDist = 70; // Short for small networks
                }
                
                // Direct relationships (statement-to-statement) should be closer
                if ((link as EnhancedLink).relationshipType === 'direct' || 
                    (link as EnhancedLink).type === 'related') {
                    return baseDist * 0.8;
                }
                
                // Keyword relationships - scale distance by strength
                const strength = (link as EnhancedLink).strength || 0.1;
                return baseDist - (strength * baseDist * 0.5);
            })
            .strength(link => {
                // Very strong links to keep connected nodes close together
                // Scale strength based on network size
                const nodeCount = this.simulation.nodes().length;
                let baseStrength;
                
                if (nodeCount > 50) {
                    baseStrength = 1.0; // Maximum strength for very large networks
                } else if (isLargeNetwork) {
                    baseStrength = 0.9; // Very strong for large networks
                } else {
                    baseStrength = 0.8; // Strong for small networks
                }
                
                // Direct relationships get maximum strength
                if ((link as EnhancedLink).relationshipType === 'direct' || 
                    (link as EnhancedLink).type === 'related') {
                    return Math.min(1.0, baseStrength + 0.1); // Cap at 1.0
                }
                
                // Keyword relationships strength
                return baseStrength * ((link as EnhancedLink).strength || 0.5);
            });

        // Charge force - minimal repulsion for ultra-dense layout
        const chargeForce = d3.forceManyBody()
            .strength(d => {
                const node = d as EnhancedNode;
                if (node.type === 'navigation') {
                    return -30; // Minimal repulsion for navigation nodes
                }
                
                // Dramatically reduced repulsion forces for maximum density
                // Scale repulsion inversely with node count - more nodes = less repulsion
                const nodeCount = this.simulation.nodes().length;
                const baseRepulsion = isLargeNetwork ? -150 : -200;
                
                // For very large networks (>50 nodes), reduce repulsion even further
                if (nodeCount > 50) {
                    return baseRepulsion * 0.8; // 20% less repulsion
                }
                
                return baseRepulsion;
            })
            .distanceMin(15) // Ultra-small minimum distance for maximum density
            .distanceMax(isLargeNetwork ? 400 : 500); // Reduced maximum effect distance

        // Collision force - ultra-minimal padding for maximum density
        const collisionForce = d3.forceCollide()
            .radius(d => {
                const node = d as EnhancedNode;
                
                if (node.type === 'navigation') {
                    // Keep normal padding for navigation nodes
                    return node.radius + COORDINATE_SPACE.NODES.PADDING.COLLISION.NAVIGATION;
                }
                
                // For statement nodes, use absolute minimum padding
                // This allows nodes to be positioned extremely close while still avoiding overlap
                // Scale padding inversely with node count - more nodes = less padding
                const basePadding = isLargeNetwork ? 
                    COORDINATE_SPACE.NODES.PADDING.COLLISION.STATEMENT * 0.25 : // 75% reduction for large networks
                    COORDINATE_SPACE.NODES.PADDING.COLLISION.STATEMENT * 0.4;   // 60% reduction for small networks
                
                // For very large networks, scale padding down even further
                const statementNodes = this.simulation.nodes().filter((n: any) => n.type === 'statement');
                if (statementNodes.length > 50) {
                    return node.radius + basePadding * 0.8; // Extra 20% reduction for very large networks
                }
                
                return node.radius + basePadding;
            })
            .strength(0.9) // Slightly reduced to allow minimal overlap if needed for density
            .iterations(isLargeNetwork ? 1 : 2); // Minimum iterations for performance

        // Center force - strong centering for dense packing
        const centerForce = d3.forceCenter(0, 0)
            .strength(isLargeNetwork ? 0.15 : 0.12); // Very strong centering force

        // Apply forces to simulation
        this.simulation
            .force('link', linkForce)
            .force('charge', chargeForce)
            .force('collision', collisionForce)
            .force('center', centerForce);
            
        // Apply sorting forces and additional forces
        this.applySortingForces();
        
        // Higher alphaDacay for faster convergence
        this.simulation.alphaDecay(isLargeNetwork ? 0.04 : 0.03); // Default is 0.02
        this.simulation.velocityDecay(isLargeNetwork ? 0.5 : 0.4); // Default is 0.4
        
        // Run many ticks immediately to force quick convergence
        const tickCount = isLargeNetwork ? 100 : 60;
        for (let i = 0; i < tickCount; i++) {
            this.simulation.tick();
        }
        
        // Restart with near-settled alpha
        this.simulation.alpha(0.1).restart();
    }
    
    /**
     * Apply forces based on current sorting criteria
     * This method positions nodes in relation to the center based on the selected sort criteria
     */
    private applySortingForces(): void {
        // Remove any existing positioning forces to start fresh
        this.simulation.force('positioning', null);
        this.simulation.force('radial', null);
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const statementNodes = nodes.filter(n => n.type === 'statement');
        const nodeCount = statementNodes.length;
        const isLargeNetwork = nodeCount > 20;
        
        // If no statement nodes, nothing to sort
        if (statementNodes.length === 0) return;
        
        console.debug(`[StatementNetworkLayout] Applying sorting forces with: ${this.sortType} ${this.sortDirection}`);
        
        // We'll use a radial force to position nodes based on sorting criteria
        const getSortValue = (node: EnhancedNode): number => {
            if (node.type !== 'statement') return 0;
            
            switch (this.sortType) {
                case 'netPositive':
                    // Higher net votes get higher value (closer to center with desc sort)
                    return this.getNetVotes(node);
                
                case 'totalVotes':
                    // Higher total votes get higher value (closer to center with desc sort)
                    return this.getTotalVotes(node);
                    
                case 'chronological':
                    // Newer statements get higher value (closer to center with desc sort)
                    if (node.metadata?.createdAt) {
                        const timestamp = new Date(node.metadata.createdAt).getTime();
                        // Map timestamp to a reasonable range (newer = higher)
                        return timestamp;
                    }
                    return 0;
                    
                default:
                    return this.getNetVotes(node);
            }
        };
        
        // Find the min and max values for the chosen sort
        let minValue = Infinity;
        let maxValue = -Infinity;
        
        statementNodes.forEach(node => {
            const value = getSortValue(node);
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
        });
        
        // Prevent division by zero
        const valueRange = maxValue - minValue || 1;
        
        // Set the base radius range (distance from center)
        // For large networks, use a smaller range to keep things compact
        let minRadius = isLargeNetwork ? 30 : 50;
        let maxRadius = isLargeNetwork ? 250 : 300;
        
        // For very small networks, use a slightly larger range
        if (nodeCount < 10) {
            minRadius = 70;
            maxRadius = 350;
        }
        
        // Create the radial force to position nodes based on sort value
        const sortingRadial = d3.forceRadial(
            (d: any) => {
                const node = d as EnhancedNode;
                
                // Navigation nodes stay at the periphery
                if (node.type === 'navigation') {
                    return isLargeNetwork ? 450 : 600;
                }
                
                // Calculate the radius based on sort value
                const value = getSortValue(node);
                // Normalize to 0-1 range
                const normalizedValue = (value - minValue) / valueRange;
                
                // Apply radius based on sort direction
                // desc: higher values closer to center (lower radius)
                // asc: higher values farther from center (higher radius)
                let targetRadius;
                if (this.sortDirection === 'desc') {
                    // Higher values (normalized closer to 1) get smaller radius
                    targetRadius = maxRadius - (normalizedValue * (maxRadius - minRadius));
                } else {
                    // Higher values (normalized closer to 1) get larger radius
                    targetRadius = minRadius + (normalizedValue * (maxRadius - minRadius));
                }
                
                // Ensure minimum radius
                return Math.max(minRadius, targetRadius);
            },
            0, 0 // Center at origin
        ).strength((d: any) => {
            const node = d as EnhancedNode;
            // Stronger force for navigation nodes, moderate for statements
            return node.type === 'navigation' ? 1.0 : 0.4;
        });
        
        // Apply the sorting radial force
        this.simulation.force('radial', sortingRadial);
        
        // For large networks, add additional forces for better clustering
        if (isLargeNetwork) {
            // Add mild x and y forces for large networks
            this.simulation.force('x', d3.forceX(0).strength(0.03));
            this.simulation.force('y', d3.forceY(0).strength(0.03));
        }
        
        // Debug output
        console.debug(`[StatementNetworkLayout] Applied sorting forces:`, {
            type: this.sortType,
            direction: this.sortDirection,
            valueRange: { min: minValue, max: maxValue },
            radiusRange: { min: minRadius, max: maxRadius }
        });
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
        
        // Start simulation with very low alpha for minimal animation
        // This essentially means the layout is almost settled already
        const alpha = skipAnimation ? 0.01 : 0.1;
        this.simulation.alpha(alpha).restart();
        
        // Force additional ticks immediately to ensure settled layout
        const tickCount = nodes.length > 20 ? 150 : 100;
        for (let i = 0; i < tickCount; i++) {
            this.simulation.tick();
        }
        
        // Stop simulation to prevent further movement
        // This makes the layout appear instantly settled
        if (skipAnimation) {
            this.simulation.stop();
        }
    }
}