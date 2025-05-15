<!-- src/lib/components/graph/Graph.svelte -->
<script lang="ts">
    import { onMount, onDestroy, afterUpdate, createEventDispatcher } from 'svelte';
    import * as d3 from 'd3';
    import type { BackgroundConfig } from '$lib/types/graph/background';
    import type { 
        GraphData, 
        ViewType, 
        NodeMode,
        RenderableNode
    } from '$lib/types/graph/enhanced';
    import { DEFAULT_BACKGROUND_CONFIG } from '$lib/types/graph/background';
    import { SvgBackground } from './backgrounds/SvgBackground';
    import { createGraphStore, type GraphStore } from '$lib/stores/graphStore';
    import { COORDINATE_SPACE } from '$lib/constants/graph';
    import LinkRenderer from './links/LinkRenderer.svelte';
    import NodeRenderer from './nodes/NodeRenderer.svelte';
    import GraphDebugVisualizer from '../debug/GraphDebugVisualizer.svelte';
    import { coordinateSystem } from '$lib/services/graph/CoordinateSystem';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { userStore } from '$lib/stores/userStore';
    
    // Enable debug mode for development
    const DEBUG_MODE = false; // Set to false for production

    // Initialize visibility store as early as possible
    visibilityStore.initialize();

    // Props
    export let data: GraphData;
    export let viewType: ViewType;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    
    // These props are kept but not directly used (for backward compatibility)
    export const isPreviewMode = false;
    export const width = COORDINATE_SPACE.WORLD.WIDTH;
    export const height = COORDINATE_SPACE.WORLD.HEIGHT;

    // Event dispatch for node mode changes
    const dispatch = createEventDispatcher<{
        modechange: { nodeId: string; mode: NodeMode };
        visibilitychange: { nodeId: string; isHidden: boolean };
    }>();

    // DOM references
    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    
    // Component state
    let graphStore: GraphStore;
    let background: SvgBackground | null = null;
    let initialTransform: d3.ZoomTransform;
    let resetZoom: (() => void) | undefined;
    let zoomInstance: d3.ZoomBehavior<SVGSVGElement, unknown> | undefined;
    let containerDimensions = {
        width: 0,
        height: 0
    };
    let initialized = false;
    let showDebug = false;
    
    // Track component instance with unique ID
    let componentId = Math.random().toString(36).slice(2, 8);
    
    // Debug info for the central node
    let centralNodePos = { x: 0, y: 0, transform: "", viewX: 0, viewY: 0 };
    let svgViewportInfo = { width: 0, height: 0, viewBox: "", preserveAspectRatio: "" };
    
    // Flag to track if we've already applied preferences
    let preferencesApplied = false;

    // Event handlers for event-based communication
    let centerOnNodeHandler: EventListener;
    let setTransformHandler: EventListener;

    // Constants - Define viewBox to center coordinate system
    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
        // This centers the coordinate system at (0,0)
        viewBox: `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`
    };

    // Background configuration
    const mergedBackgroundConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };

    // EXPORTED METHODS FOR EXTERNAL CONTROL OF VIEWPORT
    
    /**
     * External method to get the current transform
     */
    export function getTransform(): any {
        if (!coordinateSystem) return null;
        return coordinateSystem.getCurrentTransform();
    }
    
    /**
     * External method to center viewport on specific coordinates
     */
    export function centerViewportOnCoordinates(x: number, y: number, duration: number = 750): boolean {
        console.log('[STATE_DEBUG] External call to centerViewportOnCoordinates:', { x, y, duration });
        
        if (!svg || !zoomInstance) {
            console.error('[STATE_DEBUG] Cannot center - svg or zoomInstance is null');
            return false;
        }
        
        try {
            // Get the current transform for reference
            const currentTransform = coordinateSystem.getCurrentTransform();
            console.log('[STATE_DEBUG] Current transform before centering:', currentTransform.toString());
            
            // Use the scale from current transform
            const scale = currentTransform.k;
            
            // IMPORTANT: With a centered viewBox, we simply need to use the negative coordinates 
            // as our translation to move that point to the center (0,0)
            const transform = d3.zoomIdentity
                .translate(-x * scale, -y * scale)
                .scale(scale);
            
            console.log('[STATE_DEBUG] Applying transform to center:', {
                position: { x, y },
                scale: scale,
                transform: transform.toString()
            });
            
            // Apply the transform
            d3.select(svg)
                .transition()
                .duration(duration)
                .call(zoomInstance.transform, transform);
            
            return true;
        } catch (e) {
            console.error('[STATE_DEBUG] Error centering viewport:', e);
            return false;
        }
    }

    export function getInternalState(): any {
        // Return the internal store state
        return graphStore ? graphStore.getState() : null;
    }

    export function findFormNodeByParentId(parentId: string): any {
        // Find a form node with the specified parent ID
        if (!graphStore) return null;
        
        const state = graphStore.getState() as any; // Type assertion
        if (!state || !state.nodes) return null;
        
        return state.nodes.find((n: any) => // Type assertion
            n.type === 'comment-form' && 
            (n.metadata?.parentCommentId === parentId || 
            (n.data && n.data.parentCommentId === parentId))
        );
    }

    export function logNodeState(nodeType?: string): void {
        // Log all nodes or nodes of a specific type
        if (!graphStore) {
            console.log('[STATE_DEBUG] No graph store available');
            return;
        }
        
        const state = graphStore.getState() as any; // Type assertion
        if (!state || !state.nodes) {
            console.log('[STATE_DEBUG] No nodes in graph store');
            return;
        }
        
        const nodes = nodeType ? 
            state.nodes.filter((n: any) => n.type === nodeType) : // Type assertion
            state.nodes;
            
        console.log(`[STATE_DEBUG] ${nodes.length} nodes${nodeType ? ` of type ${nodeType}` : ''}:`, 
            nodes.map((n: any) => ({ // Type assertion
                id: n.id,
                type: n.type,
                metadata: n.metadata,
                position: n.position ? { x: n.position.x, y: n.position.y } : 'no position'
            }))
        );
    }
    
    /**
     * External method to center viewport on a specific node by ID
     */
    export function centerOnNodeById(nodeId: string, duration: number = 750): boolean {
        console.log('[STATE_DEBUG] External call to centerOnNodeById:', nodeId);
        
        if (!graphStore || !$graphStore || !$graphStore.nodes) {
            console.error('[STATE_DEBUG] centerOnNodeById failed: graphStore is not initialized');
            return false;
        }
        
        // Find the node by ID
        const node = $graphStore.nodes.find(n => n.id === nodeId);
        if (!node || !node.position) {
            console.error(`[STATE_DEBUG] centerOnNodeById failed: node ${nodeId} not found or has no position`);
            return false;
        }
        
        console.log('[STATE_DEBUG] Found node to center on:', {
            id: nodeId,
            type: node.type,
            position: node.position
        });
        
        // Call the existing centerViewportOnCoordinates method with the node's position
        return centerViewportOnCoordinates(node.position.x, node.position.y, duration);
    }

    /**
     * Update container dimensions when resized
     */
    function updateContainerDimensions() {
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        containerDimensions = {
            width: rect.width,
            height: rect.height
        };
        
        if (background) {
            background.resize(rect.width, rect.height);
        }
        
        // Update SVG viewport info for debugging
        if (svg && DEBUG_MODE) {
            updateSvgViewportInfo();
        }
    }
    
    /**
     * Update SVG viewport info for debugging
     */
    function updateSvgViewportInfo() {
        if (!svg) return;
        
        const rect = svg.getBoundingClientRect();
        svgViewportInfo = {
            width: rect.width,
            height: rect.height,
            viewBox: svg.getAttribute('viewBox') || '',
            preserveAspectRatio: svg.getAttribute('preserveAspectRatio') || ''
        };
    }

    /**
     * Initialize the background visualization
     */
    function initializeBackground() {
        if (!backgroundGroup) return;
        
        if (background) {
            background.destroy();
        }

        try {
            background = new SvgBackground(
                backgroundGroup, 
                containerDimensions.width, 
                containerDimensions.height,
                mergedBackgroundConfig
            );
            background.start();
        } catch (error) {
            console.error('[Graph] Error initializing background:', error);
        }
    }

    /**
     * Initialize zoom behavior
     */
    function initializeZoom() {
        if (!svg || !contentGroup || !backgroundGroup) return;

        // Get initial zoom level from constants
        const initialZoomLevel = COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM;
        
        // Create initial transform
        initialTransform = d3.zoomIdentity.scale(initialZoomLevel);
        
        // Initialize the coordinate system with the initial transform
        coordinateSystem.updateTransform(initialTransform);

        // Configure zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([
                COORDINATE_SPACE.WORLD.VIEW.MIN_ZOOM,
                COORDINATE_SPACE.WORLD.VIEW.MAX_ZOOM
            ])
            .on('start', () => {
                // Dispatch zoom start event
                window.dispatchEvent(new CustomEvent('zoom-start'));
            })
            .on('zoom', (event) => {
                const transform = event.transform;
                
                // Apply transforms to both groups
                d3.select(contentGroup).attr('transform', transform.toString());
                d3.select(backgroundGroup).attr('transform', transform.toString());
                
                // Update the coordinate system with the current transform
                coordinateSystem.updateTransform(transform);
                
                // For statement network view, enforce fixed positions during zoom
                if (viewType === 'statement-network' && graphStore) {
                    graphStore.fixNodePositions();
                    if (DEBUG_MODE) updateCentralNodeDebugPosition();
                }
            })
            .on('end', () => {
                // Dispatch zoom end event
                window.dispatchEvent(new CustomEvent('zoom-end'));
                
                // For statement network view, enforce fixed positions after zoom
                if (viewType === 'statement-network' && graphStore) {
                    graphStore.fixNodePositions();
                    graphStore.forceTick(2);
                    if (DEBUG_MODE) updateCentralNodeDebugPosition();
                }
            });

        // Store zoom instance for use in other methods
        zoomInstance = zoom;

        // Apply zoom behavior to SVG with initial transform
        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, initialTransform)
            .on('contextmenu', (event) => event.preventDefault());

        // Function to reset zoom
        resetZoom = () => {
            d3.select(svg)
                .transition()
                .duration(750)
                .call(zoom.transform, initialTransform);
        };
    }
    
    /**
     * For centering nodes using direct D3 transformations
     */
    function centerViewportOn(x: number, y: number, zoomLevel?: number, duration: number = 750) {
        console.log('[STATE_DEBUG] centerViewportOn called with coordinates:', { x, y, zoomLevel, duration });
        
        if (!svg || !zoomInstance) {
            console.error('[STATE_DEBUG] centerViewportOn failed: svg or zoomInstance is null');
            return;
        }
        
        // Get the current transform for reference
        const currentTransform = coordinateSystem.getCurrentTransform();
        console.log('[STATE_DEBUG] Current transform before centering:', currentTransform.toString());
        
        try {
            // Get or use zoom level
            const scale = zoomLevel !== undefined ? zoomLevel : currentTransform.k;
            
            // IMPORTANT: With a centered viewBox, we simply need to use the negative coordinates 
            // as our translation to move that point to the center (0,0)
            const transform = d3.zoomIdentity
                .translate(-x * scale, -y * scale)
                .scale(scale);
            
            console.log('[STATE_DEBUG] Applying transform to center:', {
                position: { x, y },
                scale: scale,
                transform: transform.toString()
            });
            
            // Apply the transform
            d3.select(svg)
                .transition()
                .duration(duration)
                .call(zoomInstance.transform, transform);
            
            // Verify transformation after a short delay
            setTimeout(() => {
                const newTransform = coordinateSystem.getCurrentTransform();
                console.log('[STATE_DEBUG] Transform after centering:', newTransform.toString(),
                    'Expected:', transform.toString(),
                    'Match:', newTransform.toString() === transform.toString());
            }, duration + 50);
        } catch (e) {
            console.error('[STATE_DEBUG] Error centering viewport:', e);
        }
    }

    /**
     * Center on a specific node by ID
     */
    function centerOnNode(nodeId: string, duration: number = 750): void {
        console.log('[STATE_DEBUG] centerOnNode called with nodeId:', nodeId);
        
        if (!graphStore) {
            console.error('[STATE_DEBUG] centerOnNode failed: graphStore is null');
            return;
        }
        
        if (!$graphStore) {
            console.error('[STATE_DEBUG] centerOnNode failed: $graphStore is null');
            return;
        }
        
        if (!$graphStore.nodes) {
            console.error('[STATE_DEBUG] centerOnNode failed: $graphStore.nodes is null');
            return;
        }
        
        // Find the node by ID
        const node = $graphStore.nodes.find(n => n.id === nodeId);
        if (!node) {
            console.error(`[STATE_DEBUG] centerOnNode failed: node ${nodeId} not found`);
            // Log all available node IDs for debugging
            console.log('[STATE_DEBUG] Available nodes:', 
                $graphStore.nodes.map(n => ({ id: n.id, type: n.type })));
            return;
        }
        
        if (!node.position) {
            console.error(`[STATE_DEBUG] centerOnNode failed: node ${nodeId} has no position`);
            return;
        }
        
        console.log('[STATE_DEBUG] Found node to center on:', {
            id: nodeId,
            type: node.type,
            position: node.position
        });
        
        // Call the existing centerViewportOn method with the node's position
        centerViewportOn(node.position.x, node.position.y, undefined, duration);
    }

    // handleModeChange to use this function with proper sequencing
    function handleModeChange(event: CustomEvent<{ 
        nodeId: string; 
        mode: NodeMode;
        position?: { x: number; y: number }; 
    }>) {
        console.log('[STATE_DEBUG] handleModeChange called with:', event.detail);
        
        const nodeId = event.detail.nodeId;
        const newMode = event.detail.mode;
        
        // Always update the node mode in the graph store first
        if (graphStore && typeof graphStore.updateNodeMode === 'function') {
            // First apply the mode change
            graphStore.updateNodeMode(nodeId, newMode);
            
            // Force ticks to update the layout
            if (typeof graphStore.forceTick === 'function') {
                graphStore.forceTick(5);
            }
            
            // If switching to detail mode, center the viewport
            if (newMode === 'detail') {
                // Allow time for layout to stabilize
                setTimeout(() => {
                    // Get the node with updated position
                    if ($graphStore && $graphStore.nodes) {
                        const node = $graphStore.nodes.find(n => n.id === nodeId);
                        
                        if (node && node.position) {
                            console.log('[STATE_DEBUG] Post-expansion node position:', node.position);
                            
                            // Center viewport
                            centerViewportOn(
                                node.position.x,
                                node.position.y
                            );
                        }
                    }
                }, 50); // Small delay for layout to complete
            }
        }
        
        // Forward event to parent
        dispatch('modechange', {
            nodeId: event.detail.nodeId,
            mode: event.detail.mode
        });
    }

    /**
     * Update debug information for the central node's position
     */
    function updateCentralNodeDebugPosition() {
        if (!$graphStore || !$graphStore.nodes || !DEBUG_MODE) return;
        
        // Find the central node
        const centralNode = $graphStore.nodes.find(node => 
            node.group === 'central' || (node.data && 'sub' in node.data && node.data.sub === 'controls')
        );
        
        if (centralNode) {
            // Get logical coordinates
            const nodeX = centralNode.position.x;
            const nodeY = centralNode.position.y;
            
            // Get view coordinates
            const viewCoords = coordinateSystem.worldToView(nodeX, nodeY);
            
            centralNodePos = {
                x: nodeX,
                y: nodeY,
                transform: centralNode.position.svgTransform,
                viewX: viewCoords.x,
                viewY: viewCoords.y
            };
        }
    }

    /**
     * Handle node visibility change events
     */
    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        // Notify the graph store
        if (graphStore) {
            graphStore.updateNodeVisibility(event.detail.nodeId, event.detail.isHidden, 'user');
        }
        
        // Forward the event to parent
        dispatch('visibilitychange', event.detail);
        
        // Save preference to store (true = visible, false = hidden)
        visibilityStore.setPreference(event.detail.nodeId, !event.detail.isHidden);
    }

    /**
     * Toggle debug mode
     */
    function toggleDebug() {
        showDebug = !showDebug;
        
        if (showDebug && DEBUG_MODE) {
            // Update central node position
            updateCentralNodeDebugPosition();
            updateSvgViewportInfo();
        }
    }

    /**
     * Apply view-specific behaviors
     * Handles special cases for statement network view
     */
    function applyViewSpecificBehavior() {
        if (!graphStore) return;
        
        // Special handling for statement-network view
        if (viewType === 'statement-network') {
            // Fix positions more aggressively
            graphStore.fixNodePositions();
            graphStore.forceTick(3);
            
            // Update debug info if needed
            if (DEBUG_MODE) {
                updateCentralNodeDebugPosition();
                updateSvgViewportInfo();
            }
        }
    }

    /**
     * Reset viewport to default state
     */
    function resetViewport() {
        if (!svg || !resetZoom) return;
        
        console.log('[STATE_DEBUG] Resetting viewport to initial state');
        
        // Reset zoom to initial state
        resetZoom();
    }

    /**
     * Initialize the component
     */
    function initialize() {
        if (initialized) return;
        
        console.log(`[STATE_DEBUG] Graph.svelte ${componentId} - Initializing graph component for viewType: ${viewType}`);
        
        // Create graph store for this view
        graphStore = createGraphStore(viewType);
        
        // Initialize zoom and background
        updateContainerDimensions();
        initializeZoom();
        initializeBackground();
        
        // Special handling for statement-network to ensure stability
        if (viewType === 'statement-network') {
            // Initialize with data with explicit position enforcement
            if (data) {
                graphStore.setData(data, { skipAnimation: true });
                graphStore.fixNodePositions();
                graphStore.forceTick(5); // More ticks for statement network
                
                // Need a second round of fixes after the initial ticks
                setTimeout(() => {
                    if (graphStore) {
                        graphStore.fixNodePositions();
                        graphStore.forceTick(3);
                    }
                }, 50);
            }
        } else {
            // Normal initialization for other views
            if (data) {
                console.log(`[STATE_DEBUG] Setting initial data with ${data.nodes.length} nodes`);
                graphStore.setData(data);
            }
        }
        
        initialized = true;
    }

    /**
     * Apply visibility preferences to current nodes
     */
    function applyVisibilityPreferences() {
        if (!graphStore) return;
        
        const preferences = visibilityStore.getAllPreferences();
        if (Object.keys(preferences).length > 0) {
            // Use the method to apply all preferences at once
            (graphStore as any).applyVisibilityPreferences(preferences);
        }
    }

    // Lifecycle hooks
    onMount(() => {
        console.log(`[STATE_DEBUG] Graph.svelte ${componentId} - onMount`);
        initialize();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateContainerDimensions);
            
            // Setup event listeners for centering
            centerOnNodeHandler = ((event: CustomEvent) => {
                console.log('[STATE_DEBUG] center-on-node event received in Graph.svelte', event.detail);
                
                if (!event.detail) {
                    console.warn('[STATE_DEBUG] center-on-node event has no detail');
                    return;
                }
                
                if (event.detail.nodeId || (event.detail.x !== undefined && event.detail.y !== undefined)) {
                    console.log('[STATE_DEBUG] Processing valid center-on-node event:', event.detail);
                    
                    if (event.detail.nodeId) {
                        // Center by ID if provided
                        console.log('[STATE_DEBUG] Centering by node ID:', event.detail.nodeId);
                        centerOnNode(event.detail.nodeId, event.detail.duration);
                    } else {
                        // Or center by coordinates
                        console.log('[STATE_DEBUG] Centering by coordinates:', 
                                    { x: event.detail.x, y: event.detail.y });
                        centerViewportOn(event.detail.x, event.detail.y, 
                                        event.detail.zoomLevel, event.detail.duration);
                    }
                } else {
                    console.warn('[STATE_DEBUG] center-on-node event missing required data', event.detail);
                }
            }) as EventListener;
            window.addEventListener('center-on-node', centerOnNodeHandler);
            
            // Add listener for setting transform directly
            setTransformHandler = ((event: CustomEvent) => {
                if (event.detail && event.detail.transform && svg && zoomInstance) {
                    console.log('[STATE_DEBUG] set-transform event received:', event.detail);
                    
                    d3.select(svg)
                        .transition()
                        .duration(event.detail.duration || 750)
                        .call(zoomInstance.transform, event.detail.transform);
                }
            }) as EventListener;
            window.addEventListener('set-transform', setTransformHandler);
            
            // Test event system
            window.addEventListener('test-event', ((event: CustomEvent) => {
                console.log('[STATE_DEBUG] Test event received in Graph.svelte');
            }) as EventListener);
            
            console.log('[STATE_DEBUG] Event listeners registered for center-on-node and set-transform');
            
            // Load visibility preferences when component mounts
            if ($userStore) {
                // Apply any cached preferences immediately
                applyVisibilityPreferences();
                
                // Then load from backend and apply again
                visibilityStore.loadPreferences().then(() => {
                    applyVisibilityPreferences();
                });
            }
        }
        
        // Force graph to center after a short delay
        if (viewType === 'statement-network') {
            setTimeout(() => {
                resetViewport();
            }, 250);
        }
        
        // Test events after a short delay
        setTimeout(() => {
            console.log('[STATE_DEBUG] Testing event system...');
            window.dispatchEvent(new CustomEvent('test-event', { detail: { test: true } }));
        }, 1000);
    });

    // When the graph data changes or we navigate to a new page,
    // make sure preferences are applied (but only once)
    afterUpdate(() => {
        console.log(`[STATE_DEBUG] Graph.svelte ${componentId} - afterUpdate`, {
            initialized,
            viewType,
            dataNodes: data?.nodes?.length
        });
        
        if (data && graphStore && !preferencesApplied) {
            preferencesApplied = true; // Set the flag to prevent loops
            
            // Apply preferences immediately without timeout
            applyVisibilityPreferences();
        }
        
        // Apply view-specific behaviors after any update
        if (initialized && graphStore) {
            applyViewSpecificBehavior();
        }
    });

    onDestroy(() => {
        console.log(`[STATE_DEBUG] Graph.svelte ${componentId} - onDestroy`);
        
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateContainerDimensions);
            window.removeEventListener('center-on-node', centerOnNodeHandler);
            window.removeEventListener('set-transform', setTransformHandler);
        }
        
        // Remove D3 zoom behavior
        if (svg) {
            d3.select(svg).on('.zoom', null);
        }
        
        if (background) {
            background.destroy();
        }
        
        if (graphStore) {
            graphStore.dispose();
        }
    });

    // Reactive declarations
    
    // When data changes, reset the preferences flag
    $: if (data) {
        preferencesApplied = false;
    }
    
    // When viewType changes
    $: if (initialized && graphStore && viewType !== graphStore.getViewType()) {
        graphStore.setViewType(viewType);
        
        // Special handling for statement network view
        if (viewType === 'statement-network') {
            // Wait for next tick to ensure view type is fully applied
            setTimeout(() => {
                if (graphStore) {
                    graphStore.fixNodePositions();
                    graphStore.forceTick(5);
                    
                    // Reset viewport after a short delay
                    setTimeout(() => {
                        resetViewport();
                    }, 100);
                }
            }, 0);
        }
    }
    
    // When data changes
    $: if (initialized && graphStore && data) {
        console.log(`[STATE_DEBUG] Graph.svelte ${componentId} - Data changed:`, {
            nodeCount: data.nodes.length,
            linkCount: data.links.length
        });
        
        // Log form nodes in the incoming data
        const formNodes = data.nodes.filter(n => n.type === 'comment-form');
        if (formNodes.length > 0) {
            console.log('[STATE_DEBUG] Form nodes in incoming data:', formNodes.map(n => ({
                id: n.id,
                parent: n.metadata?.parentCommentId || 'none'
            })));
        }
        
        // Use skipAnimation for statement network view
        if (viewType === 'statement-network') {
            graphStore.setData(data, { skipAnimation: true });
            // Ensure positions are fixed after data is set
            setTimeout(() => {
                if (graphStore) {
                    graphStore.fixNodePositions();
                    graphStore.forceTick(5);
                    
                    // Reset viewport after a short delay
                    setTimeout(() => {
                        resetViewport();
                    }, 100);
                }
            }, 0);
        } else {
            graphStore.setData(data);
            
            // Check state after setData
            setTimeout(() => {
                const state = graphStore.getState() as any;
                console.log('[STATE_DEBUG] GraphStore state after setData:',
                           state ? `${state.nodes?.length || 0} nodes` : 'unavailable');
                
                // Log form nodes in the graph store after setting data
                if (state && state.nodes) {
                    const storeFormNodes = state.nodes.filter((n: any) => n.type === 'comment-form');
                    if (storeFormNodes.length > 0) {
                        console.log('[STATE_DEBUG] Form nodes in graph store after setData:', 
                                   storeFormNodes.map((n: any) => ({
                                       id: n.id,
                                       parent: n.metadata?.parentCommentId || 'none',
                                       position: n.position ? {x: n.position.x, y: n.position.y} : 'no position'
                                   })));
                    }
                }
            }, 50);
        }
    }
    
    // When container dimensions change
    $: if (initialized && containerDimensions.width && containerDimensions.height) {
        updateContainerDimensions();
    }
</script>

<div bind:this={container} class="graph-container">
    <svg 
        bind:this={svg}
        width="100%"
        height="100%"
        viewBox={worldDimensions.viewBox}
        preserveAspectRatio="xMidYMid meet"
        class="graph-svg"
    >
        <defs>
            <!-- Global filters and patterns -->
            <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feComposite in="blur" in2="SourceGraphic" operator="atop" />
            </filter>
        </defs>

        <!-- Background layer with no pointer events -->
        <g class="background-layer">
            <svg 
                width="100%"
                height="100%"
                overflow="visible"
            >
                <g bind:this={backgroundGroup} />
            </svg>
        </g>

        <!-- Content layer with graph elements -->
        <g 
            bind:this={contentGroup} 
            class="content-layer"
        >
            {#if initialized && graphStore}
                {#key graphStore.getViewType()}
                    <!-- Small center marker for visual reference -->
                    {#if DEBUG_MODE}
                    <g class="center-marker">
                        <circle cx="0" cy="0" r="3" fill="red" fill-opacity="0.5" />
                    </g>
                    {/if}

                    <!-- Links layer -->
                    <g class="links-layer">
                        {#each $graphStore.links as link (link.id)}
                            <LinkRenderer {link} />
                            {#if showDebug}
                                <GraphDebugVisualizer {link} active={showDebug} />
                            {/if}
                        {/each}
                    </g>

                    <!-- Nodes layer -->
                    <g class="nodes-layer">
                        {#each $graphStore.nodes as node (node.id)}
                            <NodeRenderer 
                                {node}
                                on:modeChange={handleModeChange}
                                on:visibilityChange={handleVisibilityChange}
                            >
                                <svelte:fragment 
                                    slot="default" 
                                    let:node 
                                    let:nodeX
                                    let:nodeY
                                    let:handleModeChange
                                >
                                    <slot 
                                        {node}
                                        {nodeX}
                                        {nodeY}
                                        {handleModeChange} 
                                    />
                                    {#if showDebug}
                                        <GraphDebugVisualizer {node} active={showDebug} />
                                    {/if}
                                </svelte:fragment>
                            </NodeRenderer>
                        {/each}
                    </g>

                    <!-- Debug overlay only shown when debug is enabled -->
                    {#if showDebug}
                        <g class="debug-overlay">
                            <!-- Central axes -->
                            <line x1="-500" y1="0" x2="500" y2="0" stroke="rgba(255,0,0,0.3)" stroke-width="1" />
                            <line x1="0" y1="-500" x2="0" y2="500" stroke="rgba(255,0,0,0.3)" stroke-width="1" />
                            
                            <!-- Origin marker -->
                            <circle cx="0" cy="0" r="5" fill="red" />
                            <text x="10" y="10" fill="white" font-size="12">Origin (0,0)</text>
                            
                            <!-- Zoom info -->
                            <text x="10" y="30" fill="white" font-size="12">
                                Zoom: {coordinateSystem.getCurrentTransform().k.toFixed(2)}
                            </text>
                            
                            <!-- Central node position -->
                            <text x="10" y="50" fill="white" font-size="12">
                                Central: ({centralNodePos.x.toFixed(1)}, {centralNodePos.y.toFixed(1)})
                            </text>
                        </g>
                    {/if}
                {/key}
            {/if}
        </g>
    </svg>

    <!-- Control buttons -->
    <div class="controls">
        <!-- Reset zoom button -->
        {#if resetZoom}
            <button
                class="control-button reset-button"
                on:click={resetViewport}
                aria-label="Reset view"
                title="Reset view"
            >
                <span class="material-symbols-outlined">restart_alt</span>
            </button>
        {/if}
        
        <!-- Debug toggle button - only shown in development -->
        {#if DEBUG_MODE}
            <button
                class="control-button debug-button"
                on:click={toggleDebug}
                aria-label="Toggle debug mode"
                title="Toggle debug mode"
            >
                <span class="material-symbols-outlined">{showDebug ? 'bug_off' : 'bug_on'}</span>
            </button>
        {/if}
    </div>
</div>

<style>
    .graph-container {
        width: 100%;
        height: 100vh;
        background: black;
        overflow: hidden;
        position: relative;
    }

    .graph-svg {
        width: 100%;
        height: 100%;
        cursor: grab;
        touch-action: none;
        position: absolute;
    }

    .graph-svg:active {
        cursor: grabbing;
    }

    /* These classes define the layering structure */
    .background-layer {
        pointer-events: none;
    }

    .content-layer {
        pointer-events: all;
    }

    .links-layer {
        pointer-events: none;
    }

    .nodes-layer {
        pointer-events: all;
    }
    
    .center-marker {
        pointer-events: none;
    }

    /* The critical fix - proper transform origins */
    :global(.graph-svg) {
        transform-origin: 0px 0px; /* Use absolute coordinates for SVG root */
    }

    :global(.content-layer),
    :global(.background-layer) {
        transform-origin: 0px 0px; /* Use absolute coordinates for main groups */
    }

    /* For nodes only, we keep fill-box for their internal transforms */
    :global(.node-wrapper) {
        transform-box: fill-box;
        transform-origin: 50% 50%;
    }

    .controls {
        position: absolute;
        bottom: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 50;
    }

    .control-button {
        background-color: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .control-button:hover {
        transform: translateY(-1px);
        background-color: rgba(0, 0, 0, 0.7);
        border-color: rgba(255, 255, 255, 0.5);
    }

    .control-button:active {
        transform: translateY(0);
    }

    .control-button :global(.material-symbols-outlined) {
        color: white;
        font-size: 1.5rem;
    }

    .debug-overlay {
        pointer-events: none;
    }
</style>