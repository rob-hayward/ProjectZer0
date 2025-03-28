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
    
    // Debug information for central node position
    let centralNodePosition = { x: 0, y: 0, fx: 0, fy: 0 };
    let centralNodeExists = false;
    let updateCount = 0;
    
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
                updateCentralNodeDebugInfo();
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
            updateCentralNodeDebugInfo();
        }
    }
    
    // Update central node position information for debugging
    function updateCentralNodeDebugInfo() {
        if (!graphStore) return;
        
        const unsubscribe = graphStore.subscribe((state) => {
            if (state && state.nodes) {
                const centralNode = state.nodes.find(node => node.id === controlNodeId);
                if (centralNode) {
                    centralNodeExists = true;
                    centralNodePosition = {
                        x: centralNode.position.x,
                        y: centralNode.position.y,
                        fx: (centralNode as any).fx || 0,
                        fy: (centralNode as any).fy || 0
                    };
                } else {
                    centralNodeExists = false;
                }
            }
        });
        
        // Immediately unsubscribe after getting the data
        unsubscribe();
        
        // Update the counter
        updateCount++;
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
            
            // Update debug info
            updateCentralNodeDebugInfo();
        }
    }
    
    // Force an immediate update of central node position
    function forceUpdateDebugInfo() {
        updateCentralNodeDebugInfo();
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
                updateCentralNodeDebugInfo();
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
        
        // Create links between statements - using a Map to consolidate multiple keyword relationships
        const linkMap = new Map<string, {
            sourceId: string;
            targetId: string;
            keywords: Set<string>;
            strength: number;
        }>();
        
        // Add statement-to-statement relationships
        statements.forEach(statement => {
            if (statement.relatedStatements && statement.relatedStatements.length > 0) {
                statement.relatedStatements.forEach((related: any) => {
                    // Check if target statement exists in our filtered data
                    const targetExists = statements.some(s => s.id === related.nodeId);
                    if (targetExists) {
                        // Create unique key for node pair - sort IDs to ensure uniqueness regardless of direction
                        const [id1, id2] = [statement.id, related.nodeId].sort();
                        const linkKey = `${id1}-${id2}`;
                        
                        if (!linkMap.has(linkKey)) {
                            linkMap.set(linkKey, {
                                sourceId: statement.id,
                                targetId: related.nodeId,
                                keywords: new Set([related.sharedWord || 'unknown']),
                                strength: related.strength || 1
                            });
                        } else {
                            // Update existing link with additional keyword and max strength
                            const link = linkMap.get(linkKey)!;
                            link.keywords.add(related.sharedWord || 'unknown');
                            link.strength = Math.max(link.strength, related.strength || 1);
                        }
                    }
                });
            }
        });
        
        // Convert consolidated links to GraphLink objects
        const statementLinks: GraphLink[] = Array.from(linkMap.entries()).map(([key, linkInfo]) => ({
            id: `link-${key}`,
            source: linkInfo.sourceId,
            target: linkInfo.targetId,
            type: 'related' as LinkType,
            // Add metadata for visualization
            metadata: {
                keywordCount: linkInfo.keywords.size,
                keywords: Array.from(linkInfo.keywords),
                strength: linkInfo.strength
            }
        }));

        console.log('[STATEMENT-NETWORK] Created statement network structure', {
            nodeCount: navigationNodes.length + 1 + statementNodes.length,
            statementCount: statementNodes.length,
            linkCount: statementLinks.length,
            // Log the difference between raw relationships and consolidated links
            rawRelationshipCount: statements.reduce((count, s) => 
                count + (s.relatedStatements?.length || 0), 0),
            consolidatedLinkCount: statementLinks.length
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
    
    // Special debug function to check DOM structure and transforms
    function debugDOMStructure() {
        // Get the SVG element
        const svg = document.querySelector('.graph-svg');
        if (!svg) {
            console.warn('[DOM Debug] SVG element not found');
            return;
        }
        
        // Get key elements
        const contentGroup = svg.querySelector('.content-layer');
        const backgroundGroup = svg.querySelector('.background-layer');
        const centralNodeWrapper = svg.querySelector('[data-node-id="graph-controls"]');
        
        console.log('[DOM Debug] SVG DOM structure:', {
            svg: {
                classList: Array.from(svg.classList),
                attributes: getAttributes(svg),
                computedStyle: extractKeyStyles(svg)
            },
            contentGroup: contentGroup ? {
                classList: Array.from(contentGroup.classList),
                attributes: getAttributes(contentGroup),
                computedStyle: extractKeyStyles(contentGroup)
            } : 'Not found',
            backgroundGroup: backgroundGroup ? {
                classList: Array.from(backgroundGroup.classList),
                attributes: getAttributes(backgroundGroup),
                computedStyle: extractKeyStyles(backgroundGroup)
            } : 'Not found',
            centralNodeWrapper: centralNodeWrapper ? {
                classList: Array.from(centralNodeWrapper.classList),
                attributes: getAttributes(centralNodeWrapper),
                computedStyle: extractKeyStyles(centralNodeWrapper)
            } : 'Not found'
        });
        
        // Get all node wrappers
        const nodeWrappers = svg.querySelectorAll('.node-wrapper');
        console.log(`[DOM Debug] Found ${nodeWrappers.length} node wrappers`);
        
        // Find all transforms on all elements
        const allElements = svg.querySelectorAll('*');
        let transformedElements = 0;
        
        Array.from(allElements).forEach(el => {
            const transform = el.getAttribute('transform');
            if (transform) {
                transformedElements++;
                const parent = el.parentElement?.tagName || 'unknown';
                console.log(`[DOM Debug] Element with transform:`, {
                    element: el.tagName,
                    transform,
                    parent,
                    classList: Array.from(el.classList)
                });
            }
        });
        
        console.log(`[DOM Debug] Found ${transformedElements} elements with transforms`);
        
        // Helper function to extract specific attributes
        function getAttributes(el: Element) {
            const attrs: Record<string, string> = {};
            for (const attr of el.attributes) {
                attrs[attr.name] = attr.value;
            }
            return attrs;
        }
        
        // Helper function to extract key styles
        function extractKeyStyles(el: Element) {
            const style = window.getComputedStyle(el);
            return {
                position: style.position,
                transform: style.transform,
                transformOrigin: style.transformOrigin,
                top: style.top,
                left: style.left,
                width: style.width,
                height: style.height
            };
        }
    }
    
    // Function to force the content group to center
    function forceContentLayerReset() {
        // Get the SVG element and content layer
        const svg = document.querySelector('.graph-svg');
        const contentLayer = svg?.querySelector('.content-layer');
        const backgroundLayer = svg?.querySelector('.background-layer g');
        
        if (!svg || !contentLayer) {
            console.warn('[Reset] Could not find SVG or content layer');
            return;
        }
        
        const initialScale = 2.5; // Should match COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM
        
        console.log('[Reset] Forcing content layer transform reset');
        
        // Set transform directly
        contentLayer.setAttribute('transform', `translate(0,0) scale(${initialScale})`);
        
        // Also reset background if found
        if (backgroundLayer) {
            backgroundLayer.setAttribute('transform', `translate(0,0) scale(${initialScale})`);
        }
        
        // Check the result
        setTimeout(() => {
            console.log('[Reset] After reset:', {
                contentTransform: contentLayer.getAttribute('transform'),
                backgroundTransform: backgroundLayer?.getAttribute('transform')
            });
            
            // Also update debug info
            updateCentralNodeDebugInfo();
        }, 100);
    }
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
    <!-- Debug panel with central node position info -->
    <div class="debug-panel">
        <h4>Debug Panel</h4>
        <div>Statements: {statements.length}</div>
        <div>Loading: {networkNodesLoading.toString()}</div>
        <div>Loaded: {statementsLoaded.toString()}</div>
        <div>Graph nodes: {graphData.nodes.length}</div>
        <div>Graph links: {graphData.links.length}</div>
        <div>Statement nodes: {graphData.nodes.filter(n => n.type === 'statement').length}</div>
        
        <h5>Central Node</h5>
        <div>Exists: {centralNodeExists.toString()}</div>
        <div>Position X: {centralNodePosition.x.toFixed(2)}</div>
        <div>Position Y: {centralNodePosition.y.toFixed(2)}</div>
        <div>Fixed X: {centralNodePosition.fx.toFixed(2)}</div>
        <div>Fixed Y: {centralNodePosition.fy.toFixed(2)}</div>
        <div>Update Count: {updateCount}</div>
        
        <button on:click={() => updateGraphWithStatements()}>Force Update Graph</button>
        <button on:click={() => forceUpdateDebugInfo()}>Update Debug Info</button>
        <button on:click={debugDOMStructure} class="special-button">Debug DOM Structure</button>
        <button on:click={forceContentLayerReset} class="special-button">Force Content Reset</button>
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
        max-width: 400px;
    }

    .debug-panel h4 {
        margin-top: 0;
        margin-bottom: 10px;
    }
    
    .debug-panel h5 {
        margin-top: 15px;
        margin-bottom: 5px;
        color: #4338ca;
    }

    .debug-panel button {
        margin-top: 10px;
        background: #4338ca;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        display: block;
        width: 100%;
        margin-bottom: 5px;
    }
    
    .debug-panel .special-button {
        background: #e74c3c;
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
        width: 65px;
        height: 65px;
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