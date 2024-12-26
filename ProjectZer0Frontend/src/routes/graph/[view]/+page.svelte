<!-- ProjectZer0Frontend/src/routes/graph/[view]/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserProfile } from '$lib/types/user';
    import type { UserActivity } from '$lib/services/userActivity';
    import type { GraphNode } from '$lib/types/graph';
    import { getUserActivity } from '$lib/services/userActivity';
    import { NODE_CONSTANTS } from '$lib/components/graph/nodes/base/BaseNodeConstants';
    import Graph from '$lib/components/graph/Graph.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import SvgWordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import SvgWordDetail from '$lib/components/graph/nodes/word/WordDetail.svelte';
    import { getNavigationOptions, handleNavigation } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { isDashboardNode, isEditProfileNode, isCreateNodeNode, isWordNode } from '$lib/types/graph';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
	import { COLORS } from '$lib/constants/colors';
 
    let userActivity: UserActivity | undefined;
 
    const wordStyle = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: COLORS.PRIMARY.BLUE
    };

    onMount(async () => {
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            if (!fetchedUser) {
                auth0.login();
                return;
            }
            userStore.set(fetchedUser);
            userActivity = await getUserActivity();
        } catch (error) {
            console.error('Error fetching user data:', error);
            auth0.login();
        }
    });
 
    $: view = $page.params.view;
    $: wordData = view === 'word' ? $wordStore : null;
 
    $: centralNode = view === 'word' && wordData ? {
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
        view === 'word' ? NavigationContext.WORD :
        NavigationContext.EDIT_PROFILE;
 
    $: navigationNodes = getNavigationOptions(context)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));
 
    $: nodes = centralNode ? [centralNode, ...navigationNodes] : [];
</script>
 
{#if centralNode}
    <Graph nodes={nodes}>
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
                    <SvgWordDetail
                        data={node.data}
                        style={wordStyle}
                    />
                {:else}
                    <SvgWordNode
                        data={node.data}
                        mode="preview"
                        transform=""
                    />
                {/if}
            {/if}
        </svelte:fragment>
    </Graph>
{/if}