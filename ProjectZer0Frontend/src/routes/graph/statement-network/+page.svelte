<!-- src/routes/graph/statement-network/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import ControlNode from '$lib/components/graph/nodes/controlNode/ControlNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { statementNetworkStore, type NetworkSortType, type NetworkSortDirection } from '$lib/stores/statementNetworkStore';
    import { graphFilterStore, type FilterOperator } from '$lib/stores/graphFilterStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { getNetVotes, getVoteValue } from '$lib/components/graph/nodes/utils/nodeUtils';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { GraphLayoutTransformer } from '$lib/services/graph/GraphLayoutTransformer';
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
        isNavigationNode,
        isStatementData
    } from '$lib/types/graph/enhanced';
    import type { NavigationOption } from '$lib/types/domain/navigation';

    // Define view type
    const viewType: ViewType = 'statement-network';
    
    // Control node settings
    const controlNodeId = 'graph-controls';
    let controlNodeMode: NodeMode = 'detail'; 
    
    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let statementsLoaded = false;
    let visibilityPreferencesLoaded = false;
    
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
    
    // Create navigation nodes
    let navigationNodes = getNavigationOptions(NavigationContext.DASHBOARD)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));
        
    // Navigation options for the transformer
    let navigationOptions: NavigationOption[] = getNavigationOptions(NavigationContext.DASHBOARD);

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
    
    // Initialize data and authenticate user
    async function initializeData() {
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                auth0.login();
                return;
            }
            
            authInitialized = true;
            userStore.set(fetchedUser);
            
            // Initialize navigation nodes and options
            navigationOptions = getNavigationOptions(NavigationContext.DASHBOARD);
            navigationNodes = navigationOptions.map(option => ({
                id: option.id,
                type: 'navigation' as const,
                data: option,
                group: 'navigation' as const
            }));
            
            // Initialize the graph filter store
            graphFilterStore.setViewType('statement-network', true);
            
            // Initialize visibility preferences
            visibilityStore.initialize();
            
            // Load visibility preferences from the server
            if (!visibilityPreferencesLoaded) {
                await visibilityStore.loadPreferences();
                visibilityPreferencesLoaded = true;
            }
            
            // Load word list for keyword filtering
            console.log('[STATEMENT-NETWORK] Starting to load keywords for filtering');
            try {
                // Force refresh to ensure we get fresh data
                console.log('[STATEMENT-NETWORK] Forcing refresh of word list');
                await wordListStore.loadAllWords(true);
                
                // Get all available words for suggestions
                const allWords = wordListStore.getAllWords();
                console.log('[STATEMENT-NETWORK] Word list store returned', allWords.length, 'words');
                
                if (allWords.length === 0) {
                    // If no words were loaded, provide some sample words
                    console.warn('[STATEMENT-NETWORK] No words found in store, using sample keywords');
                    availableKeywords = [
                        'democracy', 'freedom', 'justice', 'equality', 'society', 
                        'government', 'truth', 'privacy', 'rights', 'liberty',
                        'security', 'capitalism', 'socialism', 'economy', 'education',
                        'health', 'environment', 'climate', 'technology', 'science'
                    ];
                } else {
                    availableKeywords = allWords;
                    console.log('[STATEMENT-NETWORK] First few keywords:', availableKeywords.slice(0, 5));
                }
                
                console.log(`[STATEMENT-NETWORK] Loaded ${availableKeywords.length} keywords for filtering`);
            } catch (error) {
                console.error('[STATEMENT-NETWORK] Error loading word list:', error);
                
                // Provide fallback keywords on error
                availableKeywords = [
                    'democracy', 'freedom', 'justice', 'equality', 'society', 
                    'government', 'truth', 'privacy', 'rights', 'liberty',
                    'security', 'capitalism', 'socialism', 'economy', 'education',
                    'health', 'environment', 'climate', 'technology', 'science'
                ];
                console.log('[STATEMENT-NETWORK] Using fallback keywords');
            }
            
            // Start with just navigation and control nodes
            createInitialGraphData();
            dataInitialized = true;
            
            // Set the correct view type in graph store
            if (graphStore) {
                graphStore.setViewType(viewType);
                graphStore.fixNodePositions();
            }
            
            // Load statement network data
            await loadStatementNetworkData();
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Load statement network data
    async function loadStatementNetworkData() {
        if (!$userStore) return;
        
        try {
            // Load statements using the network store
            await statementNetworkStore.loadStatements({
                sortType,
                sortDirection
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
    
    // Create initial graph data with just navigation and control nodes
    function createInitialGraphData() {
        graphData = {
            nodes: [...navigationNodes, controlNode],
            links: []
        };
        
        if (graphStore) {
            graphStore.setData(graphData, { skipAnimation: true });
            graphStore.fixNodePositions();
        }
    }
    
    function updateGraphWithStatements() {
        // Create complete graph data
        graphData = createGraphData();
        
        // Apply visibility preferences to graph data
        if (visibilityPreferencesLoaded && graphStore) {
            const preferences = visibilityStore.getAllPreferences();
            graphStore.applyVisibilityPreferences(preferences);
        }
        
        // Update graph store
        if (graphStore) {
            // Preserve node positions to prevent jarring layout changes
            graphStore.setData(graphData, { 
                skipAnimation: false,  // Allow animation for smoother transitions
                forceRefresh: true,    // Force a refresh to ensure all nodes update
                preservePositions: true // Preserve existing node positions where possible
            });
            
            // Ensure control node stays fixed
            graphStore.fixNodePositions();
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
            await statementNetworkStore.applyKeywordFilter(
                filterKeywords,
                keywordOperator
            );
            
            // Apply user filter
            await statementNetworkStore.applyUserFilter(
                showOnlyMyItems ? $userStore?.sub : undefined
            );
            
            // Set loading to false
            networkNodesLoading = false;
            
            // Use setTimeout to ensure the store updates have been processed
            // before updating the graph - this fixes the delay issue
            setTimeout(() => {
                updateGraphWithStatements();
            }, 50);
        } catch (error) {
            console.error('[STATEMENT-NETWORK] Error applying control changes:', error);
            
            // Still show whatever we have
            networkNodesLoading = false;
            updateGraphWithStatements();
        }
    }

    // Handle node mode changes
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode; radius?: number }>) {
        // If this is the control node, update its mode
        if (event.detail.nodeId === controlNodeId) {
            const oldMode = controlNodeMode;
            controlNodeMode = event.detail.mode;
            
            console.debug('[STATEMENT-NETWORK] Control node mode change:', { 
                oldMode,
                newMode: event.detail.mode,
                radius: event.detail.radius
            });
            
            // Update the control node mode in our local state
            controlNode = {
                ...controlNode,
                mode: event.detail.mode
            };
            
            // First immediately update the node in the graph store
            if (graphStore) {
                // This should trigger the layout updates for navigation nodes
                graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
                
                // Force node positions to stay fixed
                graphStore.fixNodePositions();
                
                // Force ticks to update the layout immediately
                graphStore.forceTick(5);
            }
        }
    }

    // Handle node visibility changes
    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        const { nodeId, isHidden } = event.detail;
        
        // Update visibility preference - note that isVisible is the opposite of isHidden
        visibilityStore.setPreference(nodeId, !isHidden, 'user');
        
        // Update node visibility in graph
        if (graphStore) {
            graphStore.updateNodeVisibility(nodeId, isHidden, 'user');
        }
    }

    // Create graph data with statements
    function createGraphData(): GraphData {
        // During loading, only include navigation and control nodes
        if (networkNodesLoading || !statementsLoaded) {
            return {
                nodes: [...navigationNodes, controlNode],
                links: []
            };
        }
        
        // Get visibility preferences
        const visibilityPreferences = visibilityPreferencesLoaded ? 
            visibilityStore.getAllPreferences() : {};
        
        // Use the GraphLayoutTransformer to create consistent layout data
        const layoutData = GraphLayoutTransformer.transformStatementNetworkView(
            statements,
            controlNode,
            navigationOptions,
            visibilityPreferences
        );
        
        // Convert layout data to graph data
        const statementNodes: GraphNode[] = layoutData.nodes
            .filter(node => node.type === 'statement')
            .map(layoutNode => {
                // Find the original statement data
                const statementData = statements.find(s => s.id === layoutNode.id);
                if (!statementData) return null;
                
                // Extract visibility metadata
                const isHidden = layoutNode.metadata.isHidden || false;
                const hiddenReason = layoutNode.metadata.hiddenReason || (isHidden ? 'community' : undefined);
                
                return {
                    id: layoutNode.id,
                    type: 'statement' as NodeType,
                    data: {
                        ...statementData,
                        // Ensure vote data is numeric by using values from the layout node
                        positiveVotes: layoutNode.metadata.positiveVotes,
                        negativeVotes: layoutNode.metadata.negativeVotes
                    },
                    group: 'statement' as NodeGroup,
                    mode: 'preview' as NodeMode,
                    // Add visibility properties from layout node
                    isHidden,
                    hiddenReason
                };
            })
            .filter(Boolean) as GraphNode[];
        
        // Always ensure control node is present with correct mode
        const updatedControlNode = {
            ...controlNode,
            mode: controlNodeMode
        };
        
        // Get navigation nodes from layout data
        const navNodes = layoutData.nodes
            .filter(node => node.type === 'navigation')
            .map(layoutNode => {
                const navOption = navigationOptions.find((opt: NavigationOption) => opt.id === layoutNode.id);
                if (!navOption) return null;
                
                return {
                    id: layoutNode.id,
                    type: 'navigation' as NodeType,
                    data: navOption,
                    group: 'navigation' as NodeGroup
                };
            })
            .filter(Boolean) as GraphNode[];
        
        // Convert layout links to graph links with type assertion
        const graphLinks: GraphLink[] = layoutData.links.map((link, index) => {
            // First create the base link with required properties
            const linkData: GraphLink = {
                id: `link-${link.source}-${link.target}-${index}`,
                source: link.source,
                target: link.target,
                type: link.type as LinkType
            };
            
            // Then add additional properties using type assertion to avoid TypeScript errors
            if ((link as any).metadata) {
                (linkData as any).metadata = (link as any).metadata;
            }
            
            // Add strength if available
            if (link.strength !== undefined) {
                (linkData as any).strength = link.strength;
            }
            
            return linkData;
        });

        return {
            nodes: [...navNodes, updatedControlNode, ...statementNodes],
            links: graphLinks
        };
    }
    
    // Initialize on mount
    onMount(() => {
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
    <!-- Graph visualization -->
    <Graph 
        data={graphData}
        viewType={viewType}
        on:modechange={handleNodeModeChange}
        on:visibilitychange={handleVisibilityChange}
    >
        <svelte:fragment slot="default" let:node let:handleModeChange>
            {#if isStatementNode(node)}
                <StatementNode 
                    {node}
                    statementText={isStatementData(node.data) ? node.data.statement : ''}
                    on:modeChange={handleModeChange}
                    on:visibilityChange={(e) => handleVisibilityChange(
                        new CustomEvent('visibilitychange', {
                            detail: { nodeId: node.id, ...e.detail }
                        })
                    )}
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
            <div class="loading-spinner" />
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
        width: 500px;
        height: 500px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
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