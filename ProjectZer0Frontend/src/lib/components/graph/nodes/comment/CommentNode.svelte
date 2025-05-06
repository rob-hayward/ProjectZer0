<!-- src/lib/components/graph/nodes/comment/CommentNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BaseNode from '../base/BaseNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { get } from 'svelte/store';
    import { discussionStore } from '$lib/stores/discussionStore';
    import { getVoteBasedColor, getContrastingTextColor } from '../utils/voteColorUtils';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    
    export let node: RenderableNode;
    export let isReply: boolean = false;
    
    // Optional position props that will be passed from NodeRenderer
    export let nodeX: number | undefined = undefined;
    export let nodeY: number | undefined = undefined;
    
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
    
    // Layout constants
    const LAYOUT = {
        contentMaxWidth: node.mode === 'detail' ? 280 : 180, // Maximum width for comment text
        contentY: 0, // Centered vertically
        metadataY: node.mode === 'detail' ? 60 : 40, // Position for metadata (author, date)
        votesY: node.mode === 'detail' ? 40 : 25 // Position for votes display
    };
    
    // Get vote data from discussion store
    $: voteData = discussionStore.getVoteData(node.id);
    $: userVoteStatus = discussionStore.getUserVoteStatus(node.id);
    $: positiveVotes = voteData.positiveVotes || 0;
    $: negativeVotes = voteData.negativeVotes || 0;
    $: netVotes = voteData.netVotes || 0;
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    
    // Track replying state
    $: isReplying = $discussionStore.isAddingReply && $discussionStore.replyToCommentId === node.id;
    
    // Track editing state
    let isEditing = false;
    let editText = '';
    
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
    
    function handleEdit() {
        isEditing = true;
        editText = data.commentText;
    }
    
    function handleDelete() {
        dispatch('delete', { commentId: node.id });
    }
    
    function cancelEdit() {
        isEditing = false;
        editText = '';
    }
    
    function saveEdit() {
        if (editText.trim() === data.commentText.trim()) {
            cancelEdit();
            return;
        }
        
        dispatch('edit', { commentId: node.id, text: editText });
        isEditing = false;
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
            } else if (target.classList.contains('action-button')) {
                if (target.classList.contains('edit')) {
                    handleEdit();
                } else if (target.classList.contains('delete')) {
                    handleDelete();
                } else if (target.classList.contains('reply')) {
                    handleReply();
                }
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
    
    function handleModeChange() {
        // Determine next mode (toggle between preview and detail)
        const nextMode = node.mode === 'detail' ? 'preview' : 'detail';
        
        // Position details if available
        const position = nodeX !== undefined && nodeY !== undefined
            ? { x: nodeX, y: nodeY }
            : undefined;
            
        // Dispatch mode change event
        dispatch('modeChange', { 
            mode: nextMode,
            position
        });
    }
    
    // Calculate vote-based styling
    $: voteColor = getVoteBasedColor(netVotes);
    $: textColor = getContrastingTextColor(voteColor);
    
    // Calculate vote-based styling enhancements based on net votes
    $: voteBasedStyles = calculateVoteBasedStyles(netVotes);
    
    // Size calculations for text wrapping
    $: textWidth = LAYOUT.contentMaxWidth;
    $: maxCharsPerLine = Math.floor(textWidth / 7); // Estimate characters per line
    
    // Text wrapping for comment
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

<!-- Choose between preview and detail mode -->
{#if node.mode === 'detail'}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} {voteBasedStyles} on:modeChange={handleModeChange}>
        <svelte:fragment slot="default" let:radius>
            <!-- Title -->
            <text
                y={-radius + 20}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size="12px"
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                {isReply ? 'Reply' : 'Comment'}
            </text>

            <!-- Comment text -->
            <g class="comment-text" transform="translate(0, {LAYOUT.contentY})">
                {#if isEditing}
                    <!-- Edit mode -->
                    <foreignObject 
                        x={-LAYOUT.contentMaxWidth/2} 
                        y={-80} 
                        width={LAYOUT.contentMaxWidth} 
                        height="160"
                    >
                        <div class="edit-container">
                            <textarea 
                                class="edit-textarea" 
                                bind:value={editText}
                                rows="5"
                            ></textarea>
                            <div class="edit-controls">
                                <button class="edit-button save" on:click={saveEdit}>Save</button>
                                <button class="edit-button cancel" on:click={cancelEdit}>Cancel</button>
                            </div>
                        </div>
                    </foreignObject>
                {:else}
                    <!-- Display comment text -->
                    {#each lines as line, i}
                        <text
                            x="0"
                            y={-lines.length * 10 / 2 + i * 15}
                            class="text-line"
                            style:font-family="'Orbitron', sans-serif"
                            style:font-size="11px"
                        >
                            {line}
                        </text>
                    {/each}
                {/if}
            </g>
            
            <!-- Vote controls -->
            <g class="vote-controls" transform="translate(0, {LAYOUT.votesY})">
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
                    on:keydown={handleKeydown}
                    tabindex="0"
                    role="button"
                    aria-label="Downvote comment"
                    aria-pressed={userVoteStatus === 'disagree'}
                >
                    <circle r="10" class="vote-bg" />
                    <path d="M0 4 L4 0 L0 0 L0 -4 L-4 0 L0 0 Z" class="vote-arrow" />
                </g>
            </g>
            
            <!-- Action buttons (edit, delete, reply) -->
            <g class="action-buttons" transform="translate(0, {LAYOUT.metadataY + 30})">
                {#if data.createdBy === get(userStore)?.sub}
                    <!-- Edit button -->
                    <g 
                        class="action-button edit"
                        transform="translate(-60, 0)"
                        on:click={handleEdit}
                        on:keydown={handleKeydown}
                        tabindex="0"
                        role="button"
                        aria-label="Edit comment"
                    >
                        <rect width="40" height="20" rx="3" ry="3" class="button-bg" />
                        <text x="20" y="14" class="button-text">Edit</text>
                    </g>
                    
                    <!-- Delete button -->
                    <g 
                        class="action-button delete"
                        transform="translate(0, 0)"
                        on:click={handleDelete}
                        on:keydown={handleKeydown}
                        tabindex="0"
                        role="button"
                        aria-label="Delete comment"
                    >
                        <rect width="50" height="20" rx="3" ry="3" class="button-bg" />
                        <text x="25" y="14" class="button-text">Delete</text>
                    </g>
                {/if}
                
                <!-- Reply button -->
                <g 
                    class="action-button reply"
                    transform="translate(60, 0)"
                    on:click={handleReply}
                    on:keydown={handleKeydown}
                    tabindex="0"
                    role="button"
                    aria-label="Reply to comment"
                >
                    <rect width="40" height="20" rx="3" ry="3" class="button-bg" />
                    <text x="20" y="14" class="button-text">Reply</text>
                </g>
            </g>
            
            <!-- Creator and date -->
            <g transform="translate(0, {LAYOUT.metadataY})">
                <text class="metadata">
                    {creatorName} · {formattedDate}
                </text>
            </g>
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} {voteBasedStyles} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <text
                y={-radius + 20}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                {isReply ? 'Reply' : 'Comment'}
            </text>
        </svelte:fragment>

        <svelte:fragment slot="content" let:radius>
            <!-- Display truncated comment text -->
            {#if lines.length > 0}
                <text
                    y="0"
                    class="preview-text"
                >
                    {lines[0].length > 20 ? lines[0].slice(0, 20) + '...' : lines[0]}
                </text>
            {/if}
        </svelte:fragment>

        <svelte:fragment slot="score" let:radius>
            <text
                y={radius - 20}
                class="score"
            >
                {scoreDisplay}
            </text>
        </svelte:fragment>
    </BasePreviewNode>
{/if}

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
    }
    
    .preview-text {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.9);
    }

    .metadata {
        font-size: 9px;
        fill: rgba(255, 255, 255, 0.6);
    }
    
    .score {
        font-size: 14px;
        opacity: 0.8;
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
    
    /* Action Buttons */
    .action-button {
        cursor: pointer;
    }
    
    .button-bg {
        fill: rgba(0, 0, 0, 0.3);
        stroke: rgba(255, 255, 255, 0.3);
        stroke-width: 1;
    }
    
    .button-text {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.9);
    }
    
    .action-button:hover .button-bg {
        fill: rgba(0, 0, 0, 0.5);
        stroke: rgba(255, 255, 255, 0.5);
    }
    
    .action-button.edit .button-bg {
        fill: rgba(52, 152, 219, 0.2);
        stroke: rgba(52, 152, 219, 0.4);
    }
    
    .action-button.delete .button-bg {
        fill: rgba(231, 76, 60, 0.2);
        stroke: rgba(231, 76, 60, 0.4);
    }
    
    .action-button.reply .button-bg {
        fill: rgba(155, 89, 182, 0.2);
        stroke: rgba(155, 89, 182, 0.4);
    }
    
    .action-button.edit:hover .button-bg {
        fill: rgba(52, 152, 219, 0.3);
        stroke: rgba(52, 152, 219, 0.6);
    }
    
    .action-button.delete:hover .button-bg {
        fill: rgba(231, 76, 60, 0.3);
        stroke: rgba(231, 76, 60, 0.6);
    }
    
    .action-button.reply:hover .button-bg {
        fill: rgba(155, 89, 182, 0.3);
        stroke: rgba(155, 89, 182, 0.6);
    }
    
    /* Edit Mode */
    :global(.edit-container) {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: rgba(0, 0, 0, 0.8);
        border-radius: 8px;
        padding: 8px;
    }
    
    :global(.edit-textarea) {
        width: 100%;
        height: 100px;
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        resize: none;
    }
    
    :global(.edit-controls) {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
    }
    
    :global(.edit-button) {
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 4px 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 10px;
        cursor: pointer;
    }
    
    :global(.edit-button.save) {
        background-color: rgba(46, 204, 113, 0.2);
        border-color: rgba(46, 204, 113, 0.4);
    }
    
    :global(.edit-button.cancel) {
        background-color: rgba(231, 76, 60, 0.2);
        border-color: rgba(231, 76, 60, 0.4);
    }
    
    :global(.edit-button:hover) {
        transform: translateY(-1px);
    }
    
    :global(.edit-button.save:hover) {
        background-color: rgba(46, 204, 113, 0.3);
        border-color: rgba(46, 204, 113, 0.6);
    }
    
    :global(.edit-button.cancel:hover) {
        background-color: rgba(231, 76, 60, 0.3);
        border-color: rgba(231, 76, 60, 0.6);
    }
</style>