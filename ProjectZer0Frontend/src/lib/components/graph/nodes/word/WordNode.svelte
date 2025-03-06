<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isWordNodeData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '$lib/constants/graph/node-styling';
    import { fetchWithAuth } from '$lib/services/api';
    import { userStore } from '$lib/stores/userStore';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName } from '../utils/nodeUtils';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    
    export let node: RenderableNode;
    export let wordText: string = '';
    
    // Type guard for word node data
    if (!isWordNodeData(node.data)) {
        throw new Error('Invalid node data type for WordNode');
    }

    const wordData = node.data;
    
    // Reactive declaration for mode to ensure reactivity
    $: isDetail = node.mode === 'detail';
    
    // Use wordText as fallback if needed
    $: displayWord = wordData.word || wordText;
    
    // Debug when mode changes
    $: console.debug(`[WordNode:${node.id}] Mode changed:`, { 
        mode: node.mode, 
        isDetail 
    });
    
    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };

    // Voting state
    let totalVotes = 0;
    let positivePercent = 0;
    let negativePercent = 0;
    let createdDate = '';
    let showDiscussionButton = false;
    let userVoteStatus: 'agree' | 'disagree' | 'none' = 'none';
    let isVoting = false;
    let netVotes = 0;
    let scoreDisplay = "0";
    let wordStatus = "";
    let wordCreatorDetails: any = null;
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();

    // Function to handle expanding or collapsing the node
    function handleModeChange() {
        const newMode = isDetail ? 'preview' : 'detail';
        console.debug(`[WordNode:${node.id}] Mode change requested:`, { 
            currentMode: node.mode, 
            newMode 
        });
        dispatch('modeChange', { mode: newMode });
    }

    function formatDate(dateString: string | Date | undefined): string {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }

    async function fetchStatsData(): Promise<void> {
        try {
            const response = await fetchWithAuth(`/words/${wordData.id}/stats`);
            if (response) {
                totalVotes = response.totalVotes || 0;
                positivePercent = response.positivePercent || 0;
                negativePercent = response.negativePercent || 0;
            }
        } catch (error) {
            console.error('Error fetching word stats:', error);
        }
    }

    async function initializeVoteStatus(retryCount = 0) {
        if (!$userStore) return;
        
        try {
            console.log('[WordNode] Fetching vote status for word:', displayWord);
            const response = await fetchWithAuth(`/nodes/word/${displayWord}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            console.log('[WordNode] Vote status response:', response);
            
            userVoteStatus = response.status || 'none';
            wordData.positiveVotes = getNeo4jNumber(response.positiveVotes);
            wordData.negativeVotes = getNeo4jNumber(response.negativeVotes);
            
            // Update net votes directly
            netVotes = (wordData.positiveVotes || 0) - (wordData.negativeVotes || 0);
            
            console.log('[WordNode] Updated vote status:', {
                userVoteStatus,
                positiveVotes: wordData.positiveVotes,
                negativeVotes: wordData.negativeVotes,
                netVotes
            });
        } catch (error) {
            console.error('[WordNode] Error fetching vote status:', error);
            
            const MAX_RETRIES = 3;
            const RETRY_DELAY = 1000;
            if (retryCount < MAX_RETRIES) {
                console.log(`[WordNode] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await initializeVoteStatus(retryCount + 1);
            }
        }
    }

    async function handleVote(voteType: 'agree' | 'disagree' | 'none') {
        if (!$userStore || isVoting) return;
        isVoting = true;
        const oldVoteStatus = userVoteStatus;

        try {
            console.log('[WordNode] Processing vote:', { 
                word: displayWord, 
                voteType,
                currentStatus: userVoteStatus
            });

            // Optimistic update
            userVoteStatus = voteType;
            
            if (voteType === 'none') {
                const result = await fetchWithAuth(
                    `/nodes/word/${displayWord}/vote/remove`,
                    { method: 'POST' }
                );
                
                wordData.positiveVotes = getNeo4jNumber(result.positiveVotes);
                wordData.negativeVotes = getNeo4jNumber(result.negativeVotes);
                console.log('[WordNode] Vote removed:', result);
            } else {
                const result = await fetchWithAuth(
                    `/nodes/word/${displayWord}/vote`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ 
                            isPositive: voteType === 'agree'
                        })
                    }
                );

                wordData.positiveVotes = getNeo4jNumber(result.positiveVotes);
                wordData.negativeVotes = getNeo4jNumber(result.negativeVotes);
                console.log('[WordNode] Vote recorded:', result);
            }
            
            // Update net votes
            netVotes = (wordData.positiveVotes || 0) - (wordData.negativeVotes || 0);
            
        } catch (error) {
            console.error('[WordNode] Error processing vote:', error);
            // Revert on error
            userVoteStatus = oldVoteStatus;
            // Retry vote status fetch to ensure consistency
            await initializeVoteStatus();
        } finally {
            isVoting = false;
        }
    }

    onMount(async () => {
        console.log('[WordNode] Mounting with word:', {
            id: wordData.id,
            word: displayWord,
            mode: node.mode
        });
        
        // Fetch creator details
        if (wordData.createdBy && wordData.createdBy !== 'FreeDictionaryAPI') {
            try {
                wordCreatorDetails = await getUserDetails(wordData.createdBy);
            } catch (e) {
                console.error('[WordNode] Error fetching creator details:', e);
            }
        }
        
        createdDate = formatDate(wordData.createdAt);
        showDiscussionButton = !!wordData.discussion;
        
        // Initialize vote counts
        const initialPos = getNeo4jNumber(wordData.positiveVotes);
        const initialNeg = getNeo4jNumber(wordData.negativeVotes);
        netVotes = initialPos - initialNeg;
        
        console.log('[WordNode] Initial vote counts:', {
            initialPos,
            initialNeg,
            netVotes
        });
        
        await initializeVoteStatus();
        
        if (isDetail) {
            await fetchStatsData();
        }
    });

    // Reactive declarations
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    $: netVotes = (wordData.positiveVotes || 0) - (wordData.negativeVotes || 0);
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    $: wordStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
    
    // Size calculations for preview mode
    $: textWidth = node.radius * 2 - 45;
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="default" let:radius>
            <!-- Title -->
            <text
                y={-radius + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Word
            </text>
     
            <!-- Main Word Display -->
            <g class="word-display" transform="translate(0, {-radius/2})">
                <text
                    class="word main-word"
                    style:font-family={NODE_CONSTANTS.FONTS.word.family}
                    style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
                >
                    {displayWord}
                </text>
            </g>
     
            <!-- User Context -->
            <g transform="translate(0, -100)">
                <text 
                    x={METRICS_SPACING.labelX} 
                    class="context-text left-align"
                >
                    Please vote on whether to include this keyword in 
                </text>
                <text 
                    x={METRICS_SPACING.labelX} 
                    y="25" 
                    class="context-text left-align"
                >
                    ProjectZer0 or not.
                </text>
                <text 
                    x={METRICS_SPACING.labelX} 
                    y="60" 
                    class="context-text left-align"
                >
                    You can always change your vote using the buttons below.
                </text>
            </g>
     
            <!-- Vote Buttons -->
            <g transform="translate(0, -10)">
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
     
            <!-- Vote Stats -->
            <g transform="translate(0, 60)">
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
                        {wordData.positiveVotes || 0}
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
                        {wordData.negativeVotes || 0}
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
     
                <!-- Word status -->
                <g transform="translate(0, 130)">
                    <text x={METRICS_SPACING.labelX} class="stats-text left-align">
                        Word Status
                    </text>
                    <text x={METRICS_SPACING.equalsX} class="stats-text">
                        =
                    </text>
                    <text x={METRICS_SPACING.valueX} class="stats-value left-align">
                        {wordStatus}
                    </text>
                </g>
            </g>
            
            <!-- Creator credits -->
            {#if wordData.createdBy}
                <g transform="translate(0, {radius - 55})">
                    <text class="creator-label">
                        created by: {getDisplayName(wordData.createdBy, wordCreatorDetails, !wordData.publicCredit)}
                    </text>
                </g>
            {/if}
     
            <!-- Contract button -->
            <ExpandCollapseButton 
                mode="collapse"
                y={radius}
                on:click={handleModeChange}
            />
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <text
                y={-radius + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Word
            </text>
        </svelte:fragment>

        <svelte:fragment slot="content" let:radius>
            <text
                y={10}
                class="word-preview"
            >
                {displayWord}
            </text>
        </svelte:fragment>

        <svelte:fragment slot="score" let:radius>
            <text
                y={radius - 30}
                class="score"
            >
                {scoreDisplay}
            </text>
        </svelte:fragment>

        <!-- Expand Button in Preview Mode -->
        <svelte:fragment slot="button" let:radius>
            <ExpandCollapseButton 
                mode="expand"
                y={radius}
                on:click={handleModeChange}
            />
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    text {
        text-anchor: middle;
        font-family: 'Orbitron', sans-serif;
        fill: white;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .main-word {
        font-size: 30px;
        fill: white;
        filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
    }
    
    .word-preview {
        font-size: 24px;
        font-weight: 500;
    }

    .score {
        font-size: 14px;
        opacity: 0.8;
    }

    .stats-label {
        font-size: 14px;
        opacity: 0.7;
    }


    .stats-value {
        font-size: 14px;
    }

    .context-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.9);
    }

    .stats-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .left-align {
        text-anchor: start;
    }

    .creator-label {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.5);
    }

    :global(.button-wrapper) {
        padding-top: 4px;
        padding-bottom: 4px;
        height: auto !important;
        min-height: 45px;
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

    :global(.action-button) {
        padding: 10px 16px;
        border-radius: 4px;
        font-family: 'Orbitron', sans-serif;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        color: white;
        background: rgba(52, 152, 219, 0.3);
        border: 1px solid rgba(52, 152, 219, 0.6);
        backdrop-filter: blur(5px);
    }

    :global(.action-button:hover) {
        background: rgba(52, 152, 219, 0.4);
        transform: translateY(-2px);
    }

    :global(.action-button:active) {
        transform: translateY(0);
    }
</style>