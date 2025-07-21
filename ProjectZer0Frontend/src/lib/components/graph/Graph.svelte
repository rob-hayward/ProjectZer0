<!-- src/lib/components/graph/Graph.svelte - Enhanced with Phantom Links Support -->
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
    
    // CRITICAL: Export graphStore for binding - allows parent to access single instance
    export let graphStore: GraphStore | null = null;
    
    // These props are kept but not directly used (for backward compatibility)
    export const isPreviewMode = false;
    export const width = COORDINATE_SPACE.WORLD.WIDTH;
    export const height = COORDINATE_SPACE.WORLD.HEIGHT;

    // Event dispatch for node mode changes
    const dispatch = createEventDispatcher<{
        modechange: { nodeId: string; mode: NodeMode };
        visibilitychange: { nodeId: string; isHidden: boolean };
        reply: { commentId: string };
        answerQuestion: { questionId: string };
    }>();

    // DOM references
    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    
    // Component state
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
    
    // ENHANCED: Data change tracking for intelligent updates
    let lastDataHash = '';
    let lastProcessedDataId = '';
    let isProcessingData = false;
    let dataUpdateCounter = 0;
    
    // Flag to track if we've already applied preferences
    let preferencesApplied = false;

    // Event handlers for event-based communication
    let centerOnNodeHandler: EventListener;
    let setTransformHandler: EventListener;

    // ENHANCED: Phantom links state - FIXED reactive chain
    let shouldRenderLinks = true; // Default to true for non-universal views
    let phantomLinksInitialized = false;

    // Constants - Define viewBox to center coordinate system
    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
        // This centers the coordinate system at (0,0)
        viewBox: `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`
    };

    // Background configuration
    const mergedBackgroundConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };

    // FIXED: Phantom links reactive statement with proper initialization
    $: if (graphStore && viewType === 'universal') {
        // Initialize phantom links state for universal view
        if (!phantomLinksInitialized && typeof graphStore.getShouldRenderLinks === 'function') {
            phantomLinksInitialized = true;
            shouldRenderLinks = false; // Start with links hidden in universal view
            console.log('[Graph] 🔗 Phantom links initialized - starting hidden');
        }
        
        // Check for state changes
        if (typeof graphStore.getShouldRenderLinks === 'function') {
            const newShouldRenderLinks = graphStore.getShouldRenderLinks();
            if (newShouldRenderLinks !== shouldRenderLinks) {
                console.log('[Graph] 🔗 Phantom links state changed:', shouldRenderLinks, '→', newShouldRenderLinks);
                shouldRenderLinks = newShouldRenderLinks;
                
                // Dispatch custom event for external monitoring
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('phantom-links-state-change', {
                        detail: {
                            enabled: shouldRenderLinks,
                            linksCount: data?.links?.length || 0,
                            revealState: shouldRenderLinks ? 'revealed' : 'hidden'
                        }
                    }));
                }
            }
        }
    } else if (viewType !== 'universal') {
        // Non-universal views always show links
        if (!shouldRenderLinks) {
            shouldRenderLinks = true;
        }
    }

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
        if (!svg || !zoomInstance) {
            console.error('[STATE_DEBUG] Cannot center - svg or zoomInstance is null');
            return false;
        }
        
        try {
            // Get the current transform for reference
            const currentTransform = coordinateSystem.getCurrentTransform();
            
            // Use the scale from current transform
            const scale = currentTransform.k;
            
            // IMPORTANT: With a centered viewBox, we simply need to use the negative coordinates 
            // as our translation to move that point to the center (0,0)
            const transform = d3.zoomIdentity
                .translate(-x * scale, -y * scale)
                .scale(scale);
            
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
            return;
        }
        
        const state = graphStore.getState() as any; // Type assertion
        if (!state || !state.nodes) {
            return;
        }
        
        const nodes = nodeType ? 
            state.nodes.filter((n: any) => n.type === nodeType) : // Type assertion
            state.nodes;
    }
    
    /**
     * External method to center viewport on a specific node by ID
     */
    export function centerOnNodeById(nodeId: string, duration: number = 750): boolean {
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
        
        // Call the existing centerViewportOnCoordinates method with the node's position
        return centerViewportOnCoordinates(node.position.x, node.position.y, duration);
    }

    /**
     * ENHANCED: Create stable hash of data to detect genuine changes
     */
    function createDataHash(data: GraphData): string {
        if (!data || !data.nodes) return '';
        
        // Create hash based on node IDs and basic structure
        const nodeHash = data.nodes.map(n => n.id).sort().join(',');
        const linkHash = (data.links?.length || 0).toString();
        const structureHash = `${data.nodes.length}-${linkHash}`;
        
        return `${nodeHash}-${structureHash}`;
    }

    /**
     * ENHANCED: Check if this is a genuine data change vs reactive update
     */
    function isGenuineDataChange(newData: GraphData): boolean {
        const newHash = createDataHash(newData);
        const isGenuine = newHash !== lastDataHash && newHash.length > 0;
        
        if (isGenuine) {
            console.log('[Graph] Genuine data change detected:', {
                oldHash: lastDataHash.substring(0, 50) + '...',
                newHash: newHash.substring(0, 50) + '...',
                nodeCount: newData.nodes?.length || 0,
                linkCount: newData.links?.length || 0
            });
            lastDataHash = newHash;
        }
        
        return isGenuine;
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
        if (!svg || !zoomInstance) {
            console.error('[STATE_DEBUG] centerViewportOn failed: svg or zoomInstance is null');
            return;
        }
        
        // Get the current transform for reference
        const currentTransform = coordinateSystem.getCurrentTransform();
        
        try {
            // Get or use zoom level
            const scale = zoomLevel !== undefined ? zoomLevel : currentTransform.k;
            
            // IMPORTANT: With a centered viewBox, we simply need to use the negative coordinates 
            // as our translation to move that point to the center (0,0)
            const transform = d3.zoomIdentity
                .translate(-x * scale, -y * scale)
                .scale(scale);
            
            // Apply the transform
            d3.select(svg)
                .transition()
                .duration(duration)
                .call(zoomInstance.transform, transform);
            
            // Verify transformation after a short delay
            setTimeout(() => {
                const newTransform = coordinateSystem.getCurrentTransform();
            }, duration + 50);
        } catch (e) {
            console.error('[STATE_DEBUG] Error centering viewport:', e);
        }
    }

    /**
     * Center on a specific node by ID
     */
    function centerOnNode(nodeId: string, duration: number = 750): void {
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
            return;
        }
        
        if (!node.position) {
            console.error(`[STATE_DEBUG] centerOnNode failed: node ${nodeId} has no position`);
            return;
        }
        
        // Call the existing centerViewportOn method with the node's position
        centerViewportOn(node.position.x, node.position.y, undefined, duration);
    }

    // handleModeChange to use this function with proper sequencing
    function handleModeChange(event: CustomEvent<{ 
        nodeId: string; 
        mode: NodeMode;
        position?: { x: number; y: number }; 
    }>) {
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
        // Reset zoom to initial state
        resetZoom();
    }

    /**
     * ENHANCED: Initialize the component with intelligent graph store management
     */
    function initialize() {
        if (initialized) return;
        
        console.log('[Graph] Initializing component:', { 
            componentId, 
            viewType,
            hasExistingGraphStore: !!graphStore
        });
        
        // CRITICAL: Only create graph store if we don't have one already
        if (!graphStore) {
            console.log('[Graph] Creating new graph store for', viewType);
            graphStore = createGraphStore(viewType);
        } else {
            console.log('[Graph] Using existing graph store for', viewType);
            
            // Update view type if needed but don't recreate the store
            if (graphStore.getViewType && graphStore.getViewType() !== viewType) {
                console.log('[Graph] Updating view type from', graphStore.getViewType(), 'to', viewType);
                graphStore.setViewType(viewType);
            }
        }
        
        // Initialize zoom and background
        updateContainerDimensions();
        initializeZoom();
        initializeBackground();
        
        // Apply initial data if available
        if (data && isGenuineDataChange(data)) {
            console.log('[Graph] Applying initial data during initialization');
            processDataUpdate(data, true); // Mark as initialization
        }
        
        initialized = true;
        
        console.log('[Graph] Component initialized successfully');
    }

    /**
     * ENHANCED: Process data updates with intelligent handling
     */
    function processDataUpdate(newData: GraphData, isInitialization: boolean = false) {
        if (isProcessingData && !isInitialization) {
            console.log('[Graph] Skipping data update - already processing');
            return;
        }
        
        if (!graphStore) {
            console.warn('[Graph] Cannot process data update - no graph store');
            return;
        }
        
        isProcessingData = true;
        dataUpdateCounter++;
        
        console.log('[Graph] Processing data update #', dataUpdateCounter, {
            isInitialization,
            viewType,
            nodeCount: newData.nodes?.length || 0,
            linkCount: newData.links?.length || 0
        });
        
        try {
            // Check if this is the specialized universal manager
            const isUniversalManager = typeof graphStore.enableBatchRendering === 'function';
            
            if (isUniversalManager) {
                // For universal manager, use intelligent update strategy
                const hasExistingData = graphStore.getPerformanceMetrics?.()?.renderedNodeCount > 0;
                
                if (hasExistingData && !isInitialization) {
                    console.log('[Graph] Using gentle sync for settled universal manager');
                    
                    // Check if the manager has the new gentle sync method
                    if (typeof (graphStore as any).syncDataGently === 'function') {
                        (graphStore as any).syncDataGently(newData);
                    } else {
                        // Fallback to updateState for existing managers
                        if (typeof (graphStore as any).updateState === 'function') {
                            (graphStore as any).updateState(newData, 0.1);
                        } else {
                            // Final fallback
                            graphStore.setData(newData, { skipAnimation: true });
                        }
                    }
                } else {
                    console.log('[Graph] Initial data load for universal manager');
                    graphStore.setData(newData);
                }
            } else {
                // Standard manager handling
                if (viewType === 'statement-network') {
                    graphStore.setData(newData, { skipAnimation: true });
                    
                    // Apply statement-network specific behaviors
                    setTimeout(() => {
                        if (graphStore) {
                            graphStore.fixNodePositions();
                            graphStore.forceTick(5);
                            setTimeout(() => resetViewport(), 100);
                        }
                    }, 0);
                } else {
                    // Standard data update
                    graphStore.setData(newData);
                }
            }
            
        } catch (error) {
            console.error('[Graph] Error processing data update:', error);
        } finally {
            // Reset processing flag after a delay
            setTimeout(() => {
                isProcessingData = false;
            }, 100);
        }
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
        console.log('[Graph] Component mounting with view type:', viewType);
        initialize();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateContainerDimensions);
            
            // Setup event listeners for centering
            centerOnNodeHandler = ((event: CustomEvent) => {
                if (!event.detail) {
                    return;
                }
                
                if (event.detail.nodeId || (event.detail.x !== undefined && event.detail.y !== undefined)) {
                    if (event.detail.nodeId) {
                        // Center by ID if provided
                        centerOnNode(event.detail.nodeId, event.detail.duration);
                    } else {
                        // Or center by coordinates
                        centerViewportOn(event.detail.x, event.detail.y, 
                                        event.detail.zoomLevel, event.detail.duration);
                    }
                }
            }) as EventListener;
            window.addEventListener('center-on-node', centerOnNodeHandler);
            
            // Add listener for setting transform directly
            setTransformHandler = ((event: CustomEvent) => {
                if (event.detail && event.detail.transform && svg && zoomInstance) {
                    d3.select(svg)
                        .transition()
                        .duration(event.detail.duration || 750)
                        .call(zoomInstance.transform, event.detail.transform);
                }
            }) as EventListener;
            window.addEventListener('set-transform', setTransformHandler);
            
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
        
        // Force graph to center after a short delay for statement-network
        if (viewType === 'statement-network') {
            setTimeout(() => {
                resetViewport();
            }, 250);
        }
    });

    // When the graph data changes or we navigate to a new page,
    // make sure preferences are applied (but only once)
    afterUpdate(() => {
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
        console.log('[Graph] Component destroying');
        
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
        
        // IMPORTANT: Only dispose if we own the graph store
        // If it was passed in via binding, let the parent handle disposal
        if (graphStore && typeof graphStore.dispose === 'function') {
            // Check if this store was created by us (not bound from parent)
            const wasCreatedByUs = !lastDataHash; // Simple heuristic
            if (wasCreatedByUs) {
                console.log('[Graph] Disposing graph store created by component');
                graphStore.dispose();
            } else {
                console.log('[Graph] Not disposing graph store - managed by parent');
            }
        }
    });

    // ENHANCED: Reactive declarations with intelligent update handling
    
    // When data changes, reset the preferences flag
    $: if (data) {
        preferencesApplied = false;
    }
    
    // CRITICAL: When viewType changes, update existing store instead of recreating
    $: if (initialized && graphStore && viewType) {
        const currentViewType = graphStore.getViewType ? graphStore.getViewType() : null;
        
        if (currentViewType && currentViewType !== viewType) {
            console.log('[Graph] View type changed from', currentViewType, 'to', viewType);
            
            // Update the view type on existing store
            if (typeof graphStore.setViewType === 'function') {
                graphStore.setViewType(viewType);
            }
            
            // Apply view-specific behaviors
            applyViewSpecificBehavior();
        }
    }
    
    // ENHANCED: Intelligent data change handling
    $: if (initialized && graphStore && data && isGenuineDataChange(data)) {
        console.log('[Graph] Reactive data change detected');
        processDataUpdate(data, false);
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

                    <!-- CLEAN: Simple conditional rendering - no opacity tricks -->
                    <g class="links-layer">
                        {#if shouldRenderLinks}
                            <!-- DEBUG: Show when links are rendering -->
                            <text 
                                x="0" 
                                y="-250" 
                                text-anchor="middle" 
                                fill="rgba(0,255,0,0.8)" 
                                font-size="14"
                                class="links-debug"
                            >
                                ✅ CLEAN: RENDERING {$graphStore?.links?.length || 0} LINKS
                            </text>
                            
                            {#if $graphStore && $graphStore.links}
                                {#each $graphStore.links as link (link.id)}
                                    <LinkRenderer {link} />
                                    {#if showDebug}
                                        <GraphDebugVisualizer {link} active={showDebug} />
                                    {/if}
                                {/each}
                            {/if}
                        {:else}
                            <!-- DEBUG: Show when links are hidden -->
                            <text 
                                x="0" 
                                y="-250" 
                                text-anchor="middle" 
                                fill="rgba(255,100,100,0.8)" 
                                font-size="14"
                                class="links-debug"
                            >
                                ❌ CLEAN: LINKS HIDDEN - WAITING FOR SETTLEMENT
                            </text>
                        {/if}
                    </g>

                    <!-- Nodes layer -->
                    <g class="nodes-layer">
                        {#if $graphStore && $graphStore.nodes}
                            {#each $graphStore.nodes as node (node.id)}
                                <NodeRenderer 
                                    {node}
                                    viewType={viewType}
                                    on:modeChange={handleModeChange}
                                    on:visibilityChange={handleVisibilityChange}
                                    on:reply={event => {
                                        // Ensure we're dispatching the exact event structure expected
                                        dispatch('reply', { commentId: event.detail.commentId });
                                    }}
                                    on:answerQuestion={event => {
                                        dispatch('answerQuestion', { questionId: event.detail.questionId });
                                    }}
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
                        {/if}
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
                            
                            <!-- ENHANCED: Phantom links debug info -->
                            {#if viewType === 'universal'}
                                <text x="10" y="70" fill="white" font-size="12">
                                    Phantom Links: {shouldRenderLinks ? 'ENABLED' : 'DISABLED'}
                                </text>
                            {/if}
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
        transition: opacity 0.3s ease-in-out;
    }

    .nodes-layer {
        pointer-events: all;
    }
    
    .center-marker {
        pointer-events: none;
    }

    .links-layer:not(.phantom-links-hidden) :global(.link) {
        opacity: 0;
        animation: phantomLinkReveal 0.8s ease-in-out forwards;
    }

    /* ENHANCED: Phantom links reveal animation */
    @keyframes phantomLinkReveal {
        from { 
            opacity: 0; 
        }
        to { 
            opacity: 1; 
        }
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

    /* ENHANCED: Reduce animations for users who prefer reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .links-layer:not(.phantom-links-hidden) :global(.link) {
            animation: none !important;
            opacity: 1 !important;
        }
        
        .links-layer {
            transition: none !important;
        }
        
        @keyframes phantomLinkReveal {
            from, to { 
                opacity: 1; 
            }
        }
    }
</style>