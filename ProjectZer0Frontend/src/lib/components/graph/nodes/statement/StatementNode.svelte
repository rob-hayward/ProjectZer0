<!-- src/lib/components/graph/nodes/statement/StatementNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';
    import { COORDINATE_SPACE } from '../../../../constants/graph/coordinate-space';
    import { COLORS } from '$lib/constants/colors';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { fetchWithAuth } from '$lib/services/api';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    
    export let node: RenderableNode;
    
    // Type guard for statement data
    function isStatementData(data: any): data is {
        id: string;
        statement: string;
        createdBy: string;
        publicCredit: boolean;
        positiveVotes: number;
        negativeVotes: number;
        keywords?: Array<{word: string; frequency: number; source: string}>;
        initialComment?: string;
        createdAt: string;
    } {
        return data && typeof data.statement === 'string';
    }
    
    if (!isStatementData(node.data)) {
        throw new Error('Invalid node data type for StatementNode');
    }

    // Statement data
    const data = node.data;
    
    // Compute the statement text
    $: statementText = data.statement;
    
    // Reactive declaration for mode to ensure reactivity
    $: isDetail = node.mode === 'detail';
    
    // Calculate radius based on mode - this is the key to making resizing work
    $: radiusValue = isDetail ? 
        COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2 : 
        COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2;
    
    // Create a key that will force re-render when mode changes
    let renderKey = 0;
    $: {
        if (node.mode) {
            renderKey++; // Force re-render when mode changes
        }
    }
    
    // Debug when mode changes
    $: console.debug(`[StatementNode:${node.id}] Mode changed:`, { 
        mode: node.mode, 
        isDetail,
        radius: node.radius,
        calculatedRadius: radiusValue
    });

    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };

    let userVoteStatus: VoteStatus = 'none';
    let isVoting = false;
    let creatorDetails: any = null;
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();

    // Function to handle expanding or collapsing the node
    function handleModeChange() {
        const newMode = isDetail ? 'preview' : 'detail';
        console.debug(`[StatementNode:${node.id}] Mode change requested:`, { 
            currentMode: node.mode, 
            newMode
        });
        
        // Dispatch the mode change event
        dispatch('modeChange', { mode: newMode });
    }

    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }

    async function initializeVoteStatus() {
        // Temporary initialization with defaults since backend endpoints aren't ready
        console.log('[StatementNode] TEMPORARY: Initializing vote status with defaults');
        userVoteStatus = 'none';
        data.positiveVotes = data.positiveVotes || 0;
        data.negativeVotes = data.negativeVotes || 0;
    }

    async function handleVote(voteType: VoteStatus) {
        // Temporary implementation until backend is ready
        console.warn('[StatementNode] Vote endpoints not implemented yet');
        userVoteStatus = voteType;
    }

    onMount(async () => {
        console.log('[StatementNode] Mounting with statement:', {
            id: data.id,
            statement: statementText,
            mode: node.mode,
            radius: node.radius
        });
        
        await initializeVoteStatus();
    });

    // Reactive declarations
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    
    // Calculate vote stats locally with reactive declarations
    $: positiveVotes = getNeo4jNumber(data.positiveVotes) || 0;
    $: negativeVotes = getNeo4jNumber(data.negativeVotes) || 0;
    $: netVotes = positiveVotes - negativeVotes;
    $: totalVotes = positiveVotes + negativeVotes;
    $: positivePercent = totalVotes > 0 ? Math.round((positiveVotes / totalVotes) * 100) : 0;
    $: negativePercent = totalVotes > 0 ? Math.round((negativeVotes / totalVotes) * 100) : 0;
    
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    $: statementStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
    
    // Size calculations for preview mode
    $: textWidth = radiusValue * 2 - 45;
    $: maxCharsPerLine = Math.floor(textWidth / 8);

    // Text wrapping for preview mode
    $: lines = statementText.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);
</script>

{#key renderKey}
<g class="statement-node-wrapper" data-radius-value={radiusValue} style="--radius: {radiusValue}px">
{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="default" let:radius>
            <!-- Title -->
            <text
                y={-radiusValue + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Statement
            </text>
     
            <!-- Main Statement Display -->
            <g class="statement-display" transform={`translate(0, ${-radiusValue/2})`}>
                <foreignObject 
                    x={METRICS_SPACING.labelX}
                    width={Math.abs(METRICS_SPACING.labelX) * 2}
                    height="100"
                >
                    <div class="statement-text">{statementText}</div>
                </foreignObject>
            </g>
    
            <!-- Keywords Display -->
            {#if data.keywords && data.keywords.length > 0}
                <g transform={`translate(0, ${-radiusValue/2 + 110})`}>
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
            <g transform={`translate(0, -50)`}>
                <text 
                    x={METRICS_SPACING.labelX} 
                    class="context-text left-align"
                >
                    Please vote on whether you agree with this statement. 
                </text>
                <text 
                    x={METRICS_SPACING.labelX} 
                    y="20" 
                    class="context-text left-align"
                >
                    You can always change your vote using the buttons below.
                </text>
            </g>
     
            <!-- Vote Buttons -->
            <g transform={`translate(0, 0)`}>
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
            <g transform={`translate(0, 60)`}>
                <text x={METRICS_SPACING.labelX} class="stats-label left-align">
                    Vote Data:
                </text>
                
                <!-- User's current vote -->
                <g transform={`translate(0, 30)`}>
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
                <g transform={`translate(0, 55)`}>
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
                <g transform={`translate(0, 80)`}>
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
                <g transform={`translate(0, 105)`}>
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
                <g transform={`translate(0, 130)`}>
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
                <g transform={`translate(0, ${radiusValue - 55})`}>
                    <text class="creator-label">
                        created by: {getDisplayName(data.createdBy, creatorDetails, !data.publicCredit)}
                    </text>
                </g>
            {/if}
     
            <!-- Contract button -->
            <ExpandCollapseButton 
                mode="collapse"
                y={radiusValue}
                on:click={handleModeChange}
            />
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <text
                y={-radiusValue + 40}
                class="title"
                style:font-family={NODE_CONSTANTS.FONTS.title.family}
                style:font-size={NODE_CONSTANTS.FONTS.title.size}
                style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
            >
                Statement
            </text>
        </svelte:fragment>

        <svelte:fragment slot="content" let:radius>
            <text
                y={10}
                class="content left-aligned"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.word.size}
                style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
            >
                {#each lines as line, i}
                    <tspan 
                        x={-radiusValue + 40}
                        dy={i === 0 ? 0 : "1.2em"}
                    >
                        {line}
                    </tspan>
                {/each}
            </text>
            
            {#if data.keywords && data.keywords.length > 0}
                <foreignObject
                    x={-radiusValue + 35}
                    y={10 + (lines.length * 20)}
                    width={radiusValue * 2 - 70}
                    height="30"
                >
                    <div class="preview-keywords">
                        {#each data.keywords.slice(0, 3) as keyword}
                            <span class="preview-keyword-chip">
                                {keyword.word}
                            </span>
                        {/each}
                        {#if data.keywords.length > 3}
                            <span class="preview-keyword-chip more">
                                +{data.keywords.length - 3}
                            </span>
                        {/if}
                    </div>
                </foreignObject>
            {/if}
        </svelte:fragment>

        <svelte:fragment slot="score" let:radius>
            <text
                y={radiusValue - 30}
                class="score"
                style:font-family={NODE_CONSTANTS.FONTS.word.family}
                style:font-size={NODE_CONSTANTS.FONTS.value.size}
                style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
            >
                {scoreDisplay}
            </text>
        </svelte:fragment>

        <!-- Expand Button in Preview Mode -->
        <svelte:fragment slot="button" let:radius>
            <ExpandCollapseButton 
                mode="expand"
                y={radiusValue}
                on:click={handleModeChange}
            />
        </svelte:fragment>
    </BasePreviewNode>
{/if}
</g>
{/key}

<style>
    .statement-node-wrapper :global(.background-layer-1),
    .statement-node-wrapper :global(.background-layer-2),
    .statement-node-wrapper :global(.background-layer-3),
    .statement-node-wrapper :global(.content-background),
    .statement-node-wrapper :global(.outer-ring),
    .statement-node-wrapper :global(.middle-ring) {
        r: var(--radius);
        transition: r 0.3s ease-out;
    }

    /* Base Text Styles */
    text {
        text-anchor: middle;
        font-family: 'Orbitron', sans-serif;
        fill: white;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
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

    .context-text {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.9);
    }

    .keywords-label {
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

    /* Preview Mode Styling */
    :global(.preview-keywords) {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    
    :global(.preview-keyword-chip) {
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.3);
        border-radius: 10px;
        padding: 0px 6px;
        font-size: 9px;
        color: white;
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.preview-keyword-chip.more) {
        background: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.3);
    }

    /* Button Styling */
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
</style>