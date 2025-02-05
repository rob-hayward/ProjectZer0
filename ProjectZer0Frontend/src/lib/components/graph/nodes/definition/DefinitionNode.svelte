<!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Definition } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName } from '../utils/nodeUtils';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BaseSvgNode from '../base/BaseNode.svelte';

    export let data: Definition;
    export let word: string;
    export let transform: string;
    export let type: 'live' | 'alternative' = 'alternative';
    
    const dispatch = createEventDispatcher<{
        click: { data: Definition };
        hover: { data: Definition; isHovered: boolean };
    }>();

    let creatorDetails: UserProfile | null = null;

    $: style = {
        previewSize: type === 'live' 
            ? NODE_CONSTANTS.SIZES.DEFINITION.live.preview 
            : NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview,
        detailSize: NODE_CONSTANTS.SIZES.DEFINITION.live.detail,
        colors: NODE_CONSTANTS.COLORS.DEFINITION[type],
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    };

    $: fontSize = type === 'live' 
        ? NODE_CONSTANTS.FONTS.title.size
        : NODE_CONSTANTS.FONTS.value.size;

    async function loadUserDetails() {
        if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
            creatorDetails = await getUserDetails(data.createdBy);
        }
    }

    function handleClick() {
        dispatch('click', { data });
    }

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', { data, isHovered: event.detail.isHovered });
    }

    $: {
        loadUserDetails();
    }
</script>

<BaseSvgNode
    {style}
    {transform}
    on:click={handleClick}
    on:hover={handleHover}
>
    <defs>
        <radialGradient id="definition-gradient-{type}" cx="50%" cy="50%" r="50%">
            <stop 
                offset="0%" 
                stop-color={style.colors.gradient.start}
            />
            <stop 
                offset="100%" 
                stop-color={style.colors.gradient.end}
            />
        </radialGradient>

        <filter id="definition-glow-{type}">
            <feGaussianBlur 
                in="SourceGraphic" 
                stdDeviation={NODE_CONSTANTS.SVG.filters.glow.deviation}
            />
            <feComponentTransfer>
                <feFuncA 
                    type="linear" 
                    slope={NODE_CONSTANTS.SVG.filters.glow.strength}
                />
            </feComponentTransfer>
        </filter>
    </defs>

    <!-- Title -->
    <text
        y={-style.previewSize/4}
        class="title"
        style:font-family={NODE_CONSTANTS.FONTS.title.family}
        style:font-size={fontSize}
        style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
    >
        {type === 'live' ? 'Live Definition' : 'Alternative Definition'}
    </text>

    <!-- Word -->
    <text
        y={-style.previewSize/4 + style.lineHeight.preview * 2}
        class="word"
        style:font-family={NODE_CONSTANTS.FONTS.value.family}
        style:font-size={fontSize}
        style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
    >
        {word}
    </text>

    <!-- Definition text -->
    <foreignObject
        x={-style.previewSize/2 + style.padding.preview}
        y={-style.previewSize/4 + style.lineHeight.preview * 3}
        width={style.previewSize - style.padding.preview * 2}
        height={style.previewSize/2}
    >
        <div class="definition-text">
            {data.text}
        </div>
    </foreignObject>

    <!-- Creator info -->
    {#if data.createdBy !== 'FreeDictionaryAPI'}
        <text
            y={style.previewSize/4 - style.lineHeight.preview * 2}
            class="votes"
            style:font-family={NODE_CONSTANTS.FONTS.value.family}
            style:font-size={fontSize}
            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
        >
            Votes: {data.votes}
        </text>
    {/if}

    <text
        y={style.previewSize/4 - style.lineHeight.preview}
        class="creator"
        style:font-family={NODE_CONSTANTS.FONTS.value.family}
        style:font-size={fontSize}
        style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
    >
        Created by: {getDisplayName(data.createdBy, creatorDetails, false)}
    </text>
</BaseSvgNode>

<style>
    text {
        text-anchor: middle;
        fill: var(--text-color, white);
        user-select: none;
    }

    .title {
        --text-color: var(--title-color, rgba(255, 255, 255, 0.9));
    }

    .word {
        --text-color: var(--word-color, white);
    }

    .definition-text {
        color: var(--text-color, rgba(255, 255, 255, 0.9));
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        overflow-wrap: break-word;
        text-align: center;
        padding: 0 10px;
    }

    .votes, .creator {
        --text-color: var(--meta-color, rgba(255, 255, 255, 0.7));
    }

    :global(.definition-node) {
        transition: all var(--animation-duration, 0.3s) var(--animation-easing, ease-out);
    }
</style>