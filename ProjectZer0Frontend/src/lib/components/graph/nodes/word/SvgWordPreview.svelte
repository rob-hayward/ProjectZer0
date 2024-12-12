<!-- src/lib/components/graph/nodes/word/SvgWordPreview.svelte -->
<script lang="ts">
    import type { NodeStyle } from '$lib/types/nodes';

    export let word: string;
    export let style: NodeStyle;
    export let centerX: number;
    export let centerY: number;
    export let radius: number;
    export let isHovered: boolean;

    // Use style properties
    $: backgroundColor = style.colors.background;
    $: borderColor = isHovered ? style.colors.hover : style.colors.border;
    $: titleColor = style.colors.text;
</script>

<g class="word-preview">
    <!-- Background circle -->
    <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill={backgroundColor}
    />

    <!-- Border -->
    <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        stroke={borderColor}
        stroke-width="2"
        fill="none"
    />

    <!-- Title -->
    <text
        x={centerX}
        y={centerY - style.padding.preview}
        dy="0.35em"
        class="title"
        fill={titleColor}
    >
        Word Node
    </text>

    <!-- Word -->
    <text
        x={centerX}
        y={centerY}
        dy="0.35em"
        class="word"
    >
        {word}
    </text>

    <!-- Hover prompt -->
    {#if isHovered}
        <text
            x={centerX}
            y={centerY + style.padding.preview}
            dy="0.35em"
            class="hover-text"
        >
            click to zoom
        </text>
    {/if}
</g>

<style>
    .word-preview text {
        text-anchor: middle;
        font-family: 'Orbitron', sans-serif;
        vector-effect: non-scaling-stroke;
    }

    .title {
        font-size: 12px;
    }

    .word {
        font-size: 14px;
        fill: white;
        font-weight: 500;
    }

    .hover-text {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.7);
    }
</style>