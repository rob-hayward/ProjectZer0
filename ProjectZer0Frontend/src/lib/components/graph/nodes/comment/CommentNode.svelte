<!-- src/lib/components/graph/nodes/comment/CommentNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import BaseNode from '../base/BaseNode.svelte';
    import HiddenNode from '../common/HiddenNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { get } from 'svelte/store';
    import { discussionStore } from '$lib/stores/discussionStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { getVoteBasedColor, getContrastingTextColor } from '../utils/voteColorUtils';
    import ReplyButton from '../common/ReplyButton.svelte';
    import ShowHideButton from '../common/ShowHideButton.svelte';
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
    const data = node.data as unknown as CommentData;
    
    // Helper function to handle Neo4j number format
    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    // CRITICAL FIX: Ensure consistent radius when transitioning from hidden to visible
    $: {
        // Fix for incorrect radius during visibility transitions
        if (!node.isHidden && node.radius > COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2) {
            console.log(`[CommentNode] Fixing oversized radius: ${node.radius} -> ${COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2}`);
            node.radius = COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
            
            // Also update style properties to match
            if (node.style) {
                node.style.previewSize = node.radius;
                node.style.detailSize = node.radius;
            }
        }
    }
    
    // Explicitly set mode even though it doesn't affect appearance
    $: mode = node.mode || 'preview';

    // Get user vote status from discussion store
    $: userVoteStatus = discussionStore.getUserVoteStatus(node.id);
    
    // Calculate vote counts directly from the comment data for immediate reactivity
    $: positiveVotes = getNeo4jNumber(data.positiveVotes) || 0;
    $: negativeVotes = getNeo4jNumber(data.negativeVotes) || 0;
    $: netVotes = positiveVotes - negativeVotes;
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    
    // Track replying state
    $: isReplying = $discussionStore.isAddingReply && $discussionStore.replyToCommentId === node.id;
    
    // VISIBILITY FUNCTIONALITY - MINIMAL ADDITION
    // Calculate visibility but don't modify the node directly here
    $: communityHidden = netVotes < 0;
    $: userPreference = visibilityStore.getPreference(node.id);
    $: isHidden = userPreference !== undefined ? !userPreference : communityHidden;
    
    // Declare hiddenReason as a regular variable
    let hiddenReason: 'user' | 'community';
    $: hiddenReason = userPreference !== undefined ? 'user' : 'community';
    
    // Track voting state
    let isVoting = false;
    let voteSuccess = false;
    let lastVoteType: VoteStatus | null = null;
    
    // Track hover state for each vote button
    let upvoteHovered = false;
    let downvoteHovered = false;
    
    // Calculate position for the reply button
    $: buttonRadius = 10;
    $: nodeRadius = node.radius || 90;
    
    // Use trigonometry to position the button at exactly 1:30 (45 degrees)
    $: replyButtonX = (nodeRadius + buttonRadius) * Math.cos(Math.PI/4);
    $: replyButtonY = -(nodeRadius + buttonRadius) * Math.sin(Math.PI/4);

    // Define colors for the vote buttons from color constants
    const upvoteColor = COLORS.PRIMARY.GREEN;
    const downvoteColor = COLORS.PRIMARY.RED;
    const neutralColor = 'white';
    
    // Create unique filter IDs for the glow effects
    const upvoteFilterId = `upvote-glow-${Math.random().toString(36).slice(2)}`;
    const downvoteFilterId = `downvote-glow-${Math.random().toString(36).slice(2)}`;
    const neutralFilterId = `neutral-glow-${Math.random().toString(36).slice(2)}`;
    
    const dispatch = createEventDispatcher<{
        reply: { commentId: string };
        edit: { commentId: string, text: string };
        delete: { commentId: string };
        modeChange: { 
            mode: 'preview' | 'detail'; 
            position?: { x: number; y: number } 
        };
        visibilityChange: { isHidden: boolean };
    }>();
    
    function handleReply() {
        console.log(`[CommentNode] handleReply called for comment: ${node.id}`);
        dispatch('reply', { commentId: node.id });
        discussionStore.startReply(node.id);
    }
    
    function handleReplyButtonClick(event: CustomEvent<{ nodeId: string | undefined }>) {
        console.log(`[CommentNode] Reply button clicked for comment: ${node.id}`);
        handleReply();
    }
    
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        // Forward the visibility change event
        console.log(`[CommentNode] Forwarding visibility change: ${event.detail.isHidden ? 'hide' : 'show'}`);
        dispatch('visibilityChange', event.detail);
    }
    
    function handleUpvoteHover(isEnter: boolean) {
        upvoteHovered = isEnter;
    }
    
    function handleDownvoteHover(isEnter: boolean) {
        downvoteHovered = isEnter;
    }
    
    // Add keyboard event handler for accessibility
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === 'Space') {
            event.preventDefault();
            const target = event.currentTarget as HTMLElement;
            if (target.classList.contains('upvote-button')) {
                if (userVoteStatus === 'agree') {
                    handleVote('none');
                } else {
                    handleVote('agree');
                }
            } else if (target.classList.contains('downvote-button')) {
                if (userVoteStatus === 'disagree') {
                    handleVote('none');
                } else {
                    handleVote('disagree');
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
    
    // ORIGINAL voting logic - PRESERVED exactly as it was
    async function handleVote(voteType: VoteStatus) {
        if (!get(userStore) || isVoting) {
            console.log('[CommentNode] Vote blocked - user not authenticated or already voting');
            return;
        }
        
        // Prevent duplicate votes of the same type
        if (voteType !== 'none' && userVoteStatus === voteType) {
            console.log('[CommentNode] Vote blocked - already voted this way');
            return;
        }
        
        isVoting = true;
        voteSuccess = false;
        lastVoteType = voteType;
        
        // Store original values for potential revert
        const originalPositive = getNeo4jNumber(data.positiveVotes);
        const originalNegative = getNeo4jNumber(data.negativeVotes);
        const originalVoteStatus = userVoteStatus;
        
        try {
            console.log('[CommentNode] Processing vote:', { 
                commentId: node.id, 
                voteType,
                currentStatus: originalVoteStatus,
                isToggle: voteType === 'none' || voteType === originalVoteStatus
            });

            // Call the store method FIRST to update backend
            const success = await discussionStore.voteOnComment(node.id, voteType);
            
            if (success) {
                console.log('[CommentNode] Vote successful - backend updated');
                
                // Get the updated vote counts from the store
                const voteData = discussionStore.getVoteData(node.id);
                
                // Update local data with confirmed backend values
                data.positiveVotes = voteData.positiveVotes;
                data.negativeVotes = voteData.negativeVotes;
                
                // Trigger reactivity by updating the node data
                node.data = { ...node.data, positiveVotes: voteData.positiveVotes, negativeVotes: voteData.negativeVotes };
                
                // Update user vote status (this should already be done by the store, but ensure it)
                userVoteStatus = discussionStore.getUserVoteStatus(node.id);
                
                // Show success animation
                voteSuccess = true;
                lastVoteType = voteType;
                
                console.log('[CommentNode] Vote update complete:', {
                    newVoteStatus: userVoteStatus,
                    newPositive: data.positiveVotes,
                    newNegative: data.negativeVotes,
                    netVotes: voteData.netVotes
                });
                
                // Schedule to hide success animation after a delay
                setTimeout(() => {
                    voteSuccess = false;
                }, 1000);
            } else {
                console.warn('[CommentNode] Vote failed - backend rejected');
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
    
    // Calculate visual states for vote buttons
    $: upvoteButtonState = {
        isVoted: userVoteStatus === 'agree',
        isHovered: upvoteHovered,
        isLoading: isVoting,
        color: userVoteStatus === 'agree' ? upvoteColor : (upvoteHovered ? upvoteColor : neutralColor),
        filter: getVoteButtonFilter('upvote', userVoteStatus, upvoteHovered, voteSuccess, lastVoteType, isVoting)
    };
    
    $: downvoteButtonState = {
        isVoted: userVoteStatus === 'disagree',
        isHovered: downvoteHovered,
        isLoading: isVoting,
        color: userVoteStatus === 'disagree' ? downvoteColor : (downvoteHovered ? downvoteColor : neutralColor),
        filter: getVoteButtonFilter('downvote', userVoteStatus, downvoteHovered, voteSuccess, lastVoteType, isVoting)
    };
    
    // Helper function to determine which filter to apply
    function getVoteButtonFilter(
        buttonType: 'upvote' | 'downvote', 
        voteStatus: VoteStatus,
        isHovered: boolean,
        showSuccess: boolean,
        successType: VoteStatus | null,
        isVotingActive: boolean
    ): string {
        if (showSuccess && successType === (buttonType === 'upvote' ? 'agree' : 'disagree')) {
            return `url(#${buttonType === 'upvote' ? upvoteFilterId : downvoteFilterId})`;
        }
        
        if (voteStatus === 'agree' && buttonType === 'upvote') {
            return isHovered && !isVotingActive 
                ? `url(#${neutralFilterId})` 
                : `url(#${upvoteFilterId})`;
        }
        if (voteStatus === 'disagree' && buttonType === 'downvote') {
            return isHovered && !isVotingActive 
                ? `url(#${neutralFilterId})` 
                : `url(#${downvoteFilterId})`;
        }
        
        if (isHovered && !isVotingActive) {
            return `url(#${buttonType === 'upvote' ? upvoteFilterId : downvoteFilterId})`;
        }
        
        return 'none';
    }
    
    // Size calculations for text wrapping
    $: radius = node.radius || 90;
    $: textWidth = radius * 1.5;
    $: maxCharsPerLine = Math.floor(textWidth / 5.5);

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
    $: commentNodeColors = NODE_CONSTANTS.COLORS.COMMENT;
    $: baseColor = commentNodeColors.border.substring(0, 7);
    
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
        highlightColor: baseColor,
        // CRITICAL FIX: Ensure style sizes always match radius directly
        previewSize: node.radius,
        detailSize: node.radius
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
            netVotes,
            userVoteStatus,
            isHidden,
            hiddenReason,
            radius: node.radius
        });
    });
</script>

{#if isHidden}
    <!-- Render as hidden node -->
    <HiddenNode 
        {node}
        hiddenBy={hiddenReason}
        {netVotes}
    />
{:else}
    <!-- Render as normal comment node -->
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
                
                <!-- Neutral glow filter for hover over voted buttons -->
                <filter id={neutralFilterId} x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                    <feFlood flood-color={neutralColor} flood-opacity="0.6" result="color1"/>
                    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                    
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                    <feFlood flood-color={neutralColor} flood-opacity="0.8" result="color2"/>
                    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                    
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                    <feFlood flood-color={neutralColor} flood-opacity="1" result="color3"/>
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
                        y={-55 + (i * 12)} 
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
                    class:voted={upvoteButtonState.isVoted}
                    class:disabled={isVoting}
                    class:pulse={voteSuccess && lastVoteType === 'agree'}
                    transform="translate(-25, 0)"
                    on:click={() => {
                        if (!isVoting) {
                            if (userVoteStatus === 'agree') {
                                handleVote('none');
                            } else {
                                handleVote('agree');
                            }
                        }
                    }}
                    on:keydown={handleKeydown}
                    on:mouseenter={() => handleUpvoteHover(true)}
                    on:mouseleave={() => handleUpvoteHover(false)}
                    tabindex="-1"
                    role="button"
                    aria-label={userVoteStatus === 'agree' ? 'Remove upvote' : 'Upvote comment'}
                    aria-pressed={userVoteStatus === 'agree'}
                    style:filter={upvoteButtonState.filter}
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
                            {#if isVoting && (lastVoteType === 'agree' || (userVoteStatus === 'agree' && lastVoteType === 'none'))}
                                <div class="loading-spinner" style:color={upvoteButtonState.color}>
                                    ⟳
                                </div>
                            {:else}
                                <span 
                                    class="material-symbols-outlined vote-icon"
                                    class:bounce={voteSuccess && lastVoteType === 'agree'}
                                    style:color={upvoteButtonState.color}
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
                    class:positive={netVotes > 0}
                    class:negative={netVotes < 0}
                    class:neutral={netVotes === 0}
                    x="0"
                    y="4"
                    style:font-family={NODE_CONSTANTS.FONTS.value.family}
                    style:font-size="12px"
                >
                    {scoreDisplay}
                </text>
                
                <!-- Downvote button positioned to the right -->
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <!-- svelte-ignore a11y-mouse-events-have-key-events -->
                <g 
                    class="downvote-button"
                    class:voted={downvoteButtonState.isVoted}
                    class:disabled={isVoting}
                    class:pulse={voteSuccess && lastVoteType === 'disagree'}
                    transform="translate(25, 0)"
                    on:click={() => {
                        if (!isVoting) {
                            if (userVoteStatus === 'disagree') {
                                handleVote('none');
                            } else {
                                handleVote('disagree');
                            }
                        }
                    }}
                    on:keydown={handleKeydown}
                    on:mouseenter={() => handleDownvoteHover(true)}
                    on:mouseleave={() => handleDownvoteHover(false)}
                    tabindex="-1"
                    role="button"
                    aria-label={userVoteStatus === 'disagree' ? 'Remove downvote' : 'Downvote comment'}
                    aria-pressed={userVoteStatus === 'disagree'}
                    style:filter={downvoteButtonState.filter}
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
                            {#if isVoting && (lastVoteType === 'disagree' || (userVoteStatus === 'disagree' && lastVoteType === 'none'))}
                                <div class="loading-spinner" style:color={downvoteButtonState.color}>
                                    ⟳
                                </div>
                            {:else}
                                <span 
                                    class="material-symbols-outlined vote-icon"
                                    class:bounce={voteSuccess && lastVoteType === 'disagree'}
                                    style:color={downvoteButtonState.color}
                                >
                                    thumb_down
                                </span>
                            {/if}
                        </div>
                    </foreignObject>
                </g>
            </g>
        </svelte:fragment>
    </BaseNode>

    <!-- Add the Reply button at the calculated position -->
    <ReplyButton 
        x={replyButtonX}
        y={replyButtonY}
        nodeId={node.id}
        on:reply={handleReplyButtonClick}
    />
    
    <!-- Add a properly positioned Show/Hide button -->
    <!-- <ShowHideButton 
        isHidden={false}
        y={hideButtonY}
        x={hideButtonX}
        nodeId={node.id}
        on:visibilityChange={handleVisibilityChange}
    /> -->
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
    .upvote-button, .downvote-button {
        cursor: pointer;
        transform-box: fill-box;
        transform-origin: center;
        outline: none;
        border: none;
        background: none;
    }

    .upvote-button.disabled, .downvote-button.disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }

    .upvote-button.voted, 
    .downvote-button.voted {
        transform: none;
    }

    .upvote-button:focus, .downvote-button:focus {
        outline: none;
    }

    .icon-container {
        overflow: visible;
        outline: none;
    }

    .vote-controls *, .vote-controls *:focus {
        outline: none !important;
        border: none !important;
    }

    .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.vote-controls .material-symbols-outlined.vote-icon) {
        font-size: 20px;
        transition: color 0.3s ease;
    }

    /* Loading spinner styling */
    .loading-spinner {
        font-size: 20px;
        animation: spin 1s linear infinite;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }

    /* Vote count styling */
    .vote-count {
        fill: rgba(255, 255, 255, 0.9);
        transition: fill 0.3s ease, font-size 0.2s ease;
    }
    
    .vote-count.positive {
        fill: rgba(46, 204, 113, 0.9);
    }
    
    .vote-count.negative {
        fill: rgba(231, 76, 60, 0.9);
    }
    
    .vote-count.neutral {
        fill: rgba(255, 255, 255, 0.9);
    }

    /* Animations */
    :global(.material-symbols-outlined.bounce) {
        animation: bounce 0.5s ease-in-out;
    }

    .pulse {
        animation: pulse 0.5s ease-in-out;
    }

    @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.5); }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>