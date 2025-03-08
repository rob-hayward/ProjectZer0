<!-- src/routes/graph/[view]/+page.svelte -->
<script lang="ts">
    import { onMount, afterUpdate } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserActivity } from '$lib/services/userActivity';
    import { getUserActivity } from '$lib/services/userActivity';
    import { getWordData } from '$lib/services/word'; 
    import Graph from '$lib/components/graph/Graph.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import CreateAlternativeDefinitionNode from '$lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { graphStore } from '$lib/stores/graphStore';
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
    import {
        isDashboardNode,
        isEditProfileNode,
        isCreateNodeNode,
        isWordNode,
        isDefinitionNode,
        isNavigationNode,
        isWordNodeData
    } from '$lib/types/graph/enhanced';
    
    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let userActivity: UserActivity | undefined;

    // Use wordData from page data for initial state
    $: initialWordData = data.wordData;
    
    // Derive viewType directly from URL parameters
    $: viewType = $page.params.view as ViewType;
    $: view = viewType;
    
    // Word node mode handling
    $: wordNodeMode = $page ? 
        ($page.params.view === 'word' ? 'detail' : 'preview')
        : 'preview';

    // Check for alternative definition mode (separate from view type)
    $: isAlternativeDefinitionsMode = false; // NOTE: alternative-definitions is a mode, not a view type
    
    // Preview mode handling
    $: isPreviewMode = isAlternativeDefinitionsMode ? 
        wordNodeMode === 'preview' : 
        view === 'word' ? 
            wordNodeMode === 'preview' : 
            false;
            
    // Check for alternative definition creation view
    $: isCreateAlternative = view === 'create-alternative';
    
    // Word-related view check
    $: isWordView = view === 'word';
    
    // Only true word views need word data for the central node
    $: needsWordDataForCentralNode = isWordView;
    
    // But we still need to load word data for create-alternative
    $: needsWordDataLoaded = isWordView || isCreateAlternative;

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
    $: isReady = authInitialized && dataInitialized;
    
    // Enhanced route key with timestamp to ensure uniqueness
    $: routeKey = `${viewType}-${Date.now()}`;

    // Event handlers
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
    }

    // Updated central node type handling
    $: centralNode = isReady && $userStore && (needsWordDataForCentralNode && wordData ? {
        // Word node as central for word views
        id: wordData.id,
        type: 'word' as const,
        data: wordData,
        group: 'central' as const,
        mode: wordNodeMode
    } : {
        // User profile for all other views including create-alternative
        id: $userStore.sub,
        // IMPORTANT: Using 'create-node' type for both create-node and create-alternative views
        // We'll differentiate in the component rendering based on isCreateAlternative flag
        type: isCreateAlternative ? 'create-node' as const : view as NodeType,
        data: $userStore,
        group: 'central' as const
    });

    // Create graph data
    function createGraphData(): GraphData {
        if (!centralNode) {
            return { nodes: [], links: [] };
        }

        const baseNodes = [centralNode, ...navigationNodes] as GraphNode[];
        
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
                id: `${centralNode.id}-${definition.id}`,
                source: centralNode.id,
                target: definition.id,
                type: (index === 0 ? 'live' : 'alternative') as LinkType
            }));

            console.log('[DATA] Created graph structure', {
                nodeCount: nodesWithModes.length + definitionNodes.length,
                linkCount: definitionLinks.length
            });

            return {
                nodes: [...nodesWithModes, ...definitionNodes],
                links: definitionLinks
            };
        } else {
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
        view === 'create-alternative' ? NavigationContext.WORD : // Use word context for alternative definition
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
        {:else if isDefinitionNode(node) && wordData}
            <DefinitionNode 
                {node}
                wordText={wordData.word}
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