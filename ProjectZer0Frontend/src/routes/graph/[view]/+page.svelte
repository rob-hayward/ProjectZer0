<!-- src/routes/graph/[view]/+page.svelte -->
<script lang="ts">
    import { onMount, afterUpdate } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserActivity } from '$lib/services/userActivity';
    import { getUserActivity } from '$lib/services/userActivity';
    import { getWordData } from '$lib/services/word'; 
    import { getStatementData } from '$lib/services/statement';
    import Graph from '$lib/components/graph/Graph.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import CreateAlternativeDefinitionNode from '$lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { statementStore } from '$lib/stores/statementStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
    import { getNetVotes } from '$lib/components/graph/nodes/utils/nodeUtils';
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
    import type { Keyword, RelatedStatement } from '$lib/types/domain/nodes';
    import {
        isDashboardNode,
        isEditProfileNode,
        isCreateNodeNode,
        isWordNode,
        isDefinitionNode,
        isNavigationNode,
        isStatementNode,
        isWordNodeData
    } from '$lib/types/graph/enhanced';
    
    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let userActivity: UserActivity | undefined;

    // Use data from page data for initial state
    $: initialWordData = data.wordData;
    $: initialStatementData = data.statementData;
    
    // Derive viewType directly from URL parameters
    $: viewType = $page.params.view as ViewType;
    $: view = viewType;
    
    // Node mode handling
    $: wordNodeMode = $page ? 
        ($page.params.view === 'word' ? 'detail' : 'preview')
        : 'preview';
    $: statementNodeMode = $page ?
        ($page.params.view === 'statement' ? 'detail' : 'preview')
        : 'preview';
    
    // Statement network data
    $: statements = $statementNetworkStore?.statements || [];
    
    // Load statement network data when view is statement-network
    $: if (viewType === 'statement-network' && isReady) {
        console.log('[NETWORK] Loading statement network data');
        loadStatementNetworkData();
    }

    // Check for alternative definition mode (separate from view type)
    $: isAlternativeDefinitionsMode = false; // NOTE: alternative-definitions is a mode, not a view type
    
    // Preview mode handling
    $: isPreviewMode = isAlternativeDefinitionsMode ? 
        wordNodeMode === 'preview' : 
        view === 'word' ? 
            wordNodeMode === 'preview' : 
            view === 'statement' ?
                statementNodeMode === 'preview' :
                false;
            
    // Check for alternative definition creation view
    $: isCreateAlternative = view === 'create-alternative';
    
    // View type checks
    $: isWordView = view === 'word';
    $: isStatementView = view === 'statement';
    $: isStatementNetworkView = view === 'statement-network';
    
    // Only true word views need word data for the central node
    $: needsWordDataForCentralNode = isWordView;
    
    // But we still need to load word data for create-alternative
    $: needsWordDataLoaded = isWordView || isCreateAlternative;
    
    // Statement view needs statement data for the central node
    $: needsStatementDataForCentralNode = isStatementView;

    // Force immediate graph updates on navigation
    function forceGraphUpdate(newViewType: ViewType) {
        console.log('[FORCE-UPDATE] Forcing graph update to:', newViewType);
        
        if (graphStore) {
            // Update the graph store
            graphStore.setViewType(newViewType);
            
            // Force immediate simulation ticks
            if (graphStore.forceTick) {
                graphStore.forceTick();
            }
            
            // Force render with new route key
            routeKey = `${newViewType}-${Date.now()}`;
        }
    }

    // Load statement network data
    async function loadStatementNetworkData() {
        if (!$userStore) return;
        
        try {
            // Load statements using the network store
            await statementNetworkStore.loadStatements({
                limit: 50 // Start with a reasonable limit
            });
            
            console.log('[NETWORK] Loaded statement data:', $statementNetworkStore.statements.length);
        } catch (error) {
            console.error('[NETWORK] Error loading statement network data:', error);
        }
    }

    async function initializeData() {
        console.log('[INIT] Starting data initialization');
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.log('[INIT] No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            console.log('[INIT] User authenticated', {
                userId: fetchedUser.sub
            });
            authInitialized = true;
            userStore.set(fetchedUser);
            userActivity = await getUserActivity();
            
            // Handle word data for both word view and create-alternative view
            if (needsWordDataLoaded) {
                console.log(`[INIT] ${view} view detected, loading word data`);
                const wordParam = new URL(window.location.href).searchParams.get('word');
                if (wordParam) {
                    const loadedWord = await getWordData(wordParam);
                    if (loadedWord) {
                        console.log('[INIT] Setting word data', {
                            wordId: loadedWord.id,
                            definitionCount: loadedWord.definitions?.length,
                            view
                        });
                        wordStore.set(loadedWord);
                    }
                }
            }
            
            // Handle statement data for statement view
            if (isStatementView) {
                console.log(`[INIT] ${view} view detected, loading statement data`);
                const idParam = new URL(window.location.href).searchParams.get('id');
                if (idParam) {
                    const loadedStatement = await getStatementData(idParam);
                    if (loadedStatement) {
                        console.log('[INIT] Setting statement data', {
                            statementId: loadedStatement.id,
                            statement: loadedStatement.statement,
                            keywordCount: loadedStatement.keywords?.length,
                            view
                        });
                        statementStore.set(loadedStatement);
                    }
                }
            }
            
            // Handle statement network data
            if (isStatementNetworkView) {
                console.log(`[INIT] ${view} view detected, loading statement network data`);
                await loadStatementNetworkData();
            }
            
            console.log('[INIT] Data initialization complete');
            dataInitialized = true;
            
            // Force a graph update after initialization completes
            forceGraphUpdate(viewType);
        } catch (error) {
            console.error('[INIT-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    onMount(() => {
        initializeData();
        console.log('[NAVIGATION] Mounted, listening for URL changes');
    });
    
    // Ensure graph store stays in sync with URL
    afterUpdate(() => {
        if (graphStore && viewType) {
            console.log('[AFTER-UPDATE] Current view type from URL:', viewType);
            
            if (graphStore.getViewType() !== viewType) {
                console.log('[AFTER-UPDATE] Fixing mismatched view types:', {
                    storeType: graphStore.getViewType(),
                    urlType: viewType
                });
                graphStore.setViewType(viewType);
            }
        }
    });

    // Data reactivity
    $: wordData = needsWordDataLoaded ? ($wordStore || initialWordData) : null;
    $: statementData = isStatementView ? ($statementStore || initialStatementData) : null;
    $: isReady = authInitialized && dataInitialized;
    
    // Enhanced route key with timestamp to ensure uniqueness
    $: routeKey = `${viewType}-${Date.now()}`;

    // Event handlers - Clean version
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[MODE-CHANGE] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
        
        // Handle word node mode changes specifically
        if (wordData && event.detail.nodeId === wordData.id) {
            console.log('[MODE-CHANGE] Word node mode change', {
                from: wordNodeMode,
                to: event.detail.mode
            });
            wordNodeMode = event.detail.mode;
        }
        
        // Handle statement node mode changes specifically
        if (statementData && event.detail.nodeId === statementData.id) {
            console.log('[MODE-CHANGE] Statement node mode change', {
                from: statementNodeMode,
                to: event.detail.mode
            });
            statementNodeMode = event.detail.mode;
        }
    }

    // Updated central node type handling - only for views that need a central node
    $: centralNode = isReady && $userStore && (
        needsWordDataForCentralNode && wordData ? {
            // Word node as central for word views
            id: wordData.id,
            type: 'word' as const,
            data: wordData,
            group: 'central' as const,
            mode: wordNodeMode
        } : 
        needsStatementDataForCentralNode && statementData ? {
            // Statement node as central for statement views
            id: statementData.id,
            type: 'statement' as const,
            data: statementData,
            group: 'central' as const,
            mode: statementNodeMode
        } : {
            // User profile for other views (except statement-network)
            id: $userStore.sub,
            type: isCreateAlternative ? 'create-node' as const : 
                  isStatementNetworkView ? 'dashboard' as const : // Fallback type for statement-network
                  view as NodeType,
            data: $userStore,
            group: 'central' as const
        }
    );

    // Create graph data
    function createGraphData(): GraphData {
        // For statement network view - special case with no central node
        if (view === 'statement-network') {
            console.log('[DATA] Creating statement network view data', {
                statementCount: statements.length
            });

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
                        // Check if target statement exists in our data
                        const targetExists = statements.some(s => s.id === related.nodeId);
                        if (targetExists) {
                            statementLinks.push({
                                id: `${statement.id}-${related.nodeId}-${related.sharedWord}`,
                                source: statement.id,
                                target: related.nodeId,
                                type: related.sharedWord === 'direct' ? 'related' as LinkType : 'alternative' as LinkType
                            });
                        }
                    });
                }
            });

            console.log('[DATA] Created statement network structure', {
                nodeCount: navigationNodes.length + statementNodes.length,
                linkCount: statementLinks.length
            });

            // Return ONLY navigation nodes and statement nodes - NO central node
            return {
                nodes: [...navigationNodes, ...statementNodes],
                links: statementLinks
            };
        }

        // For all other views, use the central node approach
        if (!centralNode) {
            return { nodes: [], links: [] };
        }

        // Debug central node
        console.debug('[DATA] Central node details:', {
            id: centralNode.id, 
            type: centralNode.type,
            mode: centralNode.type === 'statement' ? statementNodeMode : undefined
        });

        // Always explicitly set the mode on the central node
        const centralNodeWithCorrectMode = {
            ...centralNode,
            mode: centralNode.type === 'statement' ? statementNodeMode as NodeMode : 
                  centralNode.type === 'word' ? wordNodeMode as NodeMode :
                  centralNode.mode
        };

        const baseNodes = [centralNodeWithCorrectMode, ...navigationNodes] as GraphNode[];
        
        // Handle word view with definitions
        if (wordData && wordData.definitions && wordData.definitions.length > 0 && view === 'word') {
            console.log('[DATA] Creating word view data', {
                definitionCount: wordData.definitions.length,
                wordNodeMode
            });

            // Sort definitions by votes to establish rank order
            const sortedDefinitions = [...wordData.definitions].sort((a, b) => 
                getNetVotes(b) - getNetVotes(a)
            );

            // Create word node with mode
            const nodesWithModes: GraphNode[] = baseNodes.map(node => 
                node.type === 'word' ? {
                    ...node,
                    mode: wordNodeMode as NodeMode
                } : node
            );

            // Create definition nodes with their rank-based grouping
            const definitionNodes: GraphNode[] = sortedDefinitions.map((definition, index) => ({
                id: definition.id,
                type: 'definition' as NodeType,
                data: definition,
                group: (index === 0 ? 'live-definition' : 'alternative-definition') as NodeGroup,
                mode: 'preview' as NodeMode
            }));

            // Define pure relationship links
            const definitionLinks: GraphLink[] = sortedDefinitions.map((definition, index) => ({
                id: `${centralNode.id}-${definition.id}-${Date.now()}-${index}`,
                source: centralNode.id,
                target: definition.id,
                type: (index === 0 ? 'live' : 'alternative') as LinkType
            }));

            console.log('[DATA] Created graph structure for word view', {
                nodeCount: nodesWithModes.length + definitionNodes.length,
                linkCount: definitionLinks.length
            });

            return {
                nodes: [...nodesWithModes, ...definitionNodes],
                links: definitionLinks
            };
        } 
        // Handle statement view - SIMPLIFIED implementation
        else if (statementData && view === 'statement') {
            console.log('[DATA] Creating simplified statement view data', {
                statementId: statementData.id,
                statement: statementData.statement,
                statementNodeMode
            });
            
            // Make sure the central node (statement) has the correct mode
            const nodesWithCorrectMode = baseNodes.map(node => {
                if (node.id === statementData.id) {
                    return {
                        ...node,
                        mode: statementNodeMode as NodeMode
                    };
                }
                return node;
            });
            
            console.log('[DATA] Created simplified graph structure for statement view', {
                nodeCount: nodesWithCorrectMode.length,
                linkCount: 0
            });
            
            // Return only the basic nodes (central statement + navigation)
            return {
                nodes: nodesWithCorrectMode,
                links: []
            };
        }
        // Default case for all other views
        else {
            console.log('[DATA] Created base graph structure', {
                nodeCount: baseNodes.length
            });
            return { nodes: baseNodes, links: [] };
        }
    }

    // Define navigation context based on the current view
    $: context = 
        view === 'dashboard' ? NavigationContext.DASHBOARD :
        view === 'create-node' ? NavigationContext.CREATE_NODE :
        view === 'edit-profile' ? NavigationContext.EDIT_PROFILE :
        isWordView ? NavigationContext.WORD :
        isStatementView ? NavigationContext.WORD : // For now, use word context for statement view too
        view === 'create-alternative' ? NavigationContext.WORD : // Use word context for alternative definition
        view === 'statement-network' ? NavigationContext.DASHBOARD : // Use dashboard context for statement network
        NavigationContext.DASHBOARD;

    $: navigationNodes = getNavigationOptions(context)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create graph data reactively
    $: graphData = isReady ? createGraphData() : { nodes: [], links: [] };
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
    {viewType}
    on:modechange={handleNodeModeChange}
>
    <svelte:fragment slot="default" let:node let:handleModeChange>
        {#if isWordNode(node) && wordData}
            <WordNode 
                {node}
                wordText={wordData.word}
                on:modeChange={handleModeChange}
            />
        {:else if isWordNode(node) && (!wordData && isStatementView)}
            <!-- Handle keyword nodes in statement view -->
            <WordNode 
                {node}
                wordText={node.data.word} 
                on:modeChange={handleModeChange}
            />
        {:else if isDefinitionNode(node) && wordData}
            <DefinitionNode 
                {node}
                wordText={wordData.word}
                on:modeChange={handleModeChange}
            />
        {:else if isStatementNode(node)}
            <StatementNode 
                {node}
                statementText={isStatementView && statementData ? statementData.statement : node.data.statement}
                on:modeChange={handleModeChange}
            />
        {:else if isDashboardNode(node)}
            <DashboardNode 
                {node}
                {userActivity}
                on:modeChange={handleModeChange}
            />
        {:else if isEditProfileNode(node)}
            <EditProfileNode 
                {node}
                on:modeChange={handleModeChange}
            />
        {:else if isCreateNodeNode(node)}
            {#if isCreateAlternative && wordData}
                <!-- When in create-alternative view and have word data, render CreateAlternativeDefinitionNode -->
                <CreateAlternativeDefinitionNode 
                    {node}
                    on:modeChange={handleModeChange}
                />
            {:else}
                <CreateNodeNode 
                    {node}
                    on:modeChange={handleModeChange}
                />
            {/if}
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