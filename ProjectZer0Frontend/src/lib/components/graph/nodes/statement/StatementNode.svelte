<!-- src/lib/components/graph/nodes/statement/StatementNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { isStatementData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
    import { fetchWithAuth } from '$lib/services/api';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
    
    export let node: RenderableNode;
    export let statementText: string = '';
    
    // Type guard for statement data
    if (!isStatementData(node.data)) {
        throw new Error('Invalid node data type for StatementNode');
    }

    // Extract data from node
    const data = node.data;
    
    // Use statementText prop if provided, otherwise fall back to node data
    $: displayStatementText = statementText || data.statement;
    
    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    let userVoteStatus: VoteStatus = 'none';
    let isVoting = false;
    let userName: string;
    let netVotes: number = 0;
    let scoreDisplay: string = "0";
    let statementStatus: string;
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        visibilityChange: { nodeId: string; isHidden: boolean };
        hover: { isHovered: boolean };
    }>();

    function handleModeChange() {
        const newMode = isDetail ? 'preview' : 'detail';
        console.debug(`[StatementNode] Mode change requested:`, { 
            currentMode: node.mode, 
            newMode,
            isDetail
        });
        dispatch('modeChange', { mode: newMode });
    }
    
    function handleCollapse() {
        console.debug(`[StatementNode] Collapse requested`);
        dispatch('modeChange', { mode: 'preview' });
    }
    
    function handleExpand() {
        console.debug(`[StatementNode] Expand requested`);
        dispatch('modeChange', { mode: 'detail' });
    }
    
    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', event.detail);
    }

    async function initializeVoteStatus(retryCount = 0) {
        if (!$userStore) return;
        
        try {
            console.debug('[StatementNode] Fetching vote status for statement:', node.id);
            
            // Get vote data from the network store first - use as primary source
            const storeVotes = statementNetworkStore.getVoteData(node.id);
            
            // Also update the data object for reactive updates
            // This ensures vote data updates immediately
            data.positiveVotes = storeVotes.positiveVotes;
            data.negativeVotes = storeVotes.negativeVotes;
            
            // Fetch user's personal vote status from API - this is still needed for personalization
            const response = await fetchWithAuth(`/nodes/statement/${node.id}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            // Update user vote status from API
            userVoteStatus = response.status || 'none';
            
            console.debug('[StatementNode] Vote data initialized:', {
                userVoteStatus,
                storeVotes: {
                    positiveVotes: storeVotes.positiveVotes,
                    negativeVotes: storeVotes.negativeVotes,
                    netVotes: storeVotes.netVotes
                },
                apiResponse: {
                    positiveVotes: response.positiveVotes,
                    negativeVotes: response.negativeVotes,
                    netVotes: response.netVotes,
                    status: response.status
                }
            });
            
            // If store and API data don't match, update the store
            // This ensures synchronization between frontend and backend
            if (storeVotes.positiveVotes !== response.positiveVotes || 
                storeVotes.negativeVotes !== response.negativeVotes) {
                console.debug('[StatementNode] Vote count mismatch, updating store from API');
                // Update store
                statementNetworkStore.updateVoteData(
                    node.id,
                    response.positiveVotes,
                    response.negativeVotes
                );
                
                // Direct update for immediate UI reactivity
                data.positiveVotes = getNeo4jNumber(response.positiveVotes);
                data.negativeVotes = getNeo4jNumber(response.negativeVotes);
            }
        } catch (error) {
            console.error('[StatementNode] Error fetching vote status:', error);
            
            if (retryCount < MAX_RETRIES) {
                console.debug(`[StatementNode] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await initializeVoteStatus(retryCount + 1);
            } else {
                // If we can't get the vote status from API, at least use the store
                const storeVotes = statementNetworkStore.getVoteData(node.id);
                netVotes = storeVotes.netVotes;
            }
        }
    }

    async function handleVote(voteType: VoteStatus) {
        if (!$userStore || isVoting) return;
        isVoting = true;
        const oldVoteStatus = userVoteStatus;

        try {
            console.debug('[StatementNode] Processing vote:', { 
                statementId: node.id, 
                voteType,
                currentStatus: userVoteStatus
            });

            // Save current vote status for comparison
            const beforeVotes = statementNetworkStore.getVoteData(node.id);
            console.debug('[StatementNode] Vote data before API call:', beforeVotes);

            // Optimistic update
            userVoteStatus = voteType;
            
            let result;
            if (voteType === 'none') {
                result = await fetchWithAuth(
                    `/nodes/statement/${node.id}/vote/remove`,
                    { method: 'POST' }
                );
                
                console.debug('[StatementNode] Vote removed, API response:', {
                    positiveVotes: result.positiveVotes,
                    negativeVotes: result.negativeVotes,
                    netVotes: result.netVotes
                });
            } else {
                result = await fetchWithAuth(
                    `/nodes/statement/${node.id}/vote`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ 
                            isPositive: voteType === 'agree'
                        })
                    }
                );

                console.debug('[StatementNode] Vote recorded, API response:', {
                    positiveVotes: result.positiveVotes,
                    negativeVotes: result.negativeVotes,
                    netVotes: result.netVotes
                });
            }

            // Ensure we're working with numbers and consistently calculate netVotes
            const posVotes = getNeo4jNumber(result.positiveVotes);
            const negVotes = getNeo4jNumber(result.negativeVotes);
            
            // Update the local data properties directly for immediate UI updates
            // This is critical - directly modify the values our reactive declarations are watching
            data.positiveVotes = posVotes;
            data.negativeVotes = negVotes;
            
            // Also update the store for consistency across components
            statementNetworkStore.updateVoteData(node.id, posVotes, negVotes);
            
            console.debug('[StatementNode] Vote change summary:', {
                before: {
                    positive: beforeVotes.positiveVotes,
                    negative: beforeVotes.negativeVotes,
                    net: beforeVotes.netVotes
                },
                after: {
                    positive: posVotes,
                    negative: negVotes,
                    net: posVotes - negVotes
                },
                apiResponse: {
                    positive: posVotes,
                    negative: negVotes,
                    net: posVotes - negVotes
                }
            });
            
            // Vote behavior explanation
            // isPositive: true → increments positiveVotes (agree)
            // isPositive: false → increments negativeVotes (disagree)
            
            // Recalculate visibility after vote changes
            if (graphStore) {
                graphStore.recalculateNodeVisibility(
                    node.id, 
                    posVotes,
                    negVotes
                );
            }
        } catch (error) {
            console.error('[StatementNode] Error processing vote:', error);
            // Revert on error
            userVoteStatus = oldVoteStatus;
            // Retry vote status fetch to ensure consistency
            await initializeVoteStatus();
        } finally {
            isVoting = false;
        }
    }

    // Size calculations for preview mode
    $: textWidth = node.radius * 2 - 45;
    $: maxCharsPerLine = Math.floor(textWidth / 8);

    // Text wrapping for preview mode
    $: lines = displayStatementText.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);

    onMount(async () => {
        console.debug('[StatementNode] Mounting with statement:', {
            id: node.id,
            statement: displayStatementText,
            mode: node.mode,
            isHidden: node.isHidden
        });
        
        // Get vote data from the store - single source of truth
        const storeVotes = statementNetworkStore.getVoteData(node.id);
        netVotes = storeVotes.netVotes;

        console.debug('[StatementNode] Initial vote data from store:', storeVotes);

        // Also initialize user's vote status from API
        await initializeVoteStatus();
    });

    // Reactive declarations 
    $: isDetail = node.mode === 'detail';
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    
    // Create reactive variables for vote data
    $: voteData = statementNetworkStore.getVoteData(node.id);
    
    // Get votes from data object (which we update directly) and fall back to store
    $: positiveVotes = data.positiveVotes !== undefined ? getNeo4jNumber(data.positiveVotes) : voteData.positiveVotes;
    $: negativeVotes = data.negativeVotes !== undefined ? getNeo4jNumber(data.negativeVotes) : voteData.negativeVotes;
    
    $: netVotes = positiveVotes - negativeVotes;
    
    // Update display values when netVotes changes
    $: {
        // Update score display
        scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
        statementStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
    }

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
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange} {voteBasedStyles}>
        <svelte:fragment slot="default" let:radius>
            <!-- Title -->
            <text
                y={-radius + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Statement
            </text>

            <!-- Statement Display -->
            <g class="statement-display" transform="translate(0, {-radius/2 - 55})">
                <foreignObject 
                    x={METRICS_SPACING.labelX}
                    width={Math.abs(METRICS_SPACING.labelX) * 2}
                    height="100"
                >
                    <div class="statement-text">
                        {displayStatementText}
                    </div>
                </foreignObject>
            </g>

            <!-- Keywords Display (if any) -->
            {#if data.keywords && data.keywords.length > 0}
                <g transform="translate(0, {-radius/4})">
                    <text 
                        x={METRICS_SPACING.labelX} 
                        class="keywords-label left-align"
                    >
                        Keywords:
                    </text>
                    
                    <foreignObject 
                        x={METRICS_SPACING.labelX}
                        y="10"
                        width={Math.abs(METRICS_SPACING.labelX) * 2}
                        height="50"
                    >
                        <div class="keywords-container">
                            {#each data.keywords as keyword}
                                <div class="keyword-chip" class:ai-keyword={keyword.source === 'ai'} class:user-keyword={keyword.source === 'user'}>
                                    {keyword.word}
                                </div>
                            {/each}
                        </div>
                    </foreignObject>
                </g>
            {/if}
            
            <!-- User Context -->
            <!-- <g transform="translate(0, -50)">
                <text 
                    x={METRICS_SPACING.labelX} 
                    class="context-text left-align"
                >
                    Please vote on whether you agree with this statement
                </text>
                <text 
                    x={METRICS_SPACING.labelX} 
                    y="20" 
                    class="context-text left-align"
                >
                    for inclusion in ProjectZer0.
                </text>
                <text 
                    x={METRICS_SPACING.labelX} 
                    y="40" 
                    class="context-text left-align"
                >
                    You can always change your vote using the buttons below.
                </text>
            </g> -->

            <!-- Vote Buttons -->
            <g transform="translate(0, 0)">
                <foreignObject x={-160} width="100" height="45">
                    <div class="button-wrapper">
                        <button 
                            class="vote-button agree"
                            class:active={userVoteStatus === 'agree'}
                            on:click={() => handleVote('agree')}
                            disabled={isVoting}
                        >
                            Agree
                        </button>
                    </div>
                </foreignObject>

                <foreignObject x={-50} width="100" height="45">
                    <div class="button-wrapper">
                        <button 
                            class="vote-button no-vote"
                            class:active={userVoteStatus === 'none'}
                            on:click={() => handleVote('none')}
                            disabled={isVoting}
                        >
                            No Vote
                        </button>
                    </div>
                </foreignObject>

                <foreignObject x={60} width="100" height="45">
                    <div class="button-wrapper">
                        <button 
                            class="vote-button disagree"
                            class:active={userVoteStatus === 'disagree'}
                            on:click={() => handleVote('disagree')}
                            disabled={isVoting}
                        >
                            Disagree
                        </button>
                    </div>
                </foreignObject>
            </g>

           <!-- Vote Stats for the Detail View -->
            <g transform="translate(0, 70)">
                <text x={METRICS_SPACING.labelX} class="stats-label left-align">
                    Vote Data:
                </text>
                
                <!-- User's current vote -->
                <g transform="translate(0, 30)">
                    <text x={METRICS_SPACING.labelX} class="stats-text left-align">
                        {userName}
                    </text>
                    <text x={METRICS_SPACING.equalsX} class="stats-text">
                        =
                    </text>
                    <text x={METRICS_SPACING.valueX} class="stats-value left-align">
                        {userVoteStatus}
                    </text>
                </g>

                <!-- Total agree votes -->
                <g transform="translate(0, 55)">
                    <text x={METRICS_SPACING.labelX} class="stats-text left-align">
                        Total Agree
                    </text>
                    <text x={METRICS_SPACING.equalsX} class="stats-text">
                        =
                    </text>
                    <text x={METRICS_SPACING.valueX} class="stats-value left-align">
                        {positiveVotes}
                    </text>
                </g>

                <!-- Total disagree votes -->
                <g transform="translate(0, 80)">
                    <text x={METRICS_SPACING.labelX} class="stats-text left-align">
                        Total Disagree
                    </text>
                    <text x={METRICS_SPACING.equalsX} class="stats-text">
                        =
                    </text>
                    <text x={METRICS_SPACING.valueX} class="stats-value left-align">
                        {negativeVotes}
                    </text>
                </g>

                <!-- Net votes -->
                <g transform="translate(0, 105)">
                    <text x={METRICS_SPACING.labelX} class="stats-text left-align">
                        Net 
                    </text>
                    <text x={METRICS_SPACING.equalsX} class="stats-text">
                        =
                    </text>
                    <text x={METRICS_SPACING.valueX} class="stats-value left-align">
                        {netVotes}
                    </text>
                </g>

                <!-- Statement status -->
                <g transform="translate(0, 130)">
                    <text x={METRICS_SPACING.labelX} class="stats-text left-align">
                        Statement Status
                    </text>
                    <text x={METRICS_SPACING.equalsX} class="stats-text">
                        =
                    </text>
                    <text x={METRICS_SPACING.valueX} class="stats-value left-align">
                        {statementStatus}
                    </text>
                </g>
            </g>
            
            <!-- Creator credits -->
            {#if data.createdBy}
                <g transform="translate(0, {radius - 55})">
                    <text class="creator-label">
                        created by: {getDisplayName(data.createdBy, null, !data.publicCredit)}
                    </text>
                </g>
            {/if}

        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange} on:hover={handleHover} {voteBasedStyles}>
        <svelte:fragment slot="title" let:radius>
            <text
                y={-radius + 40}
                class="title centered"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size="12px"
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Statement
            </text>
        </svelte:fragment>

        <svelte:fragment slot="content" let:radius>
            <text
                y={-radius/4 - 35}
                x={-radius + 35}
                class="content left-aligned"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.word.size}
                style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
            >
                {#each lines as line, i}
                    <tspan 
                        x={-radius + 40}
                        dy={i === 0 ? 0 : "1.2em"}
                    >
                        {line}
                    </tspan>
                {/each}
            </text>
        </svelte:fragment>

        <svelte:fragment slot="score" let:radius>
            <text
                y={radius - 30}
                class="score"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.value.size}
                style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
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

    .centered {
        text-anchor: middle;
    }

    .left-aligned, .left-align {
        text-anchor: start;
    }

    .content {
        fill: white;
    }

    .score {
        fill: rgba(255, 255, 255, 0.7);
    }

    .keywords-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.9);
    }

    /* .context-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.9);
    } */

    .stats-label {
        font-size: 14px;
        fill: white;
    }

    .stats-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .stats-value {
        font-size: 14px;
        fill: white;
    }

    .creator-label {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.5);
    }

    /* Detail Mode Styling */
    :global(.statement-text) {
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        text-align: left;
        padding-right: 20px;
    }
    
    :global(.keywords-container) {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }
    
    :global(.keyword-chip) {
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 10px;
        color: white;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.keyword-chip.ai-keyword) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
    }
    
    :global(.keyword-chip.user-keyword) {
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
    }

    /* Button Styling */
    :global(.button-wrapper) {
        padding-top: 4px;
        height: 100%;
    }

    :global(.vote-button) {
        width: 100%;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 100px;
        box-sizing: border-box;
        margin: 0;
        color: white;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        white-space: nowrap;
    }

    :global(.vote-button.agree) {
        background: rgba(46, 204, 113, 0.1);
        border: 1px solid rgba(46, 204, 113, 0.2);
    }

    :global(.vote-button.disagree) {
        background: rgba(231, 76, 60, 0.1);
        border: 1px solid rgba(231, 76, 60, 0.2);
    }

    :global(.vote-button.no-vote) {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    :global(.vote-button:hover:not(:disabled)) {
        transform: translateY(-1px);
    }

    :global(.vote-button.agree:hover:not(:disabled)) {
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
    }

    :global(.vote-button.disagree:hover:not(:disabled)) {
        background: rgba(231, 76, 60, 0.2);
        border: 1px solid rgba(231, 76, 60, 0.3);
    }

    :global(.vote-button.no-vote:hover:not(:disabled)) {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    :global(.vote-button:active:not(:disabled)) {
        transform: translateY(0);
    }

    :global(.vote-button.active) {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
    }

    :global(.vote-button.agree.active) {
        background: rgba(46, 204, 113, 0.3);
        border-color: rgba(46, 204, 113, 0.4);
    }

    :global(.vote-button.disagree.active) {
        background: rgba(231, 76, 60, 0.3);
        border-color: rgba(231, 76, 60, 0.4);
    }

    :global(.vote-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>