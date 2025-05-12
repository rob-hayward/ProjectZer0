<!-- src/lib/components/graph/nodes/comment/CommentForm.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import BaseNode from '../base/BaseNode.svelte';
    import { userStore } from '$lib/stores/userStore';
    import { discussionStore } from '$lib/stores/discussionStore';
    
    export let node: RenderableNode;
    export let parentCommentId: string | null = null;
    export let isReply: boolean = !!parentCommentId;
    
    let commentText = '';
    let isSubmitting = false;
    let charCount = 0;
    const MAX_CHARS = 500;
    
    // For form validation
    let isValid = false;
    
    const dispatch = createEventDispatcher<{
        submit: { 
            text: string; 
            parentId: string | null; // Changed from string | undefined to string | null
        };
        cancel: void;
    }>();
    
    // Calculate character count and validity
    $: {
        charCount = commentText.length;
        isValid = commentText.trim().length > 0 && charCount <= MAX_CHARS;
    }
    
    // Extract color values from NODE_CONSTANTS for styling
    $: commentNodeColors = NODE_CONSTANTS.COLORS.COMMENT;
    $: baseColor = commentNodeColors.border.substring(0, 7); // First 7 chars (hex without alpha)
    
    // Define custom style using NODE_CONSTANTS
    $: customStyle = {
        ...node.style,
        colors: {
            background: commentNodeColors.background,
            border: commentNodeColors.border,
            text: commentNodeColors.text,
            hover: commentNodeColors.hover,
            gradient: {
                start: commentNodeColors.gradient.start,
                end: commentNodeColors.gradient.end
            }
        },
        highlightColor: baseColor
    };
    
    // Extract base colors for button styling
    $: successColor = NODE_CONSTANTS.COLORS.STATEMENT.border.substring(0, 7); // Green color for submit
    $: errorColor = '#e74c3c'; // Red color for cancel
    
    // Derived button styling
    $: submitBgColor = `${successColor}33`; // 20% opacity
    $: submitBorderColor = `${successColor}66`; // 40% opacity 
    $: submitBgHoverColor = `${successColor}4D`; // 30% opacity
    $: submitBorderHoverColor = `${successColor}99`; // 60% opacity
    
    $: cancelBgColor = `${errorColor}33`; // 20% opacity
    $: cancelBorderColor = `${errorColor}66`; // 40% opacity
    $: cancelBgHoverColor = `${errorColor}4D`; // 30% opacity
    $: cancelBorderHoverColor = `${errorColor}99`; // 60% opacity
    
    function handleSubmit() {
        if (!isValid || isSubmitting) return;
        
        isSubmitting = true;
        
        dispatch('submit', {
            text: commentText,
            parentId: parentCommentId
        });
        
        // Reset form
        commentText = '';
    }
    
    function handleCancel() {
        dispatch('cancel');
        commentText = '';
        discussionStore.cancelAddingComment();
    }
    
    onMount(() => {
        console.log('[CommentFormNode] Mounting with parent:', parentCommentId);
    });
</script>

<BaseNode {node} style={customStyle}>
    <svelte:fragment slot="default" let:radius>
        <!-- Title -->
        <text
            y={-radius + 20}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size="12px"
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            {isReply ? 'Add Reply' : 'Add Comment'}
        </text>

        <!-- Comment form -->
        <foreignObject 
            x={-radius + 40} 
            y={-radius/2} 
            width={radius*2 - 80} 
            height={radius - 100}
        >
            <div class="form-container">
                <textarea 
                    class="comment-textarea" 
                    bind:value={commentText}
                    placeholder={isReply ? "Write your reply..." : "Write your comment..."}
                    maxlength={MAX_CHARS}
                ></textarea>
                
                <div class="char-counter" class:near-limit={charCount > MAX_CHARS * 0.9}>
                    {charCount}/{MAX_CHARS}
                </div>
                
                <div class="form-controls">
                    <button 
                        class="form-button submit" 
                        on:click={handleSubmit}
                        disabled={!isValid || isSubmitting}
                        style="background-color: {submitBgColor}; border-color: {submitBorderColor};"
                    >
                        {isSubmitting ? 'Submitting...' : isReply ? 'Reply' : 'Comment'}
                    </button>
                    
                    <button 
                        class="form-button cancel" 
                        on:click={handleCancel}
                        style="background-color: {cancelBgColor}; border-color: {cancelBorderColor};"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </foreignObject>
        
        <!-- User info -->
        <g transform="translate(0, {radius - 40})">
            <text class="user-info">
                Posting as: {$userStore?.preferred_username || $userStore?.name || 'Anonymous'}
            </text>
        </g>
    </svelte:fragment>
</BaseNode>

<style>
    .title {
        fill: rgba(255, 255, 255, 0.7);
        text-anchor: middle;
    }
    
    .user-info {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.6);
        text-anchor: middle;
    }
    
    :global(.form-container) {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: rgba(0, 0, 0, 0.6);
        border-radius: 8px;
        padding: 8px;
    }
    
    :global(.comment-textarea) {
        width: 100%;
        height: 120px;
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        resize: none;
    }
    
    :global(.char-counter) {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        text-align: right;
        margin-top: 4px;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.char-counter.near-limit) {
        color: rgba(231, 76, 60, 0.9);
    }
    
    :global(.form-controls) {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
    }
    
    :global(.form-button) {
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 6px 12px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    :global(.form-button:hover:not(:disabled)) {
        transform: translateY(-1px);
    }
    
    /* Dynamic hover styles for buttons - handled inline with style attributes */
    
    :global(.form-button.submit:hover:not(:disabled)) {
        background-color: var(--submit-bg-hover-color);
        border-color: var(--submit-border-hover-color);
    }
    
    :global(.form-button.cancel:hover) {
        background-color: var(--cancel-bg-hover-color);
        border-color: var(--cancel-border-hover-color);
    }
    
    :global(.form-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

<!-- CSS variables for hover effects -->
<div style="display:none;
            --submit-bg-hover-color:{submitBgHoverColor};
            --submit-border-hover-color:{submitBorderHoverColor};
            --cancel-bg-hover-color:{cancelBgHoverColor};
            --cancel-border-hover-color:{cancelBorderHoverColor};">
</div>