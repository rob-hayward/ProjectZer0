<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserProfile } from '$lib/types/user';
    import type { UserActivity } from '$lib/services/userActivity';
    import type { GraphNode, GraphPageData } from '$lib/types/graph';
    import { getUserActivity } from '$lib/services/userActivity';
    import { getWordData } from '$lib/services/word';  // Add this line
    import { NODE_CONSTANTS } from '$lib/components/graph/nodes/base/BaseNodeConstants';
    import Graph from '$lib/components/graph/Graph.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import WordDetail from '$lib/components/graph/nodes/word/WordDetail.svelte';
    import { getNavigationOptions, handleNavigation } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { isDashboardNode, isEditProfileNode, isCreateNodeNode, isWordNode } from '$lib/types/graph';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { COLORS } from '$lib/constants/colors';

    export let data: GraphPageData;
 
    let userActivity: UserActivity | undefined;
    let isLoading = true;
 
    const wordStyle = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.preview,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: COLORS.PRIMARY.BLUE
    };

 // Inside initializeData function in +page.svelte
async function initializeData() {
    console.log('Starting initializeData with data:', data);
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

        // If we got word data from the server during load, set it in the store
        if (data?.wordData && isWordView) {
            console.log('Setting word data from server load:', data.wordData);
            wordStore.set(data.wordData, view as 'word' | 'alternative-definitions');
        } else if (isWordView) {
            // If we're in a word view but don't have data, try to load from URL
            const url = new URL(window.location.href);
            const wordParam = url.searchParams.get('word');
            if (wordParam) {
                console.log('Loading word data from URL param:', wordParam);
                const loadedWord = await getWordData(wordParam);
                if (loadedWord) {
                    wordStore.set(loadedWord, view as 'word' | 'alternative-definitions');
                }
            }
        }
    } catch (error) {
        console.error('Error in initializeData:', error);
        auth0.login();
    } finally {
        console.log('Setting isLoading to false');
        isLoading = false;
    }
}

    onMount(initializeData);
 
    $: view = $page.params.view;
    $: isWordView = view === 'word' || view === 'alternative-definitions';
    $: wordData = isWordView ? $wordStore : null;

    // Update store when word data changes
    $: {
        if (wordData && isWordView && view) {
            wordStore.set(wordData, view as 'word' | 'alternative-definitions');
        }
    }
    
    // Loading state that considers both user and word data
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
 
    $: nodes = centralNode ? [centralNode, ...navigationNodes] : [];

    // Debug logging
    $: {
        console.log('State update:', {
            view,
            isLoading,
            hasUser: !!$userStore,
            isWordView,
            hasWordData: !!$wordStore,
            isLoadingComplete,
            wordData: wordData,
            loadedData: data?.wordData
        });
    }
</script>

{#if !isLoadingComplete}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Loading...</span>
    </div>
{:else if centralNode}
    <Graph 
        nodes={nodes}
        isPreviewMode={view === 'alternative-definitions'}
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
                        <WordNode
                            data={node.data}
                            mode="preview"
                            transform=""
                            style={wordStyle}
                        />
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
        width: 40px;
        height: 40px;
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