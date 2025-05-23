<!-- src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import BaseNode from './BaseNode.svelte';
    import ExpandCollapseButton from '../ui/ExpandCollapseButton.svelte';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

    // Allow passing the node and custom style for more flexibility
    export let node: RenderableNode;
    export let style = node.style;
    
    // Node position data passed from NodeRenderer
    export let nodeX: number | undefined = undefined;
    export let nodeY: number | undefined = undefined;
    
    // Vote-based styling for enhanced visuals
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

    const baseOpacity = spring(0, { 
        stiffness: 0.3, 
        damping: 0.8 
    });

    const dispatch = createEventDispatcher<{
        modeChange: { 
            mode: NodeMode;
            position?: { x: number; y: number };
        };
        click: void;
        visibilityChange: { isHidden: boolean };
    }>();
    
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        // Forward the visibility change event
        dispatch('visibilityChange', event.detail);
    }

    interface $$Slots {
        default: {
            radius: number;
            filterId: string;
            gradientId: string;
        };
    }

    onMount(() => {
        baseOpacity.set(1);
        
        console.log('[NODE_CENTRE_DEBUG] BaseDetailNode mounted with position:', {
            nodeId: node.id,
            nodeX,
            nodeY,
            nodePosition: node.position
        });
        
        // If we don't have nodeX/nodeY but we have node.position, use that
        if ((nodeX === undefined || nodeY === undefined) && node.position) {
            nodeX = node.position.x;
            nodeY = node.position.y;
            console.log('[NODE_CENTRE_DEBUG] BaseDetailNode using node.position instead:', {
                x: nodeX,
                y: nodeY
            });
        }
    });

    function handleButtonClick() {
        dispatch('click');
    }

    function handleModeChange(event: CustomEvent<{ 
        mode: NodeMode; 
        position?: { x: number; y: number };
        nodeId?: string;
    }>) {
        // Forward the mode change event with position data
        const eventData = {
            mode: event.detail.mode,
            position: undefined as { x: number, y: number } | undefined
        };
        
        // If the event includes position data, use it
        if (event.detail.position) {
            eventData.position = event.detail.position;
        }
        // Otherwise, use the position from props if available
        else if (nodeX !== undefined && nodeY !== undefined) {
            eventData.position = { x: nodeX, y: nodeY };
            console.log('[NODE_CENTRE_DEBUG] BaseDetailNode adding position to event:', eventData.position);
        }
        // If all else fails, use node's position
        else if (node.position) {
            eventData.position = { 
                x: node.position.x,
                y: node.position.y
            };
            console.log('[NODE_CENTRE_DEBUG] BaseDetailNode using node.position for event:', eventData.position);
        }
        
        // Forward the enhanced event
        dispatch('modeChange', eventData);
    }
</script>

<g 
    class="detail-node"
    style:opacity={$baseOpacity}
    style:transform-origin="center"
    data-node-id={node.id}
    data-node-type={node.type}
    data-node-mode={node.mode}
    data-node-radius={node.radius}
>
    <BaseNode {node} {style} {voteBasedStyles}>
        <svelte:fragment slot="default" let:radius let:filterId let:gradientId>
            <slot 
                {radius} 
                {filterId} 
                {gradientId}
            />
            
            <!-- Collapse Button (positioned at 7:30) - pass node position data -->
            <ExpandCollapseButton 
                mode="collapse"
                y={radius * 0.7071}
                x={-radius * 0.7071}
                nodeX={nodeX}
                nodeY={nodeY}
                nodeId={node.id}
                on:click={handleButtonClick}
                on:modeChange={handleModeChange}
            />
            
            <!-- ShowHideButton is now handled by NodeRenderer, so it's removed from here -->
        </svelte:fragment>
    </BaseNode>
</g>

<style>
    .detail-node {
        will-change: transform, opacity;
        transition: all 0.3s ease-out;
    }

    :global(.detail-node text) {
        fill: white;
        font-family: 'Orbitron', sans-serif;
        text-anchor: middle;
    }
</style>