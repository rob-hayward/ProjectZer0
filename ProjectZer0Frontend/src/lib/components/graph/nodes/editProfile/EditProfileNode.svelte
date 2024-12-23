<!-- src/lib/components/graph/nodes/editProfile/EditProfileNode.svelte -->
<script lang="ts">
    import BaseSvgDetailNode from '../base/BaseDetailNode.svelte';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { createEventDispatcher } from 'svelte';
    import { updateUserProfile } from '$lib/services/userProfile';
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';
    
    import UsernameInput from '$lib/components/forms/editProfile/UsernameInput.svelte';
    import EmailInput from '$lib/components/forms/editProfile/EmailInput.svelte';
    import MissionStatementInput from '$lib/components/forms/editProfile/MissionStatementInput.svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import SaveButton from '$lib/components/forms/editProfile/SaveButton.svelte';
    
    export let node: UserProfile;
    
    let preferred_username = node.preferred_username || '';
    let email = node.email || '';
    let mission_statement = node.mission_statement || '';
    let updateSuccess = false;
    let loading = false;

    const style = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    };

    async function handleUpdateUserProfile() {
        loading = true;
        try {
            const updatedUser = await updateUserProfile({
                sub: node.sub,
                preferred_username,
                email,
                mission_statement
            });

            if (updatedUser) {
                userStore.set(updatedUser);
                updateSuccess = true;
                setTimeout(() => goto('/graph/dashboard'), 2000);
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
        } finally {
            loading = false;
        }
    }
</script>

<BaseSvgDetailNode {style}>
    <svelte:fragment let:radius let:isHovered>
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
</BaseSvgDetailNode>

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