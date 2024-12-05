<script lang="ts">
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import { ConcentricLayout, type NodePosition } from './ConcentricLayout';
    import { onMount } from 'svelte';

    export let nodes: GraphNode[];
    export let edges: GraphEdge[];
    
    const layout = new ConcentricLayout();
    let positions: Map<string, NodePosition>;

    $: {
        console.log('ConcentricLayout updating with nodes:', nodes);
        positions = layout.calculateLayout(nodes, edges);
        console.log('Calculated positions:', positions);
    }
</script>

<div class="concentric-layout">
    {#each nodes as node (node.id)}
        {@const pos = positions.get(node.id)}
        {#if pos}
            <div 
                class="node-wrapper"
                style="transform: translate(-50%, -50%) 
                       translate({pos.x}px, {pos.y}px) 
                       scale({pos.scale}) 
                       rotate({pos.rotation}deg)"
            >
                <slot {node} />
            </div>
        {/if}
    {/each}
</div>

<style>
    .concentric-layout {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .node-wrapper {
        position: absolute;
        top: 50%;
        left: 50%;
        transition: transform 0.3s ease-out;
    }
</style>