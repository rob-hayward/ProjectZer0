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
// Import statementNetworkStore directly
import { statementNetworkStore, type NetworkSortType, type NetworkSortDirection } from '../../../stores/statementNetworkStore';
import { coordinateSystem } from '../CoordinateSystem';

/**
 * Layout strategy for displaying multiple statement nodes in a network view
 * 
 * Features:
 * - Force-directed layout for statements and their relationships
 * - Sorting based on votes (net positive towards center by default)
 * - Support for preview/detail mode transitions
 * - Dynamic link distance based on relationship strength
 * - Performance optimizations for zooming and panning
 */
export class StatementNetworkLayout extends BaseLayoutStrategy {
    private sortType: NetworkSortType = 'netPositive';
    private sortDirection: NetworkSortDirection = 'desc';
    // Default zoom level for initial view - tuned for optimal viewing
    private initialZoom = COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM;
    private storeSubscription: (() => void) | null = null;
    private isZooming = false;
    private zoomDebounceTimer: any = null;
    private errorRetryCount = 0;
    private maxRetries = 3;
    
    // Cache frequently accessed data for performance
    private cachedNodePositions = new Map<string, {x: number, y: number}>();
    private cachedVoteValues = new Map<string, number>();
    private lastTickTime = 0;
    private tickThrottleTime = 16; // ~60fps
    
    // Cache expanded nodes for performance and stability
    private expandedNodes: Map<string, { 
        previousPosition: {x: number, y: number},
        transitioning: boolean,
        transitionState: 'expanding' | 'expanded' | 'collapsing' | 'collapsed',
        transitionStart: number
    }> = new Map();

    // Visibility tracking for consistent state management
    private hiddenNodes: Map<string, boolean> = new Map();
    
    // Transition timing configuration
    private readonly TRANSITION_DURATION = 300; // ms
    
    // Community standards constants
    private readonly COMMUNITY_STANDARDS = {
        NEGATIVE_VOTES_THRESHOLD: 0  // Nodes with net votes ≤ this value should be hidden
    };
    
    // Last scale is tracked at the class level in the property declaration above

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug(`[StatementNetworkLayout] Created for view: ${viewType}, dimensions: ${width}x${height}`);
        
        // Subscribe to the statementNetworkStore to get sort changes
        this.subscribeToStoreChanges();
        
        // Subscribe to zoom events to optimize performance during zooming
        this.setupZoomOptimization();
    }

    /**
     * Subscribe to statementNetworkStore changes to get updates on sort settings
     */
    private subscribeToStoreChanges(): void {
        try {
            // Direct import and subscription to the statementNetworkStore
            if (statementNetworkStore && typeof statementNetworkStore.subscribe === 'function') {
                this.storeSubscription = statementNetworkStore.subscribe((state) => {
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
                        
                        // Skip reconfiguration if we're currently zooming to avoid stuttering
                        if (this.isZooming) {
                            console.debug('[StatementNetworkLayout] Delaying sort reconfiguration until zoom completes');
                            return;
                        }
                        
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
                console.warn('[StatementNetworkLayout] statementNetworkStore not available or missing subscribe method');
                this.scheduleRetry('subscribeToStoreChanges');
            }
        } catch (error) {
            console.error('[StatementNetworkLayout] Error subscribing to statementNetworkStore:', error);
            this.scheduleRetry('subscribeToStoreChanges');
        }
    }
    
    /**
     * Set up optimizations for zoom and pan operations
     */
    private setupZoomOptimization(): void {
        // Listen for zoom events
        if (typeof window !== 'undefined') {
            // Listen for zoom start/end events from the coordinate system
            window.addEventListener('zoom-start', () => {
                this.isZooming = true;
                
                // Pause simulation during zooming for better performance
                if (this.simulation) {
                    this.simulation.stop();
                }
                
                console.debug('[StatementNetworkLayout] Zoom started, optimization enabled');
            });
            
            window.addEventListener('zoom-end', () => {
                // Use debounce to prevent rapid start/stop cycles
                if (this.zoomDebounceTimer) {
                    clearTimeout(this.zoomDebounceTimer);
                }
                
                this.zoomDebounceTimer = setTimeout(() => {
                    this.isZooming = false;
                    
                    // Restart simulation at low alpha after zooming stops
                    if (this.simulation) {
                        this.simulation.alpha(0.1).restart();
                    }
                    
                    console.debug('[StatementNetworkLayout] Zoom ended, optimization disabled');
                }, 300); // 300ms debounce
            });
            
            // Fallback in case coordinate system events aren't available
            // Monitor transform changes directly
            coordinateSystem.transform.subscribe((transform) => {
                // Skip if we're already handling via explicit events
                if (this.isZooming) return;
                
                // We can detect zooming by tracking transform.k changes
                const currentScale = transform.k;
                
                // Store scale for comparison on next update
                if (!this.lastScale) {
                    this.lastScale = currentScale;
                } else if (Math.abs(this.lastScale - currentScale) > 0.001) {
                    // Scale changed significantly - zooming activity detected
                    this.lastScale = currentScale;
                    
                    // Set zooming flag if not already set
                    if (!this.isZooming) {
                        this.isZooming = true;
                        
                        // Pause simulation during zooming
                        if (this.simulation) {
                            this.simulation.stop();
                        }
                        
                        console.debug('[StatementNetworkLayout] Zoom detected from transform, optimization enabled');
                        
                        // Set up delayed check to detect when zooming stops
                        if (this.zoomDebounceTimer) {
                            clearTimeout(this.zoomDebounceTimer);
                        }
                        
                        this.zoomDebounceTimer = setTimeout(() => {
                            this.isZooming = false;
                            
                            // Restart simulation at low alpha
                            if (this.simulation) {
                                this.simulation.alpha(0.1).restart(); 
                            }
                            
                            console.debug('[StatementNetworkLayout] No zoom activity for 300ms, optimization disabled');
                        }, 300);
                    }
                }
            });
        }
    }
    
    /**
     * Retry a failed operation with exponential backoff
     */
    private scheduleRetry(operation: string): void {
        if (this.errorRetryCount >= this.maxRetries) {
            console.warn(`[StatementNetworkLayout] Maximum retry attempts (${this.maxRetries}) reached for ${operation}`);
            return;
        }
        
        // Exponential backoff with jitter
        const baseDelay = 500; // 500ms
        const delay = baseDelay * Math.pow(1.5, this.errorRetryCount) * (0.9 + Math.random() * 0.2);
        
        console.log(`[StatementNetworkLayout] Scheduling retry #${this.errorRetryCount + 1} for ${operation} in ${delay.toFixed(0)}ms`);
        
        setTimeout(() => {
            this.errorRetryCount++;
            
            console.log(`[StatementNetworkLayout] Retrying ${operation} (attempt ${this.errorRetryCount}/${this.maxRetries})`);
            
            // Attempt the operation again
            if (operation === 'subscribeToStoreChanges') {
                this.subscribeToStoreChanges();
            }
            // Add other operations here if needed
        }, delay);
    }
    
    // Track last scale for zoom detection
    private lastScale: number | null = null;

    /**
     * Clean up resources when this layout is no longer needed
     */
    public dispose(): void {
        // Unsubscribe from the store
        if (this.storeSubscription) {
            this.storeSubscription();
            this.storeSubscription = null;
        }
        
        // Clear any pending timers
        if (this.zoomDebounceTimer) {
            clearTimeout(this.zoomDebounceTimer);
            this.zoomDebounceTimer = null;
        }
        
        // Remove event listeners
        if (typeof window !== 'undefined') {
            window.removeEventListener('zoom-start', () => {});
            window.removeEventListener('zoom-end', () => {});
        }
        
        // Clear caches
        this.cachedNodePositions.clear();
        this.cachedVoteValues.clear();
        
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
        
        // IMPORTANT: Apply visibility standards BEFORE positioning
        // This ensures nodes that should be hidden by community standards are hidden
        this.applyCommunityVisibilityStandards(nodes);
        
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
            
            // Cache position for quick access
            this.cachedNodePositions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
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
                
                // Cache the position for quick access
                this.cachedNodePositions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
                
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
                    Math.pow(highest.x ?? 0, 2) + 
                    Math.pow(highest.y ?? 0, 2)
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
                    Math.pow(lowest.x ?? 0, 2) + 
                    Math.pow(lowest.y ?? 0, 2)
                )
            });
        }
    }
    
    /**
     * Configure forces for improved animations
     */
    configureForces(): void {
        // Skip if currently zooming to reduce unnecessary calculations
        if (this.isZooming) {
            console.debug(`[StatementNetworkLayout] Skipping force configuration during zooming`);
            return;
        }
        
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
                
                // Use cached positions for better performance
                const cachedPos = this.cachedNodePositions.get(node.id);
                
                // If it's a statement node, we want to maintain the relative distances
                // but allow some flexibility for more natural spacing
                if (node.type === 'statement') {
                    // Return the node's initial x position with a weakening factor
                    // This allows nodes to move a bit from their assigned positions
                    const weakening = 0.8; // 80% pull toward assigned position
                    
                    // Use cached position if available, otherwise use current position
                    const baseX = cachedPos ? cachedPos.x : (node.x || 0);
                    return baseX * weakening;
                }
                
                // Return exact position for navigation and other nodes
                return cachedPos ? cachedPos.x : (node.x || 0);
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
                
                // Use cached positions for better performance
                const cachedPos = this.cachedNodePositions.get(node.id);
                
                // Same approach as X force
                if (node.type === 'statement') {
                    const weakening = 0.8;
                    
                    // Use cached position if available, otherwise use current position
                    const baseY = cachedPos ? cachedPos.y : (node.y || 0);
                    return baseY * weakening;
                }
                
                return cachedPos ? cachedPos.y : (node.y || 0);
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
        // Skip if currently zooming
        if (this.isZooming) return;
        
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
            
            // Check if we have a cached value for better performance
            if (this.cachedVoteValues.has(node.id) && this.sortType === 'netPositive') {
                return this.cachedVoteValues.get(node.id) || 0;
            }
            
            let value = 0;
            
            switch (this.sortType) {
                case 'netPositive':
                    // Higher net votes get higher value (closer to center with desc sort)
                    value = this.getNetVotes(node);
                    // Cache the value for performance
                    this.cachedVoteValues.set(node.id, value);
                    return value;
                
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
     * Uses the new netVotes property directly if available
     * Cache results for better performance
     */
    private getNetVotes(node: EnhancedNode): number {
        if (node.type !== 'statement') return 0;
        
        // Return cached value if available
        if (this.cachedVoteValues.has(node.id)) {
            return this.cachedVoteValues.get(node.id) || 0;
        }
        
        let netVotes = 0;
        
        if (node.data) {
            // Try to use the netVotes property first if available
            if ('netVotes' in node.data) {
                netVotes = this.getNeo4jNumber(node.data.netVotes);
            }
            // Fall back to calculating from positive/negative votes if needed
            else if ('positiveVotes' in node.data && 'negativeVotes' in node.data) {
                const positiveVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
                const negativeVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
                netVotes = positiveVotes - negativeVotes;
            }
        }
        
        // Try to use metadata if available and no direct property
        if (netVotes === 0 && node.metadata?.votes !== undefined) {
            netVotes = node.metadata.votes;
        }
        
        // Cache the result for future use
        this.cachedVoteValues.set(node.id, netVotes);
        
        return netVotes;
    }
    
    /**
     * Check if a node should be hidden based on community standards
     * This applies our default visibility rules (negative votes = hidden)
     */
    private shouldBeHiddenByCommunityStandards(node: EnhancedNode): boolean {
        if (node.type !== 'statement') return false;
        
        // Get net votes for this node
        const netVotes = this.getNetVotes(node);
        
        // Check if net votes are below our threshold
        const shouldBeHidden = netVotes <= this.COMMUNITY_STANDARDS.NEGATIVE_VOTES_THRESHOLD;
        
        if (shouldBeHidden) {
            console.debug(`[StatementNetworkLayout] Node ${node.id.substring(0,8)} should be hidden by community standards:`, {
                netVotes,
                threshold: this.COMMUNITY_STANDARDS.NEGATIVE_VOTES_THRESHOLD
            });
        }
        
        return shouldBeHidden;
    }
    
    /**
     * Apply community standards for visibility to all nodes
     * This is a preprocessing step before layout
     */
    private applyCommunityVisibilityStandards(nodes: EnhancedNode[]): void {
        console.debug('[StatementNetworkLayout] Applying community visibility standards');
        
        let hiddenCount = 0;
        
        nodes.forEach(node => {
            if (node.type === 'statement') {
                // Skip nodes that already have explicit visibility preferences
                // User preferences always override community standards
                if (node.hiddenReason === 'user') {
                    console.debug(`[StatementNetworkLayout] Node ${node.id.substring(0,8)} has user visibility preference: ${node.isHidden}`);
                    this.hiddenNodes.set(node.id, node.isHidden || false);
                    return;
                }
                
                // Check if node should be hidden by community standards
                const shouldBeHidden = this.shouldBeHiddenByCommunityStandards(node);
                
                // Update node visibility
                if (shouldBeHidden && !node.isHidden) {
                    node.isHidden = true;
                    node.hiddenReason = 'community';
                    node.radius = this.getNodeRadius(node); // Update radius
                    this.hiddenNodes.set(node.id, true);
                    hiddenCount++;
                    
                    console.debug(`[StatementNetworkLayout] Hiding node ${node.id.substring(0,8)} based on community standards`);
                } else {
                    // Update tracking state without changing node
                    this.hiddenNodes.set(node.id, node.isHidden || false);
                }
            }
        });
        
        console.debug(`[StatementNetworkLayout] Applied community standards: ${hiddenCount} nodes hidden`);
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
     * Implements a state machine for expansion/collapse
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug(`[StatementNetworkLayout] Node state change`, { 
            nodeId, 
            mode 
        });
        
        // Skip if currently zooming
        if (this.isZooming) {
            console.debug(`[StatementNetworkLayout] Delaying node state change until zoom completes`);
            
            // Schedule the state change for later
            setTimeout(() => {
                if (!this.isZooming) {
                    this.handleNodeStateChange(nodeId, mode);
                }
            }, 300);
            
            return;
        }
        
        // Get current nodes from simulation
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find the target node
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) {
            console.warn(`[StatementNetworkLayout] Node not found for state change:`, nodeId);
            return;
        }
        
        const node = nodes[nodeIndex];
        
        // Check if node is already in a transition
        const transitionData = this.expandedNodes.get(nodeId);
        if (transitionData?.transitioning) {
            console.debug(`[StatementNetworkLayout] Node is already in transition state: ${transitionData.transitionState}`);
            
            // If requesting the same mode as the transition target, just ignore
            if ((mode === 'detail' && 
                (transitionData.transitionState === 'expanding' || transitionData.transitionState === 'expanded')) ||
                (mode === 'preview' && 
                (transitionData.transitionState === 'collapsing' || transitionData.transitionState === 'collapsed'))) {
                
                console.debug(`[StatementNetworkLayout] Ignoring redundant state change request`);
                return;
            }
            
            // If transitioning in opposite direction, let's just complete the current transition immediately
            console.debug(`[StatementNetworkLayout] Completing current transition immediately to allow direction change`);
            
            // Immediately finish the current transition
            if (transitionData.transitionState === 'expanding') {
                // Finish expanding
                transitionData.transitionState = 'expanded';
            } else if (transitionData.transitionState === 'collapsing') {
                // Finish collapsing
                transitionData.transitionState = 'collapsed';
            }
            
            transitionData.transitioning = false;
        }
        
        // Store old values for comparison
        const oldMode = node.mode;
        const oldRadius = node.radius;
        // Use null coalescing operators to safely handle possibly null values
        const oldPosition = { x: node.x ?? 0, y: node.y ?? 0 };
        
        // Stop the simulation while we make changes
        this.simulation.stop();
        
        // Update node properties based on requested mode
        node.mode = mode;
        node.expanded = mode === 'detail';
        node.radius = this.getNodeRadius(node);
        
        if (node.metadata) {
            (node.metadata as any).isDetail = mode === 'detail';
        }
        
        // Update or create transition data
        if (mode === 'detail') {
            // Fix node position when expanding to detail view
            node.fx = node.x ?? 0;
            node.fy = node.y ?? 0;
            
            // Store position for reverting if needed
            const position = { x: node.x ?? 0, y: node.y ?? 0 };
            
            this.expandedNodes.set(nodeId, {
                previousPosition: position,
                transitioning: true,
                transitionState: 'expanding' as const,
                transitionStart: performance.now()
            });
            
            // Find the camera center coordinates for view centering
            const centerX = node.x ?? 0;
            const centerY = node.y ?? 0;
            
            console.debug(`[StatementNetworkLayout] Starting expansion transition:`, {
                nodeId,
                position,
                newRadius: node.radius
            });
            
            // Update cached position
            this.cachedNodePositions.set(node.id, { x: centerX, y: centerY });
            
            // Schedule completion of transition
            setTimeout(() => {
                const data = this.expandedNodes.get(nodeId);
                if (data && data.transitionState === 'expanding') {
                    console.debug(`[StatementNetworkLayout] Completing expansion transition for ${nodeId}`);
                    data.transitionState = 'expanded' as const;
                    data.transitioning = false;
                }
            }, this.TRANSITION_DURATION);
        } else {
            // Get stored position data if available
            const data = this.expandedNodes.get(nodeId) || {
                previousPosition: oldPosition,
                transitioning: false,
                transitionState: 'expanded' as const,
                transitionStart: 0
            };
            
            // Update state
            data.transitioning = true;
            data.transitionState = 'collapsing' as const;
            data.transitionStart = performance.now();
            
            this.expandedNodes.set(nodeId, data);
            
            console.debug(`[StatementNetworkLayout] Starting collapse transition:`, {
                nodeId,
                previousPosition: data.previousPosition,
                newRadius: node.radius
            });
            
            // Keep node fixed during transition to prevent flickering
            node.fx = node.x ?? 0;
            node.fy = node.y ?? 0;
            
            // Schedule release of fixed position after transition
            setTimeout(() => {
                const transitionData = this.expandedNodes.get(nodeId);
                if (transitionData && transitionData.transitionState === 'collapsing') {
                    // Get the node again in case it's changed
                    const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
                    const node = nodes.find(n => n.id === nodeId);
                    
                    if (node) {
                        // Release fixed position
                        node.fx = undefined;
                        node.fy = undefined;
                        
                        // Mark transition as complete
                        transitionData.transitionState = 'collapsed';
                        transitionData.transitioning = false;
                        
                        console.debug(`[StatementNetworkLayout] Completing collapse transition for ${nodeId}, releasing fixed position`);
                        
                        // Restart with minimal alpha
                        this.simulation.alpha(0.05).restart();
                    }
                }
            }, this.TRANSITION_DURATION);
        }
        
        console.debug(`[StatementNetworkLayout] Node updated:`, {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius: node.radius,
            position: { x: node.x, y: node.y },
            transitionState: mode === 'detail' ? 'expanding' : 'collapsing'
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
     * Handle node visibility changes with proper transition management
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean, reason: 'community' | 'user' = 'user'): void {
        console.debug(`[StatementNetworkLayout] Node visibility change request`, {
            nodeId,
            isHidden,
            reason
        });
        
        // Skip if currently zooming
        if (this.isZooming) {
            console.debug(`[StatementNetworkLayout] Delaying visibility change until zoom completes`);
            
            // Schedule the visibility change for later
            setTimeout(() => {
                if (!this.isZooming) {
                    this.handleNodeVisibilityChange(nodeId, isHidden, reason);
                }
            }, 300);
            
            return;
        }
        
        // Get current nodes from simulation
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find the target node
        const node = nodes.find(n => n.id === nodeId);
        if (!node) {
            console.warn(`[StatementNetworkLayout] Node not found for visibility change:`, nodeId);
            return;
        }
        
        // Skip if already in desired state
        if (node.isHidden === isHidden) {
            console.debug(`[StatementNetworkLayout] Node ${nodeId} is already in desired visibility state: ${isHidden}`);
            return;
        }
        
        // Store old values
        const oldVisibility = node.isHidden;
        const oldRadius = node.radius;
        
        // Stop simulation during change
        this.simulation.stop();
        
        // Update node properties
        node.isHidden = isHidden;
        node.hiddenReason = reason;
        node.radius = this.getNodeRadius(node);
        
        // Update our tracking
        this.hiddenNodes.set(nodeId, isHidden);
        
        console.debug(`[StatementNetworkLayout] Node visibility updated:`, {
            nodeId,
            oldVisibility,
            newVisibility: isHidden,
            reason,
            oldRadius,
            newRadius: node.radius
        });
        
        // Update simulation with modified node
        this.simulation.nodes(nodes);
        
        // Create strong collision detection during transition
        const collisionForce = d3.forceCollide()
            .radius((d: any) => {
                const n = d as EnhancedNode;
                return n.radius + 20; // Standard padding for all nodes
            })
            .strength(1) // Maximum strength
            .iterations(4); // More iterations for better detection
            
        // Apply minimal forces during transition
        this.simulation
            .force('collision', collisionForce)
            .force('charge', d3.forceManyBody().strength(-30))
            .force('x', null)
            .force('y', null);
            
        // Run minimal ticks
        for (let i = 0; i < 5; i++) {
            this.simulation.tick();
        }
        
        // Restore normal forces
        this.configureForces();
        
        // Restart with very low alpha
        this.simulation.alpha(0.05).restart();
    }
    
    /**
     * Throttled version of forceTick method
     * Note: We're implementing our own method since BaseLayoutStrategy doesn't have a tick method
     */
    public forceTick(count: number = 1): void {
        // Skip ticks during zooming
        if (this.isZooming) return;
        
        // Check if enough time has passed since last tick
        const now = performance.now();
        if (now - this.lastTickTime < this.tickThrottleTime) {
            return;
        }
        this.lastTickTime = now;
        
        // Run ticks manually instead of calling super
        for (let i = 0; i < count; i++) {
            if (this.simulation) {
                this.simulation.tick();
            }
        }
    }
    
    /**
     * Apply visibility preferences from the store to nodes
     * This should be called after node loading but before layout
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (!preferences || Object.keys(preferences).length === 0) {
            console.debug('[StatementNetworkLayout] No visibility preferences to apply');
            return;
        }
        
        console.debug(`[StatementNetworkLayout] Applying ${Object.keys(preferences).length} visibility preferences`);
        
        // Get current nodes
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!nodes || nodes.length === 0) {
            console.warn('[StatementNetworkLayout] No nodes to apply preferences to');
            return;
        }
        
        let appliedCount = 0;
        
        // Apply preferences to nodes
        Object.entries(preferences).forEach(([nodeId, isVisible]) => {
            const node = nodes.find(n => n.id === nodeId);
            
            if (node) {
                // Calculate new hidden state (isVisible = true means not hidden)
                const shouldBeHidden = !isVisible;
                
                // Skip if already in correct state
                if (node.isHidden === shouldBeHidden) {
                    return;
                }
                
                // Apply preference
                node.isHidden = shouldBeHidden;
                node.hiddenReason = 'user'; // User preferences always have 'user' reason
                node.radius = this.getNodeRadius(node); // Update radius
                
                // Update tracking
                this.hiddenNodes.set(nodeId, shouldBeHidden);
                
                appliedCount++;
                
                console.debug(`[StatementNetworkLayout] Applied visibility preference for ${nodeId.substring(0,8)}: ${shouldBeHidden ? 'hidden' : 'visible'}`);
            }
        });
        
        console.debug(`[StatementNetworkLayout] Applied ${appliedCount} visibility preferences`);
        
        // If we actually changed any nodes, stop and restart simulation
        if (appliedCount > 0) {
            // Update the simulation
            this.simulation.nodes(nodes);
            
            // Stop and restart with low alpha to minimize movement
            this.simulation.alpha(0.1).restart();
        }
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
        
        // Reset caches
        this.cachedNodePositions.clear();
        this.cachedVoteValues.clear();
        
        // Reset transition tracking
        this.expandedNodes.clear();
        this.hiddenNodes.clear();
        
        // Initialize node positions - this does the deterministic layout
        // This also applies community visibility standards
        this.initializeNodePositions(nodes);
        
        // For animated load, we'll start with nodes in a more compact arrangement
        // and let them expand to their proper positions for a pleasing animation
        if (!skipAnimation) {
            nodes.forEach(node => {
                if (node.type === 'statement') {
                    // Contract positions toward center by 40%
                    // Use nullish coalescing to safely handle null/undefined values
                    node.x = (node.x ?? 0) * 0.6;
                    node.y = (node.y ?? 0) * 0.6;
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
                // Skip if component was unmounted
                if (!this.simulation) return;
                
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