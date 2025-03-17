<!-- src/routes/graph/create-definition/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import CreateAlternativeDefinitionNode from '$lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
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
    import { isNavigationNode } from '$lib/types/graph/enhanced';

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Get initial word data from the page data
    let initialWordData = data.wordData;
    
    // Define view type - now using 'create-definition' instead of 'create-alternative'
    const viewType: ViewType = 'create-definition';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;

    // Initialize data and authenticate user
    async function initializeData() {
        console.log('[CREATE-DEFINITION] Starting data initialization');
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.log('[CREATE-DEFINITION] No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            console.log('[CREATE-DEFINITION] User authenticated', {
                userId: fetchedUser.sub
            });
            
            authInitialized = true;
            userStore.set(fetchedUser);
            
            // Load word data if needed
            if (!initialWordData) {
                console.log('[CREATE-DEFINITION] No initial word data, loading from URL parameter');
                const wordParam = new URL(window.location.href).searchParams.get('word');
                if (wordParam) {
                    const loadedWord = await getWordData(wordParam);
                    if (loadedWord) {
                        console.log('[CREATE-DEFINITION] Setting word data', {
                            wordId: loadedWord.id,
                            word: loadedWord.word,
                            definitionCount: loadedWord.definitions?.length
                        });
                        wordStore.set(loadedWord);
                    } else {
                        console.error('[CREATE-DEFINITION] Word data not found for:', wordParam);
                        window.location.href = '/graph/dashboard';
                        return;
                    }
                } else {
                    console.error('[CREATE-DEFINITION] No word parameter in URL');
                    window.location.href = '/graph/dashboard';
                    return;
                }
            } else {
                console.log('[CREATE-DEFINITION] Using initial word data from page data');
                wordStore.set(initialWordData);
            }
            
            console.log('[CREATE-DEFINITION] Data initialization complete');
            dataInitialized = true;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                console.log('[CREATE-DEFINITION] Setting graph store view type to create-definition');
                // Note: For now, we're using 'create-alternative' here until we update the graphStore
                // to support 'create-definition' as a valid ViewType
                graphStore.setViewType('create-definition' as ViewType);
                graphStore.forceTick();
            }
        } catch (error) {
            console.error('[CREATE-DEFINITION-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Event handlers
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[CREATE-DEFINITION] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
    }

    // Get word data from store or initial data
    $: wordData = $wordStore || initialWordData;
    
    // Create central node
    $: centralNode = isReady && $userStore && wordData ? {
        id: $userStore.sub,
        type: 'create-node' as NodeType,
        data: $userStore,
        group: 'central' as NodeGroup
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
        if (!centralNode) {
            return { nodes: [], links: [] };
        }

        const nodes = [centralNode, ...navigationNodes] as GraphNode[];
        
        console.log('[CREATE-DEFINITION] Created graph data', {
            nodeCount: nodes.length
        });
        
        return { nodes, links: [] };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady && wordData ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        console.log("✅ USING CREATE DEFINITION VIEW COMPONENT");
        initializeData();
    });

    // Cleanup on destroy
    onDestroy(() => {
        // Any cleanup logic (if needed)
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
        {#if node.type === 'create-node'}
            <CreateAlternativeDefinitionNode 
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