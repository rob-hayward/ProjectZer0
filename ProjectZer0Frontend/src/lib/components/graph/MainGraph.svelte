<script lang="ts">
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import ConcentricLayout from './layouts/ConcentricLayout.svelte';

    export let nodes: GraphNode[];
    export let edges: GraphEdge[];

    console.log('MainGraph received nodes:', nodes);
    console.log('MainGraph received edges:', edges);
</script>

<div class="main-graph" style="border: 1px solid rgba(255,255,255,0.1);">
    {#if nodes.length > 0}
        <ConcentricLayout {nodes} {edges} let:node>
            <div class="node-debug">
                <slot name="node" {node} />
            </div>
        </ConcentricLayout>
    {:else}
        <div class="loading">No nodes to display</div>
    {/if}
</div>

<style>
    .main-graph {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .node-debug {
        outline: 1px solid rgba(255,255,255,0.2);
    }

    .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-family: 'Orbitron', sans-serif;
    }
</style>