<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/definition/SvgDefinitionDetail.svelte-->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS, CIRCLE_RADIUS } from '../base/BaseNodeConstants';
    import { getDisplayName, getVoteValue } from '../utils/nodeUtils';
    import { wrapSvgText } from '../base/BaseSvgText';

    export let data: Definition;
    export let word: string;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;
    export let creatorDetails: UserProfile | null = null;

    const CONTENT_WIDTH = 350;
    const CONTENT_START_Y = -180;
    const PADDING = style.padding.detail;
    const LINE_HEIGHT = style.lineHeight.detail;

    // Generate unique gradient ID for this instance
    const gradientId = `definition-detail-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate wrapped definition text
    $: definitionLines = wrapSvgText(
        data.text,
        CONTENT_WIDTH - (PADDING * 2)
    );

    $: creator = getDisplayName(data.createdBy, creatorDetails, false);
    $: votesValue = getVoteValue(data.votes);
</script>

<!-- Rest of the component remains the same -->

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
        {type === 'live' ? "Live Definition Node" : "Alternative Definition Node"}
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

    <!-- Votes section -->
    {#if data.createdBy !== 'FreeDictionaryAPI'}
        <g class="votes-section" transform={`translate(${-CONTENT_WIDTH/2 + PADDING}, ${CONTENT_START_Y + 240})`}>
            <text class="label">
                definition approval votes:
                <tspan x="200" class="value">{votesValue}</tspan>
            </text>
        </g>
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

    .credits-label {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .credits-value {
        font-size: 14px;
        fill: white;
    }

    /* Hover effects */
    .definition-detail {
        transition: all 0.3s ease-out;
    }

    .definition-detail:hover {
        filter: brightness(1.1);
    }
</style>