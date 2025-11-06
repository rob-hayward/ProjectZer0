<!-- src/lib/components/graph/nodes/controlNode/ControlNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    
    // Props
    export let node: RenderableNode;
    
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();
    
    // Internal state - Track mode reactively
    $: isDetail = node.mode === 'detail';
    
    // Hover state for preview mode
    let isHovering = false;
    
    // Unique filter ID (like InclusionVoteButtons)
    const glowFilterId = `control-glow-${Math.random().toString(36).slice(2)}`;
    
    // Control node has special sizes
    $: controlRadius = isDetail 
        ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
        : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
    
    // Create node with correct size (reactive)
    $: nodeWithCorrectSize = ({
        ...node,
        radius: isDetail 
            ? COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 
            : COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2
    });
    
    function handleModeChange() {
        const newMode: NodeMode = isDetail ? 'preview' : 'detail';
        dispatch('modeChange', { mode: newMode });
    }
    
    function handlePreviewKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleModeChange();
        }
    }
</script>

{#if isDetail}
    <!-- DETAIL MODE - Keep existing implementation for now -->
    <BaseDetailNode node={nodeWithCorrectSize} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Graph Controls" {radius} mode="detail" />
        </svelte:fragment>
        
        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <!-- We'll implement the full detail view in the next step -->
            <text 
                x={0}
                y={0}
                class="detail-placeholder"
                text-anchor="middle"
                fill="var(--color-text-primary)"
                font-size="16"
            >
                Detail Mode
            </text>
            <text 
                x={0}
                y={25}
                class="detail-placeholder"
                text-anchor="middle"
                fill="var(--color-text-secondary)"
                font-size="12"
            >
                (Full controls coming next)
            </text>
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE - New minimal icon design -->
    <BasePreviewNode node={nodeWithCorrectSize} canExpand={false} on:modeChange={handleModeChange}>
        <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
            <!-- Filter definition at content slot level (like InclusionVoteButtons) -->
            <defs>
                <filter id={glowFilterId} x="-100%" y="-100%" width="300%" height="300%">
                    <!-- Strong outer glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                    <feFlood flood-color="white" flood-opacity="0.6" result="color1"/>
                    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                    
                    <!-- Medium glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                    <feFlood flood-color="white" flood-opacity="0.8" result="color2"/>
                    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                    
                    <!-- Sharp inner glow -->
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                    <feFlood flood-color="white" flood-opacity="1" result="color3"/>
                    <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
                    
                    <feMerge>
                        <feMergeNode in="shadow1"/>
                        <feMergeNode in="shadow2"/>
                        <feMergeNode in="shadow3"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-mouse-events-have-key-events -->
            <!-- Invisible hover detection area with proper accessibility -->
            <circle
                cx={0}
                cy={0}
                r={controlRadius}
                fill="transparent"
                class="hover-detection"
                on:mouseenter={() => isHovering = true}
                on:mouseleave={() => isHovering = false}
                on:click={handleModeChange}
                on:keydown={handlePreviewKeydown}
                tabindex="0"
                role="button"
                aria-label="Expand Controls"
                aria-pressed="false"
                style="cursor: pointer;"
            />
            
            <!-- Background circle for icon -->
            <circle
                cx={0}
                cy={0}
                r={controlRadius * 0.75}
                fill="var(--color-background-secondary)"
                stroke="var(--color-border-primary)"
                stroke-width="2"
                class="icon-background"
                class:hovered={isHovering}
            />
            
            <!-- CRITICAL: Apply filter to parent <g>, not foreignObject (like InclusionVoteButtons) -->
            <g style:filter={isHovering ? `url(#${glowFilterId})` : 'none'}>
                <foreignObject 
                    x={-controlRadius * 0.5} 
                    y={-controlRadius * 0.5} 
                    width={controlRadius} 
                    height={controlRadius}
                    class="icon-container"
                >
                    <div class="icon-wrapper" {...{"xmlns": "http://www.w3.org/1999/xhtml"}}>
                        <span 
                            class="material-symbols-outlined control-icon"
                            class:hovered={isHovering}
                            style:color={isHovering ? 'white' : 'white'}
                        >
                            graph_5
                        </span>
                    </div>
                </foreignObject>
            </g>
            
            <!-- Hover tooltip -->
            {#if isHovering}
                <g transform="translate(0, {controlRadius + 20})">
                    <rect
                        x={-50}
                        y={-10}
                        width="100"
                        height="20"
                        rx="4"
                        fill="rgba(0, 0, 0, 0.9)"
                        stroke="var(--color-border-primary)"
                        stroke-width="1"
                        class="tooltip-background"
                    />
                    <text
                        x={0}
                        y={3}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="white"
                        font-size="11"
                        font-weight="500"
                        font-family="Inter, system-ui, sans-serif"
                        class="tooltip-text"
                    >
                        Expand Controls
                    </text>
                </g>
            {/if}
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    /* Preview mode styles */
    .hover-detection {
        transition: all 0.2s ease;
        outline: none;
    }
    
    .hover-detection:focus {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: 4px;
    }
    
    .icon-background {
        transition: all 0.2s ease;
        pointer-events: none;
    }
    
    .icon-background.hovered {
        fill: var(--color-background-tertiary);
        stroke-width: 2.5;
    }
    
    /* Icon container styling - critical for Material Icons */
    .icon-container {
        overflow: visible;
        pointer-events: none;
    }
    
    .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }
    
    /* Material Icons styling */
    :global(.material-symbols-outlined.control-icon) {
        font-size: 28px;
        transition: color 0.3s ease;
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    :global(.material-symbols-outlined.control-icon.hovered) {
        font-size: 28px;
        font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 48;
    }
    
    .tooltip-background {
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
        pointer-events: none;
    }
    
    .tooltip-text {
        pointer-events: none;
        user-select: none;
        letter-spacing: 0.02em;
    }
    
    /* Detail mode placeholder styles */
    .detail-placeholder {
        pointer-events: none;
        user-select: none;
    }
</style>