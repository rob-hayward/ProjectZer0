<!-- src/lib/components/graph/nodes/word/WordPreview.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { WordNode, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { userStore } from '$lib/stores/userStore';
    import { fetchWithAuth } from '$lib/services/api';

    export let data: WordNode;
    export let style: NodeStyle;
    export let transform: string = "";

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    let netVotes: number = 0;
    let scoreDisplay: string = "0";

    const dispatch = createEventDispatcher<{
        modeChange: { mode: 'preview' | 'detail' };
    }>();

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
            const response = await fetchWithAuth(`/nodes/word/${data.word}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            console.log('[WordPreview] Vote status response:', response);
            
            // Ensure we handle the neo4j number format
            const posVotes = getNeo4jNumber(response.positiveVotes);
            const negVotes = getNeo4jNumber(response.negativeVotes);
            
            console.log('[WordPreview] Parsed vote numbers:', { posVotes, negVotes });
            
            data.positiveVotes = posVotes;
            data.negativeVotes = negVotes;
            
            // Update net votes directly
            netVotes = posVotes - negVotes;
            
            console.log('[WordPreview] Updated state:', {
                positiveVotes: data.positiveVotes,
                negativeVotes: data.negativeVotes,
                netVotes,
                currentScoreDisplay: scoreDisplay
            });
        } catch (error) {
            console.error('[WordPreview] Error fetching vote status:', error);
            
            if (retryCount < MAX_RETRIES) {
                console.log(`[WordPreview] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await initializeVoteStatus(retryCount + 1);
            }
        }
    }

    onMount(async () => {
        console.warn('🎯 [WordPreview] MOUNT:', {
            word: data.word,
            initialPositiveVotes: data.positiveVotes,
            initialNegativeVotes: data.negativeVotes
        });
        
        // Initialize vote counts
        const initialPos = getNeo4jNumber(data.positiveVotes);
        const initialNeg = getNeo4jNumber(data.negativeVotes);
        netVotes = initialPos - initialNeg;

        console.warn('🎯 [WordPreview] INITIAL CALCS:', {
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
        console.warn('🎯 [WordPreview] SCORE UPDATE:', {
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
            y={-style.previewSize/4 - 15}
            class="title"
            style:font-family={NODE_CONSTANTS.FONTS.title.family}
            style:font-size={NODE_CONSTANTS.FONTS.title.size}
            style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
        >
            Word
        </text>
    </svelte:fragment>

    <svelte:fragment slot="content">
        <text
            y={-style.previewSize/4 + 40}
            class="content"
            style:font-family={NODE_CONSTANTS.FONTS.word.family}
            style:font-size={NODE_CONSTANTS.FONTS.word.size}
            style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
        >
            {data.word}
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
        text-anchor: middle;
        dominant-baseline: middle;
        user-select: none;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .content {
        fill: white;
    }

    .score {
        fill: rgba(255, 255, 255, 0.7);
    }
</style>