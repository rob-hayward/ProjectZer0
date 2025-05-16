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
            parentId: string | null; 
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
    
    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > MAX_CHARS) {
            commentText = textarea.value.slice(0, MAX_CHARS);
        }
    }
    
    onMount(() => {
        console.log('[CommentFormNode] Mounting with parent:', parentCommentId);
    });
</script>

<BaseNode {node} style={customStyle}>
    <svelte:fragment slot="default" let:radius>
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
        
        <!-- Button container - move buttons closer together -->
        <g transform="translate(34, 75)">
            <!-- Submit button - smaller width -->
            <g 
                class="button submit-button" 
                class:disabled={!isValid || isSubmitting}
                transform="translate({-35}, 0)"
                role="button"
                tabindex="0"
                on:click={() => isValid && !isSubmitting && handleSubmit()}
                on:keydown={(e) => e.key === 'Enter' && isValid && !isSubmitting && handleSubmit()}
            >
                <rect
                    x={-35}
                    y={-15}
                    width={70}
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
                    {isSubmitting ? 'Submitting...' : isReply ? 'Reply' : 'Comment'}
                </text>
            </g>
        </g>
    </svelte:fragment>
</BaseNode>

<style>
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
    
    .button-text {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.9);
        font-family: 'Orbitron', sans-serif;
    }
    
    .submit-button:hover:not(.disabled) .submit-bg {
        fill: rgba(46, 204, 113, 0.3);
        stroke: rgba(46, 204, 113, 0.8);
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