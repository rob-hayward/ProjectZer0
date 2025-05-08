<!-- src/lib/components/graph/nodes/comment/CommentNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BaseNode from '../base/BaseNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { get } from 'svelte/store';
    import { discussionStore } from '$lib/stores/discussionStore';
    import { getVoteBasedColor, getContrastingTextColor } from '../utils/voteColorUtils';
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
        dispatch('reply', { commentId: node.id });
        discussionStore.startReply(node.id);
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
            } else if (target.classList.contains('reply-button')) {
                handleReply();
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
    
    // Calculate vote-based styling enhancements based on net votes
    $: voteBasedStyles = calculateVoteBasedStyles(netVotes);
    
    // Function to calculate styling based on vote count
    function calculateVoteBasedStyles(votes: number) {
        // Ensure votes is a non-negative value for styling calculations
        const positiveVotes = Math.max(0, votes);
        
        // Get constants
        const VOTE_STYLING = NODE_CONSTANTS.VOTE_BASED_STYLING;
        const votesPerIncrement = VOTE_STYLING.VOTES_PER_INCREMENT;
        const maxVoteThreshold = VOTE_STYLING.MAX_VOTE_THRESHOLD;
        
        // Calculate scaling factor (capped at max threshold)
        const scaleFactor = Math.min(positiveVotes / votesPerIncrement, maxVoteThreshold / votesPerIncrement);
        
        // Calculate glow properties
        const glowIntensity = VOTE_STYLING.GLOW.BASE.INTENSITY + 
            (scaleFactor * VOTE_STYLING.GLOW.INCREMENT.INTENSITY);
        const glowOpacity = VOTE_STYLING.GLOW.BASE.OPACITY + 
            (scaleFactor * VOTE_STYLING.GLOW.INCREMENT.OPACITY);
            
        // Calculate ring properties
        const ringWidth = VOTE_STYLING.RING.BASE.WIDTH + 
            (scaleFactor * VOTE_STYLING.RING.INCREMENT.WIDTH);
        const ringOpacity = VOTE_STYLING.RING.BASE.OPACITY + 
            (scaleFactor * VOTE_STYLING.RING.INCREMENT.OPACITY);
            
        // Apply caps to ensure values don't exceed maximums
        return {
            glow: {
                intensity: Math.min(glowIntensity, VOTE_STYLING.GLOW.MAX.INTENSITY),
                opacity: Math.min(glowOpacity, VOTE_STYLING.GLOW.MAX.OPACITY)
            },
            ring: {
                width: Math.min(ringWidth, VOTE_STYLING.RING.MAX.WIDTH),
                opacity: Math.min(ringOpacity, VOTE_STYLING.RING.MAX.OPACITY)
            }
        };
    }
    
    // Define comment node color using the NODE_CONSTANTS
    $: commentColor = COLORS.PRIMARY.ORANGE;
    
    // Override the node style with our custom styles
    $: customStyle = {
        ...node.style,
        colors: {
            background: `${commentColor}33`, // Background with transparency
            border: `${commentColor}FF`,     // Border in full color
            text: COLORS.UI.TEXT.PRIMARY,    // Text in white
            hover: `${commentColor}FF`,      // Hover color
            gradient: {
                start: `${commentColor}66`,  // Gradient start with medium transparency
                end: `${commentColor}33`     // Gradient end with more transparency
            }
        },
        highlightColor: commentColor         // Highlight in comment color
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

<!-- Use BaseNode with proper styling parameters -->
<BaseNode {node} style={customStyle} {voteBasedStyles}>
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
        
        <!-- Reply button -->
        <g 
            class="reply-button"
            transform="translate(0, {radius - 12})"
            on:click={handleReply}
            on:keydown={handleKeydown}
            tabindex="0"
            role="button"
            aria-label="Reply to comment"
        >
            <rect width="50" height="16" rx="3" ry="3" class="button-bg" />
            <text x="25" y="11" class="button-text">Reply</text>
        </g>
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
    
    /* Reply button */
    .reply-button {
        cursor: pointer;
    }
    
    .button-bg {
        fill: rgba(255, 165, 0, 0.2); /* Semi-transparent orange for orange theme */
        stroke: rgba(255, 165, 0, 0.4); /* Light orange stroke */
        stroke-width: 1;
    }
    
    .button-text {
        font-size: 8px;
        fill: rgba(255, 255, 255, 0.9);
    }
    
    .reply-button:hover .button-bg {
        fill: rgba(255, 165, 0, 0.3); /* Slightly more opaque on hover */
        stroke: rgba(255, 165, 0, 0.6); /* More visible stroke on hover */
    }
</style>