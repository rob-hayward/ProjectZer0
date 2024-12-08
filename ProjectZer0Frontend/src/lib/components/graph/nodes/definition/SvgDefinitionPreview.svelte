<!-- src/lib/components/graph/nodes/definition/SvgDefinitionPreview.svelte -->
<script lang="ts">
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { wrapSvgText, type SvgTextOptions } from '../base/BaseSvgText';

    export let word: string;
    export let definition: Definition;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;
    export let centerX: number;
    export let centerY: number;
    export let isHovered: boolean;

    // Generate unique gradient ID for this instance
    const gradientId = `definition-preview-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate positions
    $: titleY = centerY - (style.previewSize * 0.25);
    $: wordY = titleY + style.lineHeight.preview;
    $: definitionStartY = wordY + style.lineHeight.preview * 2;
    $: maxWidth = style.previewSize - (style.padding.preview * 2);

    // Calculate wrapped definition text
    $: definitionLines = wrapSvgText(definition.text, maxWidth);

    // Calculate hover text position
    $: hoverY = centerY + (style.previewSize * 0.3);
</script>

<g class="definition-preview" class:is-live={type === 'live'}>
    <!-- Gradient definitions -->
    <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" 
                stop-color={type === 'live' ? 'rgba(74, 144, 226, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 
            />
            <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
        </linearGradient>

        <!-- Glow filter for hover effect -->
        <filter id="hover-glow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="0" />
            <feComponentTransfer>
                <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
    </defs>

    <!-- Background circle -->
    <circle
        cx={centerX}
        cy={centerY}
        r={style.previewSize / 2 - 10}
        class="background"
        fill={`url(#${gradientId})`}
    />

    <!-- Border with hover effect -->
    <circle
        cx={centerX}
        cy={centerY}
        r={style.previewSize / 2 - 10}
        class="border"
        class:hovered={isHovered}
        fill="none"
        filter={isHovered ? 'url(#hover-glow)' : undefined}
    />

    <!-- Title -->
    <text
        x={centerX}
        y={titleY}
        font-family="Orbitron, sans-serif"
        font-size="16px"
        fill={type === 'live' ? 'rgba(74, 144, 226, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
        text-anchor="middle"
    >
        {type === 'live' ? "Live Definition" : "Alternative Definition"}
    </text>

    <!-- Word -->
    <text
        x={centerX}
        y={wordY}
        font-family="Orbitron, sans-serif"
        font-size="18px"
        fill="white"
        text-anchor="middle"
    >
        {word}
    </text>

    <!-- Definition text -->
    <text
        x={centerX}
        y={definitionStartY}
        font-family="Orbitron, sans-serif"
        font-size="14px"
        fill="rgba(255, 255, 255, 0.8)"
        text-anchor="middle"
    >
        {#each definitionLines as line, i}
            <tspan
                x={centerX}
                dy={i === 0 ? 0 : style.lineHeight.preview}
            >
                {line}
            </tspan>
        {/each}
    </text>

    <!-- Hover text with animation -->
    {#if isHovered}
        <text
            x={centerX}
            y={hoverY}
            font-family="Orbitron, sans-serif"
            font-size="14px"
            fill="rgba(255, 255, 255, 0.7)"
            text-anchor="middle"
        >
            <animate
                attributeName="opacity"
                values="0;1"
                dur="0.3s"
                begin="0s"
                fill="freeze"
            />
            click to zoom
        </text>
    {/if}
</g>

<style>
    .background {
        fill: rgba(0, 0, 0, 0.5);
    }

    .border {
        stroke: rgba(255, 255, 255, 0.3);
        stroke-width: 2;
        transition: stroke 0.3s ease;
    }

    .border.hovered {
        stroke: rgba(255, 255, 255, 0.4);
        stroke-width: 3;
    }

    :global(.definition-preview *) {
        vector-effect: non-scaling-stroke;
    }

    .definition-preview {
        transition: transform 0.3s ease-out;
    }
</style>