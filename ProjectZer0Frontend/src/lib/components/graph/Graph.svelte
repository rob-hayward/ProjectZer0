<!-- ProjectZer0Frontend/src/lib/components/graph/Graph.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import * as d3 from 'd3';
    import type { BackgroundConfig } from '$lib/types/graph/background';
    import type { 
        GraphData, 
        ViewType, 
        NodeMode, 
        NodeType,
        GraphNode,
        GraphLink
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

    // Props
    export let data: GraphData;
    export let viewType: ViewType;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    
    // These props are kept but not directly used (for backward compatibility)
    // Convert to export const to avoid Svelte warnings
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

    // Constants
    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
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
        if (!svg || !contentGroup) return;

        // Initial transform at proper zoom level
        initialTransform = d3.zoomIdentity
            .scale(COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM);
            
        // Initialize the coordinate system with the initial transform
        coordinateSystem.updateTransform(initialTransform);

        // Configure zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([
                COORDINATE_SPACE.WORLD.VIEW.MIN_ZOOM,
                COORDINATE_SPACE.WORLD.VIEW.MAX_ZOOM
            ])
            .on('zoom', (event) => {
                const transform = event.transform;
                // Apply transform to SVG content groups
                d3.select(contentGroup).attr('transform', transform.toString());
                d3.select(backgroundGroup).attr('transform', transform.toString());
                
                // Update the coordinate system with the current transform
                // This ensures all coordinate calculations are aware of zoom level
                coordinateSystem.updateTransform(transform);
                
                // Log zoom level for debugging
                if (showDebug) {
                    console.debug('[Graph] Zoom updated:', {
                        scale: transform.k,
                        translate: [transform.x, transform.y]
                    });
                }
            });

        // Apply zoom behavior to SVG
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
     * Handle node mode change events
     */
    function handleModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.debug('[Graph] Mode change event:', event.detail);
        
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
        console.debug('[Graph] Visibility change event:', event.detail);
        
        // Notify the graph store
        if (graphStore) {
            graphStore.updateNodeVisibility(event.detail.nodeId, event.detail.isHidden);
        }
        
        // Forward the event to parent
        dispatch('visibilitychange', event.detail);
    }

    /**
     * Toggle debug mode
     */
    function toggleDebug() {
        showDebug = !showDebug;
        console.debug('[Graph] Debug mode:', showDebug);
        
        if (showDebug) {
            // Log current coordinate system info in debug mode
            const transform = coordinateSystem.getCurrentTransform();
            console.debug('[Graph] Current coordinate system:', {
                scale: transform.k,
                translate: [transform.x, transform.y],
                worldOriginInView: coordinateSystem.worldToView(0, 0)
            });
        }
    }

    /**
     * Initialize the component
     */
    function initialize() {
        if (initialized) return;
        
        console.debug('[Graph] Initializing graph component', { viewType, dataNodes: data?.nodes?.length });
        
        // Create graph store for this view
        graphStore = createGraphStore(viewType);
        
        // Initialize zoom and background
        updateContainerDimensions();
        initializeZoom();
        initializeBackground();
        
        // Initialize with data
        if (data) {
            graphStore.setData(data);
        }
        
        initialized = true;
    }

    // Lifecycle hooks
    onMount(async () => {
        initialize();
        
        if (typeof window !== 'undefined') {
        window.addEventListener('resize', updateContainerDimensions);
        
        // Load visibility preferences when component mounts
        if ($userStore) {
            await visibilityStore.loadPreferences();
            applyVisibilityPreferences();
        }
        }
    });
    
    // Function to apply loaded preferences to current nodes
    function applyVisibilityPreferences() {
        if (!graphStore || !$visibilityStore.isLoaded) return;
        
        // For each node, check if there's a preference and apply it
        $graphStore.nodes.forEach(node => {
        const preference = visibilityStore.getPreference(node.id);
        if (preference !== undefined) {
            console.log(`[Graph] Applying user preference for node ${node.id}: ${preference}`);
            graphStore.updateNodeVisibility(node.id, !preference, 'user');
        }
        });
    }

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateContainerDimensions);
        }
        
        if (background) {
            background.destroy();
        }
        
        if (graphStore) {
            graphStore.dispose();
        }
    });

    // Reactive declarations
    
    // When viewType changes
    $: if (initialized && graphStore && viewType !== graphStore.getViewType()) {
        console.debug('[Graph] View type changed:', { 
            from: graphStore.getViewType(), 
            to: viewType 
        });
        graphStore.setViewType(viewType);
    }
    
    // When data changes
    $: if (initialized && graphStore && data) {
        console.debug('[Graph] Data changed:', { 
            nodeCount: data.nodes.length, 
            linkCount: data.links?.length || 0 
        });
        graphStore.setData(data);
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
            <!-- Global filters and patterns could be added here -->
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

                    <!-- Debug overlay -->
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
                on:click={resetZoom}
                aria-label="Reset view"
                title="Reset view"
            >
                <span class="material-symbols-outlined">restart_alt</span>
            </button>
        {/if}
        
        <!-- Debug toggle button -->
        <button
            class="control-button debug-button"
            on:click={toggleDebug}
            aria-label="Toggle debug mode"
            title="Toggle debug mode"
        >
            <span class="material-symbols-outlined">{showDebug ? 'bug_off' : 'bug_on'}</span>
        </button>
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

    :global(.graph-svg *) {
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