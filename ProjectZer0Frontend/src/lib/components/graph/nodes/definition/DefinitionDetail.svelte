<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionDetail.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { Definition, NodeStyle, VoteStatus } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { fetchWithAuth } from '$lib/services/api';
    
    export let data: Definition;
    export let word: string;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;

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
    let netVotes: number;
    let definitionStatus: string;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: 'preview' | 'detail' };
    }>();

    function handleCollapse() {
        dispatch('modeChange', { mode: 'preview' });
    }

    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }

    async function initializeVoteStatus(retryCount = 0) {
        if (!$userStore) return;
        
        try {
            console.log('[DefinitionDetail] Fetching vote status for definition:', data.id);
            const response = await fetchWithAuth(`/definitions/${data.id}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            console.log('[DefinitionDetail] Vote status response:', response);
            
            userVoteStatus = response.status || 'none';
            data.positiveVotes = getNeo4jNumber(response.positiveVotes);
            data.negativeVotes = getNeo4jNumber(response.negativeVotes);

            console.log('[DefinitionDetail] Updated vote status:', {
                userVoteStatus,
                positiveVotes: data.positiveVotes,
                negativeVotes: data.negativeVotes
            });
        } catch (error) {
            console.error('[DefinitionDetail] Error fetching vote status:', error);
            
            if (retryCount < MAX_RETRIES) {
                console.log(`[DefinitionDetail] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await initializeVoteStatus(retryCount + 1);
            }
        }
    }

    async function handleVote(voteType: VoteStatus) {
        if (!$userStore || isVoting) return;
        isVoting = true;
        const oldVoteStatus = userVoteStatus;

        try {
            console.log('[DefinitionDetail] Processing vote:', { 
                definitionId: data.id, 
                voteType,
                currentStatus: userVoteStatus
            });

            // Optimistic update
            userVoteStatus = voteType;
            
            if (voteType === 'none') {
                const result = await fetchWithAuth(
                    `/definitions/${data.id}/vote/remove`,
                    { method: 'POST' }
                );
                
                data.positiveVotes = getNeo4jNumber(result.positiveVotes);
                data.negativeVotes = getNeo4jNumber(result.negativeVotes);
                console.log('[DefinitionDetail] Vote removed:', result);
            } else {
                const result = await fetchWithAuth(
                    `/definitions/${data.id}/vote`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ 
                            isPositive: voteType === 'agree'
                        })
                    }
                );

                data.positiveVotes = getNeo4jNumber(result.positiveVotes);
                data.negativeVotes = getNeo4jNumber(result.negativeVotes);
                console.log('[DefinitionDetail] Vote recorded:', result);
            }
        } catch (error) {
            console.error('[DefinitionDetail] Error processing vote:', error);
            // Revert on error
            userVoteStatus = oldVoteStatus;
            // Retry vote status fetch to ensure consistency
            await initializeVoteStatus();
        } finally {
            isVoting = false;
        }
    }

    onMount(async () => {
        console.log('[DefinitionDetail] Mounting with definition:', data);
        // Initialize vote counts
        data.positiveVotes = getNeo4jNumber(data.positiveVotes);
        data.negativeVotes = getNeo4jNumber(data.negativeVotes);

        await initializeVoteStatus();
    });

    // Reactive declarations
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    $: netVotes = (data.positiveVotes || 0) - (data.negativeVotes || 0);
    $: definitionStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';

    // Debug reactive updates
    $: {
        console.log('[DefinitionDetail] Vote state updated:', {
            userVoteStatus,
            netVotes,
            definitionStatus,
            positiveVotes: data.positiveVotes,
            negativeVotes: data.negativeVotes
        });
    }
</script>

<BaseDetailNode {style}>
    <svelte:fragment slot="default" let:radius>
        <!-- Title -->
        <text
            y={-radius + 40}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            {type === 'live' ? 'Live Definition' : 'Alternative Definition'}
        </text>

        <!-- Definition Display -->
        <g class="definition-display" transform="translate(0, {-radius/2 - 40})">
            <foreignObject 
                x={METRICS_SPACING.labelX}
                width={Math.abs(METRICS_SPACING.labelX) * 2}
                height="100"
            >
                <div class="definition-line">
                    <span class="word-text">{word}:</span>
                    <span class="definition-text">{data.text}</span>
                </div>
            </foreignObject>
        </g>

        <!-- User Context -->
        <g transform="translate(0, -100)">
            <text 
                x={METRICS_SPACING.labelX} 
                class="context-text left-align"
            >
                Please vote on whether you agree with this definition 
            </text>
            <text 
                x={METRICS_SPACING.labelX} 
                y="25" 
                class="context-text left-align"
            >
                for this word within the context of ProjectZer0.
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
            {data.positiveVotes || 0}
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
            {data.negativeVotes || 0}
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

    <!-- Definition status -->
    <g transform="translate(0, 130)">
        <text x={METRICS_SPACING.labelX} class="stats-text left-align">
            Definition Status
        </text>
        <text x={METRICS_SPACING.equalsX} class="stats-text">
            =
        </text>
        <text x={METRICS_SPACING.valueX} class="stats-value left-align">
            {definitionStatus}
        </text>
    </g>
</g>
        
        <!-- Creator credits -->
        <g transform="translate(0, {radius - 55})">
            <text class="creator-label">
                defined by: {getDisplayName(data.createdBy, null, false)}
            </text>
        </g>

        <!-- Collapse button -->
        <ExpandCollapseButton 
            mode="collapse"
            y={radius}
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

    .definition-text {
        fill: white;
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

    :global(.definition-line) {
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        text-align: left;
        padding-right: 20px;
    }

    :global(.word-text) {
        font-weight: 500;
        margin-right: 8px;
    }

    :global(.definition-text) {
        opacity: 0.9;
    }
</style>