<!-- ProjectZer0Frontend/src/lib/components/graph/edges/base/BaseEdge.svelte -->
<script lang="ts">
    import { calculateEdgePath, adjustEdgeLength, getNodeRadius } from '../utils/edgeUtils';
    import { EDGE_CONSTANTS } from './BaseEdgeConstants';
    import type { GraphNode } from '$lib/types/graph';
 
    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;
 
    const edgeId = `edge-${Math.random().toString(36).slice(2)}`;
    const gradientId = `gradient-${edgeId}`;
    const filterGlowId = `glow-${edgeId}`;
 
    let path: string;
    $: {
        const sourceRadius = getNodeRadius(sourceNode);
        const targetRadius = getNodeRadius(targetNode);
        
        // Adjust coordinates to account for node sizes
        const adjusted = adjustEdgeLength(
            sourceX,
            sourceY,
            targetX,
            targetY,
            sourceRadius,
            targetRadius
        );
        
        path = calculateEdgePath(
            adjusted.x1,
            adjusted.y1,
            adjusted.x2,
            adjusted.y2
        );
    }
 </script>
 
 <g 
    class="edge" 
    data-edge-id={edgeId}
    data-source-id={sourceNode.id}
    data-target-id={targetNode.id}
 >
    <defs>
        <!-- Add glow filter -->
        <filter id={filterGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 0.5 0"
            />
            <feComposite in="SourceGraphic" operator="over" />
        </filter>
 
        <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
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