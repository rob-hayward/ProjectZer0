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
    const MAX_CHARS = 280; // Match backend limit (Twitter-length)
    
    // For form validation
    let isValid = false;
    
    const dispatch = createEventDispatcher<{
        submit: { 
            text: string; 
            parentId: string | null; 
        };
        cancel: void;
    }>();
    
    // CRITICAL FIX: Extract parentCommentId from multiple sources
    $: actualParentId = parentCommentId 
        || node.metadata?.parentCommentId 
        || (node.data && 'parentCommentId' in node.data ? (node.data as any).parentCommentId : null);
    
    // Update isReply based on actual parent ID
    $: isReply = !!actualParentId;
    
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
    
    function handleSubmit() {
        if (!isValid || isSubmitting) return;
        
        isSubmitting = true;
        
        console.log('[CommentForm] Submitting with parentId:', actualParentId);
        
        // CRITICAL FIX: Use actualParentId instead of parentCommentId
        dispatch('submit', {
            text: commentText,
            parentId: actualParentId
        });
        
        // Reset form
        commentText = '';
    }
    
    function handleCancel() {
        dispatch('cancel');
        commentText = '';
        discussionStore.cancelAddingComment();
    }
    
    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > MAX_CHARS) {
            commentText = textarea.value.slice(0, MAX_CHARS);
        }
    }
    
    onMount(() => {
        console.log('[CommentFormNode] Mounting with:', {
            nodeId: node.id,
            parentCommentId: parentCommentId,
            nodeMetadataParent: node.metadata?.parentCommentId,
            nodeDataParent: node.data && 'parentCommentId' in node.data ? (node.data as any).parentCommentId : 'none',
            actualParentId: actualParentId,
            isReply: isReply
        });
    });
</script>

<BaseNode {node} style={customStyle}>
    <svelte:fragment slot="default" let:radius>
        <!-- Title showing whether this is a reply or root comment -->
        <text
            y={-radius + 15}
            class="form-title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size="10px"
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            {isReply ? `Reply to Comment` : 'New Comment'}
        </text>
        
        <!-- Text input area - positioned higher and made wider -->
        <foreignObject
            x={-radius + 20}
            y={-radius/2 - 10}
            width={radius*2 - 40}
            height={110}
        >
            <textarea
                class="form-textarea"
                bind:value={commentText}
                on:input={handleInput}
                placeholder={isReply ? "Write your reply..." : "Write your comment..."}
                disabled={isSubmitting}
                maxlength={MAX_CHARS}
            ></textarea>
        </foreignObject>
        
        <!-- Character counter - repositioned -->
        <text
            x={radius - 20}
            y={-radius/2 + 95}
            class="character-count"
            class:near-limit={commentText.length > MAX_CHARS * 0.9}
            class:over-limit={commentText.length > MAX_CHARS}
            text-anchor="end"
        >
            {MAX_CHARS - commentText.length} characters remaining
        </text>
        
        <!-- Button container - side by side -->
        <g transform="translate(0, 75)">
            <!-- Cancel button -->
            <g 
                class="button cancel-button"
                transform="translate(-35, 0)"
                role="button"
                tabindex="0"
                on:click={handleCancel}
                on:keydown={(e) => e.key === 'Enter' && handleCancel()}
            >
                <rect
                    x={-25}
                    y={-15}
                    width={50}
                    height={20}
                    rx="4"
                    ry="4"
                    class="button-bg cancel-bg"
                />
                <text
                    y="0"
                    class="button-text"
                    text-anchor="middle"
                >
                    Cancel
                </text>
            </g>
            
            <!-- Submit button -->
            <g 
                class="button submit-button" 
                class:disabled={!isValid || isSubmitting}
                transform="translate(35, 0)"
                role="button"
                tabindex="0"
                on:click={() => isValid && !isSubmitting && handleSubmit()}
                on:keydown={(e) => e.key === 'Enter' && isValid && !isSubmitting && handleSubmit()}
            >
                <rect
                    x={-25}
                    y={-15}
                    width={50}
                    height={20}
                    rx="4"
                    ry="4"
                    class="button-bg submit-bg"
                />
                <text
                    y="0"
                    class="button-text"
                    text-anchor="middle"
                >
                    {isSubmitting ? 'Sending...' : isReply ? 'Reply' : 'Comment'}
                </text>
            </g>
        </g>
    </svelte:fragment>
</BaseNode>

<style>
    .form-title {
        fill: rgba(255, 255, 255, 0.8);
        text-anchor: middle;
    }
    
    .character-count {
        font-size: 8px;
        font-family: 'Orbitron', sans-serif;
        fill: rgba(255, 255, 255, 0.6);
    }
    
    .character-count.near-limit {
        fill: #ffd700;
    }
    
    .character-count.over-limit {
        fill: #ff4444;
    }
    
    .button {
        cursor: pointer;
    }
    
    .button.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
    }
    
    .button-bg {
        fill: rgba(0, 0, 0, 0.5);
        stroke-width: 1;
    }
    
    .submit-bg {
        stroke: rgba(46, 204, 113, 0.6);
        fill: rgba(46, 204, 113, 0.2);
    }
    
    .cancel-bg {
        stroke: rgba(231, 76, 60, 0.6);
        fill: rgba(231, 76, 60, 0.2);
    }
    
    .button-text {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.9);
        font-family: 'Orbitron', sans-serif;
    }
    
    .submit-button:hover:not(.disabled) .submit-bg {
        fill: rgba(46, 204, 113, 0.3);
        stroke: rgba(46, 204, 113, 0.8);
    }
    
    .cancel-button:hover .cancel-bg {
        fill: rgba(231, 76, 60, 0.3);
        stroke: rgba(231, 76, 60, 0.8);
    }
    
    /* Textarea styling */
    :global(.form-textarea) {
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        transition: all 0.2s ease;
        box-sizing: border-box;
        resize: none;
    }
    
    :global(.form-textarea:focus) {
        outline: none;
        border: 2px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    }
    
    :global(.form-textarea:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>