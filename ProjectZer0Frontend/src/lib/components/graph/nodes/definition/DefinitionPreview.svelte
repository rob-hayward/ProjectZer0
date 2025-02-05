<!-- src/lib/components/graph/nodes/definition/DefinitionPreview.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { userStore } from '$lib/stores/userStore';
    import { fetchWithAuth } from '$lib/services/api';

    export let definition: Definition;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;
    export let transform: string = "";
    export let word: string;

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    let netVotes: number = 0;
    let scoreDisplay: string = "0";

    const dispatch = createEventDispatcher<{
        hover: { data: Definition; isHovered: boolean };
        modeChange: { mode: 'preview' | 'detail' };
    }>();

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', { data: definition, isHovered: event.detail.isHovered });
    }

    function handleExpandClick() {
        dispatch('modeChange', { mode: 'detail' });
    }

    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }

    async function initializeVoteStatus(retryCount = 0) {
        if (!$userStore) return;
        
        try {
            const response = await fetchWithAuth(`/definitions/${definition.id}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            console.log('[DefinitionPreview] Vote status response:', response);
            
            // Ensure we handle the neo4j number format
            const posVotes = getNeo4jNumber(response.positiveVotes);
            const negVotes = getNeo4jNumber(response.negativeVotes);
            
            console.log('[DefinitionPreview] Parsed vote numbers:', { posVotes, negVotes });
            
            definition.positiveVotes = posVotes;
            definition.negativeVotes = negVotes;
            
            // Update net votes directly
            netVotes = posVotes - negVotes;
            
            console.log('[DefinitionPreview] Updated state:', {
                positiveVotes: definition.positiveVotes,
                negativeVotes: definition.negativeVotes,
                netVotes,
                currentScoreDisplay: scoreDisplay
            });
        } catch (error) {
            console.error('[DefinitionPreview] Error fetching vote status:', error);
            
            if (retryCount < MAX_RETRIES) {
                console.log(`[DefinitionPreview] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await initializeVoteStatus(retryCount + 1);
            }
        }
    }

    // Size calculations
    $: textWidth = style.previewSize - (style.padding.preview * 2) - 45;
    $: maxCharsPerLine = Math.floor(textWidth / 8);

    // Text wrapping
    $: content = `${word}: ${definition.text}`;
    $: lines = content.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);

    onMount(async () => {
        console.warn('🎯 [DefinitionPreview] MOUNT:', {
            id: definition.id,
            initialPositiveVotes: definition.positiveVotes,
            initialNegativeVotes: definition.negativeVotes
        });
        
        // Initialize vote counts
        const initialPos = getNeo4jNumber(definition.positiveVotes);
        const initialNeg = getNeo4jNumber(definition.negativeVotes);
        netVotes = initialPos - initialNeg;

        console.warn('🎯 [DefinitionPreview] INITIAL CALCS:', {
            initialPos,
            initialNeg,
            netVotes,
            scoreDisplay
        });

        await initializeVoteStatus();
    });

    // Update score display whenever net votes changes
    $: {
        const oldScoreDisplay = scoreDisplay;
        scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
        console.warn('🎯 [DefinitionPreview] SCORE UPDATE:', {
            netVotes,
            oldScoreDisplay,
            newScoreDisplay: scoreDisplay
        });
    }
</script>

<BasePreviewNode 
    {style}
    {transform}
>
    <svelte:fragment slot="title">
        <text
            y={-style.previewSize/4 - 50}
            class="title centered"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size="12px"
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            {type === 'live' ? 'Live Definition' : 'Alternative Definition'}
        </text>
    </svelte:fragment>

    <svelte:fragment slot="content">
        <text
            y={-style.previewSize/4 + 20}
            x={-style.previewSize/2 + 35}
            class="content left-aligned"
            style:font-family={NODE_CONSTANTS.FONTS.word.family}
            style:font-size={NODE_CONSTANTS.FONTS.word.size}
            style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
        >
            {#each lines as line, i}
                <tspan 
                    x={-style.previewSize/2 + 40}
                    dy={i === 0 ? 0 : "1.2em"}
                >
                    {line}
                </tspan>
            {/each}
        </text>
    </svelte:fragment>

    <svelte:fragment slot="score">
        <text
            y={style.previewSize/4 + 10}
            class="score"
            style:font-family={NODE_CONSTANTS.FONTS.word.family}
            style:font-size={NODE_CONSTANTS.FONTS.value.size}
            style:font-weight={NODE_CONSTANTS.FONTS.value.weight}
        >
            {scoreDisplay}
        </text>
    </svelte:fragment>

    <svelte:fragment slot="button" let:radius>
        <ExpandCollapseButton 
            mode="expand"
            y={radius}
            on:click={handleExpandClick}
        />
    </svelte:fragment>
</BasePreviewNode>

<style>
    text {
        dominant-baseline: middle;
        user-select: none;
    }

    .centered {
        text-anchor: middle;
    }

    .left-aligned {
        text-anchor: start;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .content {
        fill: white;
    }

    .score {
        fill: rgba(255, 255, 255, 0.7);
        text-anchor: middle;
    }
</style>