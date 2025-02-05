<!-- src/lib/components/graph/edges/connections/WordDefinitionEdge.svelte -->
<script lang="ts">
    import type { GraphNode } from '$lib/types/graph/core';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import BaseEdge from '../base/BaseEdge.svelte';
    import { EDGE_CONSTANTS } from '../../../../constants/graph/edges';

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
        EDGE_CONSTANTS.COLORS.DEFINITION.LIVE : 
        EDGE_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE;
</script>

<BaseEdge
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
            stop-color={EDGE_CONSTANTS.COLORS.WORD}
            stop-opacity={EDGE_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.START_OPACITY} 
        />
        <stop 
            offset="100%" 
            stop-color={targetColor}
            stop-opacity={EDGE_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.END_OPACITY} 
        />
    </svelte:fragment>
</BaseEdge>