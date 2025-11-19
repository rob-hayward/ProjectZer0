<!-- src/lib/components/graph/nodes/base/BaseNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { graphStore } from '$lib/stores/graphStore';
    import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
    
    // Node data
    export let node: RenderableNode;
    export let style = node.style;

    // --- HARD CODED GLOW SETTINGS (Destiny-style tuning playground) ---
    export let glowIntensity = 12;  // blur power
    export let glowOpacity   = 1.0; // bloom strength (0–1)
    // --------------------------------------------------------------------

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        click: void;
    }>();
    
    const nodeId = `node-${Math.random().toString(36).slice(2)}`;
    const filterId = `glow-${nodeId}`;
    const gradientId = `gradient-${nodeId}`;
    
    $: radius = node.radius;
    $: highlightColor = style.highlightColor || style.colors?.border || '#3498db';

    // Automatic visibility based on votes
    $: if (node.data && graphStore) {
        const hasInclusionVotes = 'inclusionPositiveVotes' in node.data;
        if (hasInclusionVotes) {
            const data = node.data as any;
            const positiveVotes = getNeo4jNumber(data.inclusionPositiveVotes) || 0;
            const negativeVotes = getNeo4jNumber(data.inclusionNegativeVotes) || 0;
            if (typeof graphStore.recalculateNodeVisibility === 'function') {
                graphStore.recalculateNodeVisibility(node.id, positiveVotes, negativeVotes);
            }
        }
    }

    function handleClick() {
        dispatch('click');
    }

    interface $$Slots {
        default: { radius: number; filterId: string; gradientId: string };
    }
</script>


<g 
    class="base-node"
    data-node-id={nodeId}
    data-node-radius={radius}
    data-node-mode={node.mode || 'preview'}
    on:click={handleClick}
>
    <defs>
        <!-- Hard-coded glow filter -->
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur 
                in="SourceGraphic" 
                stdDeviation={glowIntensity}
                result="blur"
            />
            <feColorMatrix 
                in="blur" 
                type="matrix" 
                values="
                    1 0 0 0 0  
                    0 1 0 0 0  
                    0 0 1 0 0  
                    0 0 0 {glowOpacity} 0
                "
                result="glow"
            />
            <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>

        <!-- Radial depth gradient -->
        <radialGradient id={gradientId}>
            <stop offset="0%"   style="stop-color:{highlightColor}; stop-opacity:0.40" />
            <stop offset="50%"  style="stop-color:{highlightColor}; stop-opacity:0.15" />
            <stop offset="100%" style="stop-color:{highlightColor}; stop-opacity:0.04" />
        </radialGradient>
    </defs>

    <!-- Background layers -->
    <circle class="background-layer-1" r={radius * 1.0}  fill="url(#{gradientId})" opacity="0.5" />
    <circle class="background-layer-2" r={radius * 0.95} fill="url(#{gradientId})" opacity="0.3" />
    <circle class="background-layer-3" r={radius * 0.85} fill="url(#{gradientId})" opacity="0.3" />
    <circle class="content-background" r={radius} fill={style.colors?.background || '#1a1a1a'} opacity="0.1" />

    <!-- Decorative rings -->
    <circle 
        class="outer-ring" 
        r={radius} 
        fill="none" 
        stroke={highlightColor} 
        stroke-width="2"
        opacity="0.8"
        filter="url(#{filterId})"
    />

    <circle 
        class="middle-ring" 
        r={radius * 1.006} 
        fill="none" 
        stroke="white" 
        stroke-width="1" 
        opacity="0.5"
    />

    <slot {radius} {filterId} {gradientId} />
</g>

<style>
    .base-node {
        will-change: transform;
        transition: all 0.3s ease-out;
    }

    .base-node circle {
        transition: opacity 0.3s ease, stroke-width 0.3s ease;
    }

    .base-node:hover .outer-ring {
        stroke-width: 5;
        opacity: 1.0;
    }
</style>
