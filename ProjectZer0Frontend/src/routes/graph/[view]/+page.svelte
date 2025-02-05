<!-- src/routes/graph/[view]/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserActivity } from '$lib/services/userActivity';
    import { getUserActivity } from '$lib/services/userActivity';
    import { getWordData } from '$lib/services/word';  
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import Graph from '$lib/components/graph/Graph.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import WordPreview from '$lib/components/graph/nodes/word/WordPreview.svelte';
    import WordDetail from '$lib/components/graph/nodes/word/WordDetail.svelte';
    import DefinitionPreview from '$lib/components/graph/nodes/definition/DefinitionPreview.svelte';
    import { getNavigationOptions } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { COLORS } from '$lib/constants/colors';
    import { getNetVotes } from '$lib/components/graph/nodes/utils/nodeUtils';
    import DefinitionDetail from '$lib/components/graph/nodes/definition/DefinitionDetail.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import type { GraphNode, GraphPageData, GraphEdge, EdgeType, GraphData, NodeGroup, NodeType, ViewType } from '$lib/types/graph/core';
    import { isDashboardNode, isEditProfileNode, isCreateNodeNode, isWordNode, 
        isDefinitionNode, isNavigationNode } from '$lib/types/graph/core';
    
    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let userActivity: UserActivity | undefined;
    let graphLayout: Graph;
    let definitionNodeModes: Map<string, 'preview' | 'detail'> = new Map();

    $: viewType = view as ViewType;
    
    // State debugging
    $: console.log('Auth State:', {
        authInitialized,
        dataInitialized,
        hasUser: !!$userStore,
        view,
        data
    });

    // Word node mode handling
    $: wordNodeMode = $page ? 
        ($page.params.view === 'word' ? 'detail' : 'preview')
        : 'preview';

    // Styles
    const wordStyle = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.preview,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: COLORS.PRIMARY.BLUE
    };

    const liveDefinitionStyle = {
        previewSize: NODE_CONSTANTS.SIZES.DEFINITION.live.preview,
        detailSize: NODE_CONSTANTS.SIZES.DEFINITION.live.detail,
        colors: NODE_CONSTANTS.COLORS.DEFINITION.live,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: COLORS.PRIMARY.BLUE  
    };

    const alternativeDefinitionStyle = {
        previewSize: NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview,
        detailSize: NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail,
        colors: NODE_CONSTANTS.COLORS.DEFINITION.alternative,
        padding: NODE_CONSTANTS.PADDING,
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
        console.log('Starting initializeData');
        try {
            // Handle auth first
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            console.log('Auth check complete:', { hasUser: !!fetchedUser });
            
            if (!fetchedUser) {
                console.log('No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            authInitialized = true;
            userStore.set(fetchedUser);
            
            // Once auth is confirmed, fetch activity
            userActivity = await getUserActivity();
            
            // Handle word data if needed
            if (view === 'word') {
                const wordParam = new URL(window.location.href).searchParams.get('word');
                if (wordParam) {
                    const loadedWord = await getWordData(wordParam);
                    if (loadedWord) {
                        wordStore.set(loadedWord);
                    }
                }
            }
            
            dataInitialized = true;
            console.log('Data initialization complete', {
                hasUser: !!fetchedUser,
                hasActivity: !!userActivity,
                view
            });
        } catch (error) {
            console.error('Error in initializeData:', error);
            auth0.login();
        }
    }

    onMount(initializeData);

    // View and data reactivity
    $: view = $page.params.view;
    $: isWordView = view === 'word' || view === 'alternative-definitions';
    $: wordData = isWordView ? $wordStore : null;
    $: isReady = authInitialized && dataInitialized;

    // Event handlers
    function handleWordNodeModeChange(event: CustomEvent<{ mode: 'preview' | 'detail' }>) {
        console.log('Word node mode change:', event.detail);
        wordNodeMode = event.detail.mode;
    }

    function handleDefinitionModeChange(event: CustomEvent<{ mode: 'preview' | 'detail' }>, nodeId: string) {
        console.log('Definition mode change:', { nodeId, newMode: event.detail.mode });
        definitionNodeModes.set(nodeId, event.detail.mode);
        definitionNodeModes = new Map(definitionNodeModes);
    }

    // Graph data preparation
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

    $: graphData = centralNode ? (() => {
        const baseNodes = [centralNode, ...navigationNodes] as GraphNode[];
        
        if (wordData && wordData.definitions.length > 0) {
            const sortedDefinitions = [...wordData.definitions].sort((a, b) => 
                getNetVotes(b) - getNetVotes(a)
            );

            if (view === 'word') {
                const definitionNodes: GraphNode[] = sortedDefinitions.map((definition, index) => ({
                    id: definition.id,
                    type: 'definition' as NodeType,
                    data: definition,
                    group: (index === 0 ? 'live-definition' : 'alternative-definition') as NodeGroup
                }));

                const definitionLinks: GraphEdge[] = sortedDefinitions.map((definition, index) => ({
                    source: centralNode.id,
                    target: definition.id,
                    type: (index === 0 ? 'live' : 'alternative') as EdgeType,
                    value: 1 + Math.abs(getNetVotes(definition))
                }));

                return {
                    nodes: [...baseNodes, ...definitionNodes],
                    links: definitionLinks
                } satisfies GraphData;
            }
        }
        
        return { nodes: baseNodes, links: [] } satisfies GraphData;
    })() : { nodes: [], links: [] } satisfies GraphData;

    $: nodes = graphData.nodes;
    $: links = graphData.links;
</script>

{#if !isReady}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Initializing...</span>
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
    on:modeChange
>
    <svelte:fragment let:node let:transform>
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