<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/editProfile/EditProfileNode.svelte -->
<script lang="ts">
    import BaseSvgDetailNode from '../base/BaseDetailNode.svelte';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { createEventDispatcher } from 'svelte';
    import { updateUserProfile } from '$lib/services/userProfile';
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';

    const dispatch = createEventDispatcher();
    
    export let node: UserProfile;
    
    const LAYOUT = {
        LEFT_ALIGN: -200,  // Single constant for left alignment
        FIELD_WIDTH: 400,  // Width of form fields
        BUTTON_WIDTH: 150, // Width for the save button
        VERTICAL_SPACING: {
            BETWEEN_FIELDS: 75,  // Space between each field group
            LABEL_TO_INPUT: 10   // Space between label and its input
        }
    };

    let preferred_username = node.preferred_username || '';
    let email = node.email || '';
    let mission_statement = node.mission_statement || '';
    let updateSuccess = false;
    let loading = false;

    const MAX_MISSION_LENGTH = 280;
    $: missionLength = mission_statement.length;
    $: isNearLimit = MAX_MISSION_LENGTH - missionLength <= 20;
    $: isOverLimit = missionLength > MAX_MISSION_LENGTH;

    const style = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    };

    async function handleUpdateUserProfile() {
        if (isOverLimit) return;
        
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
            <text 
                x={LAYOUT.LEFT_ALIGN}
                class="label"
            >
                Username:
            </text>
            <foreignObject 
                x={LAYOUT.LEFT_ALIGN} 
                y={LAYOUT.VERTICAL_SPACING.LABEL_TO_INPUT} 
                width={LAYOUT.FIELD_WIDTH} 
                height="40"
            >
                <input
                    type="text"
                    bind:value={preferred_username}
                    placeholder="Enter username"
                    class="input"
                />
            </foreignObject>
 
            <text 
                x={LAYOUT.LEFT_ALIGN}
                y={LAYOUT.VERTICAL_SPACING.BETWEEN_FIELDS}
                class="label"
            >
                Email:
            </text>
            <foreignObject 
                x={LAYOUT.LEFT_ALIGN} 
                y={LAYOUT.VERTICAL_SPACING.BETWEEN_FIELDS + LAYOUT.VERTICAL_SPACING.LABEL_TO_INPUT} 
                width={LAYOUT.FIELD_WIDTH} 
                height="40"
            >
                <input
                    type="email"
                    bind:value={email}
                    placeholder="Enter email"
                    class="input"
                />
            </foreignObject>
 
            <text 
                x={LAYOUT.LEFT_ALIGN}
                y={LAYOUT.VERTICAL_SPACING.BETWEEN_FIELDS * 2}
                class="label"
            >
                Mission Statement:
            </text>
            <foreignObject 
                x={LAYOUT.LEFT_ALIGN} 
                y={LAYOUT.VERTICAL_SPACING.BETWEEN_FIELDS * 2 + LAYOUT.VERTICAL_SPACING.LABEL_TO_INPUT} 
                width={LAYOUT.FIELD_WIDTH} 
                height="150"
            >
                <textarea
                    bind:value={mission_statement}
                    placeholder="Enter mission statement"
                    class="textarea"
                    maxlength={MAX_MISSION_LENGTH}
                />
            </foreignObject>
 
            <!-- Character Count -->
            <text
                x={LAYOUT.LEFT_ALIGN + LAYOUT.FIELD_WIDTH}
                y={LAYOUT.VERTICAL_SPACING.BETWEEN_FIELDS * 2 + 145}
                class="character-count"
                class:near-limit={isNearLimit}
                class:over-limit={isOverLimit}
            >
                {MAX_MISSION_LENGTH - missionLength} characters remaining
            </text>
 
            <!-- Save Button -->
            <foreignObject 
                x={-LAYOUT.BUTTON_WIDTH / 2} 
                y={LAYOUT.VERTICAL_SPACING.BETWEEN_FIELDS * 2 + 190} 
                width={LAYOUT.BUTTON_WIDTH} 
                height="40"
            >
                <button
                    class="save-button"
                    on:click={handleUpdateUserProfile}
                    disabled={loading || isOverLimit}
                >
                    {#if loading}
                        Loading...
                    {:else}
                        Save Changes
                    {/if}
                </button>
            </foreignObject>
 
            {#if updateSuccess}
                <text
                    x="0"
                    y={LAYOUT.VERTICAL_SPACING.BETWEEN_FIELDS * 2 + 190}
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
 
    .label {
        font-size: 14px;
        text-anchor: start;
        fill: rgba(255, 255, 255, 0.7);
    }
 
    .success {
        font-size: 14px;
        text-anchor: middle;
        fill: #4CAF50;
    }
 
    .character-count {
        font-size: 12px;
        text-anchor: end;
        fill: rgba(255, 255, 255, 0.6);
    }
 
    .character-count.near-limit {
        fill: #ffd700;
    }
 
    .character-count.over-limit {
        fill: #ff4444;
    }
 
    :global(input.input), :global(textarea.textarea) {
        width: 100%;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
    }
 
    :global(input.input:focus), :global(textarea.textarea:focus) {
        outline: none;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
 
    :global(textarea.textarea) {
        height: 120px;
        resize: none;
        margin-bottom: 0;
    }
 
    :global(button.save-button) {
        width: 100%;
        background: rgba(74, 144, 226, 0.3);
        border: 1px solid rgba(74, 144, 226, 0.4);
        border-radius: 4px;
        color: white;
        padding: 8px 16px;
        cursor: pointer;
        font-family: 'Orbitron', sans-serif;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 100px;
        box-sizing: border-box;
        margin: 0;
    }
 
    :global(button.save-button:hover:not(:disabled)) {
        transform: translateY(-1px);
        background: rgba(74, 144, 226, 0.4);
    }
 
    :global(button.save-button:active:not(:disabled)) {
        transform: translateY(0);
    }
 
    :global(button.save-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
 </style>