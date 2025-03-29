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
    let containerDimensions = {
        width: 0,
        height: 0
    };
    let initialized = false;
    let showDebug = false;
    
    // Debug info for the central node
    let centralNodePos = { x: 0, y: 0, transform: "", viewX: 0, viewY: 0 };
    let svgViewportInfo = { width: 0, height: 0, viewBox: "", preserveAspectRatio: "" };
    
    // Flag to track if we've already applied preferences
    let preferencesApplied = false;

    // Constants - Define viewBox to center coordinate system
    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
        // This centers the coordinate system at (0,0)
        viewBox: `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`
    };

    // Background configuration
    const mergedBackgroundConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };

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
     * Handle node mode change events
     */
    function handleModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        // Notify the graph store
        if (graphStore) {
            graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
        }
        
        // Forward the event to parent
        dispatch('modechange', event.detail);
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
     * Initialize the component
     */
    function initialize() {
        if (initialized) return;
        
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
    onMount(async () => {
        initialize();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateContainerDimensions);
            
            // Load visibility preferences when component mounts
            if ($userStore) {
                // Apply any cached preferences immediately
                applyVisibilityPreferences();
                
                // Then load from backend and apply again
                await visibilityStore.loadPreferences();
                applyVisibilityPreferences();
            }
        }
        
        // Force graph to center after a short delay
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
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateContainerDimensions);
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
                                    let:handleModeChange
                                >
                                    <slot 
                                        {node} 
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