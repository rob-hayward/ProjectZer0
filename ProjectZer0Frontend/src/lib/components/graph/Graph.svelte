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
    
    import AnswerNode from './nodes/answer/AnswerNode.svelte';
    import CategoryNode from './nodes/category/CategoryNode.svelte';
    import CommentNode from './nodes/comment/CommentNode.svelte';
    import DefinitionNode from './nodes/definition/DefinitionNode.svelte';
    import EvidenceNode from './nodes/evidence/EvidenceNode.svelte';
    import StatementNode from './nodes/statement/StatementNode.svelte';
    import OpenQuestionNode from './nodes/openquestion/OpenQuestionNode.svelte';
    import QuantityNode from './nodes/quantity/QuantityNode.svelte';
    import WordNode from './nodes/word/WordNode.svelte';
    import NavigationNode from './nodes/navigation/NavigationNode.svelte';
    import ControlNode from './nodes/controlNode/ControlNode.svelte';
    import { isStatementNode, isOpenQuestionNode, isNavigationNode, isCategoryNode, isAnswerNode, isStatementData, isOpenQuestionData, isCategoryData } from '$lib/types/graph/enhanced';

    
    const DEBUG_MODE = false;

    visibilityStore.initialize();

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
        answerQuestion: { 
            questionId: string;
            questionText: string;         
            sourceNodeId: string;         
            sourcePosition: { x: number; y: number };  
        };
        filterchange: {
            nodeTypes: string[];
            categories: string[];
            keywords: string[];
            sortBy: string;
            sortDirection: 'asc' | 'desc';
            showOnlyMyItems: boolean;
            userFilterMode: string;
        };
        expandCategory: {  
            categoryId: string;
            categoryName: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandWord: {  
            word: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandStatement: {  
            statementId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandOpenQuestion: {
            questionId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandQuantity: {
            quantityId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandAnswer: {
            answerId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        createDefinition: {
            wordId: string;
            word: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandDefinition: {
            definitionId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandEvidence: {
            evidenceId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
    }>();

    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    
    let background: SvgBackground | null = null;
    let initialTransform: d3.ZoomTransform;
    let resetZoom: (() => void) | undefined;
    let zoomInstance: d3.ZoomBehavior<SVGSVGElement, unknown> | undefined;
    let containerDimensions = { width: 0, height: 0 };
    let initialized = false;
    let showDebug = false;
    
    let componentId = Math.random().toString(36).slice(2, 8);
    
    let centralNodePos = { x: 0, y: 0, transform: "", viewX: 0, viewY: 0 };
    let svgViewportInfo = { width: 0, height: 0, viewBox: "", preserveAspectRatio: "" };
    
    let lastDataHash = '';
    let lastProcessedDataId = '';
    let isProcessingData = false;
    let dataUpdateCounter = 0;
    let preferencesApplied = false;

    let centerOnNodeHandler: EventListener;
    let setTransformHandler: EventListener;
    let debugModeChangeHandler: EventListener;

    let isUniversalView = false;

    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
        viewBox: `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`
    };

    const mergedBackgroundConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };

    $: {
        isUniversalView = viewType === 'universal';
    }

    export function getTransform(): any {
        if (!coordinateSystem) return null;
        return coordinateSystem.getCurrentTransform();
    }
    
    export function centerViewportOnCoordinates(x: number, y: number, duration: number = 750): boolean {
        if (!svg || !zoomInstance) {
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
            return false;
        }
        
        const node = $graphStore.nodes.find(n => n.id === nodeId);
        if (!node || !node.position) {
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
            return;
        }
        
        const node = $graphStore.nodes.find(n => n.id === nodeId);
        if (!node || !node.position) {
            return;
        }
        
        centerViewportOn(node.position.x, node.position.y, undefined, duration);
    }

    function handleModeChange(event: CustomEvent<{ 
        nodeId: string; 
        mode: NodeMode;
        position?: { x: number; y: number }; 
    }>) {
        const { nodeId, mode, position } = event.detail;
        
        if (graphStore && typeof graphStore.updateNodeMode === 'function') {
            try {
                graphStore.updateNodeMode(nodeId, mode);
                
                if (mode === 'detail' && position) {
                    setTimeout(() => {
                        const success = centerOnNodeById(nodeId, 750);
                        
                        if (success && graphStore && typeof (graphStore as any).onNodeCenteringComplete === 'function') {
                            setTimeout(() => {
                                (graphStore as any).onNodeCenteringComplete(nodeId);
                            }, 800);
                        } else if (!success) {
                            if (graphStore && typeof (graphStore as any).onNodeCenteringComplete === 'function') {
                                setTimeout(() => {
                                    (graphStore as any).onNodeCenteringComplete(nodeId);
                                }, 100);
                            }
                        }
                    }, 100);
                }
                
            } catch (error) {
                console.error('[Graph] Error calling updateNodeMode():', error);
            }
            
        } else if (graphStore && typeof (graphStore as any).updateNodeMode === 'function') {
            (graphStore as any).updateNodeMode(nodeId, mode);
            
            if (typeof (graphStore as any).forceTick === 'function') {
                (graphStore as any).forceTick(5);
            }
            
            if (mode === 'detail') {
                setTimeout(() => {
                    if ($graphStore && $graphStore.nodes) {
                        const node = $graphStore.nodes.find(n => n.id === nodeId);
                        
                        if (node && node.position) {
                            centerViewportOn(node.position.x, node.position.y);
                        }
                    }
                }, 50);
            }
        }
        
        dispatch('modechange', {
            nodeId,
            mode
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
        if (graphStore) {
            graphStore.updateNodeVisibility(event.detail.nodeId, event.detail.isHidden, 'user');
        }
        
        dispatch('visibilitychange', event.detail);
    }

    function handleFilterChange(event: CustomEvent<{
        nodeTypes: string[];
        categories: string[];
        keywords: string[];
        sortBy: string;
        sortDirection: 'asc' | 'desc';
        showOnlyMyItems: boolean;
        userFilterMode: string;
    }>) {
        dispatch('filterchange', event.detail);
    }

    function handleExpandCategory(event: CustomEvent<{
        categoryId: string;
        categoryName: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        dispatch('expandCategory', event.detail);
    }

    function handleExpandWord(event: CustomEvent<{
        word: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        dispatch('expandWord', event.detail);
    }

    function toggleDebug() {
        showDebug = !showDebug;
        
        if (showDebug && DEBUG_MODE) {
            updateCentralNodeDebugPosition();
            updateSvgViewportInfo();
        }
    }

    function handleExpandStatement(event: CustomEvent<{
        statementId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        dispatch('expandStatement', event.detail);
    }

    function handleExpandOpenQuestion(event: CustomEvent<{
        questionId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        dispatch('expandOpenQuestion', event.detail);
    }

    function handleExpandQuantity(event: CustomEvent<{
        quantityId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        dispatch('expandQuantity', event.detail);
    }

    function handleAnswerQuestion(event: CustomEvent<{
        questionId: string;
    }>) {
        const questionNode = $graphStore?.nodes?.find(n => n.id === event.detail.questionId);
        
        if (!questionNode) {
            return;
        }
        
        const questionText = (questionNode.data as any)?.questionText || 
                            (questionNode.data as any)?.question || 
                            (questionNode.data as any)?.content || 
                            'Question text not available';
        
        dispatch('answerQuestion', {
            questionId: event.detail.questionId,
            questionText: questionText,
            sourceNodeId: questionNode.id,
            sourcePosition: {
                x: questionNode.position?.x || 0,
                y: questionNode.position?.y || 0
            }
        });
    }

    function handleExpandAnswer(event: CustomEvent<{
        answerId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        dispatch('expandAnswer', event.detail);
    }

    function handleCreateDefinition(event: CustomEvent<{
        wordId: string;
    }>) {
        const wordNode = $graphStore?.nodes?.find(n => n.id === event.detail.wordId);
        
        if (!wordNode) {
            return;
        }
        
        const word = (wordNode.data as any)?.word || 
                    (wordNode.data as any)?.content || 
                    'Word not available';
        
        dispatch('createDefinition', {
            wordId: event.detail.wordId,
            word: word,
            sourceNodeId: wordNode.id,
            sourcePosition: {
                x: wordNode.position?.x || 0,
                y: wordNode.position?.y || 0
            }
        });
    }

    function handleExpandDefinition(event: CustomEvent<{
        definitionId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        dispatch('expandDefinition', event.detail);
    }

    function handleExpandEvidence(event: CustomEvent<{
        evidenceId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[Graph] Evidence expansion event received:', {
            evidenceId: event.detail.evidenceId,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandEvidence', event.detail);
        console.log('[Graph] Evidence expansion event forwarded to page');
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
        
        if (!graphStore) {
            graphStore = createGraphStore(viewType);
        } else {
            if (graphStore.getViewType && graphStore.getViewType() !== viewType) {
                graphStore.setViewType(viewType);
            }
        }
        
        updateContainerDimensions();
        initializeZoom();
        initializeBackground();
        
        if (data && isGenuineDataChange(data)) {
            processDataUpdate(data, true);
        }
        
        initialized = true;
    }

    function processDataUpdate(newData: GraphData, isInitialization: boolean = false) {
        if (isProcessingData && !isInitialization) {
            return;
        }
        
        if (!graphStore) {
            return;
        }
        
        isProcessingData = true;
        dataUpdateCounter++;
        
        try {
            const isUniversalManager = typeof graphStore.enableBatchRendering === 'function';
            
            if (isUniversalManager) {
                const hasExistingData = graphStore.getPerformanceMetrics?.()?.renderedNodeCount > 0;
                
                if (hasExistingData && !isInitialization) {
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

    onMount(() => {
        initialize();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateContainerDimensions);
            
            debugModeChangeHandler = ((event: CustomEvent) => {
                if (graphStore && typeof graphStore.updateNodeMode === 'function') {
                    try {
                        graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
                    } catch (error) {
                        console.error('[Graph] Debug mode change error:', error);
                    }
                }
            }) as EventListener;
            window.addEventListener('debug-statement-mode', debugModeChangeHandler);
            
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
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateContainerDimensions);
            window.removeEventListener('center-on-node', centerOnNodeHandler);
            window.removeEventListener('set-transform', setTransformHandler);
            window.removeEventListener('debug-statement-mode', debugModeChangeHandler);
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
                graphStore.dispose();
            }
        }
    });

    $: if (data) {
        preferencesApplied = false;
    }
    
    $: if (initialized && graphStore && viewType) {
        const currentViewType = graphStore.getViewType ? graphStore.getViewType() : null;
        
        if (currentViewType && currentViewType !== viewType) {
            if (typeof graphStore.setViewType === 'function') {
                graphStore.setViewType(viewType);
            }
            
            applyViewSpecificBehavior();
        }
    }
    
    $: if (initialized && graphStore && data && isGenuineDataChange(data)) {
        processDataUpdate(data, false);
    }
    
    $: if (initialized && containerDimensions.width && containerDimensions.height) {
        updateContainerDimensions();
    }
</script>

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

                    <g class="nodes-layer">
                        {#if $graphStore && $graphStore.nodes}
                            {#each $graphStore.nodes as node (node.id)}
                                <NodeRenderer 
                                    {node}
                                    viewType={viewType}
                                    on:modeChange={handleModeChange}
                                    on:visibilityChange={handleVisibilityChange}
                                    on:expandCategory={handleExpandCategory}
                                    on:expandWord={handleExpandWord}
                                    on:expandStatement={handleExpandStatement}
                                    on:expandOpenQuestion={handleExpandOpenQuestion}
                                    on:expandQuantity={handleExpandQuantity}
                                    on:expandAnswer={handleExpandAnswer}
                                    on:createDefinition={handleCreateDefinition}
                                    on:expandDefinition={handleExpandDefinition} 
                                    on:expandEvidence={handleExpandEvidence}
                                    on:reply={event => {
                                        dispatch('reply', { commentId: event.detail.commentId });
                                    }}
                                    on:answerQuestion={handleAnswerQuestion}
                                >
                                    <svelte:fragment 
                                        slot="default" 
                                        let:node 
                                        let:nodeX
                                        let:nodeY
                                        let:handleModeChange
                                        let:handleExpandCategory
                                        let:handleExpandWord
                                    >
                                        {#if isStatementNode(node)}
                                            <StatementNode 
                                                {node}
                                                on:modeChange={handleModeChange}
                                                on:expandCategory={handleExpandCategory}
                                                on:expandWord={handleExpandWord}
                                            />
                                        {:else if isOpenQuestionNode(node)}
                                            <OpenQuestionNode
                                                {node}
                                                on:modeChange={handleModeChange}
                                                on:expandCategory={handleExpandCategory}
                                                on:expandWord={handleExpandWord}
                                            />
                                        {:else if node.type === 'answer'}
                                            <AnswerNode
                                                {node}
                                                on:modeChange={handleModeChange}
                                                on:expandCategory={handleExpandCategory}
                                                on:expandWord={handleExpandWord}
                                            />
                                        {:else if node.type === 'quantity'}
                                            <QuantityNode
                                                {node}
                                                on:modeChange={handleModeChange}
                                                on:expandCategory={handleExpandCategory}
                                                on:expandWord={handleExpandWord}
                                            />
                                        {:else if node.type === 'evidence'}
                                            <EvidenceNode
                                                {node}
                                                on:modeChange={handleModeChange}
                                                on:expandCategory={handleExpandCategory}
                                                on:expandWord={handleExpandWord}
                                            />
                                        {:else if node.type === 'category'}
                                            <CategoryNode
                                                {node}
                                                on:modeChange={handleModeChange}
                                                on:expandWord={handleExpandWord}
                                            />
                                        {:else if node.type === 'word'}
                                            <WordNode
                                                {node}
                                                on:modeChange={handleModeChange}
                                            />
                                        {:else if node.type === 'definition'}
                                            <DefinitionNode
                                                {node}
                                                on:modeChange={handleModeChange}
                                            />    
                                        {:else if isNavigationNode(node)}
                                            <NavigationNode 
                                                {node}
                                            />
                                        {:else if node.id === 'universal-graph-controls'}
                                            <ControlNode 
                                                {node}
                                                on:modeChange={handleModeChange}
                                                on:filterChange={handleFilterChange}
                                            />
                                        {:else}
                                            <slot {node} {handleModeChange} />
                                        {/if}
                                        
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
                        </g>
                    {/if}
                {/key}
            {/if}
        </g>
    </svg>

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

    @media (prefers-contrast: high) {
        .control-button {
            background-color: rgba(0, 0, 0, 0.8);
            border-color: rgba(255, 255, 255, 0.8);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .control-button {
            transition: none;
        }
    }

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