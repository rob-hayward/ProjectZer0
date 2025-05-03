<!-- src/lib/components/graph/nodes/comment/CommentNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BaseNode from '../base/BaseNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { fetchWithAuth } from '$lib/services/api';
    
    export let node: RenderableNode;
    
    // We expect the comment data to have the following structure
    // It would be better to have a proper type definition, but we'll use any for now
    interface CommentData {
        id: string;
        text: string;
        createdBy: string;
        createdAt: string | Date;
        positiveVotes: number;
        negativeVotes: number;
        parentId?: string; // The id of the parent node (could be a statement, definition, word, or another comment)
        parentType?: string; // The type of the parent node
        publicCredit?: boolean;
    }
    
    // Type assertion for comment data
    const data = node.data as CommentData;
    
    // Layout constants
    const LAYOUT = {
        contentMaxWidth: 180, // Maximum width for comment text
        contentY: 0, // Centered vertically
        metadataY: 60, // Position for metadata (author, date)
        votesY: 40 // Position for votes display
    };
    
    // Vote-related state
    let userVoteStatus: VoteStatus = 'none';
    let isVoting = false;
    let positiveVotes: number = (typeof data.positiveVotes === 'number') ? data.positiveVotes : 0;
    let negativeVotes: number = (typeof data.negativeVotes === 'number') ? data.negativeVotes : 0;
    
    $: netVotes = positiveVotes - negativeVotes;
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    
    const dispatch = createEventDispatcher<{
        visibilityChange: { isHidden: boolean };
        reply: { commentId: string };
    }>();
    
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        console.debug(`[CommentNode] Visibility change requested:`, event.detail);
        dispatch('visibilityChange', event.detail);
    }
    
    function handleReply() {
        console.debug(`[CommentNode] Reply requested for comment:`, node.id);
        dispatch('reply', { commentId: node.id });
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
    
    async function initializeVoteStatus() {
        if (!$userStore) return;
        
        try {
            console.log('[CommentNode] Fetching vote status for comment:', node.id);
            // This endpoint would need to be implemented on the backend
            const response = await fetchWithAuth(`/comments/${node.id}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            userVoteStatus = response.status || 'none';
            positiveVotes = response.positiveVotes || data.positiveVotes || 0;
            negativeVotes = response.negativeVotes || data.negativeVotes || 0;
            
            console.log('[CommentNode] Vote status initialized:', {
                userVoteStatus,
                positiveVotes,
                negativeVotes,
                netVotes
            });
        } catch (error) {
            console.error('[CommentNode] Error fetching vote status:', error);
            // Fall back to data from props
            positiveVotes = data.positiveVotes || 0;
            negativeVotes = data.negativeVotes || 0;
        }
    }
    
    async function handleVote(voteType: VoteStatus) {
        if (!$userStore || isVoting) return;
        isVoting = true;
        const oldVoteStatus = userVoteStatus;
        
        try {
            console.log('[CommentNode] Processing vote:', {
                commentId: node.id,
                voteType,
                currentStatus: userVoteStatus
            });
            
            // Optimistic update
            userVoteStatus = voteType;
            
            let result;
            if (voteType === 'none') {
                // Remove vote
                result = await fetchWithAuth(
                    `/comments/${node.id}/vote/remove`,
                    { method: 'POST' }
                );
            } else {
                // Add vote
                result = await fetchWithAuth(
                    `/comments/${node.id}/vote`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            isPositive: voteType === 'agree'
                        })
                    }
                );
            }
            
            // Update vote counts
            positiveVotes = result.positiveVotes || 0;
            negativeVotes = result.negativeVotes || 0;
            
            console.log('[CommentNode] Vote recorded:', {
                voteType,
                positiveVotes,
                negativeVotes,
                netVotes
            });
        } catch (error) {
            console.error('[CommentNode] Error processing vote:', error);
            // Revert on error
            userVoteStatus = oldVoteStatus;
        } finally {
            isVoting = false;
        }
    }
    
    // Size calculations for text wrapping
    $: textWidth = node.radius * 2 - 45;
    $: maxCharsPerLine = Math.floor(textWidth / 7); // Slightly smaller character width
    
    // Text wrapping for comment
    $: lines = data.text.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);
    
    // Reactive declarations
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    $: formattedDate = formatDate(data.createdAt);
    
    // Calculate vote-based styling enhancements based on net votes
    $: voteBasedStyles = calculateVoteBasedStyles(netVotes);
    
    // Function to calculate styling based on vote count
    function calculateVoteBasedStyles(votes: number) {
        // Ensure votes is a non-negative value (hidden nodes have negative votes)
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
    
    onMount(async () => {
        console.log('[CommentNode] Mounting with comment:', {
            id: node.id,
            text: data.text,
            positiveVotes: data.positiveVotes,
            negativeVotes: data.negativeVotes
        });
        
        await initializeVoteStatus();
    });
</script>

<BaseNode {node} {voteBasedStyles}>
    <svelte:fragment slot="default" let:radius>
        <!-- Title -->
        <text
            y={-radius + 20}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size="12px"
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            Comment
        </text>

        <!-- Comment text -->
        <g class="comment-text" transform="translate(0, {LAYOUT.contentY})">
            {#each lines as line, i}
                <text
                    x="0"
                    y={-lines.length * 10 / 2 + i * 15}
                    class="text-line"
                    style:font-family={NODE_CONSTANTS.FONTS.text.family}
                    style:font-size="11px"
                >
                    {line}
                </text>
            {/each}
        </g>
        
        <!-- Vote buttons -->
        <g class="vote-controls" transform="translate(0, {LAYOUT.votesY})">
            <!-- Upvote button -->
            <g 
                class="vote-button upvote"
                class:active={userVoteStatus === 'agree'}
                transform="translate(-20, 0)"
                on:click={() => handleVote(userVoteStatus === 'agree' ? 'none' : 'agree')}
            >
                <circle r="10" class="vote-bg" />
                <path d="M0 -4 L4 0 L0 0 L0 4 L-4 0 L0 0 Z" class="vote-arrow" />
            </g>
            
            <!-- Vote count -->
            <text
                class="vote-count"
                style:font-family={NODE_CONSTANTS.FONTS.value.family}
                style:font-size="12px"
            >
                {scoreDisplay}
            </text>
            
            <!-- Downvote button -->
            <g 
                class="vote-button downvote"
                class:active={userVoteStatus === 'disagree'}
                transform="translate(20, 0)"
                on:click={() => handleVote(userVoteStatus === 'disagree' ? 'none' : 'disagree')}
            >
                <circle r="10" class="vote-bg" />
                <path d="M0 4 L4 0 L0 0 L0 -4 L-4 0 L0 0 Z" class="vote-arrow" />
            </g>
        </g>
        
        <!-- Creator and date -->
        <g transform="translate(0, {LAYOUT.metadataY})">
            <text class="metadata">
                {getDisplayName(data.createdBy, null, !data.publicCredit)} · {formattedDate}
            </text>
        </g>
        
        <!-- Reply button goes at 10:30 - this is just a placeholder,
             the actual button is added by NodeRenderer -->
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

    .text-line {
        text-anchor: middle;
        fill: white;
        font-family: 'Orbitron', sans-serif;
    }

    .metadata {
        font-size: 9px;
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