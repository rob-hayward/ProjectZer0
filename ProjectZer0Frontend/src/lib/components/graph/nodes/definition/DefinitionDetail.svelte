<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionDetail.svelte-->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS, CIRCLE_RADIUS } from '../base/BaseNodeConstants';
    import { getDisplayName, getVoteValue } from '../utils/nodeUtils';
    import { wrapSvgText } from '../base/BaseSvgText';
    import { fetchWithAuth } from '$lib/services/api';
    import { userStore } from '$lib/stores/userStore';

    export let data: Definition;
    export let word: string;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;
    export let creatorDetails: UserProfile | null = null;

    const CONTENT_WIDTH = 350;
    const CONTENT_START_Y = -180;
    const PADDING = style.padding.detail;
    const LINE_HEIGHT = style.lineHeight.detail;

    let voteStatus: 'agree' | 'none' = 'none';
    let isVoting = false;
    let showDisagreeMessage = false;

    // Generate unique gradient ID for this instance
    const gradientId = `definition-detail-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate wrapped definition text
    $: definitionLines = wrapSvgText(
        data.text,
        CONTENT_WIDTH - (PADDING * 2)
    );

    $: creator = getDisplayName(data.createdBy, creatorDetails, false);
    $: votesValue = getVoteValue(data.votes);

    onMount(async () => {
        if ($userStore) {
            try {
                const response = await fetchWithAuth(
                    `/definitions/${data.id}/vote`
                );
                voteStatus = response.hasVoted ? 'agree' : 'none';
            } catch (error) {
                console.error('Error fetching vote status:', error);
            }
        }
    });

    async function handleAgreeVote() {
        if (!$userStore || isVoting) return;
        isVoting = true;
        showDisagreeMessage = false;

        try {
            const result = await fetchWithAuth(
                `/definitions/${data.id}/vote`,
                {
                    method: 'POST',
                    body: JSON.stringify({ vote: 'agree' })
                }
            );

            voteStatus = result.hasVoted ? 'agree' : 'none';
            data.votes = getVoteValue(result.definition.votes);
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            isVoting = false;
        }
    }

    async function handleDisagreeVote() {
        if (!$userStore || isVoting) return;
        isVoting = true;

        try {
            const result = await fetchWithAuth(
                `/definitions/${data.id}/vote`,
                {
                    method: 'POST',
                    body: JSON.stringify({ vote: 'disagree' })
                }
            );

            voteStatus = 'none';
            showDisagreeMessage = true;
            data.votes = getVoteValue(result.definition.votes);
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            isVoting = false;
        }
    }
</script>

<g class="definition-detail" class:is-live={type === 'live'}>
    <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={type === 'live' ? 'rgba(74, 144, 226, 0.1)' : 'rgba(255, 255, 255, 0.1)'} />
            <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
        </linearGradient>
    </defs>

    <!-- Background -->
    <rect
        x={-CONTENT_WIDTH/2}
        y={CONTENT_START_Y}
        width={CONTENT_WIDTH}
        height={style.detailSize}
        fill={`url(#${gradientId})`}
        rx="4"
        ry="4"
    />

    <!-- Title -->
    <text
        x="0"
        y={CONTENT_START_Y + 40}
        class="title"
    >
        {type === 'live' ? "Live Definition" : "Alternative Definition"}
    </text>

    <!-- Word section -->
    <g class="word-section" transform={`translate(${-CONTENT_WIDTH/2 + PADDING}, ${CONTENT_START_Y + 80})`}>
        <text class="label">
            word:
            <tspan x="60" class="value">{word}</tspan>
        </text>
    </g>

    <!-- Definition section -->
    <g class="definition-section" transform={`translate(${-CONTENT_WIDTH/2 + PADDING}, ${CONTENT_START_Y + 120})`}>
        <text class="label">definition:</text>
        
        {#each definitionLines as line, i}
            <text
                y={30 + (i * LINE_HEIGHT)}
                class="definition"
            >
                {line}
            </text>
        {/each}
    </g>

    <!-- Voting section -->
    {#if data.createdBy !== 'FreeDictionaryAPI'}
        <g class="voting-section" transform={`translate(0, ${CONTENT_START_Y + 240})`}>
            <!-- Vote Buttons -->
            <foreignObject x={-160} width="100" height="50">
                <div class="button-wrapper">
                    <button 
                        class="vote-button agree"
                        class:active={voteStatus === 'agree'}
                        on:click={handleAgreeVote}
                        disabled={isVoting}
                    >
                        Agree
                    </button>
                </div>
            </foreignObject>

            <foreignObject x={40} width="100" height="50">
                <div class="button-wrapper">
                    <button 
                        class="vote-button disagree"
                        class:active={voteStatus === 'none'}
                        on:click={handleDisagreeVote}
                        disabled={isVoting}
                    >
                        Disagree
                    </button>
                </div>
            </foreignObject>

            <!-- Vote Information -->
            <text x={-160} dy="80" class="vote-info left-align">
                total agree votes:
            </text>
            <text x={40} dy="80" class="vote-info-value left-align">
                {votesValue}
            </text>

            <text x={-160} dy="100" class="vote-info left-align">
                your vote:
            </text>
            <text x={40} dy="100" class="vote-info-value left-align">
                {voteStatus}
            </text>
        </g>

        <!-- Disagree Message -->
        {#if showDisagreeMessage}
            <g transform="translate(0, 0)">
                <foreignObject 
                    x="-125" 
                    y="-175"
                    width="250" 
                    height="250"  
                >
                    <div class="message-container">
                        <button 
                            class="close-button"
                            on:click={() => showDisagreeMessage = false}
                            aria-label="Close message"
                        >×</button>
                        <div class="message-content">
                            <p>If you disagree with this definition, you can:</p>
                            <ul>
                                <li>View alternative definitions</li>
                                <li>Suggest your own definition</li>
                            </ul>
                            <p class="small-note">The definition with the most votes becomes the live definition.</p>
                        </div>
                    </div>
                </foreignObject>
            </g>
        {/if}
    {/if}

    <!-- Credits section -->
    <g class="credits-section" transform={`translate(${-CONTENT_WIDTH/2 + PADDING}, ${CIRCLE_RADIUS - 110})`}>
        <text class="credits-label">
            Definition created by:
            <tspan x="0" dy="20" class="credits-value">
                {creator}
            </tspan>
        </text>
    </g>
</g>

<style>
    .definition-detail text {
        font-family: 'Orbitron', sans-serif;
        vector-effect: non-scaling-stroke;
    }

    .title {
        font-size: 24px;
        fill: rgba(255, 255, 255, 0.9);
        text-anchor: middle;
    }

    .is-live .title {
        fill: rgba(74, 144, 226, 0.9);
    }

    .label {
        font-size: 16px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .value {
        font-size: 16px;
        fill: white;
    }

    .definition {
        font-size: 16px;
        fill: white;
    }

    .vote-info {
        font-size: 13px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .vote-info-value {
        font-size: 13px;
        fill: white;
    }

    .credits-label {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .credits-value {
        font-size: 14px;
        fill: white;
    }

    .left-align {
        text-anchor: start;
    }

    /* Button styles */
    :global(.button-wrapper) {
        padding-top: 8px;
        height: 100%;
    }

    :global(.vote-button) {
        width: 100%;
        padding: 8px 16px;
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
    }

    :global(.vote-button.agree) {
        background: rgba(46, 204, 113, 0.3);
        border: 1px solid rgba(46, 204, 113, 0.4);
    }

    :global(.vote-button.disagree) {
        background: rgba(231, 76, 60, 0.3);
        border: 1px solid rgba(231, 76, 60, 0.4);
    }

    :global(.vote-button:hover:not(:disabled)) {
        transform: translateY(-1px);
    }

    :global(.vote-button.agree:hover:not(:disabled)) {
        background: rgba(46, 204, 113, 0.4);
        border: 1px solid rgba(46, 204, 113, 0.4);
    }

    :global(.vote-button.disagree:hover:not(:disabled)) {
        background: rgba(231, 76, 60, 0.4);
        border: 1px solid rgba(231, 76, 60, 0.4);
    }

    :global(.vote-button:active:not(:disabled)) {
        transform: translateY(0);
    }

    :global(.vote-button.active.agree) {
        background: rgba(46, 204, 113, 0.4);
        border-color: rgba(46, 204, 113, 0.6);
    }

    :global(.vote-button.active.disagree) {
        background: rgba(231, 76, 60, 0.4);
        border-color: rgba(231, 76, 60, 0.6);
    }

    :global(.vote-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Message container styles */
    :global(.message-container) {
        position: relative;
        width: 200px;
        height: 200px;
        background: rgb(0, 0, 0);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
        pointer-events: auto;
    }

    :global(.close-button) {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;
        line-height: 1;
    }

    :global(.message-content) {
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 11px;
        text-align: center;
    }

    :global(.message-content p) {
        margin: 0 0 10px 0;
    }

    :global(.message-content ul) {
        list-style: none;
        padding: 0;
        margin: 0 0 10px 0;
    }

    :global(.message-content li) {
        margin: 5px 0;
        color: rgba(255, 255, 255, 0.8);
    }

    :global(.message-content .small-note) {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 10px;
    }

    /* Hover effects */
    .definition-detail {
        transition: all 0.3s ease-out;
    }

    .definition-detail:hover {
        filter: brightness(1.1);
    }
</style>