<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/word/SvgWordDetail.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { WordNode, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS, CIRCLE_RADIUS } from '../base/BaseNodeConstants';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName, getVoteValue } from '../utils/nodeUtils';

    export let data: WordNode;
    export let style: NodeStyle;

    const CONTENT_WIDTH = 350;
    const CONTENT_START_Y = -180;
    const PADDING = style.padding.detail;
    const LINE_HEIGHT = style.lineHeight.detail;

    let wordCreatorDetails: UserProfile | null = null;
    let definitionCreatorDetails: UserProfile | null = null;

    // Get the live definition (highest voted)
    $: liveDefinition = data.definitions.length > 0
        ? [...data.definitions].sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))[0]
        : null;

    onMount(async () => {
        if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
            wordCreatorDetails = await getUserDetails(data.createdBy);
        }
        
        if (liveDefinition?.createdBy && liveDefinition.createdBy !== 'FreeDictionaryAPI') {
            definitionCreatorDetails = await getUserDetails(liveDefinition.createdBy);
        }
    });

    // Calculate text wrapping for definition
    function wrapText(text: string): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (testLine.length * 10 > CONTENT_WIDTH && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    $: definitionLines = liveDefinition ? wrapText(liveDefinition.text) : [];
</script>

<g class="word-detail">
    <!-- Background gradient -->
    <defs>
        <linearGradient id="contentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.1)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0.05)" />
        </linearGradient>
    </defs>

    <!-- Title -->
    <text
        x="50%"
        y={CONTENT_START_Y + PADDING}
        class="title"
    >
        Word Node
    </text>

    <!-- Word section -->
    <g class="word-section" transform={`translate(${-CONTENT_WIDTH/2}, ${CONTENT_START_Y + PADDING + 40})`}>
        <text class="label">
            word:
            <tspan x={80} class="value">{data.word}</tspan>
        </text>
    </g>

    <!-- Definition section -->
    {#if liveDefinition}
        <g class="definition-section" transform={`translate(${-CONTENT_WIDTH/2}, ${CONTENT_START_Y + PADDING + 80})`}>
            <text class="label">live definition:</text>
            
            {#each definitionLines as line, i}
                <text
                    y={40 + i * LINE_HEIGHT}
                    class="definition"
                >
                    {line}
                </text>
            {/each}

            {#if liveDefinition.createdBy !== 'FreeDictionaryAPI'}
                <text y={40 + definitionLines.length * LINE_HEIGHT + 35} class="label">
                    definition approval votes:
                    <tspan x={200} class="value">{getVoteValue(liveDefinition.votes)}</tspan>
                </text>
            {/if}
        </g>
    {/if}

    <!-- Credits section -->
    <g class="credits-section" transform={`translate(${-CONTENT_WIDTH/2}, ${CIRCLE_RADIUS - 110})`}>
        <!-- Word creator -->
        <text class="credits-label">
            Word created by:
            <tspan x="0" dy="20" class="credits-value">
                {getDisplayName(data.createdBy, wordCreatorDetails, !data.publicCredit)}
            </tspan>
        </text>

        <!-- Definition creator -->
        {#if liveDefinition}
            <text x={CONTENT_WIDTH/2 + 20} class="credits-label">
                Definition created by:
                <tspan x={CONTENT_WIDTH/2 + 20} dy="20" class="credits-value">
                    {getDisplayName(liveDefinition.createdBy, definitionCreatorDetails, false)}
                </tspan>
            </text>
        {/if}
    </g>
</g>

<style>
    text {
        font-family: 'Orbitron', sans-serif;
        fill: white;
    }

    .title {
        font-size: 24px;
        text-anchor: middle;
        fill: rgba(255, 255, 255, 0.9);
    }

    .label {
        font-size: 18px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .value {
        font-size: 18px;
        fill: white;
    }

    .definition {
        font-size: 16px;
        fill: white;
    }

    .credits-label {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .credits-value {
        font-size: 10px;
        fill: white;
    }

    :global(.word-detail text) {
        vector-effect: non-scaling-stroke;
    }
</style>