<!-- src/routes/graph/[view]/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserActivity } from '$lib/services/userActivity';
    import { getUserActivity } from '$lib/services/userActivity';
    import { getWordData } from '$lib/services/word';  
    import { NODE_CONSTANTS } from '$lib/constants/graph/node-styling';
    import { COORDINATE_SPACE } from '$lib/constants/graph';
    import Graph from '$lib/components/graph/Graph.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import WordPreview from '$lib/components/graph/nodes/word/WordPreview.svelte';
    import WordDetail from '$lib/components/graph/nodes/word/WordDetail.svelte';
    import DefinitionPreview from '$lib/components/graph/nodes/definition/DefinitionPreview.svelte';
    import DefinitionDetail from '$lib/components/graph/nodes/definition/DefinitionDetail.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { COLORS } from '$lib/constants/colors';
    import { getNetVotes } from '$lib/components/graph/nodes/utils/nodeUtils';
    import type { 
        GraphNode, 
        GraphPageData, 
        GraphLink, 
        LinkType, 
        GraphData, 
        NodeGroup, 
        NodeType, 
        ViewType,
        NodeMode 
    } from '$lib/types/graph/core';
    import { 
        isDashboardNode, 
        isEditProfileNode, 
        isCreateNodeNode, 
        isWordNode, 
        isDefinitionNode, 
        isNavigationNode 
    } from '$lib/types/graph/core';
    import type { NodeStyle } from '$lib/types/nodes';
    
    type ModeChangeEvent = CustomEvent<{ mode: NodeMode }>;
    
    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let userActivity: UserActivity | undefined;
    let graphLayout: Graph;
    let definitionNodeModes = new Map<string, NodeMode>();
    let graphData: GraphData;

    // Initialize viewType from page data
    $: viewType = data.viewType;
    
    // Use wordData from page data for initial state
    $: initialWordData = data.wordData;
    
    // Word node mode handling
    $: wordNodeMode = $page ? 
        ($page.params.view === 'word' ? 'detail' : 'preview')
        : 'preview';

    // Initialize nodes in correct modes when word data changes
    $: if (wordData?.definitions) {
        console.debug('[INIT-7] +page.svelte: Setting definition modes', {
            definitionCount: wordData.definitions.length,
            existingModes: Array.from(definitionNodeModes.entries())
        });

        const definitionNodes = wordData.definitions;
        const newNodes = definitionNodes.filter(def => !definitionNodeModes.has(def.id));
        
        if (newNodes.length > 0) {
            console.debug('[INIT-8] +page.svelte: New definition nodes found', {
                count: newNodes.length,
                nodeIds: newNodes.map(n => n.id)
            });

            newNodes.forEach(node => {
                definitionNodeModes.set(node.id, 'preview');
            });
            definitionNodeModes = new Map(definitionNodeModes);
        }
    }

    // Node styles configuration using COORDINATE_SPACE
    const wordStyle: NodeStyle = {
    previewSize: COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW,
    detailSize: COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL,
    colors: NODE_CONSTANTS.COLORS.WORD,
    padding: {
        preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
        detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
    },
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE,
    highlightColor: COLORS.PRIMARY.BLUE
};

const liveDefinitionStyle: NodeStyle = {
    previewSize: COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW,
    detailSize: COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL,
    colors: NODE_CONSTANTS.COLORS.DEFINITION.live,
    padding: {
        preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
        detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
    },
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE,
    highlightColor: COLORS.PRIMARY.BLUE  
};

const alternativeDefinitionStyle: NodeStyle = {
    previewSize: COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW,
    detailSize: COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL,
    colors: NODE_CONSTANTS.COLORS.DEFINITION.alternative,
    padding: {
        preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
        detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
    },
    lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
    stroke: NODE_CONSTANTS.STROKE,
    highlightColor: COLORS.PRIMARY.PURPLE
};

   // Preview mode handling
   $: isPreviewMode = view === 'alternative-definitions' ? 
        wordNodeMode === 'preview' : 
        view === 'word' ? 
            wordNodeMode === 'preview' : 
            false;

    async function initializeData() {
        console.debug('[INIT-9] +page.svelte: Starting data initialization');
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.debug('[INIT-9a] +page.svelte: No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            console.debug('[INIT-10] +page.svelte: User authenticated', {
                userId: fetchedUser.sub
            });
            authInitialized = true;
            userStore.set(fetchedUser);
            userActivity = await getUserActivity();
            
            if (view === 'word') {
                console.debug('[INIT-11] +page.svelte: Word view detected, loading word data');
                const wordParam = new URL(window.location.href).searchParams.get('word');
                if (wordParam) {
                    const loadedWord = await getWordData(wordParam);
                    if (loadedWord) {
                        console.debug('[INIT-12] +page.svelte: Setting word data', {
                            wordId: loadedWord.id,
                            definitionCount: loadedWord.definitions?.length
                        });
                        wordStore.set(loadedWord);
                    }
                }
            }
            
            console.debug('[INIT-13] +page.svelte: Data initialization complete');
            dataInitialized = true;
        } catch (error) {
            console.error('[INIT-ERROR] +page.svelte: Error in initializeData:', error);
            auth0.login();
        }
    }

    onMount(initializeData);

    // View and data reactivity
    $: view = $page.params.view;
    $: isWordView = view === 'word' || view === 'alternative-definitions';
    $: wordData = isWordView ? ($wordStore || initialWordData) : null;
    $: isReady = authInitialized && dataInitialized;

    // Event handlers
    function handleWordNodeModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        console.debug('[UPDATE-1] +page.svelte: Word node mode change', {
            newMode: event.detail.mode,
            currentMode: wordNodeMode
        });
        wordNodeMode = event.detail.mode;
    }

    function handleDefinitionModeChange(event: ModeChangeEvent, nodeId: string) {
        console.debug('[UPDATE-2] +page.svelte: Definition mode change', {
            nodeId,
            newMode: event.detail.mode,
            currentMode: definitionNodeModes.get(nodeId)
        });
        const newMode = event.detail.mode;
        definitionNodeModes.set(nodeId, newMode);
        definitionNodeModes = new Map(definitionNodeModes);
        updateGraphData();
    }

    // Graph data management
    function updateGraphData() {
        console.debug('[UPDATE-3] +page.svelte: Updating graph data', {
            hasCentralNode: !!centralNode,
            definitionModes: Array.from(definitionNodeModes.entries())
        });

        if (!centralNode) {
            graphData = { nodes: [], links: [] };
            return;
        }

        const baseNodes = [centralNode, ...navigationNodes] as GraphNode[];
        
        if (wordData && wordData.definitions.length > 0 && view === 'word') {
            console.debug('[UPDATE-4] +page.svelte: Processing word view data', {
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
                mode: (definitionNodeModes.get(definition.id) || 'preview') as NodeMode
            }));

            // Define pure relationship links
            const definitionLinks: GraphLink[] = sortedDefinitions.map((definition, index) => ({
                source: centralNode.id,
                target: definition.id,
                type: (index === 0 ? 'live' : 'alternative') as LinkType
            }));

            console.debug('[UPDATE-5] +page.svelte: Created graph structure', {
                nodeCount: nodesWithModes.length + definitionNodes.length,
                linkCount: definitionLinks.length
            });

            graphData = {
                nodes: [...nodesWithModes, ...definitionNodes],
                links: definitionLinks
            };
        } else {
            console.debug('[UPDATE-6] +page.svelte: Created base graph structure', {
                nodeCount: baseNodes.length
            });
            graphData = { nodes: baseNodes, links: [] };
        }
    }

    // Central node preparation
    $: centralNode = isReady && $userStore && (isWordView && wordData ? {
        id: wordData.id,
        type: 'word' as const,
        data: wordData,
        group: 'central' as const
    } : {
        id: $userStore.sub,
        type: view as 'dashboard' | 'edit-profile' | 'create-node',
        data: $userStore,
        group: 'central' as const
    });

    $: context = 
        view === 'dashboard' ? NavigationContext.DASHBOARD :
        view === 'create-node' ? NavigationContext.CREATE_NODE :
        isWordView ? NavigationContext.WORD :
        NavigationContext.EDIT_PROFILE;

    $: navigationNodes = getNavigationOptions(context)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Update graph data when core dependencies change
    $: {
        if (centralNode || navigationNodes || wordData) {
            console.debug('[UPDATE-7] +page.svelte: Dependencies changed, updating graph data', {
                hasCentralNode: !!centralNode,
                hasNavigationNodes: !!navigationNodes,
                hasWordData: !!wordData
            });
            updateGraphData();
        }
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
<Graph 
    bind:this={graphLayout}
    data={graphData}
    {isPreviewMode}
    {viewType}
    on:modechange
>
    <svelte:fragment let:node let:transform let:handleNodeModeChange>
        {#if isDashboardNode(node)}
            <DashboardNode 
                node={node.data} 
                {userActivity}
            />
        {:else if isEditProfileNode(node)}
            <EditProfileNode 
                node={node.data}
            />
        {:else if isCreateNodeNode(node)}
            <CreateNodeNode 
                node={node.data}
            />
        {:else if isNavigationNode(node)}
            <NavigationNode 
                option={node.data}
                transform={transform.toString()}
            />
        {:else if isWordNode(node)}
            {#if node.group === 'central'}
                {#if wordNodeMode === 'preview'}
                    <WordPreview
                        data={node.data}
                        style={wordStyle}
                        transform={transform.toString()}
                        on:modeChange={handleWordNodeModeChange}
                    />
                {:else}
                    <WordDetail
                        data={node.data}
                        style={wordStyle}
                        on:modeChange={handleWordNodeModeChange}
                    />
                {/if}
            {:else}
                <WordPreview
                    data={node.data}
                    style={wordStyle}
                    transform={transform.toString()}
                />
            {/if}
        {:else if isDefinitionNode(node) && wordData}
            {#if definitionNodeModes.get(node.id) === 'detail'}
                <DefinitionDetail
                    word={wordData.word}
                    data={node.data}
                    type={node.group === 'live-definition' ? 'live' : 'alternative'}
                    style={node.group === 'live-definition' ? liveDefinitionStyle : alternativeDefinitionStyle}
                    on:modeChange={(event) => handleDefinitionModeChange(event, node.id)}
                />
            {:else}
                <DefinitionPreview
                    word={wordData.word}
                    definition={node.data}
                    type={node.group === 'live-definition' ? 'live' : 'alternative'}
                    style={node.group === 'live-definition' ? liveDefinitionStyle : alternativeDefinitionStyle}
                    transform={transform.toString()}
                    on:modeChange={(event) => handleDefinitionModeChange(event, node.id)}
                />
            {/if}
        {/if}
    </svelte:fragment>
</Graph>
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
        width: 580px;
        height: 580px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .loading-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>