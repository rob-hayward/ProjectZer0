<script lang="ts">
    import type { Definition, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { BasePreviewNode, BaseZoomedNode } from '../base';
    import { drawDefinitionNodePreview } from './DefinitionNodePreview';
    import { drawDefinitionNodeZoomed } from './DefinitionNodeZoomed';
    import { getUserDetails } from '$lib/services/userLookup';
    import { createDefinitionNodeStyle } from '../utils/nodeStyles';
    
    export let data: Definition;
    export let word: string;
    export let mode: 'preview' | 'zoomed' = 'preview';
    export let type: 'live' | 'alternative' = 'alternative';

    // State for zoomed view
    let creatorDetails: UserProfile | null = null;

    async function loadUserDetails() {
        if (mode === 'zoomed' && data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
            creatorDetails = await getUserDetails(data.createdBy);
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
            drawDefinitionNodePreview(ctx, centerX, centerY, style, isHovered, data, word, type);
        } else {
            drawDefinitionNodeZoomed(ctx, centerX, centerY, style, data, word, creatorDetails, type);
        }
    }

    function handleZoom() {
        mode = mode === 'preview' ? 'zoomed' : 'preview';
    }

    $: if (mode === 'zoomed') {
        loadUserDetails();
    }

    const nodeStyle = createDefinitionNodeStyle();
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