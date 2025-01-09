<!-- src/routes/graph/[view]/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserProfile } from '$lib/types/user';
    import type { UserActivity } from '$lib/services/userActivity';
    import type { GraphNode, GraphPageData, GraphEdge, EdgeType, GraphData, NodeGroup, NodeType } from '$lib/types/graph';
    import { getUserActivity } from '$lib/services/userActivity';
    import { getWordData } from '$lib/services/word';  
    import { NODE_CONSTANTS } from '$lib/components/graph/nodes/base/BaseNodeConstants';
    import Graph from '$lib/components/graph/Graph.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import WordDetail from '$lib/components/graph/nodes/word/WordDetail.svelte';
    import DefinitionPreview from '$lib/components/graph/nodes/definition/DefinitionPreview.svelte';
    import { getNavigationOptions, handleNavigation } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { isDashboardNode, isEditProfileNode, isCreateNodeNode, isWordNode, isDefinitionNode } from '$lib/types/graph';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { COLORS } from '$lib/constants/colors';
	import { getVoteValue } from '$lib/components/graph/nodes/utils/nodeUtils';

    export let data: GraphPageData;
    
    let userActivity: UserActivity | undefined;
    let isLoading = true;
    let wordNodeMode: 'preview' | 'detail' = 'preview';
 
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

    function handleWordNodeModeChange(event: CustomEvent<{ mode: 'preview' | 'detail' }>) {
        const oldMode = wordNodeMode;
        wordNodeMode = event.detail.mode;
        console.log('Word node mode transition:', {
            from: oldMode,
            to: wordNodeMode,
            view,
            isWordView
        });
    }

    async function initializeData() {
        console.log('Starting initializeData:', { 
            data,
            currentUrl: window.location.href,
            view,
            isWordView 
        });
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            if (!fetchedUser) {
                console.log('No user found, redirecting to login');
                auth0.login();
                return;
            }
            userStore.set(fetchedUser);
            userActivity = await getUserActivity();

            if (data?.wordData && isWordView) {
                console.log('Setting word data from server load:', data.wordData);
                wordStore.set(data.wordData);
            } else if (isWordView) {
                const url = new URL(window.location.href);
                const wordParam = url.searchParams.get('word');
                console.log('Checking URL for word param:', { wordParam, url: url.toString() });
                if (wordParam) {
                    console.log('Loading word data from URL param:', wordParam);
                    const loadedWord = await getWordData(wordParam);
                    if (loadedWord) {
                        console.log('Word data loaded from URL:', loadedWord);
                        wordStore.set(loadedWord);
                    }
                }
            }
        } catch (error) {
            console.error('Error in initializeData:', error);
            auth0.login();
        } finally {
            console.log('Setting isLoading to false', {
                view,
                isWordView,
                hasWordData: !!$wordStore
            });
            isLoading = false;
        }
    }

    onMount(initializeData);
 
    $: view = $page.params.view;
    $: isWordView = view === 'word' || view === 'alternative-definitions';
    $: wordData = isWordView ? $wordStore : null;

    $: isLoadingComplete = !isLoading && $userStore && (!isWordView || (isWordView && !!$wordStore));
 
    $: centralNode = isWordView && wordData ? {
        id: wordData.id,
        type: 'word' as const,
        data: wordData,
        group: 'central' as const
    } : $userStore ? {
        id: $userStore.sub,
        type: view as 'dashboard' | 'edit-profile' | 'create-node',
        data: $userStore,
        group: 'central' as const
    } : null;
 
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
        
        if (view === 'alternative-definitions' && wordData && wordData.definitions.length > 0) {
            // Sort definitions by votes (most popular first)
            const sortedDefinitions = [...wordData.definitions].sort((a, b) => 
                getVoteValue(b.votes) - getVoteValue(a.votes)
            );

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
                value: 1 + getVoteValue(definition.votes)
            }));

            return {
                nodes: [...baseNodes, ...definitionNodes],
                links: definitionLinks
            } satisfies GraphData;
        }
        
        return { nodes: baseNodes, links: [] } satisfies GraphData;
    })() : { nodes: [], links: [] } satisfies GraphData;

    $: nodes = graphData.nodes;
    $: links = graphData.links;

</script>

{#if !isLoadingComplete}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Loading...</span>
    </div>
{:else if centralNode}
    <Graph 
        nodes={graphData.nodes}
        links={graphData.links ?? []}
        isPreviewMode={view === 'alternative-definitions' && wordNodeMode === 'preview'}
    >
        <svelte:fragment slot="node" let:node>
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
            {:else if isWordNode(node)}
                {#if node.group === 'central'}
                    {#if view === 'alternative-definitions'}
                        {#if wordNodeMode === 'preview'}
                            <WordNode
                                data={node.data}
                                mode="preview"
                                transform=""
                                style={wordStyle}
                                on:modeChange={handleWordNodeModeChange}
                            />
                        {:else}
                            <WordDetail
                                data={node.data}
                                style={wordStyle}
                            />
                        {/if}
                    {:else}
                        <WordDetail
                            data={node.data}
                            style={wordStyle}
                        />
                    {/if}
                {:else}
                    <WordNode
                        data={node.data}
                        mode="preview"
                        transform=""
                        style={wordStyle}
                    />
                {/if}
            {:else if isDefinitionNode(node) && wordData}
                <DefinitionPreview
                    word={wordData.word}
                    definition={node.data}
                    type={node.group === 'live-definition' ? 'live' : 'alternative'}
                    style={node.group === 'live-definition' ? liveDefinitionStyle : alternativeDefinitionStyle}
                    transform=""
                />
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