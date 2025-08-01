<!-- src/lib/components/graph/Graph.svelte - CLEAN VERSION (No unused CSS) -->
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
    
    const DEBUG_MODE = false;

    visibilityStore.initialize();

    // Props
    export let data: GraphData;
    export let viewType: ViewType;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    export let graphStore: GraphStore | null = null;
    
    export const isPreviewMode = false;
    export const width = COORDINATE_SPACE.WORLD.WIDTH;
    export const height = COORDINATE_SPACE.WORLD.HEIGHT;

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
    let containerDimensions = { width: 0, height: 0 };
    let initialized = false;
    let showDebug = false;
    
    let componentId = Math.random().toString(36).slice(2, 8);
    
    // Debug info
    let centralNodePos = { x: 0, y: 0, transform: "", viewX: 0, viewY: 0 };
    let svgViewportInfo = { width: 0, height: 0, viewBox: "", preserveAspectRatio: "" };
    
    // Data change tracking
    let lastDataHash = '';
    let lastProcessedDataId = '';
    let isProcessingData = false;
    let dataUpdateCounter = 0;
    let preferencesApplied = false;

    // Event handlers
    let centerOnNodeHandler: EventListener;
    let setTransformHandler: EventListener;

    // SIMPLE: Just track if this is universal view
    let isUniversalView = false;

    // Constants
    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
        viewBox: `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`
    };

    const mergedBackgroundConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };

    // SIMPLE: Just detect universal view
    $: {
        isUniversalView = viewType === 'universal';
    }

    // EXPORTED METHODS
    
    export function getTransform(): any {
        if (!coordinateSystem) return null;
        return coordinateSystem.getCurrentTransform();
    }
    
    export function centerViewportOnCoordinates(x: number, y: number, duration: number = 750): boolean {
        if (!svg || !zoomInstance) {
            console.error('[Graph] Cannot center - svg or zoomInstance is null');
            return false;
        }
        
        try {
            const currentTransform = coordinateSystem.getCurrentTransform();
            const scale = currentTransform.k;
            
            const transform = d3.zoomIdentity
                .translate(-x * scale, -y * scale)
                .scale(scale);
            
            d3.select(svg)
                .transition()
                .duration(duration)
                .call(zoomInstance.transform, transform);
            
            return true;
        } catch (e) {
            console.error('[Graph] Error centering viewport:', e);
            return false;
        }
    }

    export function getInternalState(): any {
        return graphStore ? graphStore.getState() : null;
    }

    export function findFormNodeByParentId(parentId: string): any {
        if (!graphStore) return null;
        
        const state = graphStore.getState() as any;
        if (!state || !state.nodes) return null;
        
        return state.nodes.find((n: any) =>
            n.type === 'comment-form' && 
            (n.metadata?.parentCommentId === parentId || 
            (n.data && n.data.parentCommentId === parentId))
        );
    }

    export function logNodeState(nodeType?: string): void {
        if (!graphStore) return;
        
        const state = graphStore.getState() as any;
        if (!state || !state.nodes) return;
        
        const nodes = nodeType ? 
            state.nodes.filter((n: any) => n.type === nodeType) :
            state.nodes;
    }
    
    export function centerOnNodeById(nodeId: string, duration: number = 750): boolean {
        if (!graphStore || !$graphStore || !$graphStore.nodes) {
            console.error('[Graph] centerOnNodeById failed: graphStore is not initialized');
            return false;
        }
        
        const node = $graphStore.nodes.find(n => n.id === nodeId);
        if (!node || !node.position) {
            console.error(`[Graph] centerOnNodeById failed: node ${nodeId} not found or has no position`);
            return false;
        }
        
        return centerViewportOnCoordinates(node.position.x, node.position.y, duration);
    }

    function createDataHash(data: GraphData): string {
        if (!data || !data.nodes) return '';
        
        const nodeHash = data.nodes.map(n => n.id).sort().join(',');
        const linkHash = (data.links?.length || 0).toString();
        const structureHash = `${data.nodes.length}-${linkHash}`;
        
        return `${nodeHash}-${structureHash}`;
    }

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
        
        if (svg && DEBUG_MODE) {
            updateSvgViewportInfo();
        }
    }
    
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

    function initializeZoom() {
        if (!svg || !contentGroup || !backgroundGroup) return;

        const initialZoomLevel = COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM;
        initialTransform = d3.zoomIdentity.scale(initialZoomLevel);
        coordinateSystem.updateTransform(initialTransform);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([
                COORDINATE_SPACE.WORLD.VIEW.MIN_ZOOM,
                COORDINATE_SPACE.WORLD.VIEW.MAX_ZOOM
            ])
            .on('start', () => {
                window.dispatchEvent(new CustomEvent('zoom-start'));
            })
            .on('zoom', (event) => {
                const transform = event.transform;
                
                d3.select(contentGroup).attr('transform', transform.toString());
                d3.select(backgroundGroup).attr('transform', transform.toString());
                coordinateSystem.updateTransform(transform);
                
                if (viewType === 'statement-network' && graphStore) {
                    graphStore.fixNodePositions();
                    if (DEBUG_MODE) updateCentralNodeDebugPosition();
                }
            })
            .on('end', () => {
                window.dispatchEvent(new CustomEvent('zoom-end'));
                
                if (viewType === 'statement-network' && graphStore) {
                    graphStore.fixNodePositions();
                    graphStore.forceTick(2);
                    if (DEBUG_MODE) updateCentralNodeDebugPosition();
                }
            });

        zoomInstance = zoom;

        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, initialTransform)
            .on('contextmenu', (event) => event.preventDefault());

        resetZoom = () => {
            d3.select(svg)
                .transition()
                .duration(750)
                .call(zoom.transform, initialTransform);
        };
    }
    
    function centerViewportOn(x: number, y: number, zoomLevel?: number, duration: number = 750) {
        if (!svg || !zoomInstance) {
            console.error('[Graph] centerViewportOn failed: svg or zoomInstance is null');
            return;
        }
        
        const currentTransform = coordinateSystem.getCurrentTransform();
        
        try {
            const scale = zoomLevel !== undefined ? zoomLevel : currentTransform.k;
            
            const transform = d3.zoomIdentity
                .translate(-x * scale, -y * scale)
                .scale(scale);
            
            d3.select(svg)
                .transition()
                .duration(duration)
                .call(zoomInstance.transform, transform);
        } catch (e) {
            console.error('[Graph] Error centering viewport:', e);
        }
    }

    function centerOnNode(nodeId: string, duration: number = 750): void {
        if (!graphStore || !$graphStore || !$graphStore.nodes) {
            console.error('[Graph] centerOnNode failed: graphStore is null');
            return;
        }
        
        const node = $graphStore.nodes.find(n => n.id === nodeId);
        if (!node || !node.position) {
            console.error(`[Graph] centerOnNode failed: node ${nodeId} not found or has no position`);
            return;
        }
        
        centerViewportOn(node.position.x, node.position.y, undefined, duration);
    }

    function handleModeChange(event: CustomEvent<{ 
        nodeId: string; 
        mode: NodeMode;
        position?: { x: number; y: number }; 
    }>) {
        const nodeId = event.detail.nodeId;
        const newMode = event.detail.mode;
        
        if (graphStore && typeof graphStore.updateNodeMode === 'function') {
            graphStore.updateNodeMode(nodeId, newMode);
            
            if (typeof graphStore.forceTick === 'function') {
                graphStore.forceTick(5);
            }
            
            if (newMode === 'detail') {
                setTimeout(() => {
                    if ($graphStore && $graphStore.nodes) {
                        const node = $graphStore.nodes.find(n => n.id === nodeId);
                        
                        if (node && node.position) {
                            centerViewportOn(
                                node.position.x,
                                node.position.y
                            );
                        }
                    }
                }, 50);
            }
        }
        
        dispatch('modechange', {
            nodeId: event.detail.nodeId,
            mode: event.detail.mode
        });
    }

    function updateCentralNodeDebugPosition() {
        if (!$graphStore || !$graphStore.nodes || !DEBUG_MODE) return;
        
        const centralNode = $graphStore.nodes.find(node => 
            node.group === 'central' || (node.data && 'sub' in node.data && node.data.sub === 'controls')
        );
        
        if (centralNode) {
            const nodeX = centralNode.position.x;
            const nodeY = centralNode.position.y;
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

    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        console.log('[Graph] handleVisibilityChange received event:', {
            nodeId: event.detail.nodeId,
            isHidden: event.detail.isHidden,
            eventType: event.type,
            timestamp: Date.now()
        });
        
        if (graphStore) {
            console.log('[Graph] Updating graph store node visibility');
            graphStore.updateNodeVisibility(event.detail.nodeId, event.detail.isHidden, 'user');
        } else {
            console.warn('[Graph] No graphStore available for visibility update');
        }
        
        // Forward the event to parent components
        dispatch('visibilitychange', event.detail);
        
        // REMOVED: duplicate call to visibilityStore.setPreference
        // The visibilityBehaviour in the node component already handles this
        console.log('[Graph] Visibility change handling complete - visibilityBehaviour should handle backend save');
    }

    function toggleDebug() {
        showDebug = !showDebug;
        
        if (showDebug && DEBUG_MODE) {
            updateCentralNodeDebugPosition();
            updateSvgViewportInfo();
        }
    }

    function applyViewSpecificBehavior() {
        if (!graphStore) return;
        
        if (viewType === 'statement-network') {
            graphStore.fixNodePositions();
            graphStore.forceTick(3);
            
            if (DEBUG_MODE) {
                updateCentralNodeDebugPosition();
                updateSvgViewportInfo();
            }
        }
    }

    function resetViewport() {
        if (!svg || !resetZoom) return;
        resetZoom();
    }

    function initialize() {
        if (initialized) return;
        
        console.log('[Graph] SIMPLE - Initializing component:', { 
            componentId, 
            viewType,
            isUniversalView,
            hasExistingGraphStore: !!graphStore
        });
        
        if (!graphStore) {
            console.log('[Graph] Creating new graph store for', viewType);
            graphStore = createGraphStore(viewType);
        } else {
            console.log('[Graph] Using existing graph store for', viewType);
            
            if (graphStore.getViewType && graphStore.getViewType() !== viewType) {
                console.log('[Graph] Updating view type from', graphStore.getViewType(), 'to', viewType);
                graphStore.setViewType(viewType);
            }
        }
        
        updateContainerDimensions();
        initializeZoom();
        initializeBackground();
        
        if (data && isGenuineDataChange(data)) {
            console.log('[Graph] Applying initial data during initialization');
            processDataUpdate(data, true);
        }
        
        initialized = true;
        console.log('[Graph] SIMPLE - Component initialized successfully');
    }

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
        
        console.log('[Graph] SIMPLE - Processing data update #', dataUpdateCounter, {
            isInitialization,
            viewType,
            isUniversalView,
            nodeCount: newData.nodes?.length || 0,
            linkCount: newData.links?.length || 0
        });
        
        try {
            const isUniversalManager = typeof graphStore.enableBatchRendering === 'function';
            
            if (isUniversalManager) {
                const hasExistingData = graphStore.getPerformanceMetrics?.()?.renderedNodeCount > 0;
                
                if (hasExistingData && !isInitialization) {
                    console.log('[Graph] Using gentle sync for settled universal manager');
                    
                    if (typeof (graphStore as any).syncDataGently === 'function') {
                        (graphStore as any).syncDataGently(newData);
                    } else {
                        if (typeof (graphStore as any).updateState === 'function') {
                            (graphStore as any).updateState(newData, 0.1);
                        } else {
                            graphStore.setData(newData, { skipAnimation: true });
                        }
                    }
                } else {
                    console.log('[Graph] Initial data load for universal manager');
                    graphStore.setData(newData);
                }
            } else {
                if (viewType === 'statement-network') {
                    graphStore.setData(newData, { skipAnimation: true });
                    
                    setTimeout(() => {
                        if (graphStore) {
                            graphStore.fixNodePositions();
                            graphStore.forceTick(5);
                            setTimeout(() => resetViewport(), 100);
                        }
                    }, 0);
                } else {
                    graphStore.setData(newData);
                }
            }
            
        } catch (error) {
            console.error('[Graph] Error processing data update:', error);
        } finally {
            setTimeout(() => {
                isProcessingData = false;
            }, 100);
        }
    }

    function applyVisibilityPreferences() {
        if (!graphStore) return;
        
        const preferences = visibilityStore.getAllPreferences();
        if (Object.keys(preferences).length > 0) {
            (graphStore as any).applyVisibilityPreferences(preferences);
        }
    }

    // Lifecycle hooks
    onMount(() => {
        console.log('[Graph] SIMPLE - Component mounting with view type:', viewType, 'isUniversal:', isUniversalView);
        initialize();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateContainerDimensions);
            
            centerOnNodeHandler = ((event: CustomEvent) => {
                if (!event.detail) return;
                
                if (event.detail.nodeId || (event.detail.x !== undefined && event.detail.y !== undefined)) {
                    if (event.detail.nodeId) {
                        centerOnNode(event.detail.nodeId, event.detail.duration);
                    } else {
                        centerViewportOn(event.detail.x, event.detail.y, 
                                        event.detail.zoomLevel, event.detail.duration);
                    }
                }
            }) as EventListener;
            window.addEventListener('center-on-node', centerOnNodeHandler);
            
            setTransformHandler = ((event: CustomEvent) => {
                if (event.detail && event.detail.transform && svg && zoomInstance) {
                    d3.select(svg)
                        .transition()
                        .duration(event.detail.duration || 750)
                        .call(zoomInstance.transform, event.detail.transform);
                }
            }) as EventListener;
            window.addEventListener('set-transform', setTransformHandler);
            
            if ($userStore) {
                applyVisibilityPreferences();
                
                visibilityStore.loadPreferences().then(() => {
                    applyVisibilityPreferences();
                });
            }
        }
        
        if (viewType === 'statement-network') {
            setTimeout(() => {
                resetViewport();
            }, 250);
        }
    });

    afterUpdate(() => {
        if (data && graphStore && !preferencesApplied) {
            preferencesApplied = true;
            applyVisibilityPreferences();
        }
        
        if (initialized && graphStore) {
            applyViewSpecificBehavior();
        }
    });

    onDestroy(() => {
        console.log('[Graph] SIMPLE - Component destroying');
        
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateContainerDimensions);
            window.removeEventListener('center-on-node', centerOnNodeHandler);
            window.removeEventListener('set-transform', setTransformHandler);
        }
        
        if (svg) {
            d3.select(svg).on('.zoom', null);
        }
        
        if (background) {
            background.destroy();
        }
        
        if (graphStore && typeof graphStore.dispose === 'function') {
            const wasCreatedByUs = !lastDataHash;
            if (wasCreatedByUs) {
                console.log('[Graph] Disposing graph store created by component');
                graphStore.dispose();
            } else {
                console.log('[Graph] Not disposing graph store - managed by parent');
            }
        }
    });

    // Reactive declarations
    
    $: if (data) {
        preferencesApplied = false;
    }
    
    $: if (initialized && graphStore && viewType) {
        const currentViewType = graphStore.getViewType ? graphStore.getViewType() : null;
        
        if (currentViewType && currentViewType !== viewType) {
            console.log('[Graph] View type changed from', currentViewType, 'to', viewType);
            
            if (typeof graphStore.setViewType === 'function') {
                graphStore.setViewType(viewType);
            }
            
            applyViewSpecificBehavior();
        }
    }
    
    $: if (initialized && graphStore && data && isGenuineDataChange(data)) {
        console.log('[Graph] SIMPLE - Reactive data change detected');
        processDataUpdate(data, false);
    }
    
    $: if (initialized && containerDimensions.width && containerDimensions.height) {
        updateContainerDimensions();
    }
</script>

<!-- SIMPLE: Clean container without unused CSS -->
<div 
    bind:this={container} 
    class="graph-container"
    class:universal-graph={isUniversalView}
>
    <svg 
        bind:this={svg}
        width="100%"
        height="100%"
        viewBox={worldDimensions.viewBox}
        preserveAspectRatio="xMidYMid meet"
        class="graph-svg"
    >
        <defs>
            <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feComposite in="blur" in2="SourceGraphic" operator="atop" />
            </filter>
        </defs>

        <g class="background-layer">
            <svg 
                width="100%"
                height="100%"
                overflow="visible"
            >
                <g bind:this={backgroundGroup} />
            </svg>
        </g>

        <g 
            bind:this={contentGroup} 
            class="content-layer"
        >
            {#if initialized && graphStore}
                {#key graphStore.getViewType()}
                    {#if DEBUG_MODE}
                    <g class="center-marker">
                        <circle cx="0" cy="0" r="3" fill="red" fill-opacity="0.5" />
                    </g>
                    {/if}

                    <!-- SIMPLE: Links without complex CSS -->
                    <g class="links-layer">
                        {#if $graphStore && $graphStore.links && $graphStore.links.length > 0}
                            {#each $graphStore.links as link (link.id)}
                                <LinkRenderer {link} />
                                {#if showDebug}
                                    <GraphDebugVisualizer {link} active={showDebug} />
                                {/if}
                            {/each}
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

                    {#if showDebug}
                        <g class="debug-overlay">
                            <line x1="-500" y1="0" x2="500" y2="0" stroke="rgba(255,0,0,0.3)" stroke-width="1" />
                            <line x1="0" y1="-500" x2="0" y2="500" stroke="rgba(255,0,0,0.3)" stroke-width="1" />
                            
                            <circle cx="0" cy="0" r="5" fill="red" />
                            <text x="10" y="10" fill="white" font-size="12">Origin (0,0)</text>
                            
                            <text x="10" y="30" fill="white" font-size="12">
                                Zoom: {coordinateSystem.getCurrentTransform().k.toFixed(2)}
                            </text>
                            
                            <text x="10" y="50" fill="white" font-size="12">
                                Central: ({centralNodePos.x.toFixed(1)}, {centralNodePos.y.toFixed(1)})
                            </text>
                            
                            <text x="10" y="70" fill="white" font-size="12">
                                View: {isUniversalView ? 'Universal' : 'Standard'}
                            </text>
                            
                            <text x="10" y="90" fill="white" font-size="12">
                                Links: {$graphStore?.links?.length || 0}
                            </text>
                            
                            <text x="10" y="110" fill="white" font-size="12">
                                SIMPLE: Direct opacity calculations
                            </text>
                        </g>
                    {/if}
                {/key}
            {/if}
        </g>
    </svg>

    <!-- Control buttons -->
    <div class="controls">
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

    :global(.graph-svg) {
        transform-origin: 0px 0px;
    }

    :global(.content-layer),
    :global(.background-layer) {
        transform-origin: 0px 0px;
    }

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

    /* Responsive design */
    @media (max-width: 768px) {
        .controls {
            bottom: 0.5rem;
            right: 0.5rem;
            gap: 0.25rem;
        }
        
        .control-button {
            width: 2rem;
            height: 2rem;
        }
        
        .control-button :global(.material-symbols-outlined) {
            font-size: 1.25rem;
        }
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
        .control-button {
            background-color: rgba(0, 0, 0, 0.8);
            border-color: rgba(255, 255, 255, 0.8);
        }
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
        .control-button {
            transition: none;
        }
    }

    /* Print styles */
    @media print {
        .controls {
            display: none;
        }
        
        .graph-container {
            height: 100%;
            background: white;
        }
    }
</style>