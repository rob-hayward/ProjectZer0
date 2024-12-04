<!-- src/components/graph/nodes/word/WordNode.svelte -->
<script lang="ts">
    import type { WordNode, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { BasePreviewNode, BaseZoomedNode } from '../base';
    import { drawWordNodePreview } from './WordNodePreview';
    import { drawWordNodeZoomed } from './WordNodeZoomed';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getVoteValue } from '../utils/nodeUtils';
    import { createWordNodeStyle } from '../utils/nodeStyles';
    
    export let data: WordNode;
    export let mode: 'preview' | 'zoomed' = 'preview';

    // State for zoomed view
    let wordCreatorDetails: UserProfile | null = null;
    let liveDefinition = getLiveDefinition(data.definitions);
    let definitionCreatorDetails: UserProfile | null = null;

    function getLiveDefinition(definitions: WordNode['definitions']) {
        if (!definitions?.length) return null;
        return [...definitions]
            .sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))[0];
    }

    async function loadUserDetails() {
        if (mode === 'zoomed') {
            if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
                wordCreatorDetails = await getUserDetails(data.createdBy);
            }
            
            if (liveDefinition?.createdBy && liveDefinition.createdBy !== 'FreeDictionaryAPI') {
                definitionCreatorDetails = await getUserDetails(liveDefinition.createdBy);
            }
        }
    }

    function drawContent(
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: NodeStyle, 
        isHovered: boolean
    ) {
        if (mode === 'preview') {
            drawWordNodePreview(ctx, centerX, centerY, style, isHovered, data);
        } else {
            drawWordNodeZoomed(
                ctx, 
                centerX, 
                centerY, 
                style, 
                data, 
                wordCreatorDetails, 
                liveDefinition, 
                definitionCreatorDetails
            );
        }
    }

    function handleZoom() {
        mode = mode === 'preview' ? 'zoomed' : 'preview';
    }

    $: if (mode === 'zoomed') {
        loadUserDetails();
    }

    const nodeStyle = createWordNodeStyle();
</script>


{#if mode === 'preview'}
    <BasePreviewNode
        style={nodeStyle}
        {drawContent}
        on:zoom={handleZoom}
    />
{:else}
    <BaseZoomedNode
        style={nodeStyle}
        {drawContent}
        on:close={handleZoom}
    />
{/if}