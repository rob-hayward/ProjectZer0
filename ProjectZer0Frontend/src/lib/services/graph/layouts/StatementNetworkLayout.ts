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
import { get } from 'svelte/store';
// Import statementNetworkStore directly if possible
// import { statementNetworkStore } from '../../../stores/statementNetworkStore';

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
            // Import directly using ES imports (at the top of file)
            // Instead of trying to use require, we'll access the store from the window
            // This approach works in browser environments
            if (typeof window !== 'undefined' && 'statementNetworkStore' in window) {
                // @ts-ignore - Access the globally available store
                const store = window.statementNetworkStore;
                
                if (store && typeof store.subscribe === 'function') {
                    this.storeSubscription = store.subscribe((state: any) => {
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
                                for (let i = 0; i < 10; i++) {
                                    this.simulation.tick();
                                }
                                
                                // Restart simulation with low alpha for smooth transition
                                this.simulation.alpha(0.1).restart();
                            }
                        }
                    });
                    
                    console.debug('[StatementNetworkLayout] Successfully subscribed to statementNetworkStore');
                } else {
                    console.warn('[StatementNetworkLayout] statementNetworkStore exists but lacks subscribe method');
                }
            } else {
                // Graceful fallback if store is not available
                console.warn('[StatementNetworkLayout] statementNetworkStore not available on window, using default settings');
            }
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
            'manyBody', 'radial', 'positioning', 'custom',
            'positionX', 'positionY'
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
            // More statement nodes = navigation nodes moved further out
            const statementNodes = nodes.filter(n => n.type === 'statement');
            const nodeCount = statementNodes.length;
            
            // Adaptive radius calculation - increased to give more space
            // Larger radius for all cases to reduce crowding
            const minRadius = 600; // Minimum radius for navigation nodes
            const maxRadius = 750; // Maximum radius for navigation nodes
            const radiusRange = maxRadius - minRadius;
            
            // Inverse logarithmic scaling - more nodes = further out navigation
            const scaleFactor = Math.min(1, Math.log(nodeCount + 1) / Math.log(60));
            const radius = minRadius + (radiusRange * scaleFactor);
            
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            node.fx = node.x; // Fix navigation nodes in place
            node.fy = node.y;
        });
        
        // Position statement nodes using the deterministic concentric layout
        const statementNodes = nodes.filter(n => n.type === 'statement');
        this.positionNodesInConcentric(statementNodes);
    }
    
    /**
     * Position nodes in a deterministic concentric layout based on net votes
     * This ensures nodes with higher votes are ALWAYS closer to the center
     */
    private positionNodesInConcentric(nodes: EnhancedNode[]): void {
        // 1. First, sort nodes strictly by net votes (descending)
        const sortedNodes = [...nodes].sort((a, b) => {
            const aVotes = this.getNetVotes(a);
            const bVotes = this.getNetVotes(b);
            return bVotes - aVotes; // Higher votes first
        });
        
        console.debug('[StatementNetworkLayout] Positioning nodes in concentric layout');
        console.debug('[StatementNetworkLayout] Top 3 nodes by votes:', 
            sortedNodes.slice(0, 3).map(n => ({
                id: n.id.substring(0, 8),
                netVotes: this.getNetVotes(n)
            }))
        );

        // 2. Configure spacing parameters
        const nodeCount = nodes.length;
        // Increase base spacing to reduce overcrowding
        const baseSpacing = Math.max(60, 250 - Math.log(nodeCount) * 30);
        
        // 3. Calculate nodes per ring to create a balanced layout
        const nodesPerRing = [1, 6, 12, 18, 24, 32, 48, 64]; // Increasing capacity per ring
        const rings: number[] = [];
        let remaining = sortedNodes.length;
        let ringIndex = 0;
        
        // Create rings with appropriate capacity
        while (remaining > 0) {
            const capacity = ringIndex < nodesPerRing.length 
                ? nodesPerRing[ringIndex] 
                : Math.floor(15 * Math.PI * (ringIndex + 1)); // Approximate circumference scaling
                
            rings.push(Math.min(capacity, remaining));
            remaining -= capacity;
            ringIndex++;
        }
        
        // 4. Position each node in its correct ring based on vote ranking
        let nodeIndex = 0;
        for (let r = 0; r < rings.length; r++) {
            const ring = rings[r];
            const radius = r === 0 ? 0 : baseSpacing * Math.pow(r, 1.2); // Non-linear radius scaling
            
            // Position nodes in this ring
            for (let i = 0; i < ring; i++) {
                const node = sortedNodes[nodeIndex];
                
                if (r === 0) {
                    // Highest voted node at exact center
                    node.x = 0;
                    node.y = 0;
                } else {
                    // Position around the circle
                    const angle = (i / ring) * 2 * Math.PI; // Evenly spaced around circle
                    node.x = Math.cos(angle) * radius;
                    node.y = Math.sin(angle) * radius;
                    
                    // Add small jitter to reduce perfect circle artifact
                    const jitterRadius = radius * 0.05; // 5% jitter
                    node.x += (Math.random() - 0.5) * jitterRadius;
                    node.y += (Math.random() - 0.5) * jitterRadius;
                }
                
                // Store the ring number in metadata for future use
                if (node.metadata) {
                    // Use a type assertion to add the custom property
                    (node.metadata as any).ring = r;
                }
                
                nodeIndex++;
            }
        }
        
        // 5. Log the placement of highest and lowest voted nodes for verification
        if (sortedNodes.length > 0) {
            const highest = sortedNodes[0];
            const lowest = sortedNodes[sortedNodes.length - 1];
            
            console.debug('[StatementNetworkLayout] Highest voted node placement:', {
                id: highest.id.substring(0, 8),
                netVotes: this.getNetVotes(highest),
                position: { 
                    x: highest.x ?? 0, 
                    y: highest.y ?? 0 
                },
                distance: Math.sqrt(
                    (highest.x ?? 0) * (highest.x ?? 0) + 
                    (highest.y ?? 0) * (highest.y ?? 0)
                )
            });
            
            console.debug('[StatementNetworkLayout] Lowest voted node placement:', {
                id: lowest.id.substring(0, 8),
                netVotes: this.getNetVotes(lowest),
                position: { 
                    x: lowest.x ?? 0, 
                    y: lowest.y ?? 0 
                },
                distance: Math.sqrt(
                    (lowest.x ?? 0) * (lowest.x ?? 0) + 
                    (lowest.y ?? 0) * (lowest.y ?? 0)
                )
            });
        }
    }
    
    /**
     * Configure forces for improved animations
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
        
        // Link force - optimized for deterministic, fixed layout with more pleasing animations
        const linkForce = d3.forceLink<any, any>()
            .id((d: any) => d.id)
            .links(links)
            .distance(link => {
                // Keep links at a reasonable distance for a spacious layout
                const baseDist = isLargeNetwork ? 80 : 100; // Increased for more space
                
                // Direct relationships should be closer
                if ((link as EnhancedLink).relationshipType === 'direct' || 
                    (link as EnhancedLink).type === 'related') {
                    return baseDist * 0.85;
                }
                
                // Default for keyword relationships
                return baseDist;
            })
            .strength(0.5); // Moderate strength for gentler animations

        // Charge force - minimal to preserve deterministic layout but allow some movement
        const chargeForce = d3.forceManyBody()
            .strength((d: any) => {
                const node = d as EnhancedNode;
                if (node.type === 'navigation') {
                    return -20; // Very weak repulsion for navigation nodes
                }
                
                // Moderate repulsion for statements to allow natural spacing
                return isLargeNetwork ? -60 : -80;
            })
            .distanceMin(15) 
            .distanceMax(250); // Reduced max distance for better local behavior

        // Collision force - firm to prevent overlap but allow some flexibility
        const collisionForce = d3.forceCollide()
            .radius((d: any) => {
                const node = d as EnhancedNode;
                
                if (node.type === 'navigation') {
                    return node.radius + COORDINATE_SPACE.NODES.PADDING.COLLISION.NAVIGATION;
                }
                
                // Increased padding to reduce crowding, with extra for high-vote nodes
                const basePadding = COORDINATE_SPACE.NODES.PADDING.COLLISION.STATEMENT * 0.7;
                
                // Slightly larger collision radius for higher voted nodes
                if (node.type === 'statement') {
                    const netVotes = this.getNetVotes(node);
                    if (netVotes > 0) {
                        const voteFactor = Math.min(1.3, 1 + Math.log(netVotes + 1) / 15);
                        return node.radius + (basePadding * voteFactor);
                    }
                }
                
                return node.radius + basePadding;
            })
            .strength(0.7) // Strong but not rigid, allows some flexibility
            .iterations(2); // Fewer iterations for better performance

        // Center force - light to maintain overall centering
        const centerForce = d3.forceCenter(0, 0)
            .strength(0.03); // Very weak to preserve deterministic layout
            
        // Position preservation force - modified to allow more natural movement
        // This preserves vote-based ordering while allowing pleasing animations
        const positioningForceX = d3.forceX()
            .x((d: any) => {
                const node = d as EnhancedNode;
                
                // If it's a statement node, we want to maintain the relative distances
                // but allow some flexibility for more natural spacing
                if (node.type === 'statement') {
                    // Return the node's initial x position with a weakening factor
                    // This allows nodes to move a bit from their assigned positions
                    const weakening = 0.8; // 80% pull toward assigned position
                    return (node.x || 0) * weakening;
                }
                
                // Return exact position for navigation and other nodes
                return node.x || 0;
            })
            .strength((d: any) => {
                const node = d as EnhancedNode;
                
                // Higher strength for navigation nodes (fixed)
                if (node.type === 'navigation') {
                    return 0.7;
                }
                
                // For statement nodes, use weaker forces to allow natural movement
                // But adjust based on vote count - important nodes stay closer to assigned positions
                if (node.type === 'statement') {
                    const netVotes = this.getNetVotes(node);
                    if (netVotes > 10) {
                        return 0.25; // Stronger positioning for high-vote nodes
                    }
                    
                    return 0.15; // Weaker positioning for low-vote nodes
                }
                
                return 0.1; // Default
            });
            
        const positioningForceY = d3.forceY()
            .y((d: any) => {
                const node = d as EnhancedNode;
                
                // Same approach as X force
                if (node.type === 'statement') {
                    const weakening = 0.8;
                    return (node.y || 0) * weakening;
                }
                
                return node.y || 0;
            })
            .strength((d: any) => {
                const node = d as EnhancedNode;
                
                if (node.type === 'navigation') {
                    return 0.7;
                }
                
                if (node.type === 'statement') {
                    const netVotes = this.getNetVotes(node);
                    if (netVotes > 10) {
                        return 0.25;
                    }
                    
                    return 0.15;
                }
                
                return 0.1;
            });

        // Apply forces to simulation
        this.simulation
            .force('link', linkForce)
            .force('charge', chargeForce)
            .force('collision', collisionForce)
            .force('center', centerForce)
            .force('positionX', positioningForceX)
            .force('positionY', positioningForceY);
    
        // Optimize simulation parameters for good animations
        this.simulation.alphaDecay(0.03); // Medium decay for better animations
        this.simulation.velocityDecay(0.45); // Medium damping for natural movement
        
        // Run minimal ticks for initial positioning
        const tickCount = 5;
        console.debug(`[StatementNetworkLayout] Running ${tickCount} initial force ticks`);
        
        for (let i = 0; i < tickCount; i++) {
            this.simulation.tick();
        }
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
                
                if (node.type !== 'statement') {
                    return maxRadius; // Other non-statement nodes go to the outer edge
                }
                
                // Calculate the radius based on sort value
                const value = getSortValue(node);
                
                // Apply non-linear scaling to create more dramatic visual effect
                // This will make high-voted statements much closer to center
                // and negative statements much further away
                
                // Normalize to 0-1 range
                let normalizedValue: number;
                
                if (this.sortType === 'netPositive') {
                    // Special case for netPositive - we want to handle negative values differently
                    // and create a more dramatic separation between positive and negative
                    
                    if (value >= 0) {
                        // For positive votes, map from 0 to maxValue
                        // Use a non-linear (sqrt) scaling to emphasize differences
                        // Higher values = closer to center (smaller radius)
                        const posRange = Math.max(1, maxValue);
                        normalizedValue = Math.sqrt(value / posRange);
                    } else {
                        // For negative votes, map from minValue to 0
                        // Use negative values to push further from center than neutral nodes
                        const negRange = Math.abs(Math.min(0, minValue));
                        if (negRange === 0) {
                            normalizedValue = 0; // No negative values in dataset
                        } else {
                            normalizedValue = -0.2 * Math.sqrt(Math.abs(value) / negRange);
                        }
                    }
                } else {
                    // Standard linear normalization for other sort types
                    normalizedValue = (value - minValue) / valueRange;
                }
                
                // Apply radius based on sort direction and normalized value
                let targetRadius: number;
                
                if (this.sortType === 'netPositive') {
                    if (this.sortDirection === 'desc') {
                        // For netPositive desc - dramatic scaling
                        if (normalizedValue >= 0) {
                            // Positive votes - closer to center
                            // Square root for non-linear scaling
                            targetRadius = minRadius + ((1 - normalizedValue) * (maxRadius - minRadius) * 0.6);
                        } else {
                            // Negative votes - further from center than maxRadius
                            // Push negative nodes further out
                            targetRadius = maxRadius * (1 - normalizedValue);
                        }
                    } else {
                        // For netPositive asc - reverse the logic
                        if (normalizedValue >= 0) {
                            // Positive votes - further from center
                            targetRadius = minRadius + (normalizedValue * (maxRadius - minRadius) * 0.6);
                        } else {
                            // Negative votes - closer to center
                            targetRadius = maxRadius * (1 + normalizedValue);
                        }
                    }
                } else {
                    // Standard linear mapping for other sort types
                    if (this.sortDirection === 'desc') {
                        // Higher values (normalized closer to 1) get smaller radius
                        targetRadius = maxRadius - (normalizedValue * (maxRadius - minRadius));
                    } else {
                        // Higher values (normalized closer to 1) get larger radius
                        targetRadius = minRadius + (normalizedValue * (maxRadius - minRadius));
                    }
                }
                
                // Ensure minimum radius
                return Math.max(minRadius, targetRadius);
            },
            0, 0 // Center at origin
        ).strength(0.2); // Reduced strength to allow position preservation forces to dominate
        
        // Apply the sorting radial force
        this.simulation.force('radial', sortingRadial);
        
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
     * Uses the new netVotes property directly
     */
    private getNetVotes(node: EnhancedNode): number {
        if (node.type !== 'statement') return 0;
        
        if (node.data) {
            // Try to use the netVotes property first if available
            if ('netVotes' in node.data) {
                return this.getNeo4jNumber(node.data.netVotes);
            }
            
            // Fall back to calculating from positive/negative votes if needed
            if ('positiveVotes' in node.data && 'negativeVotes' in node.data) {
                const positiveVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
                const negativeVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
                return positiveVotes - negativeVotes;
            }
        }
        
        // Try to use metadata if available
        if (node.metadata?.votes !== undefined) {
            return node.metadata.votes;
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
     * Handle node mode changes (preview/detail) with stable positioning
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
        const oldPosition = { x: node.x ?? 0, y: node.y ?? 0 };
        
        // Stop the simulation while we make changes
        this.simulation.stop();
        
        // Update the node properties
        node.mode = mode;
        node.expanded = mode === 'detail';
        node.radius = this.getNodeRadius(node);
        
        if (node.metadata) {
            (node.metadata as any).isDetail = mode === 'detail';
        }
        
        // Important: Fix node position when expanding to detail view
        if (mode === 'detail') {
            // Fix node in place to prevent it from moving during expansion
            node.fx = node.x;
            node.fy = node.y;
            
            // Find the camera center coordinates
            // This is for centering the view on the expanded node later
            const centerX = node.x ?? 0;
            const centerY = node.y ?? 0;
            
            console.debug(`[StatementNetworkLayout] Fixing expanded node position:`, {
                x: centerX,
                y: centerY
            });
        } else {
            // When collapsing, release node position constraint
            node.fx = undefined;
            node.fy = undefined;
        }
        
        console.debug(`[StatementNetworkLayout] Node updated:`, {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius: node.radius,
            position: { x: node.x, y: node.y }
        });
        
        // Update the simulation with the new node properties
        this.simulation.nodes(nodes);
        
        // Reconfigure collision detection with the new node size
        // but keep all other forces minimal to prevent chaotic movement
        const collisionForce = d3.forceCollide()
            .radius((d: any) => {
                const n = d as EnhancedNode;
                // Give expanded nodes more space
                if (n.id === nodeId && mode === 'detail') {
                    return n.radius * 1.1; // Extra padding for expanded node
                }
                return n.radius + 20; // Standard padding for other nodes
            })
            .strength(1) // Maximum strength to prevent overlap
            .iterations(4); // More iterations for better collision detection
        
        // Apply minimal forces when changing node mode
        this.simulation
            .force('collision', collisionForce)
            .force('charge', d3.forceManyBody().strength(-50)) // Minimal repulsion
            .force('x', null) // Remove x force
            .force('y', null); // Remove y force
        
        // Keep existing links
        const linkForce = this.simulation.force('link');
        if (linkForce) {
            // Reduce link strength to minimize movement
            (linkForce as any).strength(0.1);
        }
        
        // Run just a few ticks with very high alpha decay
        this.simulation.alphaDecay(0.2); // Very quick decay
        this.simulation.velocityDecay(0.8); // High damping
        
        // Minimal ticks for adjustment
        for (let i = 0; i < 10; i++) {
            this.simulation.tick();
        }
        
        // Restore normal forces
        this.configureForces();
        
        // If expanding to detail, notify that we want to center the view on this node
        if (mode === 'detail') {
            // This would be handled by the parent component to center the view
            // We could emit an event or call a callback here
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                const event = new CustomEvent('nodeExpanded', { 
                    detail: { 
                        nodeId, 
                        x: node.x ?? 0, 
                        y: node.y ?? 0
                    } 
                });
                window.dispatchEvent(event);
            }
        }
        
        // Restart with very low alpha
        this.simulation.alpha(0.05).restart();
    }
    
    /**
     * Override updateData to set up the network layout with better animation
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

        // Stop any existing simulation
        this.simulation.stop();
        
        // Initialize node positions - this does the deterministic layout
        this.initializeNodePositions(nodes);
        
        // For animated load, we'll start with nodes in a more compact arrangement
        // and let them expand to their proper positions for a pleasing animation
        if (!skipAnimation) {
            nodes.forEach(node => {
                if (node.type === 'statement') {
                    // Contract positions toward center by 40%
                    if (node.x !== undefined && node.y !== undefined) {
                        node.x *= 0.6;
                        node.y *= 0.6;
                    }
                }
            });
        }
        
        // Update nodes in the simulation
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Configure forces
        this.configureForces();
        
        // For animated load, use hybrid approach with two phases:
        // 1. Quick opening animation with higher velocity
        // 2. Gentle settling with low alpha
        if (!skipAnimation) {
            // Phase 1: Opening animation - faster with more energy
            this.simulation
                .alpha(0.3)
                .alphaDecay(0.02) // Slower decay for more movement
                .velocityDecay(0.4) // Lower decay for more momentum
                .restart();
                
            // After a short time, transition to gentle settling phase
            setTimeout(() => {
                // Phase 2: Settling - restore original parameters
                this.simulation
                    .alphaDecay(0.05) // Higher decay to settle quickly
                    .velocityDecay(0.6) // Higher damping
                    .alpha(0.1) // Lower energy
                    .restart();
            }, 600); // 600ms is enough for opening animation
        } else {
            // For immediate layout, just set alpha to near zero
            this.simulation.alpha(0.01);
            
            // Run a few final ticks to settle everything
            for (let i = 0; i < 5; i++) {
                this.simulation.tick();
            }
            
            // Stop simulation completely
            this.simulation.stop();
        }
    }
}