<!-- src/lib/components/graph/nodes/navigation/NavigationContainer.svelte -->
<script lang="ts">
    import type { NavigationOption } from '$lib/types/navigation';
    import NavigationNode from './NavigationNode.svelte';
    
    export let options: NavigationOption[];
    export let centerX: number = 0;
    export let centerY: number = 0;
    export let radius: number = 200;

    let hoveredNodeId: string | null = null;

    $: positions = options.map((option, index) => {
        const angle = (index / options.length) * 2 * Math.PI - Math.PI / 2;
        return {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            option
        };
    });

    function handleHover(nodeId: string, isHovered: boolean) {
        hoveredNodeId = isHovered ? nodeId : null;
    }
</script>

<g class="navigation-container">
    <!-- Common filter for all navigation nodes -->
    <defs>
        <filter id="navigationGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
        </filter>
    </defs>

    {#each positions as { x, y, option }}
        <NavigationNode
            {option}
            {x}
            {y}
            isHovered={hoveredNodeId === option.id}
            on:mouseover={() => handleHover(option.id, true)}
            on:mouseout={() => handleHover(option.id, false)}
            on:click
        />
    {/each}
</g>

<style>
    .navigation-container {
        pointer-events: none;
    }

    :global(.navigation-container > *) {
        pointer-events: all;
    }
</style>