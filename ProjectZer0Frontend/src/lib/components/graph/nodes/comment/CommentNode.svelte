<!-- src/lib/components/graph/nodes/comment/CommentNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import BaseNode from '../base/BaseNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { get } from 'svelte/store';
    import { discussionStore } from '$lib/stores/discussionStore';
    import { getVoteBasedColor, getContrastingTextColor } from '../utils/voteColorUtils';
    import ReplyButton from '../common/ReplyButton.svelte';
    import { COLORS } from '$lib/constants/colors';
    
    export let node: RenderableNode;
    export let isReply: boolean = false;
    
    // Use export const for position properties since they're only for external reference
    export const nodeX: number | undefined = undefined;
    export const nodeY: number | undefined = undefined;
    
    // We expect the comment data to have the following structure
    interface CommentData {
        id: string;
        commentText: string;
        createdBy: string;
        createdAt: string | Date;
        updatedAt?: string | Date;
        parentCommentId?: string;
        positiveVotes: number;
        negativeVotes: number;
        publicCredit?: boolean;
        childComments?: CommentData[];
        depth?: number;
    }
    
    // Type assertion for comment data
    // Cast to CommentData using type assertion
    const data = node.data as unknown as CommentData;
    
    // Helper function to handle Neo4j number format
    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    // Get user vote status from discussion store
    $: userVoteStatus = discussionStore.getUserVoteStatus(node.id);
    
    // Calculate vote counts directly from the comment data for immediate reactivity
    $: positiveVotes = getNeo4jNumber(data.positiveVotes) || 0;
    $: negativeVotes = getNeo4jNumber(data.negativeVotes) || 0;
    $: netVotes = positiveVotes - negativeVotes;
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    
    // Track replying state
    $: isReplying = $discussionStore.isAddingReply && $discussionStore.replyToCommentId === node.id;
    
    // Track voting state
    let isVoting = false;
    let voteSuccess = false;
    let lastVoteType: VoteStatus | null = null;
    
    // Calculate position for the reply button to place it where the circles just meet
    // Assuming ReplyButton has a radius of 10 (as we've set it in the updated component)
    $: buttonRadius = 10; // Match the radius we set in ReplyButton
    $: nodeRadius = node.radius || 90;
    
    // Use trigonometry to position the button at exactly 1:30 (45 degrees)
    $: replyButtonX = (nodeRadius + buttonRadius) * Math.cos(Math.PI/4); // cos(45°) = 0.7071
    $: replyButtonY = -(nodeRadius + buttonRadius) * Math.sin(Math.PI/4); // -sin(45°) = -0.7071
    
    // Define colors for the vote buttons from color constants
    const upvoteColor = COLORS.PRIMARY.GREEN;
    const downvoteColor = COLORS.PRIMARY.RED;
    
    // Create unique filter IDs for the glow effects
    const upvoteFilterId = `upvote-glow-${Math.random().toString(36).slice(2)}`;
    const downvoteFilterId = `downvote-glow-${Math.random().toString(36).slice(2)}`;
    
    const dispatch = createEventDispatcher<{
        reply: { commentId: string };
        edit: { commentId: string, text: string };
        delete: { commentId: string };
        modeChange: { 
            mode: 'preview' | 'detail'; 
            position?: { x: number; y: number } 
        };
    }>();
    
    function handleReply() {
        console.log(`[CommentNode] handleReply called for comment: ${node.id}`);
        dispatch('reply', { commentId: node.id });
        discussionStore.startReply(node.id);
    }
    
    function handleReplyButtonClick(event: CustomEvent<{ nodeId: string | undefined }>) {
        console.log(`[CommentNode] Reply button clicked for comment: ${node.id}`);
        // Forward the event to our existing handler
        handleReply();
    }
    
    // Track hover state for each vote button
    let upvoteHovered = false;
    let downvoteHovered = false;
    
    function handleUpvoteHover(isEnter: boolean) {
        upvoteHovered = isEnter;
    }
    
    function handleDownvoteHover(isEnter: boolean) {
        downvoteHovered = isEnter;
    }
    
    // Add keyboard event handler for accessibility
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === 'Space') {
            const target = event.currentTarget as HTMLElement;
            if (target.classList.contains('upvote-button')) {
                handleVote(userVoteStatus === 'agree' ? 'none' : 'agree');
            } else if (target.classList.contains('downvote-button')) {
                handleVote(userVoteStatus === 'disagree' ? 'none' : 'disagree');
            }
        }
    }
    
    // Format the creation date for display
    function formatDate(date: string | Date): string {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    async function handleVote(voteType: VoteStatus) {
        if (!get(userStore) || isVoting) return;
        
        isVoting = true;
        voteSuccess = false;
        lastVoteType = voteType;
        
        // Store original values for potential revert
        const originalPositive = data.positiveVotes;
        const originalNegative = data.negativeVotes;
        const originalVoteStatus = userVoteStatus;
        
        try {
            // Optimistic update - Update the counts directly in the comment data
            // This is similar to how WordNode does it
            if (originalVoteStatus === 'agree' && voteType !== 'agree') {
                // Removing upvote
                data.positiveVotes = Math.max(0, getNeo4jNumber(data.positiveVotes) - 1);
            }
            if (originalVoteStatus === 'disagree' && voteType !== 'disagree') {
                // Removing downvote
                data.negativeVotes = Math.max(0, getNeo4jNumber(data.negativeVotes) - 1);
            }
            if (voteType === 'agree' && originalVoteStatus !== 'agree') {
                // Adding upvote
                data.positiveVotes = getNeo4jNumber(data.positiveVotes) + 1;
            }
            if (voteType === 'disagree' && originalVoteStatus !== 'disagree') {
                // Adding downvote
                data.negativeVotes = getNeo4jNumber(data.negativeVotes) + 1;
            }
            
            // Check if this is removing current vote
            const shouldRemove = 
                (voteType === 'agree' && originalVoteStatus === 'agree') || 
                (voteType === 'disagree' && originalVoteStatus === 'disagree');
            
            // Call the store method which will also update the backend
            const success = await discussionStore.voteOnComment(node.id, shouldRemove ? 'none' : voteType);
            
            if (success) {
                // Show success animation
                voteSuccess = true;
                
                // Schedule to hide success animation after a delay
                setTimeout(() => {
                    voteSuccess = false;
                }, 1000);
            } else {
                // Revert optimistic changes on failure
                data.positiveVotes = originalPositive;
                data.negativeVotes = originalNegative;
            }
        } catch (error) {
            console.error('[CommentNode] Error voting:', error);
            // Revert optimistic changes on error
            data.positiveVotes = originalPositive;
            data.negativeVotes = originalNegative;
        } finally {
            isVoting = false;
        }
    }
    
    // Helper function to truncate text
    function truncateText(text: string, maxLength: number): string {
        if (!text) return '';
        return text.length > maxLength
            ? text.substring(0, maxLength) + '...'
            : text;
    }
    
    // Size calculations for text wrapping
    $: radius = node.radius || 90; // Default size if radius is not set
    $: textWidth = radius * 1.5; // Adjust this multiplier as needed
    $: maxCharsPerLine = Math.floor(textWidth / 5.5); // Approx characters per line

    // Text wrapping for content
    $: lines = data.commentText.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);
    
    // Calculate vote-based styling
    $: voteColor = getVoteBasedColor(netVotes);
    $: textColor = getContrastingTextColor(voteColor);
    
    // Extract color values from NODE_CONSTANTS for comment styling
    // Get base color and add different alpha values
    $: commentNodeColors = NODE_CONSTANTS.COLORS.COMMENT;
    $: baseColor = commentNodeColors.border.substring(0, 7); // First 7 chars (hex without alpha)
    
    // Define comment node color using the NODE_CONSTANTS
    $: customStyle = {
        ...node.style,
        colors: {
            background: commentNodeColors.background,
            border: commentNodeColors.border,
            text: NODE_CONSTANTS.FONTS.title.family,
            hover: commentNodeColors.hover,
            gradient: {
                start: commentNodeColors.gradient.start,
                end: commentNodeColors.gradient.end
            }
        },
        highlightColor: baseColor // Highlight in comment color
    };
    
    // Reactive declarations
    $: userName = get(userStore)?.preferred_username || get(userStore)?.name || 'Anonymous';
    $: formattedDate = formatDate(data.createdAt);
    $: creatorName = getDisplayName(data.createdBy, null, !data.publicCredit);
    
    onMount(() => {
        console.log('[CommentNode] Mounting with comment:', {
            id: node.id,
            text: data.commentText,
            positiveVotes,
            negativeVotes,
            netVotes
        });
    });
</script>

<!-- Use BaseNode with proper styling parameters, but without vote-based styling -->
<BaseNode {node} style={customStyle}>
    <svelte:fragment slot="default" let:radius>
        <!-- Filter defs for glow effects -->
        <defs>
            <!-- Upvote glow filter -->
            <filter id={upvoteFilterId} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                <feFlood flood-color={upvoteColor} flood-opacity="0.6" result="color1"/>
                <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                
                <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                <feFlood flood-color={upvoteColor} flood-opacity="0.8" result="color2"/>
                <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                <feFlood flood-color={upvoteColor} flood-opacity="1" result="color3"/>
                <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
                
                <feMerge>
                    <feMergeNode in="shadow1"/>
                    <feMergeNode in="shadow2"/>
                    <feMergeNode in="shadow3"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            
            <!-- Downvote glow filter -->
            <filter id={downvoteFilterId} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                <feFlood flood-color={downvoteColor} flood-opacity="0.6" result="color1"/>
                <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                
                <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                <feFlood flood-color={downvoteColor} flood-opacity="0.8" result="color2"/>
                <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                <feFlood flood-color={downvoteColor} flood-opacity="1" result="color3"/>
                <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
                
                <feMerge>
                    <feMergeNode in="shadow1"/>
                    <feMergeNode in="shadow2"/>
                    <feMergeNode in="shadow3"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <!-- Title -->
        <text
            y={-radius + 15}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size="10px"
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            {isReply ? 'Reply' : 'Comment'}
        </text>

        <!-- Comment text - wrapped to fit -->
        <g class="comment-text">
            {#each lines as line, i}
                <text
                    y={-15 + (i * 12)} 
                    class="comment-content"
                    style:font-family="'Orbitron', sans-serif"
                    style:font-size="9px"
                >
                    {truncateText(line, maxCharsPerLine)}
                </text>
            {/each}
        </g>
        
        <!-- Author and date -->
        <text
            y={radius - 25}
            class="metadata"
            style:font-size="7px"
        >
            {creatorName} · {formattedDate}
        </text>
        
        <!-- Vote controls with proper positioning -->
        <g class="vote-controls" transform="translate(0, {radius - 45})">
            <!-- Upvote button positioned to the left -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-mouse-events-have-key-events -->
            <g 
                class="upvote-button"
                class:active={userVoteStatus === 'agree'}
                class:disabled={isVoting}
                class:pulse={voteSuccess && lastVoteType === 'agree'}
                transform="translate(-30, 0)"
                on:click={() => !isVoting && handleVote(userVoteStatus === 'agree' ? 'none' : 'agree')}
                on:keydown={handleKeydown}
                on:mouseenter={() => handleUpvoteHover(true)}
                on:mouseleave={() => handleUpvoteHover(false)}
                tabindex="0"
                role="button"
                aria-label="Upvote comment"
                aria-pressed={userVoteStatus === 'agree'}
                style:filter={upvoteHovered || (voteSuccess && lastVoteType === 'agree') ? `url(#${upvoteFilterId})` : 'none'}
            >
                <foreignObject 
                    x="-42" 
                    y="-12" 
                    width="24" 
                    height="24" 
                    class="icon-container"
                >
                    <div 
                        class="icon-wrapper"
                        {...{"xmlns": "http://www.w3.org/1999/xhtml"}}
                    >
                        {#if isVoting && lastVoteType === 'agree'}
                            <span 
                                class="material-symbols-outlined spinning"
                                style:color={userVoteStatus === 'agree' ? upvoteColor : (upvoteHovered ? upvoteColor : 'white')}
                            >
                                sync
                            </span>
                        {:else}
                            <span 
                                class="material-symbols-outlined"
                                class:bounce={voteSuccess && lastVoteType === 'agree'}
                                style:color={userVoteStatus === 'agree' ? upvoteColor : (upvoteHovered ? upvoteColor : 'white')}
                            >
                                thumb_up
                            </span>
                        {/if}
                    </div>
                </foreignObject>
            </g>
            
            <!-- Vote count with explicit position -->
            <text
                class="vote-count"
                class:pulse={voteSuccess}
                x="0"
                y="4"
                style:font-family={NODE_CONSTANTS.FONTS.value.family}
                style:font-size="10px"
            >
                {scoreDisplay}
            </text>
            
            <!-- Downvote button positioned to the right -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-mouse-events-have-key-events -->
            <g 
                class="downvote-button"
                class:active={userVoteStatus === 'disagree'}
                class:disabled={isVoting}
                class:pulse={voteSuccess && lastVoteType === 'disagree'}
                transform="translate(30, 0)"
                on:click={() => !isVoting && handleVote(userVoteStatus === 'disagree' ? 'none' : 'disagree')}
                on:keydown={handleKeydown}
                on:mouseenter={() => handleDownvoteHover(true)}
                on:mouseleave={() => handleDownvoteHover(false)}
                tabindex="0"
                role="button"
                aria-label="Downvote comment"
                aria-pressed={userVoteStatus === 'disagree'}
                style:filter={downvoteHovered || (voteSuccess && lastVoteType === 'disagree') ? `url(#${downvoteFilterId})` : 'none'}
            >
                <foreignObject 
                    x="22" 
                    y="-12" 
                    width="24" 
                    height="24" 
                    class="icon-container"
                >
                    <div 
                        class="icon-wrapper"
                        {...{"xmlns": "http://www.w3.org/1999/xhtml"}}
                    >
                        {#if isVoting && lastVoteType === 'disagree'}
                            <span 
                                class="material-symbols-outlined spinning"
                                style:color={userVoteStatus === 'disagree' ? downvoteColor : (downvoteHovered ? downvoteColor : 'white')}
                            >
                                sync
                            </span>
                        {:else}
                            <span 
                                class="material-symbols-outlined"
                                class:bounce={voteSuccess && lastVoteType === 'disagree'}
                                style:color={userVoteStatus === 'disagree' ? downvoteColor : (downvoteHovered ? downvoteColor : 'white')}
                            >
                                thumb_down
                            </span>
                        {/if}
                    </div>
                </foreignObject>
            </g>
        </g>
        
        <!-- Add the Reply button at a position where the circles just meet -->
        <ReplyButton 
            x={replyButtonX}
            y={replyButtonY}
            nodeId={node.id}
            on:reply={handleReplyButtonClick}
        />
    </svelte:fragment>
</BaseNode>

<style>
    /* Base Text Styles */
    text {
        text-anchor: middle;
        font-family: 'Orbitron', sans-serif;
        fill: white;
        pointer-events: none;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .comment-content {
        font-size: 9px;
        fill: rgba(255, 255, 255, 0.9);
        text-anchor: middle;
    }

    .metadata {
        font-size: 7px;
        fill: rgba(255, 255, 255, 0.6);
    }

    /* Vote Controls using the NavigationNode pattern */
    .upvote-button, .downvote-button {
        cursor: pointer;
        /* Prevent any movement */
        transform: none !important;
        will-change: auto;
    }

    .upvote-button.disabled, .downvote-button.disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }

    .icon-container {
        overflow: visible;
    }

    .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.vote-controls .material-symbols-outlined) {
        font-size: 20px;
        /* Only transition color, not size */
        transition: color 0.3s ease;
    }

    /* Vote count styling */
    .vote-count {
        fill: rgba(255, 255, 255, 0.9);
    }

    /* Spinning animation for loading state */
    :global(.material-symbols-outlined.spinning) {
        animation: spin 1.5s infinite linear;
    }

    /* Bounce animation for successful vote */
    :global(.material-symbols-outlined.bounce) {
        animation: bounce 0.5s ease-in-out;
    }

    /* Pulse animation for successful vote */
    .pulse {
        animation: pulse 0.5s ease-in-out;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.3); }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
</style>