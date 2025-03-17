<!-- src/routes/graph/statement/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import { getStatementData } from '$lib/services/statement';
    import Graph from '$lib/components/graph/Graph.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { statementStore } from '$lib/stores/statementStore';
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
        isStatementNode, 
        isNavigationNode 
    } from '$lib/types/graph/enhanced';

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Get initial statement data from the page data
    let initialStatementData = data.statementData;
    
    // Define view type
    const viewType: ViewType = 'statement';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Node mode handling for statement node (starts in detail mode)
    let statementNodeMode: NodeMode = 'detail'; 

    // Initialize data and authenticate user
    async function initializeData() {
        console.log('[STATEMENT-VIEW] Starting data initialization');
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.log('[STATEMENT-VIEW] No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            console.log('[STATEMENT-VIEW] User authenticated', {
                userId: fetchedUser.sub
            });
            
            authInitialized = true;
            userStore.set(fetchedUser);
            
            // Load statement data if needed
            if (!initialStatementData) {
                console.log('[STATEMENT-VIEW] No initial statement data, loading from URL parameter');
                const idParam = new URL(window.location.href).searchParams.get('id');
                if (idParam) {
                    const loadedStatement = await getStatementData(idParam);
                    if (loadedStatement) {
                        console.log('[STATEMENT-VIEW] Setting statement data', {
                            statementId: loadedStatement.id,
                            statement: loadedStatement.statement
                        });
                        statementStore.set(loadedStatement);
                    } else {
                        console.error('[STATEMENT-VIEW] Statement data not found for:', idParam);
                        window.location.href = '/graph/dashboard';
                        return;
                    }
                } else {
                    console.error('[STATEMENT-VIEW] No statement ID parameter in URL');
                    window.location.href = '/graph/dashboard';
                    return;
                }
            } else {
                console.log('[STATEMENT-VIEW] Using initial statement data from page data');
                statementStore.set(initialStatementData);
            }
            
            console.log('[STATEMENT-VIEW] Data initialization complete');
            dataInitialized = true;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                console.log('[STATEMENT-VIEW] Setting graph store view type to statement');
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
        } catch (error) {
            console.error('[STATEMENT-VIEW-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Event handlers
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[STATEMENT-VIEW] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
        
        // Handle statement node mode changes specifically
        if (statementData && event.detail.nodeId === statementData.id) {
            console.log('[STATEMENT-VIEW] Statement node mode change', {
                from: statementNodeMode,
                to: event.detail.mode
            });
            statementNodeMode = event.detail.mode;
        }
    }

    // Get statement data from store or initial data
    $: statementData = $statementStore || initialStatementData;
    
    // Create central statement node
    $: centralStatementNode = isReady && statementData ? {
        id: statementData.id,
        type: 'statement' as NodeType,
        data: statementData,
        group: 'central' as NodeGroup,
        mode: statementNodeMode
    } : null;

    // Get navigation options for word context (for now, statement uses word context)
    $: navigationNodes = getNavigationOptions(NavigationContext.WORD)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create graph data
    function createGraphData(): GraphData {
        if (!centralStatementNode || !statementData) {
            return { nodes: [], links: [] };
        }

        console.log('[STATEMENT-VIEW] Creating statement view data', {
            statementId: statementData.id,
            statement: statementData.statement,
            statementNodeMode
        });

        // Create statement node with mode
        const baseNodes = [
            {
                ...centralStatementNode,
                mode: statementNodeMode  // Ensure mode is set correctly
            },
            ...navigationNodes
        ] as GraphNode[];

        console.log('[STATEMENT-VIEW] Created graph structure for statement view', {
            nodeCount: baseNodes.length
        });

        return {
            nodes: baseNodes,
            links: []
        };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady && statementData ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        console.log("✅ USING NEW STATEMENT VIEW COMPONENT");
        initializeData();
    });

    // Force update when statementStore changes
    $: if ($statementStore && isReady) {
        console.log('[STATEMENT-VIEW] Statement store updated, rebuilding graph data');
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
{:else if !statementData}
    <div class="loading-container">
        <div class="loading-text">Statement data not found</div>
    </div>
{:else}
{#key routeKey}
<Graph 
    data={graphData}
    viewType={viewType}
    on:modechange={handleNodeModeChange}
>
    <svelte:fragment slot="default" let:node let:handleModeChange>
        {#if isStatementNode(node)}
            <StatementNode 
                {node}
                statementText={statementData.statement}
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