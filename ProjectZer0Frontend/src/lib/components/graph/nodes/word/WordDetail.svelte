<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { WordNode, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName } from '../utils/nodeUtils';
    import { fetchWithAuth } from '$lib/services/api';
    import { userStore } from '$lib/stores/userStore';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';

    export let data: WordNode;
    export let style: NodeStyle;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: 'preview' | 'detail' };
    }>();

    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };

    let wordCreatorDetails: UserProfile | null = null;
    let userVoteStatus: 'agree' | 'disagree' | 'none' = 'none';
    let isVoting = false;
    let userName: string;
    let netVotes: number;
    let wordStatus: string;

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }

    async function initializeVoteStatus(retryCount = 0) {
        if (!$userStore) return;
        
        try {
            const response = await fetchWithAuth(`/nodes/word/${data.word}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            userVoteStatus = response.status || 'none';
            data.positiveVotes = getNeo4jNumber(response.positiveVotes);
            data.negativeVotes = getNeo4jNumber(response.negativeVotes);
        } catch (error) {
            console.error('Error fetching vote status:', error);
            
            if (retryCount < MAX_RETRIES) {
                console.log(`Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await initializeVoteStatus(retryCount + 1);
            }
        }
    }

    function handleCollapse() {
        dispatch('modeChange', { mode: 'preview' });
    }

    async function handleVote(voteType: 'agree' | 'disagree' | 'none') {
        if (!$userStore || isVoting) return;
        isVoting = true;
        const oldVoteStatus = userVoteStatus;

        try {
            // Optimistic update
            userVoteStatus = voteType;
            
            if (voteType === 'none') {
                const result = await fetchWithAuth(
                    `/nodes/word/${data.word}/vote/remove`,
                    { method: 'POST' }
                );
                
                data.positiveVotes = getNeo4jNumber(result.positiveVotes);
                data.negativeVotes = getNeo4jNumber(result.negativeVotes);
            } else {
                const result = await fetchWithAuth(
                    `/nodes/word/${data.word}/vote`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ 
                            isPositive: voteType === 'agree'
                        })
                    }
                );

                data.positiveVotes = getNeo4jNumber(result.positiveVotes);
                data.negativeVotes = getNeo4jNumber(result.negativeVotes);
            }
        } catch (error) {
            console.error('Error voting:', error);
            // Revert on error
            userVoteStatus = oldVoteStatus;
            // Retry vote status fetch to ensure consistency
            await initializeVoteStatus();
        } finally {
            isVoting = false;
        }
    }

    onMount(async () => {
        if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
            wordCreatorDetails = await getUserDetails(data.createdBy);
        }

        // Initialize vote counts
        data.positiveVotes = getNeo4jNumber(data.positiveVotes);
        data.negativeVotes = getNeo4jNumber(data.negativeVotes);

        await initializeVoteStatus();
    });

    // Reactive declarations
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    $: netVotes = getNeo4jNumber(data.positiveVotes) - getNeo4jNumber(data.negativeVotes);
    $: wordStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
 </script>
 
 <BaseDetailNode {style}>
    <svelte:fragment slot="default" let:radius let:isHovered>
        <!-- Title -->
        <text
            y={-radius + 40}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            word
        </text>
 
        <!-- Main Word Display -->
        <g class="word-display" transform="translate(0, {-radius/2})">
            <text
                class="word main-word"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
            >
                {data.word}
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
            <foreignObject x={-160} width="100" height="40">
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
 
            <foreignObject x={-50} width="100" height="40">
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
 
            <foreignObject x={60} width="100" height="40">
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
                    {data.positiveVotes}
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
                    {data.negativeVotes}
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
        <g transform="translate(0, {radius - 55})">
            <text class="creator-label">
                created by: {getDisplayName(data.createdBy, wordCreatorDetails, !data.publicCredit)}
            </text>
        </g>
 
        <!-- Contract button -->
        <ExpandCollapseButton 
            mode="collapse"
            y={radius - 500}
            on:click={handleCollapse}
        />
    </svelte:fragment>
 </BaseDetailNode>
 
 <style>
    text {
        text-anchor: middle;
        font-family: 'Orbitron', sans-serif;
    }
 
    .title {
        fill: rgba(255, 255, 255, 0.7);
    }
 
    .main-word {
        font-size: 30px;
        fill: white;
        filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
    }
 
    .context-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.9);
    }
 
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
 
    .left-align {
        text-anchor: start;
    }
 
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
 
    :global(.vote-button.agree.active) {
        background: rgba(46, 204, 113, 0.3);
        border-color: rgba(46, 204, 113, 0.4);
    }
 
    :global(.vote-button.disagree.active) {
        background: rgba(231, 76, 60, 0.3);
        border-color: rgba(231, 76, 60, 0.4);
    }
 
    :global(.vote-button.no-vote.active) {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
    }
 
    :global(.vote-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
 </style>