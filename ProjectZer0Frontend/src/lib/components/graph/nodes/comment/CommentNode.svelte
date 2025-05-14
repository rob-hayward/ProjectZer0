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
    
    // Get vote data from discussion store
    $: voteData = discussionStore.getVoteData(node.id);
    $: userVoteStatus = discussionStore.getUserVoteStatus(node.id);
    $: positiveVotes = voteData.positiveVotes || 0;
    $: negativeVotes = voteData.negativeVotes || 0;
    $: netVotes = voteData.netVotes || 0;
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    
    // Track replying state
    $: isReplying = $discussionStore.isAddingReply && $discussionStore.replyToCommentId === node.id;
    
    // Track voting state
    let isVoting = false;
    
    // Calculate position for the reply button to place it where the circles just meet
    // Assuming ReplyButton has a radius of 10 (as we've set it in the updated component)
    $: buttonRadius = 10; // Match the radius we set in ReplyButton
    $: nodeRadius = node.radius || 90;
    
    // Use trigonometry to position the button at exactly 1:30 (45 degrees)
    $: replyButtonX = (nodeRadius + buttonRadius) * Math.cos(Math.PI/4); // cos(45°) = 0.7071
    $: replyButtonY = -(nodeRadius + buttonRadius) * Math.sin(Math.PI/4); // -sin(45°) = -0.7071
    
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
    
    // Add keyboard event handler for accessibility
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === 'Space') {
            const target = event.currentTarget as HTMLElement;
            if (target.classList.contains('vote-button')) {
                const voteType = target.classList.contains('upvote') ? 
                    (userVoteStatus === 'agree' ? 'none' : 'agree') : 
                    (userVoteStatus === 'disagree' ? 'none' : 'disagree');
                handleVote(voteType);
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
        
        try {
            // Check if this is removing current vote
            const shouldRemove = 
                (voteType === 'agree' && userVoteStatus === 'agree') || 
                (voteType === 'disagree' && userVoteStatus === 'disagree');
            
            if (shouldRemove) {
                // Remove vote
                await discussionStore.voteOnComment(node.id, 'none');
            } else {
                // Add/update vote
                await discussionStore.voteOnComment(node.id, voteType);
            }
        } catch (error) {
            console.error('[CommentNode] Error voting:', error);
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
    
    // CSS variables for button styling
    $: buttonBgColor = `${baseColor}33`; // 20% opacity
    $: buttonStrokeColor = `${baseColor}66`; // 40% opacity
    $: buttonBgHoverColor = `${baseColor}4D`; // 30% opacity
    $: buttonStrokeHoverColor = `${baseColor}99`; // 60% opacity
    
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
        
        <!-- Vote controls -->
        <g class="vote-controls" transform="translate(0, {radius - 45})">
            <!-- Upvote button -->
            <g 
                class="vote-button upvote"
                class:active={userVoteStatus === 'agree'}
                transform="translate(-20, 0)"
                on:click={() => handleVote(userVoteStatus === 'agree' ? 'none' : 'agree')}
                on:keydown={handleKeydown}
                tabindex="0"
                role="button"
                aria-label="Upvote comment"
                aria-pressed={userVoteStatus === 'agree'}
            >
                <circle r="8" class="vote-bg" />
                <path d="M0 -3 L3 0 L0 0 L0 3 L-3 0 L0 0 Z" class="vote-arrow" />
            </g>
            
            <!-- Vote count -->
            <text
                class="vote-count"
                style:font-family={NODE_CONSTANTS.FONTS.value.family}
                style:font-size="10px"
            >
                {scoreDisplay}
            </text>
            
            <!-- Downvote button -->
            <g 
                class="vote-button downvote"
                class:active={userVoteStatus === 'disagree'}
                transform="translate(20, 0)"
                on:click={() => handleVote(userVoteStatus === 'disagree' ? 'none' : 'disagree')}
                on:keydown={handleKeydown}
                tabindex="0"
                role="button"
                aria-label="Downvote comment"
                aria-pressed={userVoteStatus === 'disagree'}
            >
                <circle r="8" class="vote-bg" />
                <path d="M0 3 L3 0 L0 0 L0 -3 L-3 0 L0 0 Z" class="vote-arrow" />
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

    /* Vote Controls */
    .vote-button {
        cursor: pointer;
    }

    .vote-bg {
        fill: rgba(0, 0, 0, 0.3);
        stroke: rgba(255, 255, 255, 0.3);
        stroke-width: 1;
        transition: all 0.2s ease;
    }

    .vote-arrow {
        fill: rgba(255, 255, 255, 0.7);
        transition: all 0.2s ease;
    }

    .vote-button:hover .vote-bg {
        fill: rgba(0, 0, 0, 0.5);
        stroke: rgba(255, 255, 255, 0.5);
    }

    .vote-button:hover .vote-arrow {
        fill: rgba(255, 255, 255, 0.9);
    }

    .vote-button.active .vote-bg {
        fill: rgba(0, 0, 0, 0.6);
        stroke: rgba(255, 255, 255, 0.7);
    }

    .upvote.active .vote-arrow {
        fill: rgba(46, 204, 113, 0.9);
    }

    .downvote.active .vote-arrow {
        fill: rgba(231, 76, 60, 0.9);
    }

    .vote-count {
        fill: rgba(255, 255, 255, 0.9);
    }
</style>

<!-- CSS variables for button styling -->
<div style="display:none;--button-bg-color:{buttonBgColor};--button-stroke-color:{buttonStrokeColor};--button-bg-hover-color:{buttonBgHoverColor};--button-stroke-hover-color:{buttonStrokeHoverColor}"></div>