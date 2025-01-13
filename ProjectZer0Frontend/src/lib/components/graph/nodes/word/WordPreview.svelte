<!-- src/lib/components/graph/nodes/word/WordPreview.svelte -->
<script lang="ts">
    import type { NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';

    export let word: string;
    export let style: NodeStyle;
    export let centerX: number;
    export let centerY: number;
    export let radius: number;

    $: backgroundColor = style.colors.background;
</script>

<g class="word-preview">
    <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill={backgroundColor}
    />

    <circle
        cx={centerX}
        cy={centerY}
        r={radius}
    
        stroke-width="12"
        fill="none"
    />

    <text
        x={centerX}
        y={centerY - 10}
        class="title"
        style:font-family={NODE_CONSTANTS.FONTS.title.family}
        style:font-size={NODE_CONSTANTS.FONTS.title.size}
        style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
    >
        Word
    </text>

    <text
        x={centerX}
        y={centerY + 10}
        class="word"
        style:font-family={NODE_CONSTANTS.FONTS.word.family}
        style:font-size={NODE_CONSTANTS.FONTS.word.size}
        style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
    >
        {word}
    </text>
</g>

<style>
    .word-preview text {
        text-anchor: middle;
        vector-effect: non-scaling-stroke;
        dominant-baseline: middle;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .word {
        fill: white;
    }
</style>