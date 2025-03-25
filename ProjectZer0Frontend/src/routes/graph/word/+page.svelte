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

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Define view type
    const viewType: ViewType = 'statement-network';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Control node settings - start in detail mode (like word node)
    let controlNodeMode: NodeMode = 'detail';
    const controlNodeId = 'graph-controls';
    
    // Control settings
    let sortType: NetworkSortType = 'netPositive';
    let sortDirection: NetworkSortDirection = 'desc';
    let filterKeywords: string[] = [];
    let keywordOperator: FilterOperator = 'OR';
    let showOnlyMyItems = false;
    let availableKeywords: string[] = [];

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
            
            // Initialize the graph filter store
            graphFilterStore.setViewType('statement-network', true);
            
            // Pre-create the central control node and navigation nodes
            const initialData = createInitialGraphData();
            
            // Apply to graph store to show something immediately
            if (graphStore) {
                graphStore.setData(initialData, { skipAnimation: true });
                graphStore.setViewType(viewType);
                graphStore.fixNodePositions();
                graphStore.forceTick(3);
            }
            
            // Pre-load statements in background
            loadStatementsInBackground();
            
            // Mark as initialized to show nodes immediately
            dataInitialized = true;
        } catch (error) {
            console.error('[STATEMENT-NETWORK-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Load statements in background while showing initial UI
    async function loadStatementsInBackground() {
        try {
            // Load statements using the network store
            await statementNetworkStore.loadStatements({
                sortType,
                sortDirection
            });
            
            console.log('[STATEMENT-NETWORK] Loaded statement data:', {
                total: $statementNetworkStore.allStatements.length,
                filtered: $statementNetworkStore.filteredStatements.length
            });
            
            // Also load available keywords
            loadAvailableKeywords();
            
            // Force update to show statements
            routeKey = `${viewType}-${Date.now()}`;
            
            // Ensure control node is positioned correctly
            if (graphStore) {
                graphStore.fixNodePositions();
                graphStore.forceTick(3);
            }
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error loading statement data:', error);
        }
    }
    
    // Load available keywords for filtering
    async function loadAvailableKeywords() {
        try {
            if (wordListStore && typeof wordListStore.loadAllWords === 'function') {
                const words = await wordListStore.loadAllWords();
                availableKeywords = words.map(w => w.toLowerCase());
                console.log('[STATEMENT-NETWORK] Loaded available keywords:', availableKeywords.length);
            } else {
                // Fallback: extract keywords from statements
                availableKeywords = statementNetworkStore.getUniqueKeywords();
                console.log('[STATEMENT-NETWORK] Using keywords from statements:', availableKeywords.length);
            }
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error loading keywords:', error);
            availableKeywords = [];
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
            
            // Force re-render with updated data
            routeKey = `${viewType}-${Date.now()}`;
            
            // Ensure control node stays fixed
            if (graphStore) {
                graphStore.fixNodePositions();
                graphStore.forceTick(3);
            }
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error applying control changes:', error);
        }
    }

    // Event handlers for node events
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[STATEMENT-NETWORK] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
        
        // If this is the control node, update its mode
        if (event.detail.nodeId === controlNodeId) {
            console.log('[STATEMENT-NETWORK] Control node mode change', {
                from: controlNodeMode,
                to: event.detail.mode
            });
            controlNodeMode = event.detail.mode;
        }
    }

    // Create initial graph data with just control and navigation nodes
    function createInitialGraphData(): GraphData {
        // Get navigation options for dashboard context
        const navNodes = getNavigationOptions(NavigationContext.DASHBOARD)
            .map(option => ({
                id: option.id,
                type: 'navigation' as const,
                data: option,
                group: 'navigation' as const
            }));
            
        // Create control node
        const controlNode = {
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
        
        return {
            nodes: [...navNodes, controlNode],
            links: []
        };
    }

    // Get statements from the store
    $: statements = $statementNetworkStore?.filteredStatements || [];

    // Create full graph data including statement nodes
    function createGraphData(): GraphData {
        // Get navigation options for dashboard context
        const navNodes = getNavigationOptions(NavigationContext.DASHBOARD)
            .map(option => ({
                id: option.id,
                type: 'navigation' as const,
                data: option,
                group: 'navigation' as const
            }));
            
        // Create control node with current mode
        const controlNode = {
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

        // If no statements, just return base nodes
        if (statements.length === 0) {
            console.log('[STATEMENT-NETWORK] No statements available, showing base nodes only');
            return {
                nodes: [...navNodes, controlNode],
                links: []
            };
        }
        
        console.log('[STATEMENT-NETWORK] Creating statement network view with', statements.length, 'statements');

        // Create statement nodes - all in preview mode initially
        const statementNodes: GraphNode[] = statements.map(statement => ({
            id: statement.id,
            type: 'statement' as NodeType,
            data: statement,
            group: 'statement' as NodeGroup,
            mode: 'preview' as NodeMode
        }));

        // Create links between statements based on related statements
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
            nodeCount: navNodes.length + statementNodes.length + 1, // +1 for control node
            linkCount: statementLinks.length
        });

        return {
            nodes: [...navNodes, controlNode, ...statementNodes],
            links: statementLinks
        };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        console.log("✅ USING ALIGNED STATEMENT NETWORK VIEW");
        initializeData();
    });

    // Force update when statementNetworkStore changes
    $: if ($statementNetworkStore && isReady) {
        console.log('[STATEMENT-NETWORK] Statement store updated, consider rebuilding graph data');
        // No automatic rebuild here to avoid flicker - control changes will force rebuilds
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
{:else}
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
                    {showOnlyMyItems}
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

    <!-- Empty state message (only shown if no statements) -->
    {#if statements.length === 0}
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