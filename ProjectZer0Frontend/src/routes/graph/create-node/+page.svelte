<!-- src/routes/graph/create-node/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore';
    import type { 
        GraphData, 
        GraphNode, 
        GraphLink,
        RenderableNode,
        NodeType,
        NodeGroup,
        NodeMode,
        ViewType
    } from '$lib/types/graph/enhanced';

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Ensure graph store is initialized with the correct view type
    const viewType: ViewType = 'create-node';

    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;

    // Initialize data and authenticate user
    async function initializeData() {
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                auth0.login();
                return;
            }
            
            console.log('[CREATE-NODE] User authenticated', {
                userId: fetchedUser.sub
            });
            authInitialized = true;
            userStore.set(fetchedUser);
            dataInitialized = true;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
        } catch (error) {
            console.error('[CREATE-NODE-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Handle node mode changes
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[CREATE-NODE] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
    }

    // Create create-node central node
    $: centralNode = isReady && $userStore ? {
        id: $userStore.sub,
        type: 'create-node' as NodeType,
        data: $userStore,
        group: 'central' as NodeGroup
    } : null;

    // Get navigation options for create-node context
    $: navigationNodes = getNavigationOptions(NavigationContext.CREATE_NODE)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create graph data
    function createGraphData(): GraphData {
        if (!centralNode) {
            return { nodes: [], links: [] };
        }

        const nodes = [centralNode, ...navigationNodes] as GraphNode[];
        
        console.log('[CREATE-NODE] Created graph data', {
            nodeCount: nodes.length
        });
        
        return { nodes, links: [] };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        initializeData();
    });

    // Cleanup on destroy
    onDestroy(() => {
        // Any cleanup logic (if needed)
    });
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
{:else}
{#key routeKey}
<Graph 
    data={graphData}
    viewType={viewType}
    on:modechange={handleNodeModeChange}
>
    <svelte:fragment slot="default" let:node let:handleModeChange>
        {#if node.type === 'create-node'}
            <CreateNodeNode 
                {node}
                on:modeChange={handleModeChange}
            />
        {:else if node.type === 'navigation'}
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