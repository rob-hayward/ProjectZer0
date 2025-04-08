<!-- src/routes/graph/word/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import { getWordData } from '$lib/services/word';
    import Graph from '$lib/components/graph/Graph.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { wordViewStore } from '$lib/stores/wordViewStore';
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
        isWordNode, 
        isDefinitionNode, 
        isNavigationNode 
    } from '$lib/types/graph/enhanced';

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Get initial word data from the page data
    let initialWordData = data.wordData;
    
    // Define view type
    const viewType: ViewType = 'word';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Node mode handling for word node (starts in detail mode)
    let wordNodeMode: NodeMode = 'detail'; 

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
            
            // Load word data if needed
            if (!initialWordData) {
                const wordParam = new URL(window.location.href).searchParams.get('word');
                if (wordParam) {
                    const loadedWord = await getWordData(wordParam);
                    if (loadedWord) {
                        wordStore.set(loadedWord);
                        // Add data to wordViewStore for vote management
                        wordViewStore.setWordData(loadedWord);
                    } else {
                        window.location.href = '/graph/dashboard';
                        return;
                    }
                } else {
                    window.location.href = '/graph/dashboard';
                    return;
                }
            } else {
                wordStore.set(initialWordData);
                // Add data to wordViewStore for vote management
                wordViewStore.setWordData(initialWordData);
            }
            
            dataInitialized = true;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
        } catch (error) {
            auth0.login();
        }
    }

    // Event handlers
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        // Handle word node mode changes specifically
        if (wordData && event.detail.nodeId === wordData.id) {
            wordNodeMode = event.detail.mode;
        }
        
        // Always update the graph store
        if (graphStore) {
            graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
        }
    }

    // Get word data from store or initial data
    $: wordData = $wordStore || initialWordData;
    
    // Update wordViewStore whenever wordData changes
    $: if (wordData) {
        wordViewStore.setWordData(wordData);
    }
    
    // Create central word node
    $: centralWordNode = isReady && wordData ? {
        id: wordData.id,
        type: 'word' as NodeType,
        data: wordData,
        group: 'central' as NodeGroup,
        mode: wordNodeMode
    } : null;

    // Get navigation options for word context
    $: navigationNodes = getNavigationOptions(NavigationContext.WORD)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create graph data
    function createGraphData(): GraphData {
        if (!centralWordNode || !wordData) {
            return { nodes: [], links: [] };
        }

        // Sort definitions by votes to establish rank order
        const sortedDefinitions = [...wordData.definitions].sort((a, b) => 
            getNetVotes(b) - getNetVotes(a)
        );

        // Create word node with mode
        const baseNodes = [
            {
                ...centralWordNode,
                mode: wordNodeMode  // Ensure mode is set correctly
            },
            ...navigationNodes
        ] as GraphNode[];

        // Create definition nodes with their rank-based grouping
        const definitionNodes: GraphNode[] = sortedDefinitions.map((definition, index) => ({
            id: definition.id,
            type: 'definition' as NodeType,
            data: definition,
            group: (index === 0 ? 'live-definition' : 'alternative-definition') as NodeGroup,
            mode: 'preview' as NodeMode
        }));

        // Define relationship links between word and definition nodes
        const definitionLinks: GraphLink[] = sortedDefinitions.map((definition, index) => ({
            id: `${centralWordNode.id}-${definition.id}-${Date.now()}-${index}`,
            source: centralWordNode.id,
            target: definition.id,
            type: (index === 0 ? 'live' : 'alternative') as LinkType
        }));

        return {
            nodes: [...baseNodes, ...definitionNodes],
            links: definitionLinks
        };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady && wordData ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        initializeData();
    });

    // Force update when wordStore changes
    $: if ($wordStore && isReady) {
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
{:else if !wordData}
    <div class="loading-container">
        <div class="loading-text">Word data not found</div>
    </div>
{:else}
{#key routeKey}
<Graph 
    data={graphData}
    viewType={viewType}
    on:modechange={handleNodeModeChange}
>
    <svelte:fragment slot="default" let:node let:handleModeChange>
        {#if isWordNode(node)}
            <WordNode 
                {node}
                wordText={wordData.word}
                on:modeChange={handleModeChange}
            />
        {:else if isDefinitionNode(node)}
            <DefinitionNode 
                {node}
                wordText={wordData.word}
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