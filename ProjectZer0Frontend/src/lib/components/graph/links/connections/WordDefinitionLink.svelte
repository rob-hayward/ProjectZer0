<!-- src/lib/components/graph/links/connections/WordDefinitionLink.svelte -->
<script lang="ts">
    import type { GraphNode } from '$lib/types/graph/core';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import BaseLink from '../base/BaseLink.svelte';
    import { LINK_CONSTANTS } from '../../../../constants/graph/links';

    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;

    $: isLiveDefinition = targetNode.type === 'definition' && 
                         (targetNode.data as Definition).id === 
                         (sourceNode.data as WordNode).definitions[0].id;

    $: targetColor = isLiveDefinition ? 
        LINK_CONSTANTS.COLORS.DEFINITION.LIVE : 
        LINK_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE;

    $: {
        // Log specific word-definition link details
        console.log(`Word-Definition link metrics:`, {
            wordId: sourceNode.id,
            definitionId: targetNode.id,
            isLive: isLiveDefinition,
            coordinates: {
                source: { x: sourceX, y: sourceY },
                target: { x: targetX, y: targetY }
            }
        });
    }
</script>

<BaseLink
    {sourceNode}
    {targetNode}
    {sourceX}
    {sourceY}
    {targetX}
    {targetY}
>
    <svelte:fragment slot="gradient">
        <stop 
            offset="0%" 
            stop-color={LINK_CONSTANTS.COLORS.WORD}
            stop-opacity={LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.START_OPACITY} 
        />
        <stop 
            offset="100%" 
            stop-color={targetColor}
            stop-opacity={LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.END_OPACITY} 
        />
    </svelte:fragment>
</BaseLink>