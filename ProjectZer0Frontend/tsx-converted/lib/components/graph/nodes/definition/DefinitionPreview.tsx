/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionPreview.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { onMount, createEventDispatcher } from 'svelte';
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../../../../constants/graph/NodeConstants';
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
    useEffect(() => { textWidth = style.previewSize - (style.padding.preview * 2) - 45; });
    useEffect(() => { maxCharsPerLine = Math.floor(textWidth / 8); });

    // Text wrapping
    useEffect(() => { content = `${word}: ${definition.text}`; });
    useEffect(() => { lines = content.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || ''; });
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
    useEffect(() => { {
        const oldScoreDisplay = scoreDisplay; });
        scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
        console.warn('🎯 [DefinitionPreview] SCORE UPDATE:', {
            netVotes,
            oldScoreDisplay,
            newScoreDisplay: scoreDisplay
        });
    }


// Original Svelte Template:
/*
<!-- src/lib/components/graph/nodes/definition/DefinitionPreview.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/nodes/definition/DefinitionPreview.svelte -->
  );
}