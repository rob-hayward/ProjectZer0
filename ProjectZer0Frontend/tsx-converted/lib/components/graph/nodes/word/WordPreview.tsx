/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/word/WordPreview.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { onMount, createEventDispatcher } from 'svelte';
    import type { WordNode, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../../../../constants/graph/NodeConstants';
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
    useEffect(() => { {
        const oldScoreDisplay = scoreDisplay; });
        scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
        console.warn('🎯 [WordPreview] SCORE UPDATE:', {
            netVotes,
            oldScoreDisplay,
            newScoreDisplay: scoreDisplay
        });
    }


// Original Svelte Template:
/*
<!-- src/lib/components/graph/nodes/word/WordPreview.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/nodes/word/WordPreview.svelte -->
  );
}