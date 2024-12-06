<!-- MainGraph.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import ConcentricLayout from './layouts/ConcentricLayout.svelte';
  
    export let nodes: GraphNode[];
    export let edges: GraphEdge[];

    const dispatch = createEventDispatcher();
</script>

<div class="main-graph">
    {#if nodes && edges}
        <ConcentricLayout {nodes} {edges} let:node>
            <slot name="node" {node} />
        </ConcentricLayout>
    {/if}
</div>

<style>
    .main-graph {
        width: 100%;
        height: 100%;
        position: relative;
        background-color: black;
        overflow: hidden;
    }
</style>