<!-- src/lib/components/graph/nodes/definition/SvgDefinitionNode.svelte -->
<script lang="ts">
    import type { Definition } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import type { SvgNodePosition } from '$lib/types/svgLayout';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName } from '../utils/nodeUtils';
    import { createEventDispatcher } from 'svelte';

    export let data: Definition;
    export let word: string;
    export let position: SvgNodePosition;
    export let type: 'live' | 'alternative' = 'alternative';
    
    const dispatch = createEventDispatcher<{
        click: { data: Definition };
        mouseenter: { data: Definition };
        mouseleave: { data: Definition };
    }>();

    let creatorDetails: UserProfile | null = null;
    let isHovered = false;

    const nodeRadius = type === 'live' ? 180 : 160;
    const fontSize = type === 'live' ? 16 : 14;

    const colors = {
        background: type === 'live' 
            ? 'rgba(74, 144, 226, 0.1)' 
            : 'rgba(0, 0, 0, 0.7)',
        border: type === 'live'
            ? 'rgba(74, 144, 226, 0.3)'
            : 'rgba(255, 255, 255, 0.2)',
        borderHover: type === 'live'
            ? 'rgba(74, 144, 226, 0.5)'
            : 'rgba(255, 255, 255, 0.4)',
        text: type === 'live'
            ? 'rgba(74, 144, 226, 0.9)'
            : 'rgba(255, 255, 255, 0.9)'
    };

    async function loadUserDetails() {
        if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
            creatorDetails = await getUserDetails(data.createdBy);
        }
    }

    function handleClick() {
        dispatch('click', { data });
    }

    function handleMouseEnter() {
        isHovered = true;
        dispatch('mouseenter', { data });
    }

    function handleMouseLeave() {
        isHovered = false;
        dispatch('mouseleave', { data });
    }

    // Use position for transform
    $: transform = position?.svgTransform || '';

    $: {
        loadUserDetails();
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g
    class="definition-node"
    class:is-hovered={isHovered}
    class:is-live={type === 'live'}
    {transform}
    on:click={handleClick}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
>
    <!-- Rest of the template remains the same -->
    <circle
        r={nodeRadius}
        fill={colors.background}
        stroke={isHovered ? colors.borderHover : colors.border}
        stroke-width="2"
    />

    <text
        class="title"
        y={-nodeRadius + 30}
        fill={colors.text}
        font-family="Orbitron, sans-serif"
        font-size={fontSize}
        text-anchor="middle"
    >
        {type === 'live' ? 'Live Definition' : 'Alternative Definition'}
    </text>

    <text
        class="word"
        y={-nodeRadius + 60}
        fill={colors.text}
        font-family="Orbitron, sans-serif"
        font-size={fontSize + 2}
        text-anchor="middle"
    >
        {word}
    </text>

    <foreignObject
        x={-nodeRadius + 20}
        y={-nodeRadius + 80}
        width={nodeRadius * 2 - 40}
        height={nodeRadius * 2 - 100}
    >
        <div class="definition-text">
            {data.text}
        </div>
    </foreignObject>

    <text
        class="creator"
        y={nodeRadius - 20}
        fill={colors.text}
        font-family="Orbitron, sans-serif"
        font-size={fontSize - 4}
        text-anchor="middle"
    >
        Created by: {getDisplayName(data.createdBy, creatorDetails, false)}
    </text>

    {#if data.createdBy !== 'FreeDictionaryAPI'}
        <text
            class="votes"
            y={nodeRadius - 40}
            fill={colors.text}
            font-family="Orbitron, sans-serif"
            font-size={fontSize - 2}
            text-anchor="middle"
        >
            Votes: {data.votes}
        </text>
    {/if}
</g>

<style>
    .definition-node {
        cursor: pointer;
        transition: all 0.3s ease-out;
    }

    .definition-text {
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        overflow-wrap: break-word;
        text-align: center;
        padding: 0 10px;
    }

    .is-hovered {
        filter: brightness(1.2);
    }

    :global(.definition-node text) {
        user-select: none;
    }

    :global(.definition-text) {
        background: transparent;
        color: rgba(255, 255, 255, 0.9);
    }
</style>