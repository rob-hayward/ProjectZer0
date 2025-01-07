<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from './BaseNodeConstants';
    import BaseNode from './BaseNode.svelte';

    export let style: NodeStyle;
    export let transform: string;
    export let hoverText: string = 'click to view detailed node';

    let isHovered = false;
    
    const dispatch = createEventDispatcher<{
        detail: void;
        hover: { isHovered: boolean };
    }>();

    function handleClick() {
        dispatch('detail');
    }

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        isHovered = event.detail.isHovered;
        dispatch('hover', event.detail);
    }

    function wrapText(text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (testLine.length * 5 > maxWidth && currentLine) {  
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

    $: hoverLines = wrapText(hoverText, style.previewSize / 2);
</script>

<BaseNode 
    {style}
    {transform}
    {isHovered}
    on:click={handleClick}
    on:hover={handleHover}
>
    <slot {isHovered} {style} />

    {#if isHovered}
        <!-- Hover overlay -->
        <circle
            r={style.previewSize / 2 - 12}
            class="hover-overlay"
        />

        <!-- Wrapped hover text -->
        {#each hoverLines as line, i}
            <text
                y={-10 + (i * 20)}
                class="hover-text"
                style:font-family={NODE_CONSTANTS.FONTS.hover.family}
                style:font-size={NODE_CONSTANTS.FONTS.hover.size}
                style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
            >
                {line}
            </text>
        {/each}
    {/if}
</BaseNode>

<style>
    .hover-overlay {
        fill: rgba(0, 0, 0, 0.85);
        transition: opacity 0.3s ease-out;
    }

    .hover-text {
        text-anchor: middle;
        fill: rgba(255, 255, 255, 0.9);
        transition: opacity 0.3s ease-out;
        user-select: none;
    }
</style>