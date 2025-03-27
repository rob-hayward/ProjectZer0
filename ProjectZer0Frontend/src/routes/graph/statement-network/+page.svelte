<!-- src/routes/graph/statement-network/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import ControlNode from '$lib/components/graph/nodes/controls/ControlNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { statementNetworkStore, type NetworkSortType, type NetworkSortDirection } from '$lib/stores/statementNetworkStore';
    import { graphFilterStore, type FilterOperator } from '$lib/stores/graphFilterStore';
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
        isNavigationNode,
        isStatementData
    } from '$lib/types/graph/enhanced';

    // Define view type
    const viewType: ViewType = 'statement-network';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Control node settings
    const controlNodeId = 'graph-controls';
    let controlNodeMode: NodeMode = 'detail'; 
    
    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let statementsLoaded = false;
    
    // Control settings with default values
    let sortType: NetworkSortType = 'netPositive';
    let sortDirection: NetworkSortDirection = 'desc';
    let filterKeywords: string[] = [];
    let keywordOperator: FilterOperator = 'OR';
    let showOnlyMyItems = false;
    let availableKeywords: string[] = [];

    // Statement network loading state
    let networkNodesLoading = true;
    let networkLoadingTimeout: NodeJS.Timeout | undefined;
    
    // Graph data
    let graphData: GraphData = { nodes: [], links: [] };
    
    // Get statements from the store
    $: statements = $statementNetworkStore?.filteredStatements || [];
    $: isReady = authInitialized && dataInitialized;
    
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
            
            // Initialize navigation nodes
            navigationNodes = getNavigationOptions(NavigationContext.DASHBOARD)
                .map(option => ({
                    id: option.id,
                    type: 'navigation' as const,
                    data: option,
                    group: 'navigation' as const
                }));
            
            // Initialize the graph filter store
            graphFilterStore.setViewType('statement-network', true);
            
            // Start with just navigation and control nodes
            createInitialGraphData();
            dataInitialized = true;
            
            // Set the correct view type in graph store
            if (graphStore) {
                console.log('[STATEMENT-NETWORK] Setting graph store view type to statement-network');
                graphStore.setViewType(viewType);
                
                // Fix positions and force ticks
                graphStore.fixNodePositions();
                graphStore.forceTick(5);
            }
            
            // Load statement network data
            await loadStatementNetworkData();
            
            console.log('[STATEMENT-NETWORK] Data initialization complete');
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Load statement network data
    async function loadStatementNetworkData() {
        if (!$userStore) return;
        
        try {
            console.log('[STATEMENT-NETWORK] Loading statement data...');
            
            // Load statements using the network store
            await statementNetworkStore.loadStatements({
                sortType,
                sortDirection
            });
            
            console.log('[STATEMENT-NETWORK] Loaded statement data:', {
                total: $statementNetworkStore.allStatements.length,
                filtered: $statementNetworkStore.filteredStatements.length
            });
            
            // Mark statements as loaded
            statementsLoaded = true;
            networkNodesLoading = false;
            
            // Update graph with statements
            updateGraphWithStatements();
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error loading statement network data:', error);
            
            // Still consider statements loaded, even if empty
            statementsLoaded = true;
            networkNodesLoading = false;
        }
    }
    
    // Create navigation nodes
    let navigationNodes = getNavigationOptions(NavigationContext.DASHBOARD)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create control node for sorting and filtering
    let controlNode: GraphNode = {
        id: controlNodeId,
        type: 'dashboard' as NodeType,
        data: {
            sub: 'controls',
            name: 'Graph Controls',
            email: '',
            picture: '',
            'https://projectzer0.co/user_metadata': {
                handle: 'controls'
            }
        },
        group: 'central' as NodeGroup,
        mode: controlNodeMode
    };
    
    // Create initial graph data with just navigation and control nodes
    function createInitialGraphData() {
        graphData = {
            nodes: [...navigationNodes, controlNode],
            links: []
        };
        
        if (graphStore) {
            graphStore.setData(graphData, { skipAnimation: true });
            graphStore.fixNodePositions();
            graphStore.forceTick(5);
        }
    }
    
    function updateGraphWithStatements() {
        console.log('[STATEMENT-NETWORK] Updating graph with statements...');
        
        // Create complete graph data
        graphData = createGraphData();
        
        // Update graph store
        if (graphStore) {
            graphStore.setData(graphData, { 
                skipAnimation: true,
                // Add these if available in your implementation:
                forceRefresh: false,
                preservePositions: true
            });
            graphStore.fixNodePositions();
            
            // Reduce the number of forced ticks
            graphStore.forceTick(3);
        }
        
        // Don't force a complete re-render
        // routeKey = `${viewType}-${Date.now()}`; // Remove this
    }
    
    // Handle control settings changes
    async function handleControlChange(event: CustomEvent<{
        sortType: string;
        sortDirection: string;
        keywords: string[];
        keywordOperator: string;
        showOnlyMyItems: boolean;
    }>) {
        console.log('[STATEMENT-NETWORK] Control settings changed:', event.detail);
        
        // Create properly typed values
        const newSortType = event.detail.sortType as NetworkSortType;
        const newSortDirection = event.detail.sortDirection as NetworkSortDirection;
        
        // Update local values
        sortType = newSortType;
        sortDirection = newSortDirection;
        filterKeywords = [...event.detail.keywords];
        keywordOperator = event.detail.keywordOperator as FilterOperator;
        showOnlyMyItems = event.detail.showOnlyMyItems;
        
        // Set loading state
        networkNodesLoading = true;
        
        try {
            // Apply sorting via the store
            await statementNetworkStore.setSorting(
                newSortType,
                newSortDirection
            );
            
            // Apply keyword filter
            statementNetworkStore.applyKeywordFilter(
                filterKeywords,
                keywordOperator
            );
            
            // Apply user filter
            statementNetworkStore.applyUserFilter(
                showOnlyMyItems ? $userStore?.sub : undefined
            );
            
            // Set loading to false
            networkNodesLoading = false;
            
            // Update graph
            updateGraphWithStatements();
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error applying control changes:', error);
            
            // Still show whatever we have
            networkNodesLoading = false;
            updateGraphWithStatements();
        }
    }

    // Handle node mode changes
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[STATEMENT-NETWORK] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
        
        // If this is the control node, update its mode
        if (event.detail.nodeId === controlNodeId) {
            controlNodeMode = event.detail.mode;
            
            // Force control node to stay fixed at center
            if (graphStore) {
                graphStore.fixNodePositions();
                graphStore.forceTick(5);
            }
        }
    }

    // Create graph data with statements
    function createGraphData(): GraphData {
        console.log('[STATEMENT-NETWORK] Creating statement network view data', {
            statementCount: statements.length,
            loading: networkNodesLoading,
            statementsLoaded
        });

        // During loading, only include navigation and control nodes
        if (networkNodesLoading || !statementsLoaded) {
            console.log('[STATEMENT-NETWORK] Still loading, showing only navigation and control nodes');
            return {
                nodes: [...navigationNodes, controlNode],
                links: []
            };
        }
        
        console.log('[STATEMENT-NETWORK] Loading complete, showing statement nodes');

        // Create statement nodes in preview mode
        const statementNodes: GraphNode[] = statements.map(statement => ({
            id: statement.id,
            type: 'statement' as NodeType,
            data: statement,
            group: 'statement' as NodeGroup,
            mode: 'preview' as NodeMode
        }));

        // Always ensure control node is present with correct mode
        const updatedControlNode = {
            ...controlNode,
            mode: controlNodeMode
        };
        
        // Create links between statements
        const statementLinks: GraphLink[] = [];
        
        // First, create links from control node to each statement
        statementNodes.forEach(statementNode => {
            statementLinks.push({
                id: `${controlNode.id}-${statementNode.id}`,
                source: controlNode.id,
                target: statementNode.id,
                type: 'related' as LinkType
            });
        });
        
        // Then, add statement-to-statement relationships
        statements.forEach(statement => {
            if (statement.relatedStatements && statement.relatedStatements.length > 0) {
                statement.relatedStatements.forEach((related: any) => {
                    // Check if target statement exists in our filtered data
                    const targetExists = statements.some(s => s.id === related.nodeId);
                    if (targetExists) {
                        statementLinks.push({
                            id: `${statement.id}-${related.nodeId}-${related.sharedWord || 'unknown'}`,
                            source: statement.id,
                            target: related.nodeId,
                            type: 'related' as LinkType
                        });
                    }
                });
            }
        });

        console.log('[STATEMENT-NETWORK] Created statement network structure', {
            nodeCount: navigationNodes.length + 1 + statementNodes.length,
            statementCount: statementNodes.length,
            linkCount: statementLinks.length
        });

        return {
            nodes: [...navigationNodes, updatedControlNode, ...statementNodes],
            links: statementLinks
        };
    }
    
    // Initialize on mount
    onMount(() => {
        console.log("✅ USING STATEMENT NETWORK VIEW COMPONENT");
        initializeData();
    });

    // Cleanup on destroy
    onDestroy(() => {
        if (networkLoadingTimeout) {
            clearTimeout(networkLoadingTimeout);
        }
    });
</script>

{#if !authInitialized}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Authenticating...</span>
    </div>
{:else if !$userStore}
    <div class="loading-container">
        <div class="loading-text">Authentication required</div>
    </div>
{:else if !dataInitialized}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Initializing graph...</span>
    </div>
{:else}
    <!-- Debug panel -->
    <div class="debug-panel">
        <h4>Debug Panel</h4>
        <div>Statements: {statements.length}</div>
        <div>Loading: {networkNodesLoading.toString()}</div>
        <div>Loaded: {statementsLoaded.toString()}</div>
        <div>Graph nodes: {graphData.nodes.length}</div>
        <div>Graph links: {graphData.links.length}</div>
        <div>Statement nodes: {graphData.nodes.filter(n => n.type === 'statement').length}</div>
        <button on:click={() => updateGraphWithStatements()}>Force Update</button>
    </div>

    <!-- Graph visualization -->
    
    <Graph 
        data={graphData}
        viewType={viewType}
        on:modechange={handleNodeModeChange}
    >
        <svelte:fragment slot="default" let:node let:handleModeChange>
            {#if isStatementNode(node)}
                <StatementNode 
                    {node}
                    statementText={isStatementData(node.data) ? node.data.statement : ''}
                    on:modeChange={handleModeChange}
                />
            {:else if node.id === controlNodeId}
                <ControlNode 
                    {node}
                    {sortType}
                    {sortDirection}
                    keywords={filterKeywords}
                    keywordOperator={keywordOperator}
                    showOnlyMyItems={showOnlyMyItems}
                    {availableKeywords}
                    on:modeChange={handleModeChange}
                    on:controlChange={handleControlChange}
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
                        Unknown: {node.type}
                    </text>
                </g>
            {/if}
        </svelte:fragment>
    </Graph>
   

    <!-- Loading overlay -->
    {#if networkNodesLoading && dataInitialized}
        <div class="loading-overlay">
            <div class="loading-spinner small" />
            <span class="loading-text small">Loading statements...</span>
        </div>
    {/if}
{/if}

<style>
    :global(html, body) {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: black;
    }

    .debug-panel {
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 15px;
        border-radius: 5px;
        font-family: monospace;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .debug-panel h4 {
        margin-top: 0;
        margin-bottom: 10px;
    }

    .debug-panel button {
        margin-top: 10px;
        background: #4338ca;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
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
        z-index: 100;
    }

    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        color: rgba(255, 255, 255, 0.8);
        gap: 1rem;
        z-index: 50;
        pointer-events: none;
    }

    .loading-spinner {
        width: 650px;
        height: 650px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    .loading-spinner.small {
        width: 80px;
        height: 80px;
        border-width: 2px;
    }

    .loading-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
    }
    
    .loading-text.small {
        font-size: 1rem;
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