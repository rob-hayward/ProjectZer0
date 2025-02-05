/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionDetail.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { onMount, createEventDispatcher } from 'svelte';
    import type { Definition, NodeStyle, VoteStatus } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS } from '../../../../constants/graph/NodeConstants';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { getDisplayName } from '../utils/nodeUtils';
    import { userStore } from '$lib/stores/userStore';
    import { fetchWithAuth } from '$lib/services/api';
    
    export let data: Definition;
    export let word: string;
    export let type: 'live' | 'alternative';
    export let style: NodeStyle;

    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    let userVoteStatus: VoteStatus = 'none';
    let isVoting = false;
    let userName: string;
    let netVotes: number;
    let definitionStatus: string;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: 'preview' | 'detail' };
    }>();

    function handleCollapse() {
        dispatch('modeChange', { mode: 'preview' });
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
            console.log('[DefinitionDetail] Fetching vote status for definition:', data.id);
            const response = await fetchWithAuth(`/definitions/${data.id}/vote`);
            if (!response) {
                throw new Error('No response from vote status endpoint');
            }
            
            console.log('[DefinitionDetail] Vote status response:', response);
            
            userVoteStatus = response.status || 'none';
            data.positiveVotes = getNeo4jNumber(response.positiveVotes);
            data.negativeVotes = getNeo4jNumber(response.negativeVotes);

            console.log('[DefinitionDetail] Updated vote status:', {
                userVoteStatus,
                positiveVotes: data.positiveVotes,
                negativeVotes: data.negativeVotes
            });
        } catch (error) {
            console.error('[DefinitionDetail] Error fetching vote status:', error);
            
            if (retryCount < MAX_RETRIES) {
                console.log(`[DefinitionDetail] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await initializeVoteStatus(retryCount + 1);
            }
        }
    }

    async function handleVote(voteType: VoteStatus) {
        if (!$userStore || isVoting) return;
        isVoting = true;
        const oldVoteStatus = userVoteStatus;

        try {
            console.log('[DefinitionDetail] Processing vote:', { 
                definitionId: data.id, 
                voteType,
                currentStatus: userVoteStatus
            });

            // Optimistic update
            userVoteStatus = voteType;
            
            if (voteType === 'none') {
                const result = await fetchWithAuth(
                    `/definitions/${data.id}/vote/remove`,
                    { method: 'POST' }
                );
                
                data.positiveVotes = getNeo4jNumber(result.positiveVotes);
                data.negativeVotes = getNeo4jNumber(result.negativeVotes);
                console.log('[DefinitionDetail] Vote removed:', result);
            } else {
                const result = await fetchWithAuth(
                    `/definitions/${data.id}/vote`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ 
                            isPositive: voteType === 'agree'
                        })
                    }
                );

                data.positiveVotes = getNeo4jNumber(result.positiveVotes);
                data.negativeVotes = getNeo4jNumber(result.negativeVotes);
                console.log('[DefinitionDetail] Vote recorded:', result);
            }
        } catch (error) {
            console.error('[DefinitionDetail] Error processing vote:', error);
            // Revert on error
            userVoteStatus = oldVoteStatus;
            // Retry vote status fetch to ensure consistency
            await initializeVoteStatus();
        } finally {
            isVoting = false;
        }
    }

    onMount(async () => {
        console.log('[DefinitionDetail] Mounting with definition:', data);
        // Initialize vote counts
        data.positiveVotes = getNeo4jNumber(data.positiveVotes);
        data.negativeVotes = getNeo4jNumber(data.negativeVotes);

        await initializeVoteStatus();
    });

    // Reactive declarations
    useEffect(() => { userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous'; });
    useEffect(() => { netVotes = (data.positiveVotes || 0) - (data.negativeVotes || 0); });
    useEffect(() => { definitionStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided'; });

    // Debug reactive updates
    useEffect(() => { {
        console.log('[DefinitionDetail] Vote state updated:', {
            userVoteStatus,
            netVotes,
            definitionStatus,
            positiveVotes: data.positiveVotes,
            negativeVotes: data.negativeVotes
        }); });
    }


// Original Svelte Template:
/*
<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionDetail.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionDetail.svelte -->
  );
}