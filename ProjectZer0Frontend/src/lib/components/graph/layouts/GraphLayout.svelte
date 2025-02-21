<!-- ProjectZer0Frontend/src/lib/components/graph/layouts/GraphLayout.svelte -->
<script lang="ts">
    console.log('[LAYOUT-DEBUG] GraphLayout script initialization');
    
    import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphData, NodePosition, ViewType } from '$lib/types/graph/core';
    import type { NodeMode } from '$lib/types/nodes';
    import { GraphLayoutEngine as LayoutClass } from './GraphLayoutEngine';
    import WordDefinitionLink from '../links/connections/WordDefinitionLink.svelte';
    import { COORDINATE_SPACE } from '$lib/constants/graph';

    // Props
    export let data: GraphData;
    export let width: number;
    export let height: number;
    export let viewType: ViewType;
    export let isPreviewMode = false;

    // Event dispatch
    const dispatch = createEventDispatcher<{
        modechange: { nodeId: string; mode: NodeMode }
    }>();

    // Component state initialization
    let layout: LayoutClass | null = null;
    let nodePositions: Map<string, NodePosition> = new Map();
    let expandedNodes = new Map<string, NodeMode>();
    let initialized = false;
    let layoutReady = false;
    let currentViewType = viewType;
    let componentMounted = false;
    let updateCounter = 0;
    
    // Word node tracking
    let wordNodeId: string | null = null;
    let wordNodeMode: NodeMode | null = null;
    let previousWordNodeMode: NodeMode | null = null;
    
    // Only force refresh on real changes, not just for periodic updates
    let forceRefreshLinks = Date.now();
    let lastRefresh = 0;
    let isPeriodicUpdate = false;
    
    // Track previous values to prevent unnecessary updates
    let prevWidth = width;
    let prevHeight = height;
    
    // Find any word node in the data
    function findWordNode(): { id: string; mode: NodeMode } | null {
        const wordNode = data?.nodes?.find(n => n.type === 'word');
        if (wordNode && 'mode' in wordNode) {
            return { 
                id: wordNode.id, 
                mode: wordNode.mode as NodeMode 
            };
        }
        return null;
    }

    onMount(() => {
        console.log('[LAYOUT-DEBUG] Component onMount');
        componentMounted = true;
        
        try {
            // Initialize layout
            initializeLayout();
            
            // Find and track word node
            const wordNode = findWordNode();
            if (wordNode) {
                wordNodeId = wordNode.id;
                wordNodeMode = wordNode.mode;
                previousWordNodeMode = wordNode.mode;
                console.debug('[LAYOUT-DEBUG] Word node found:', { 
                    id: wordNodeId, 
                    mode: wordNodeMode 
                });
            }
            
            // Schedule recurrent link checks but less frequently
            const checkInterval = setInterval(() => {
                // Only update timestamp if real change detected
                if (wordNodeId && wordNodeMode) {
                    // Set flag to indicate this is just a periodic check
                    isPeriodicUpdate = true;
                    
                    // Throttle updates to once every 5 seconds for periodic checks
                    const now = Date.now();
                    if (now - lastRefresh > 5000) {
                        forceRefreshLinks = now;
                        lastRefresh = now;
                    }
                    
                    isPeriodicUpdate = false;
                }
            }, 5000); // Much less frequent checks
            
            // Return cleanup function
            return function cleanup() {
                clearInterval(checkInterval);
            };
        } catch (error) {
            console.error('[LAYOUT-DEBUG] Mount error:', error);
        }
    });
 
    onDestroy(() => {
        if (layout) {
            layout.stop();
        }
    });

    // Debug current state
    $: console.log('[LAYOUT-DEBUG] Component state:', {
        mounted: componentMounted,
        initialized,
        layoutReady,
        hasLinks: !!data?.links?.length,
        linkCount: data?.links?.length,
        hasPositions: nodePositions.size > 0,
        wordNodeId,
        wordNodeMode,
        previousWordNodeMode,
        updateCounter
    });

    async function updateNodePositions(forceUpdate = false) {
        console.log('[LAYOUT-DEBUG] updateNodePositions called', { 
            forceUpdate,
            counter: ++updateCounter 
        });
        
        if (!layout || !data) return;
        
        // First check for word node mode changes
        const wordNode = findWordNode();
        const currentWordNodeMode = wordNode?.mode || null;
        
        // Check if word node mode changed
        const wordNodeChanged = (
            previousWordNodeMode !== null && 
            currentWordNodeMode !== null && 
            previousWordNodeMode !== currentWordNodeMode
        );
        
        if (wordNodeChanged) {
            console.debug('[LAYOUT-DEBUG] Word node mode changed:', {
                from: previousWordNodeMode,
                to: currentWordNodeMode
            });
            
            // Update word node tracking
            wordNodeMode = currentWordNodeMode;
            previousWordNodeMode = currentWordNodeMode;
            
            // Always force update when word node changes
            forceUpdate = true;
            
            // Force links to refresh by changing the key
            forceRefreshLinks = Date.now();
        }
        
        // Update modes map from data nodes
        const modes = new Map<string, NodeMode>();
        data.nodes.forEach(node => {
            if ('mode' in node) {
                modes.set(node.id, node.mode as NodeMode);
            }
        });
        
        // Apply modes to layout
        if (modes.size > 0) {
            layout.updateDefinitionModes(modes);
        }
        
        // Update layout and get fresh positions
        nodePositions = layout.updateLayout(data, !forceUpdate);
        layoutReady = true;
        
        // If the word node changed modes, schedule multiple updates for smoother transitions
        if (wordNodeChanged || forceUpdate) {
            await tick();
            
            // Force multiple updates
            const delays = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000];
            
            for (const delay of delays) {
                setTimeout(async () => {
                    if (!layout) return;
                    
                    console.debug(`[LAYOUT-DEBUG] Performing delayed update at ${delay}ms`);
                    
                    // Get fresh positions
                    nodePositions = layout.updateLayout(data, false);
                    
                    // Force links to refresh with new timestamp
                    forceRefreshLinks = Date.now();
                    
                    await tick();
                }, delay);
            }
        }
        
        console.debug('[LAYOUT-DEBUG] Positions updated:', {
            nodesCount: data.nodes.length,
            positionsCount: nodePositions.size,
            wordNodeChanged
        });
    }

    async function handleModeChange(nodeId: string, newMode: NodeMode) {
        // Check if this is a word node change
        const isWordNodeChange = nodeId === wordNodeId;
        
        console.debug('[LAYOUT-DEBUG] Mode change handler called:', {
            nodeId,
            newMode,
            isWordNode: isWordNodeChange,
            currentWordMode: wordNodeMode,
            previousWordMode: previousWordNodeMode
        });
        
        // If this is a word node, update our tracking
        if (isWordNodeChange) {
            previousWordNodeMode = wordNodeMode;
            wordNodeMode = newMode;
        }
        
        // Update the actual node data
        data.nodes.forEach(node => {
            if (node.id === nodeId) {
                node.mode = newMode;
            }
        });
        
        // Track expanded nodes
        expandedNodes.set(nodeId, newMode);
        expandedNodes = new Map(expandedNodes);
        
        if (layout) {
            // Update layout with new modes
            layout.updateDefinitionModes(expandedNodes);
            
            // Word node changes need special handling
            if (isWordNodeChange) {
                // Update timestamp for real changes
                const now = Date.now();
                forceRefreshLinks = now;
                lastRefresh = now;
                
                // Force immediate update
                await updateNodePositions(true);
            } else {
                // Standard update for other nodes
                updateNodePositions(false);
            }
        }
 
        // Notify parent component
        dispatch('modechange', { nodeId, mode: newMode });
    }

    function createModeChangeHandler(nodeId: string) {
        return function(event: CustomEvent<{ mode: NodeMode }>) {
            handleModeChange(nodeId, event.detail.mode);
        };
    }

    function initializeLayout() {
        try {
            // Always use COORDINATE_SPACE constants for world dimensions
            layout = new LayoutClass(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT, 
                viewType, 
                isPreviewMode
            );
            
            updateNodePositions(false);
            initialized = true;
            currentViewType = viewType;
            
            const wordNode = findWordNode();
            if (wordNode) {
                wordNodeId = wordNode.id;
                wordNodeMode = wordNode.mode;
                previousWordNodeMode = wordNode.mode;
            }
            
            console.log('[LAYOUT-DEBUG] Layout initialized successfully');
        } catch (error) {
            console.error('[LAYOUT-DEBUG] Layout initialization error:', error);
            throw error;
        }
    }

    // Reactivity - watch for property changes
    $: if (initialized && layout && viewType !== currentViewType) {
        layout.updateViewType(viewType);
        currentViewType = viewType;
        updateNodePositions(true);
    }
 
    $: if (initialized && layout && isPreviewMode !== undefined) {
        layout.updatePreviewMode(isPreviewMode);
        updateNodePositions(true);
    }
 
    $: if (initialized && layout && data) {
        // Check if word node changed
        const wordNode = findWordNode();
        if (wordNode) {
            // If word node mode changed, force update
            if (wordNodeMode !== wordNode.mode) {
                previousWordNodeMode = wordNodeMode;
                wordNodeMode = wordNode.mode;
                updateNodePositions(true);
            } else {
                updateNodePositions(false);
            }
        } else {
            updateNodePositions(false);
        }
    }
 
    $: if (initialized && layout && (width !== prevWidth || height !== prevHeight)) {
        layout.resize(COORDINATE_SPACE.WORLD.WIDTH, COORDINATE_SPACE.WORLD.HEIGHT);
        updateNodePositions(true);
        prevWidth = width;
        prevHeight = height;
    }
    
    // Observe expanded nodes changes
    $: if (initialized && layout && expandedNodes.size > 0) {
        // Force link recalculation when nodes change
        setTimeout(() => {
            forceRefreshLinks = Date.now();
        }, 10);
    }
</script>

{#if componentMounted}
    <g class="graph-layout">
        {#if layoutReady && data.links?.length > 0}
            <!-- Log and render links -->
            {@const linksLog = console.log('[LAYOUT-DEBUG] Rendering links', {
                count: data.links.length,
                refresh: forceRefreshLinks
            })}
            <g class="links" aria-hidden="true">
                {#each data.links as link, index (index + '-' + forceRefreshLinks)}
                    <!-- Get source/target data -->
                    {@const sourceId = typeof link.source === 'string' ? link.source : link.source.id}
                    {@const targetId = typeof link.target === 'string' ? link.target : link.target.id}
                    {@const sourceNode = data.nodes.find(n => n.id === sourceId)}
                    {@const targetNode = data.nodes.find(n => n.id === targetId)}
                    {@const sourcePos = nodePositions.get(sourceId)}
                    {@const targetPos = nodePositions.get(targetId)}
                    
                    {#if sourcePos && targetPos && sourceNode && targetNode}
                        <!-- Create a unique key for this link instance -->
                        {@const linkKey = `${sourceNode.mode}-${targetNode.mode}-${forceRefreshLinks}`}
                        
                        <!-- Only render if we have valid data -->
                        <WordDefinitionLink
                            sourceNode={sourceNode}
                            targetNode={targetNode}
                            sourceX={sourcePos.x}
                            sourceY={sourcePos.y}
                            targetX={targetPos.x}
                            targetY={targetPos.y}
                            version={linkKey}
                        />
                    {/if}
                {/each}
            </g>
        {/if}

        {#if layoutReady && data.nodes?.length > 0}
            <g class="nodes">
                {#each data.nodes as node (node.id)}
                    {@const position = nodePositions.get(node.id)}
                    {#if position}
                        <slot
                            {node}
                            {position}
                            handleNodeModeChange={createModeChangeHandler(node.id)}
                        />
                    {/if}
                {/each}
            </g>
        {/if}
    </g>
{:else}
    <g>
        <text x="0" y="0" fill="none">Loading...</text>
    </g>
{/if}

<style>
    .graph-layout {
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .nodes {
        pointer-events: all;
    }

    .links {
        pointer-events: none;
    }

    :global(.node) {
        transition: transform 0.3s ease-out;
    }
</style>