<!-- src/lib/components/graph/nodes/comment/CommentForm.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import BaseNode from '../../graph/nodes/base/BaseNode.svelte';
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
    
    // Button hover state
    let submitHovered = false;
    
    // Create unique filter ID for the glow effect
    const submitFilterId = `submit-glow-${Math.random().toString(36).slice(2)}`;
    
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
    
    function handleSubmitHover(isEnter: boolean) {
        submitHovered = isEnter;
    }
    
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && event.ctrlKey && isValid && !isSubmitting) {
            event.preventDefault();
            handleSubmit();
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
        <!-- Filter defs for glow effect -->
        <defs>
            <filter id={submitFilterId} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                <feFlood flood-color="#2ecc71" flood-opacity="0.6" result="color1"/>
                <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                
                <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                <feFlood flood-color="#2ecc71" flood-opacity="0.8" result="color2"/>
                <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                <feFlood flood-color="#2ecc71" flood-opacity="1" result="color3"/>
                <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
                
                <feMerge>
                    <feMergeNode in="shadow1"/>
                    <feMergeNode in="shadow2"/>
                    <feMergeNode in="shadow3"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        
        <!-- Title showing whether this is a reply or root comment -->
        <text
            y={-radius + 15}
            class="form-title"
            style:font-family="Inter"
            style:font-size="10px"
            style:font-weight="500"
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
                on:keydown={handleKeydown}
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
        
        <!-- Submit button with material icon -->
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <!-- svelte-ignore a11y-mouse-events-have-key-events -->
        <g 
            class="submit-button" 
            class:disabled={!isValid || isSubmitting}
            transform="translate(0, 75)"
            role="button"
            tabindex="0"
            on:click={() => isValid && !isSubmitting && handleSubmit()}
            on:keydown={(e) => e.key === 'Enter' && isValid && !isSubmitting && handleSubmit()}
            on:mouseenter={() => handleSubmitHover(true)}
            on:mouseleave={() => handleSubmitHover(false)}
            style:filter={submitHovered && isValid && !isSubmitting ? `url(#${submitFilterId})` : 'none'}
        >
            <foreignObject 
                x="-12" 
                y="-12" 
                width="24" 
                height="24" 
                class="icon-container"
            >
                <div class="icon-wrapper">
                    {#if isSubmitting}
                        <div class="loading-spinner">
                            ⟳
                        </div>
                    {:else}
                        <span 
                            class="material-symbols-outlined submit-icon"
                            style:color={submitHovered && isValid ? '#2ecc71' : 'white'}
                            style:opacity={!isValid ? '0.5' : '1'}
                        >
                            add_comment
                        </span>
                    {/if}
                </div>
            </foreignObject>
            
            {#if submitHovered && !isSubmitting && isValid}
                <text
                    y="25"
                    class="hover-text"
                    style:font-family="Inter"
                    style:font-size="10px"
                    style:font-weight="400"
                    style:fill="#2ecc71"
                >
                    Add comment
                </text>
            {/if}
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
        font-family: Inter;
        fill: rgba(255, 255, 255, 0.6);
    }
    
    .character-count.near-limit {
        fill: #ffd700;
    }
    
    .character-count.over-limit {
        fill: #ff4444;
    }
    
    .submit-button {
        cursor: pointer;
        transform-box: fill-box;
        transform-origin: center;
        outline: none;
    }
    
    .submit-button.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
    }
    
    .submit-button:focus {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: 4px;
        border-radius: 50%;
    }
    
    .icon-container {
        overflow: visible;
        outline: none;
    }
    
    .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    :global(.submit-icon) {
        font-size: 24px;
        transition: color 0.3s ease, transform 0.2s ease;
        font-variation-settings: 'FILL' 1;
    }
    
    .submit-button:hover:not(.disabled) :global(.submit-icon) {
        transform: scale(1.1);
    }
    
    .loading-spinner {
        font-size: 20px;
        animation: spin 1s linear infinite;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: white;
    }
    
    .hover-text {
        text-anchor: middle;
        dominant-baseline: middle;
        user-select: none;
        pointer-events: none;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
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
        font-family: Inter;
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
    
    :global(.form-textarea::placeholder) {
        color: rgba(255, 255, 255, 0.5);
    }
</style>