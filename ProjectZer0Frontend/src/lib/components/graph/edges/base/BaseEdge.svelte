<!-- src/lib/components/graph/edges/base/BaseEdge.svelte -->
<script lang="ts">
    import type { GraphNode } from '$lib/types/graph/core';
    import type { EdgePath } from '../../../../services/graph/simulation/ForceSimulation';
    import type { ForceSimulation } from '../../../../services/graph/simulation/ForceSimulation';
    import { EDGE_CONSTANTS } from '../../../../constants/graph/edges';
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

    $: {
        if (simulation) {
            const edgePath = simulation.getEdgePath(sourceNode.id, targetNode.id);
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
</script>
 
<g 
    class="edge" 
    data-edge-id={edgeId}
    data-source-id={sourceNode.id}
    data-target-id={targetNode.id}
>
    <defs>
        <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={gradientStart.x}
            y1={gradientStart.y}
            x2={gradientEnd.x}
            y2={gradientEnd.y}
        >
            <slot name="gradient">
                <stop
                    offset="0%"
                    stop-color={EDGE_CONSTANTS.COLORS.WORD}
                    stop-opacity="0.8"
                />
                <stop
                    offset="100%"
                    stop-color={EDGE_CONSTANTS.COLORS.WORD}
                    stop-opacity="0.4"
                />
            </slot>
        </linearGradient>

        <filter id={filterGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 0.5 0"
            />
            <feComposite in="SourceGraphic" operator="over" />
        </filter>
    </defs>
 
    <!-- Background glow -->
    <path
        d={path}
        class="edge-glow"
        filter={`url(#${filterGlowId})`}
    />
 
    <!-- Main edge path -->
    <path
        d={path}
        stroke={`url(#${gradientId})`}
        class="edge-path"
        data-source-type={sourceNode.type}
        data-target-type={targetNode.type}
    />
</g>
 
<style>
    .edge {
        pointer-events: none;
    }
 
    .edge-path {
        fill: none;
        stroke-width: 2px;
        vector-effect: non-scaling-stroke;
    }
 
    .edge-glow {
        fill: none;
        stroke: rgba(255, 255, 255, 0.1);
        stroke-width: 4px;
        vector-effect: non-scaling-stroke;
    }
</style>