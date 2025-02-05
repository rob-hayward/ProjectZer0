/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/edges/base/BaseEdge.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import type { GraphNode } from '$lib/types/graph/core';
    import type { EdgePath } from '../../../../services/graph/simulation/ForceSimulation';
    import type { ForceSimulation } from '../../../../services/graph/simulation/ForceSimulation';
    import { EDGE_CONSTANTS } from '../../../../constants/graph/EdgeConstants';
    import { getContext } from 'svelte';
 
    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;
 
    const edgeId = `edge-${Math.random().toString(36).slice(2)}`;
    const gradientId = `gradient-${edgeId}`;
    const filterGlowId = `glow-${edgeId}`;

    // Get the force simulation from context with proper typing
    const simulation = getContext<ForceSimulation>('forceSimulation');

    let path = '';
    let gradientStart = { x: sourceX, y: sourceY };
    let gradientEnd = { x: targetX, y: targetY };

    useEffect(() => { {
        if (simulation) {
            const edgePath = simulation.getEdgePath(sourceNode.id, targetNode.id); });
            if (edgePath) {
                path = edgePath.path;
                gradientStart = edgePath.sourcePoint;
                gradientEnd = edgePath.targetPoint;
            } else {
                // Fallback to direct line if no path from simulation
                path = `M${sourceX},${sourceY}L${targetX},${targetY}`;
                gradientStart = { x: sourceX, y: sourceY };
                gradientEnd = { x: targetX, y: targetY };
            }
        } else {
            // Fallback if no simulation context
            path = `M${sourceX},${sourceY}L${targetX},${targetY}`;
            gradientStart = { x: sourceX, y: sourceY };
            gradientEnd = { x: targetX, y: targetY };
        }
    }


// Original Svelte Template:
/*
<!-- src/lib/components/graph/edges/base/BaseEdge.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/edges/base/BaseEdge.svelte -->
  );
}