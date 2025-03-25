<!-- src/routes/graph/statement-network/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import ControlNode from '$lib/components/graph/nodes/controls/ControlNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { statementNetworkStore, type NetworkSortType, type NetworkSortDirection } from '$lib/stores/statementNetworkStore';
    import { graphFilterStore, type FilterOperator } from '$lib/stores/graphFilterStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { wordListStore } from '$lib/stores/wordListStore';
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

    // Define view type
    const viewType: ViewType = 'statement-network';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Track initialization status
    let authInitialized = false;
    let dataInitialized = false;
    
    // Control node settings
    const controlNodeId = 'graph-controls';
    let controlNodeMode: NodeMode = 'detail'; 
    
    // Control settings with default values
    let sortType: NetworkSortType = 'netPositive';
    let sortDirection: NetworkSortDirection = 'desc';
    let filterKeywords: string[] = [];
    let keywordOperator: FilterOperator = 'OR';
    let showOnlyMyItems = false;
    let availableKeywords: string[] = [];

    // Statement network loading state - start with loading true
    let networkNodesLoading = true;
    let networkLoadingTimeout: NodeJS.Timeout;
    
    // Track data loading status separately from UI state
    let statementsLoaded = false;
    let keywordsLoaded = false;
    
    // Get statements from the store
    $: statements = $statementNetworkStore?.filteredStatements || [];
    $: isReady = authInitialized && dataInitialized;
    
    // Create navigation nodes
    let navigationNodes: GraphNode[] = [];

    // Create control node for sorting and filtering
    let controlNode: GraphNode = {
        id: controlNodeId,
        type: 'dashboard' as NodeType, // Use dashboard type for proper styling
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

    // Initialize data and authenticate user
    async function initializeData() {
        console.debug('[STATEMENT-NETWORK] Starting data initialization');
        try {
            // Handle authentication first
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.debug('[STATEMENT-NETWORK] No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            console.debug('[STATEMENT-NETWORK] User authenticated:', {
                userId: fetchedUser.sub
            });
            
            // Update user store
            userStore.set(fetchedUser);
            authInitialized = true;
            
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
            
            // Initialize with just navigation and control nodes immediately
            createInitialGraphData();
            dataInitialized = true;
            
            // Set the correct view type in graph store
            if (graphStore) {
                console.debug('[STATEMENT-NETWORK] Setting graph store view type to statement-network');
                graphStore.setViewType(viewType);
                
                // Ensure positions are fixed and central node is properly positioned
                graphStore.fixNodePositions();
                graphStore.forceTick(5);
            }
            
            // Load statement network data and keywords in parallel
            // But handle them independently to avoid one failure blocking the other
            loadStatementNetworkData();
            loadAvailableKeywords();
            
            console.debug('[STATEMENT-NETWORK] Data initialization started');
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Load statement network data
    async function loadStatementNetworkData() {
        if (!$userStore) return;
        
        try {
            console.debug('[STATEMENT-NETWORK] Loading statement data...');
            
            // Load statements using the network store with current sort settings
            await statementNetworkStore.loadStatements({
                sortType,
                sortDirection
            });
            
            console.debug('[STATEMENT-NETWORK] Loaded statement data:', {
                total: $statementNetworkStore.allStatements.length,
                filtered: $statementNetworkStore.filteredStatements.length
            });
            
            // Mark statements as loaded
            statementsLoaded = true;
            
            // Always show statements once loaded
            showStatements();
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error loading statement network data:', error);
            // Still consider statements loaded, even if empty
            statementsLoaded = true;
            
            // Show whatever we have
            showStatements();
        }
    }
    
    // Separate function to update UI state when data is ready
    function showStatements() {
        // Clear any existing timeout
        if (networkLoadingTimeout) {
            clearTimeout(networkLoadingTimeout);
        }
        
        // Use a short timeout to allow the UI to update
        networkLoadingTimeout = setTimeout(() => {
            console.debug('[STATEMENT-NETWORK] Showing statements...');
            
            // Stop loading spinner
            networkNodesLoading = false;
            
            // Force re-render with new data
            routeKey = `${viewType}-${Date.now()}`;
            
            // Enforce control node position
            if (graphStore) {
                graphStore.fixNodePositions();
                graphStore.forceTick(5);
            }
            
            console.debug('[STATEMENT-NETWORK] Statements visible');
        }, 100);
    }
    
    // Load available keywords for filtering
    async function loadAvailableKeywords() {
        try {
            console.debug('[STATEMENT-NETWORK] Loading keywords...');
            
            // Set a fallback in case the load fails
            availableKeywords = [];
            
            try {
                // Try loading from statementNetworkStore first since it's always available
                if ($statementNetworkStore?.allStatements?.length > 0) {
                    availableKeywords = statementNetworkStore.getUniqueKeywords();
                    console.debug('[STATEMENT-NETWORK] Using keywords from statements:', availableKeywords.length);
                }
            } catch (innerError) {
                console.warn('[STATEMENT-NETWORK] Error getting keywords from statements:', innerError);
            }
            
            // Try to load from wordListStore if empty
            if (availableKeywords.length === 0 && wordListStore && typeof wordListStore.loadAllWords === 'function') {
                try {
                    const words = await wordListStore.loadAllWords();
                    if (words && words.length > 0) {
                        availableKeywords = words.map(w => w.toLowerCase());
                        console.debug('[STATEMENT-NETWORK] Loaded available keywords from wordList:', availableKeywords.length);
                    }
                } catch (wordError) {
                    console.warn('[STATEMENT-NETWORK] Error loading words from wordList:', wordError);
                    // Continue with empty or previous keywords
                }
            }
            
            // Mark keywords as loaded
            keywordsLoaded = true;
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error in loadAvailableKeywords:', error);
            // Still mark as loaded
            keywordsLoaded = true;
        }
    }

    // Create initial graph data with just navigation and control nodes
    function createInitialGraphData() {
        const initialData = {
            nodes: [...navigationNodes, controlNode],
            links: []
        };
        
        if (graphStore) {
            graphStore.setData(initialData, { skipAnimation: true });
            
            // Make sure the control node is fixed at the center
            graphStore.fixNodePositions();
            graphStore.forceTick(5);
        }
    }

    // Handle control node mode changes
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.debug('[STATEMENT-NETWORK] Node mode change', {
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
    
    // Handle control settings changes
    async function handleControlChange(event: CustomEvent<{
        sortType: string;
        sortDirection: string;
        keywords: string[];
        keywordOperator: string;
        showOnlyMyItems: boolean;
    }>) {
        console.debug('[STATEMENT-NETWORK] Control settings changed:', event.detail);
        
        // Create properly typed values
        const newSortType = event.detail.sortType as NetworkSortType;
        const newSortDirection = event.detail.sortDirection as NetworkSortDirection;
        
        // Update local values
        sortType = newSortType;
        sortDirection = newSortDirection;
        filterKeywords = [...event.detail.keywords];
        keywordOperator = event.detail.keywordOperator as FilterOperator;
        showOnlyMyItems = event.detail.showOnlyMyItems;
        
        // Set loading state to provide visual feedback
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
            
            // Show updated statements after a short delay
            showStatements();
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error applying control changes:', error);
            
            // Still show whatever we have
            showStatements();
        }
    }

    // Create graph data with statements
    function createGraphData(): GraphData {
        console.debug('[STATEMENT-NETWORK] Creating statement network view data', {
            statementCount: statements.length,
            loading: networkNodesLoading,
            statementsLoaded,
            controlNodeMode
        });

        // During loading (or if no statements loaded yet), only include navigation and control nodes
        if (networkNodesLoading || !statementsLoaded) {
            return {
                nodes: [...navigationNodes, controlNode],
                links: []
            };
        }

        // Create statement nodes - ALL in preview mode initially
        const statementNodes: GraphNode[] = statements.map(statement => ({
            id: statement.id,
            type: 'statement' as NodeType,
            data: statement,
            group: 'statement' as NodeGroup,
            mode: 'preview' as NodeMode
        }));

        // Create links between statements
        const statementLinks: GraphLink[] = [];
        
        // Only process links if we have more than one statement
        if (statements.length > 1) {
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
        }

        console.debug('[STATEMENT-NETWORK] Created statement network structure', {
            nodeCount: navigationNodes.length + statementNodes.length + 1,
            linkCount: statementLinks.length
        });

        // Always ensure control node is present with correct mode
        const updatedControlNode = {
            ...controlNode,
            mode: controlNodeMode
        };

        return {
            nodes: [...navigationNodes, updatedControlNode, ...statementNodes],
            links: statementLinks
        };
    }

    // Compute graph data for rendering
    $: graphData = isReady ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        console.log("✅ USING PERFORMANCE-OPTIMIZED STATEMENT NETWORK VIEW");
        initializeData();
    });

    // Cleanup on destroy
    onDestroy(() => {
        console.debug('[STATEMENT-NETWORK] Component being destroyed');
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
    <!-- Graph visualization -->
    {#key routeKey}
    <Graph 
        data={graphData}
        viewType={viewType}
        on:modechange={handleNodeModeChange}
    >
        <svelte:fragment slot="default" let:node let:handleModeChange>
            {#if node.id === controlNodeId}
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
            {:else if isStatementNode(node)}
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

    <!-- Loading overlay for statements -->
    {#if networkNodesLoading && dataInitialized}
        <div class="loading-overlay">
            <div class="loading-spinner small" />
            <span class="loading-text small">Loading statements...</span>
        </div>
    {/if}
    
    <!-- Empty state message (only shown if no statements and not loading) -->
    {#if !networkNodesLoading && statements.length === 0 && statementsLoaded && dataInitialized}
        <div class="empty-state-container">
            <div class="empty-state-box">
                <span class="empty-state-text">No statements found</span>
                <span class="empty-state-subtext">Try adjusting your filters or creating a statement</span>
            </div>
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
    
    .empty-state-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 10;
    }
    
    .empty-state-box {
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 1.5rem 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    
    .empty-state-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
        color: rgba(255, 255, 255, 0.9);
    }
    
    .empty-state-subtext {
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.6);
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