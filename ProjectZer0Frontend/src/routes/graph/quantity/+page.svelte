<!-- src/routes/graph/quantity/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import { getQuantityData } from '$lib/services/quantity';
    import Graph from '$lib/components/graph/Graph.svelte';
    import QuantityNode from '$lib/components/graph/nodes/quantity/QuantityNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { quantityStore } from '$lib/stores/quantityStore';
    import { graphStore } from '$lib/stores/graphStore';
    import type { 
        GraphData, 
        GraphNode, 
        GraphLink,
        GraphPageData,
        RenderableNode,
        NodeType,
        NodeGroup,
        NodeMode,
        ViewType
    } from '$lib/types/graph/enhanced';
    import { 
        isQuantityNode, 
        isNavigationNode 
    } from '$lib/types/graph/enhanced';

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Get initial quantity data from the page data
    let initialQuantityData = data.quantityData;
    
    // Define view type
    const viewType: ViewType = 'quantity';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Node mode handling for quantity node (starts in detail mode)
    let quantityNodeMode: NodeMode = 'detail'; 

    // Initialize data and authenticate user
    async function initializeData() {
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                auth0.login();
                return;
            }
            
            console.log('[QUANTITY-VIEW] User authenticated', {
                userId: fetchedUser.sub
            });
            
            authInitialized = true;
            userStore.set(fetchedUser);
            
            // Load quantity data if needed
            if (!initialQuantityData) {
                const idParam = new URL(window.location.href).searchParams.get('id');
                if (idParam) {
                    const loadedQuantity = await getQuantityData(idParam);
                    if (loadedQuantity) {
                        console.log('[QUANTITY-VIEW] Setting quantity data', {
                            quantityId: loadedQuantity.id,
                            question: loadedQuantity.question
                        });
                        quantityStore.set(loadedQuantity);
                    } else {
                        console.error('[QUANTITY-VIEW] Quantity data not found for:', idParam);
                        window.location.href = '/graph/dashboard';
                        return;
                    }
                } else {
                    console.error('[QUANTITY-VIEW] No quantity ID parameter in URL');
                    window.location.href = '/graph/dashboard';
                    return;
                }
            } else {
                quantityStore.set(initialQuantityData);
            }
            dataInitialized = true;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
        } catch (error) {
            console.error('[QUANTITY-VIEW-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Event handlers
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[QUANTITY-VIEW] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
        
        // Handle quantity node mode changes specifically
        if (quantityData && event.detail.nodeId === quantityData.id) {
            console.log('[QUANTITY-VIEW] Quantity node mode change', {
                from: quantityNodeMode,
                to: event.detail.mode
            });
            quantityNodeMode = event.detail.mode;
        }
    }

    // Get quantity data from store or initial data
    $: quantityData = $quantityStore || initialQuantityData;
    
    // Create central quantity node
    $: centralQuantityNode = isReady && quantityData ? {
        id: quantityData.id,
        type: 'quantity' as NodeType,
        data: quantityData,
        group: 'central' as NodeGroup,
        mode: quantityNodeMode
    } : null;

    // Get navigation options for quantity context (for now, use word context)
    $: navigationNodes = getNavigationOptions(NavigationContext.WORD)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create graph data
    function createGraphData(): GraphData {
        if (!centralQuantityNode || !quantityData) {
            return { nodes: [], links: [] };
        }

        console.log('[QUANTITY-VIEW] Creating quantity view data', {
            quantityId: quantityData.id,
            question: quantityData.question,
            quantityNodeMode
        });

        // Create quantity node with mode
        const baseNodes = [
            {
                ...centralQuantityNode,
                mode: quantityNodeMode  // Ensure mode is set correctly
            },
            ...navigationNodes
        ] as GraphNode[];

        console.log('[QUANTITY-VIEW] Created graph structure for quantity view', {
            nodeCount: baseNodes.length
        });

        return {
            nodes: baseNodes,
            links: []
        };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady && quantityData ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        console.log("✅ USING NEW QUANTITY VIEW COMPONENT");
        initializeData();
    });

    // Force update when quantityStore changes
    $: if ($quantityStore && isReady) {
        routeKey = `${viewType}-${Date.now()}`;
    }
</script>

{#if !isReady}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Loading...</span>
    </div>
{:else if !$userStore}
    <div class="loading-container">
        <div class="loading-text">Authentication required</div>
    </div>
{:else if !quantityData}
    <div class="loading-container">
        <div class="loading-text">Quantity data not found</div>
    </div>
{:else}
{#key routeKey}
<Graph 
    data={graphData}
    viewType={viewType}
    on:modechange={handleNodeModeChange}
>
    <svelte:fragment slot="default" let:node let:handleModeChange>
        {#if isQuantityNode(node)}
            <QuantityNode 
                {node}
                question={quantityData.question}
                unitCategoryId={quantityData.unitCategoryId}
                defaultUnitId={quantityData.defaultUnitId}
                on:modeChange={handleModeChange}
            />
        {:else if isNavigationNode(node)}
            <NavigationNode 
                {node}
                on:hover={() => {}} 
            />
        {:else}
            <!-- Fallback for unrecognized node types -->
            <g>
                <text 
                    dy="-10" 
                    class="error-text"
                >
                    Unknown node type: {node.type}
                </text>
            </g>
        {/if}
    </svelte:fragment>
</Graph>
{/key}
{/if}

<style>
    :global(html, body) {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: black;
    }

    .loading-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: black;
        color: rgba(255, 255, 255, 0.8);
        gap: 1rem;
    }

    .loading-spinner {
        width: 650px;
        height: 650px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .loading-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
    }

    /* Add styling for the error text via CSS instead of inline attributes */
    :global(.error-text) {
        fill: red;
        font-size: 14px;
        text-anchor: middle;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>