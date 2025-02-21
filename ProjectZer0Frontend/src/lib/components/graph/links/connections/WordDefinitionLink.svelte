<!-- ProjectZer0Frontend/src/lib/components/graph/links/connections/WordDefinitionLink.svelte -->
<script lang="ts">
    import type { GraphNode } from '$lib/types/graph/core';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import BaseLink from '../base/BaseLink.svelte';
    import { LINK_CONSTANTS } from '$lib/constants/graph/links';
 
    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;
    export let version: any = undefined;
    
    // Determine if this is a live definition link
    $: isLiveDefinition = targetNode?.type === 'definition' && 
                         (targetNode.data as Definition)?.id === 
                         (sourceNode?.data as WordNode)?.definitions?.[0]?.id;
 
    // Get the appropriate color based on definition type
    $: targetColor = isLiveDefinition ? 
        LINK_CONSTANTS.COLORS.DEFINITION.LIVE : 
        LINK_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE;
</script>

{#if sourceNode && targetNode && sourceX !== undefined && sourceY !== undefined && 
       targetX !== undefined && targetY !== undefined}
    <BaseLink
        {sourceNode}
        {targetNode}
        {sourceX}
        {sourceY}
        {targetX}
        {targetY}
        {version}
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
{/if}