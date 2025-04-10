<!-- src/lib/components/graph/nodes/editProfile/EditProfileNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { COORDINATE_SPACE } from '../../../../constants/graph';
    import { updateUserProfile } from '$lib/services/userProfile';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore'; // Add graphStore import
    
    import UsernameInput from '$lib/components/forms/editProfile/UsernameInput.svelte';
    import EmailInput from '$lib/components/forms/editProfile/EmailInput.svelte';
    import MissionStatementInput from '$lib/components/forms/editProfile/MissionStatementInput.svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import SaveButton from '$lib/components/forms/editProfile/SaveButton.svelte';
    
    export let node: RenderableNode;

    // Type guard for user profile data
    if (!isUserProfileData(node.data)) {
        throw new Error('Invalid node data type for EditProfileNode');
    }
    
    const userData = node.data;
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();
    
    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', event.detail);
    }
    
    let preferred_username = userData.preferred_username || '';
    let email = userData.email || '';
    let mission_statement = userData.mission_statement || '';
    let updateSuccess = false;
    let loading = false;

    // Correctly reference coordinate space constants
    const style = {
        previewSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        detailSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: {
            preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
            detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
        },
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    };

    async function handleUpdateUserProfile() {
        loading = true;
        try {
            const updatedUser = await updateUserProfile({
                sub: userData.sub,
                preferred_username,
                email,
                mission_statement
            });

            if (updatedUser) {
                // Update user store with updated profile
                userStore.set(updatedUser);
                
                // Update success flag for UI feedback
                updateSuccess = true;
                
                // CRITICAL FIX 1: Update graph store to dashboard view type
                if (graphStore && graphStore.setViewType) {
                    console.log('[EditProfile] Updating graph store to dashboard view');
                    graphStore.setViewType('dashboard');
                    
                    // Force immediate visual update if available
                    if (graphStore.forceTick) {
                        try {
                            graphStore.forceTick();
                        } catch (e) {
                            console.warn('[EditProfile] Error forcing tick:', e);
                        }
                    }
                }
                
                // CRITICAL FIX 2: Use direct navigation instead of goto
                setTimeout(() => {
                    console.log('[EditProfile] Navigating to dashboard');
                    window.location.href = '/graph/dashboard';
                }, 1500); // Keep a shorter timeout for better UX
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
        } finally {
            loading = false;
        }
    }
</script>

<BaseDetailNode {node} {style} on:modeChange={handleModeChange}>
    <svelte:fragment slot="default" let:radius>
        <!-- Title -->
        <text 
            dy={-radius + 120} 
            class="title"
        >
            Edit Profile
        </text>

        <!-- Form Fields -->
        <g transform="translate(0, {-radius + 150})">
            <UsernameInput
                bind:username={preferred_username}
                disabled={loading}
            />

            <EmailInput
                bind:email
                disabled={loading}
            />

            <MissionStatementInput
                bind:statement={mission_statement}
                disabled={loading}
            />

            <SaveButton
                loading={loading}
                disabled={loading}
                onClick={handleUpdateUserProfile}
            />

            {#if updateSuccess}
                <text
                    x="0"
                    y={FORM_STYLES.layout.verticalSpacing.betweenFields * 2 + 190}
                    class="success"
                >
                    Profile updated successfully! Redirecting...
                </text>
            {/if}
        </g>
    </svelte:fragment>
</BaseDetailNode>

<style>
    .title {
        font-size: 30px;
        text-anchor: middle;
        fill: white;
    }

    .success {
        font-size: 14px;
        text-anchor: middle;
        fill: var(--success-color, #4CAF50);
    }
</style>