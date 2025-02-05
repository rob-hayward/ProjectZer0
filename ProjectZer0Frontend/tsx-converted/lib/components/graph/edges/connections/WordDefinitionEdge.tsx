/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/edges/connections/WordDefinitionEdge.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import type { GraphNode } from '$lib/types/graph/core';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import BaseEdge from '../base/BaseEdge.svelte';
    import { EDGE_CONSTANTS } from '../../../../constants/graph/EdgeConstants';

    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;

    useEffect(() => { isLiveDefinition = targetNode.type === 'definition' && 
                         (targetNode.data as Definition).id === 
                         (sourceNode.data as WordNode).definitions[0].id; });

    useEffect(() => { targetColor = isLiveDefinition ? 
        EDGE_CONSTANTS.COLORS.DEFINITION.LIVE : 
        EDGE_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE; });


// Original Svelte Template:
/*
<!-- src/lib/components/graph/edges/connections/WordDefinitionEdge.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/edges/connections/WordDefinitionEdge.svelte -->
  );
}