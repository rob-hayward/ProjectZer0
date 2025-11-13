<!-- src/lib/components/graph/nodes/base/BaseNode.svelte -->
<!-- ENHANCED: Automatic visibility recalculation based on vote changes -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { graphStore } from '$lib/stores/graphStore';
    import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
    
    // Node data - contains ALL information needed for rendering
    export let node: RenderableNode;
    // Allow custom style to be passed in (optional)
    export let style = node.style;
    // Vote-based styling for visual enhancements
    export let voteBasedStyles = {
        glow: {
            intensity: 8,
            opacity: 0.6
        },
        ring: {
            width: 6, 
            opacity: 0.5
        }
    };
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        click: void;
    }>();
    
    // Generate unique IDs for this instance
    const nodeId = `node-${Math.random().toString(36).slice(2)}`;
    const filterId = `glow-${nodeId}`;
    const gradientId = `gradient-${nodeId}`;
    
    // Extract visual properties only - NO position info
    $: radius = node.radius;
    $: highlightColor = style.highlightColor || style.colors?.border || '#3498db';

    // ✅ AUTOMATIC VISIBILITY RECALCULATION
    // Watches for inclusion vote changes and updates graph store automatically
    $: if (node.data && graphStore) {
        const hasInclusionVotes = 'inclusionPositiveVotes' in node.data;
        
        if (hasInclusionVotes) {
            const data = node.data as any;
            
            const positiveVotes = getNeo4jNumber(data.inclusionPositiveVotes) || 0;
            const negativeVotes = getNeo4jNumber(data.inclusionNegativeVotes) || 0;
            
            // Update graph store whenever votes change
            if (typeof graphStore.recalculateNodeVisibility === 'function') {
                graphStore.recalculateNodeVisibility(node.id, positiveVotes, negativeVotes);
            }
        }
    }

    function handleClick() {
        dispatch('click');
    }

    interface $$Slots {
        default: {
            radius: number;
            filterId: string;
            gradientId: string;
        };
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="base-node"
    data-node-id={nodeId}
    data-node-radius={radius}
    data-node-mode={node.mode || 'preview'}
    on:click={handleClick}
>
    <!-- Filter and gradient definitions -->
    <defs>
        <!-- Glow filter for highlight effects -->
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={voteBasedStyles.glow.intensity} result="blur"/>
            <feColorMatrix 
                in="blur" 
                type="matrix" 
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 {voteBasedStyles.glow.opacity} 0"
                result="glow"
            />
            <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
        
        <!-- Radial gradient for background -->
        <radialGradient id={gradientId}>
            <stop offset="0%" style="stop-color:{highlightColor};stop-opacity:0.4" />
            <stop offset="50%" style="stop-color:{highlightColor};stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:{highlightColor};stop-opacity:0.05" />
        </radialGradient>
    </defs>

    <!-- 4 background layers for depth effect -->
    <circle 
        class="background-layer-1" 
        r={radius * 1.0} 
        fill="url(#{gradientId})" 
        opacity="1.0"
    />
    <circle 
        class="background-layer-2" 
        r={radius * 0.95} 
        fill="url(#{gradientId})" 
        opacity="0.8"
    />
    <circle 
        class="background-layer-3" 
        r={radius * 0.85} 
        fill="url(#{gradientId})" 
        opacity="0.7"
    />
    <circle 
        class="content-background" 
        r={radius * 1} 
        fill={style.colors?.background || '#1a1a1a'} 
        opacity="0.6"
    />
    
    <!-- Decorative rings -->
    <circle 
        class="outer-ring" 
        r={radius} 
        fill="none" 
        stroke={highlightColor} 
        stroke-width={voteBasedStyles.ring.width} 
        opacity={voteBasedStyles.ring.opacity}
        filter="url(#{filterId})"
    />
    <circle 
        class="middle-ring" 
        r={radius * 0.97} 
        fill="none" 
        stroke="white" 
        stroke-width="1" 
        opacity="0.2"
    />
    
    <!-- Slot for child content (BasePreviewNode or BaseDetailNode) -->
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
        stroke-width: 8;
        opacity: 0.8;
    }
</style>