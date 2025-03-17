<!-- src/routes/graph/statement-network/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
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
        ViewType,
        LinkType 
    } from '$lib/types/graph/enhanced';
    import { 
        isStatementNode, 
        isNavigationNode 
    } from '$lib/types/graph/enhanced';
    import type { RelatedStatement } from '$lib/types/domain/nodes';

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Statement network loading state
    let networkNodesLoading = true;
    let networkLoadingTimeout: NodeJS.Timeout;
    
    // Define view type
    const viewType: ViewType = 'statement-network';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Get statements from the store
    $: statements = $statementNetworkStore?.filteredStatements || [];

    // Initialize data and authenticate user
    async function initializeData() {
        console.log('[STATEMENT-NETWORK] Starting data initialization');
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.log('[STATEMENT-NETWORK] No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            console.log('[STATEMENT-NETWORK] User authenticated', {
                userId: fetchedUser.sub
            });
            
            authInitialized = true;
            userStore.set(fetchedUser);
            
            // Load statement network data
            await loadStatementNetworkData();
            
            console.log('[STATEMENT-NETWORK] Data initialization complete');
            dataInitialized = true;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                console.log('[STATEMENT-NETWORK] Setting graph store view type to statement-network');
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
        } catch (error) {
            console.error('[STATEMENT-NETWORK-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Load statement network data
    async function loadStatementNetworkData() {
        if (!$userStore) return;
        
        try {
            // Set loading state
            networkNodesLoading = true;
            
            // Load statements using the network store
            await statementNetworkStore.loadStatements();
            
            console.log('[STATEMENT-NETWORK] Loaded statement data:', {
                total: $statementNetworkStore.allStatements.length,
                filtered: $statementNetworkStore.filteredStatements.length
            });
            
            // Add a delay before showing the nodes to let the force simulation settle
            if (networkLoadingTimeout) clearTimeout(networkLoadingTimeout);
            networkLoadingTimeout = setTimeout(() => {
                // Only set loading to false after a delay to let forces settle
                networkNodesLoading = false;
            }, 800); // Delay showing nodes to reduce visual flickering
            
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error loading statement network data:', error);
            
            // Show empty state even on error, after a delay
            if (networkLoadingTimeout) clearTimeout(networkLoadingTimeout);
            networkLoadingTimeout = setTimeout(() => {
                networkNodesLoading = false;
            }, 800);
        }
    }

    // Event handlers
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[STATEMENT-NETWORK] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
    }

    // Get navigation options for dashboard context (fallback for network view)
    $: navigationNodes = getNavigationOptions(NavigationContext.DASHBOARD)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create graph data
    function createGraphData(): GraphData {
        console.log('[STATEMENT-NETWORK] Creating statement network view data', {
            statementCount: statements.length,
            loading: networkNodesLoading
        });

        // Only include navigation nodes during loading to avoid flickering
        if (networkNodesLoading) {
            console.log('[STATEMENT-NETWORK] Network in loading state, showing only navigation nodes');
            return {
                nodes: [...navigationNodes],
                links: []
            };
        }

        // Create statement nodes - ALL in preview mode initially
        const statementNodes: GraphNode[] = statements.map(statement => ({
            id: statement.id,
            type: 'statement' as NodeType,
            data: statement,
            group: 'statement' as NodeGroup, // Not 'central'
            mode: 'preview' as NodeMode
        }));

        // Create links between statements based on shared keywords and direct relationships
        const statementLinks: GraphLink[] = [];
        
        // Add links based on relatedStatements from each statement
        statements.forEach(statement => {
            if (statement.relatedStatements && statement.relatedStatements.length > 0) {
                statement.relatedStatements.forEach(related => {
                    // Check if target statement exists in our filtered data
                    const targetExists = statements.some(s => s.id === related.nodeId);
                    if (targetExists) {
                        statementLinks.push({
                            id: `${statement.id}-${related.nodeId}-${related.sharedWord || 'unknown'}`,
                            source: statement.id,
                            target: related.nodeId,
                            type: related.sharedWord === 'direct' ? 'related' as LinkType : 'alternative' as LinkType
                        });
                    }
                });
            }
        });

        console.log('[STATEMENT-NETWORK] Created statement network structure', {
            nodeCount: navigationNodes.length + statementNodes.length,
            linkCount: statementLinks.length
        });

        // Return ONLY navigation nodes and statement nodes - NO central node
        return {
            nodes: [...navigationNodes, ...statementNodes],
            links: statementLinks
        };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        console.log("✅ USING STATEMENT NETWORK VIEW COMPONENT");
        initializeData();
    });

    // Cleanup on destroy
    onDestroy(() => {
        if (networkLoadingTimeout) clearTimeout(networkLoadingTimeout);
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
{:else if networkNodesLoading}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Loading statements...</span>
    </div>
{:else if statements.length === 0}
    <div class="loading-container">
        <div class="loading-text">No statements found</div>
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