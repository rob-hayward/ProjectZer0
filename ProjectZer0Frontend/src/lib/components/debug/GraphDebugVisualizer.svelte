<!-- src/lib/components/debug/GraphDebugVisualizer.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, RenderableLink } from '$lib/types/graph/enhanced';
    import { coordinateSystem } from '$lib/services/graph/CoordinateSystem';
    
    // Props
    export let node: RenderableNode | null = null;
    export let link: RenderableLink | null = null;
    export let showNodeRadius: boolean = true;
    export let showLinkEndpoints: boolean = true;
    export let showCoordinates: boolean = true;
    export let active: boolean = true;
    export let transform: string = "";
    
    // Local state
    let visible = false;
    let radius = 0;
    let debugId = Math.random().toString(36).substring(2, 9);
    
    // Create event dispatcher
    const dispatch = createEventDispatcher<{
        toggle: { visible: boolean }
    }>();
    
    function toggleVisibility() {
        visible = !visible;
        dispatch('toggle', { visible });
    }
    
    // Update data when props change
    $: {
        if (node) {
            radius = node.radius;
        }
    }
    
    // Use exact node position for debugging (no transforms)
    $: debugTransform = node 
        ? `translate(${node.position.x || 0}, ${node.position.y || 0})` 
        : transform;
    
    onMount(() => {
        console.debug(`[GraphDebugVisualizer:${debugId}] Mounted:`, {
            nodeId: node?.id,
            linkId: link?.id,
            position: node?.position,
            transform: debugTransform
        });
    });
</script>

{#if active}
    <!-- Node debugging visualization -->
    {#if node && node.position}
        <!-- Important: Use the exact position coordinates, not the SVG transform -->
        <g class="debug-node-visualizer" transform={debugTransform}>
            <!-- Toggle button -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <circle 
                cx="0" 
                cy="0" 
                r="10" 
                fill="red" 
                opacity="0.5"
                on:click={toggleVisibility}
            />
            
            {#if visible}
                <!-- Node information -->
                <text x="15" y="0" fill="white" font-size="12" text-anchor="start">
                    {node.id.substring(0, 8)} ({node.type}/{node.mode})
                </text>
                
                <!-- Radius visualization -->
                {#if showNodeRadius}
                    <circle 
                        cx="0" 
                        cy="0" 
                        r={radius} 
                        fill="none" 
                        stroke="red" 
                        stroke-width="2" 
                        stroke-dasharray="5,5"
                        opacity="0.7"
                    />
                    
                    <!-- Radius label -->
                    <text x="0" y={-radius-10} fill="red" font-size="12" text-anchor="middle">
                        r = {radius}
                    </text>
                {/if}
                
                <!-- Coordinates -->
                {#if showCoordinates}
                    <text x="15" y="20" fill="yellow" font-size="10" text-anchor="start">
                        x: {Math.round(node.position.x)}, y: {Math.round(node.position.y)}
                    </text>
                {/if}
                
                <!-- Cardinal point markers -->
                {#if showNodeRadius}
                    <!-- Right -->
                    <circle cx={radius} cy="0" r="5" fill="yellow" opacity="0.7" />
                    <!-- Left -->
                    <circle cx={-radius} cy="0" r="5" fill="yellow" opacity="0.7" />
                    <!-- Top -->
                    <circle cx="0" cy={-radius} r="5" fill="yellow" opacity="0.7" />
                    <!-- Bottom -->
                    <circle cx="0" cy={radius} r="5" fill="yellow" opacity="0.7" />
                {/if}
            {/if}
        </g>
    {/if}
    
    <!-- Link debugging visualization -->
    {#if link && showLinkEndpoints}
        <g class="debug-link-visualizer">
            <!-- Toggle button at midpoint of link -->
            {#if link.sourcePosition && link.targetPosition}
                {@const midX = (link.sourcePosition.x + link.targetPosition.x) / 2}
                {@const midY = (link.sourcePosition.y + link.targetPosition.y) / 2}
                
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <circle 
                    cx={midX} 
                    cy={midY} 
                    r="7" 
                    fill="blue" 
                    opacity="0.5"
                    on:click={toggleVisibility}
                />
                
                {#if visible}
                    <!-- Link information -->
                    <text x={midX + 10} y={midY} fill="white" font-size="10" text-anchor="start">
                        {link.sourceId.substring(0, 6)} → {link.targetId.substring(0, 6)} ({link.type})
                    </text>
                    
                    <!-- Draw the calculated path -->
                    <path 
                        d={link.path} 
                        stroke="blue" 
                        stroke-width="3" 
                        fill="none" 
                        stroke-dasharray="5,5" 
                        opacity="0.7"
                    />
                    
                    <!-- Draw debug points at actual link endpoints -->
                    {@const pathMatch = link.path.match(/M([\d\.-]+),([\d\.-]+)L([\d\.-]+),([\d\.-]+)/)}
                    {#if pathMatch}
                        {@const startX = parseFloat(pathMatch[1])}
                        {@const startY = parseFloat(pathMatch[2])}
                        {@const endX = parseFloat(pathMatch[3])}
                        {@const endY = parseFloat(pathMatch[4])}
                        
                        <!-- Source endpoint -->
                        <circle cx={startX} cy={startY} r="5" fill="green" opacity="0.7" />
                        <text x={startX} y={startY - 10} fill="green" font-size="10" text-anchor="middle">
                            Source
                        </text>
                        
                        <!-- Target endpoint -->
                        <circle cx={endX} cy={endY} r="5" fill="purple" opacity="0.7" />
                        <text x={endX} y={endY - 10} fill="purple" font-size="10" text-anchor="middle">
                            Target
                        </text>
                    {/if}
                {/if}
            {/if}
        </g>
    {/if}
{/if}

<style>
    .debug-node-visualizer, .debug-link-visualizer {
        pointer-events: all;
        cursor: pointer;
        /* No transitions that could cause position issues */
        transition: none !important;
        transform-style: preserve-3d;
    }
    
    text {
        pointer-events: none;
    }
</style>