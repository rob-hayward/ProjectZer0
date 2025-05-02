<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import BaseNode from './BaseNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

    export let node: RenderableNode;
    // Add position props that will be passed from NodeRenderer
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
        title: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
        content: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
        score: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
        button: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
    }

    onMount(() => {
        console.log('[NODE_CENTRE_DEBUG] BasePreviewNode mounted with position:', {
            nodeId: node.id,
            nodeX,
            nodeY,
            nodePosition: node.position
        });
        
        // If we don't have nodeX/nodeY but we have node.position, use that
        if ((nodeX === undefined || nodeY === undefined) && node.position) {
            nodeX = node.position.x;
            nodeY = node.position.y;
            console.log('[NODE_CENTRE_DEBUG] BasePreviewNode using node.position instead:', {
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
        // Forward the enhanced event including position data
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
            console.log('[NODE_CENTRE_DEBUG] BasePreviewNode adding position to event:', eventData.position);
        }
        // If all else fails, use node's position
        else if (node.position) {
            eventData.position = { 
                x: node.position.x,
                y: node.position.y
            };
            console.log('[NODE_CENTRE_DEBUG] BasePreviewNode using node.position for event:', eventData.position);
        }
        
        // Forward the enhanced event
        dispatch('modeChange', eventData);
    }
</script>

<g 
    class="preview-node"
    data-node-id={node.id}
    data-node-type={node.type}
    data-node-mode={node.mode}
    data-node-radius={node.radius}
>
    <BaseNode {node} {voteBasedStyles}>
        <svelte:fragment slot="default" let:radius let:filterId let:gradientId>
            <!-- Title slot -->
            {#if $$slots.title}
                <slot 
                    name="title" 
                    {radius}
                    style={NODE_CONSTANTS}
                />
            {/if}

            <!-- Content slot -->
            {#if $$slots.content}
                <slot 
                    name="content" 
                    {radius}
                    style={NODE_CONSTANTS}
                />
            {/if}

            <!-- Score slot -->
            {#if $$slots.score}
                <slot 
                    name="score" 
                    {radius}
                    style={NODE_CONSTANTS}
                />
            {/if}

            <!-- Button slot section -->
            {#if $$slots.button}
                <slot 
                    name="button" 
                    {radius}
                    style={NODE_CONSTANTS}
                />
            {/if}
            
            <!-- Expand Button (positioned at 7:30) -->
            <ExpandCollapseButton 
                mode="expand"
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
    .preview-node {
        will-change: transform;
        transition: transform 0.3s ease-out;
    }
</style>