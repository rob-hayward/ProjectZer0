<!-- src/lib/components/graph/nodes/navigation/NavigationNode.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount, afterUpdate } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import type { NavigationOption } from '$lib/types/domain/navigation';
    import { handleNavigation } from '$lib/services/navigation';
    import type { NavigationOptionId } from '$lib/services/navigation';
    import { getNavigationColor } from './navigationColors';
    import { isNavigationData } from '$lib/types/graph/enhanced';
    import { graphStore } from '$lib/stores/graphStore';
    import type { ViewType } from '$lib/types/graph/enhanced';
    import { NavigationNodeLayout } from '$lib/services/graph/layouts/common/NavigationNodeLayout';

    export let node: RenderableNode;

    const dispatch = createEventDispatcher<{
        hover: { isHovered: boolean };
    }>();

    let isHovered = false;
    const filterId = `nav-glow-${Math.random().toString(36).slice(2)}`;
    
    // Type guard for navigation data
    if (!isNavigationData(node.data)) {
        throw new Error('Invalid node data type for NavigationNode');
    }

    const navigationData = node.data as NavigationOption;
    
    // Get color from navigation option ID
    $: color = getNavigationColor(navigationData.id);

    // Navigation options that should ONLY dispatch events (for universal graph central node switching)
    const CENTRAL_NODE_SWITCH_OPTIONS = [
        'dashboard',
        'edit-profile', 
        'create-node',
        'graph-controls'
    ];

    // Navigation options that should be handled by the navigation service
    const EXTERNAL_NAVIGATION_OPTIONS = [
        'donate',
        'logout'
    ];

    // Since we're no longer using connection lines,
    // we can remove the connection endpoint calculation logic
    
    // We'll keep the central node detection for debugging purposes
    $: if ($graphStore) {
        const centralNode = $graphStore.nodes.find(n => 
            n.group === 'central' || (n.data && typeof n.data === 'object' && 'sub' in n.data && n.data.sub === 'controls')
        );
        
        // Debug logging only on significant changes
        if (centralNode && centralNode.mode !== undefined) {
            console.debug(`[NavigationNode:${navigationData.id}] Central node update:`, { 
                id: centralNode.id,
                type: centralNode.type,
                mode: centralNode.mode,
                isControlNode: centralNode.type === 'dashboard' && 
                    centralNode.data && 
                    typeof centralNode.data === 'object' && 
                    'sub' in centralNode.data && 
                    centralNode.data.sub === 'controls'
            });
        }
    }

    async function handleClick() {
        console.log('[NAVIGATION] Clicked node:', { 
            id: navigationData.id
        });

        // Check if this is a central node switch (for universal graph)
        if (CENTRAL_NODE_SWITCH_OPTIONS.includes(navigationData.id)) {
            console.log('[NAVIGATION] Central node switch option - dispatching event only');
            
            // Dispatch event for +page.svelte to handle
            window.dispatchEvent(new CustomEvent('navigation-node-click', {
                detail: { optionId: navigationData.id }
            }));
            
            // Do NOT call handleNavigation - let the page handle central node switching
            return;
        }

        // Check if this is an external navigation (donate, logout)
        if (EXTERNAL_NAVIGATION_OPTIONS.includes(navigationData.id)) {
            console.log('[NAVIGATION] External navigation option - using handler');
            handleNavigation(navigationData.id as NavigationOptionId);
            return;
        }

        // For all other navigation options, use the standard handler
        console.log('[NAVIGATION] Standard navigation option - using handler');
        
        // Get the target view type based on navigation option
        const targetViewType = navigationData.id === 'dashboard' ? 'dashboard' : 
                             navigationData.id === 'create-word' ? 'create-node' :
                             navigationData.id === 'edit-profile' ? 'edit-profile' : 'dashboard';
        
        // Update graph store if target view type is specified
        if (graphStore && graphStore.setViewType) {
            console.log('[NAVIGATION] Directly updating graph store:', targetViewType);
            graphStore.setViewType(targetViewType as ViewType);
            
            // Force immediate refresh
            if (graphStore.forceTick) {
                graphStore.forceTick();
            }
        }

        // Handle the navigation
        try {
            await new Promise(resolve => setTimeout(resolve, 10));
            handleNavigation(navigationData.id as NavigationOptionId);
        } catch (e) {
            console.error('[NAVIGATION] Error during navigation:', e);
        }
    }

    function handleMouseEnter() {
        isHovered = true;
        dispatch('hover', { isHovered: true });
        
        // Ensure positions stay fixed during hover interactions
        if (graphStore.fixNodePositions) {
            // Fix node positions - no alpha, no restart
            graphStore.fixNodePositions();
        }
    }

    function handleMouseLeave() {
        isHovered = false;
        dispatch('hover', { isHovered: false });
        
        // Again ensure positions stay fixed
        if (graphStore.fixNodePositions) {
            // Fix node positions but don't restart
            graphStore.fixNodePositions();
        }
    }
</script>

<!-- Navigation node wrapper - NO animations or transforms that could affect positioning -->
<g class="navigation-node-wrapper">
    <defs>
        <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
            <!-- Strong outer glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="18" result="blur1"/>
            <feFlood flood-color={color} flood-opacity="0.6" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
 
            <!-- Medium glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur2"/>
            <feFlood flood-color={color} flood-opacity="0.8" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
 
            <!-- Sharp inner glow -->
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur3"/>
            <feFlood flood-color={color} flood-opacity="1" result="color3"/>
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
    <g 
        class="navigation-node"
        style="pointer-events: all; touch-action: none;"
        on:mouseenter={handleMouseEnter}
        on:mouseleave={handleMouseLeave}
        on:click={handleClick}
    >
        <!-- Icon Container with fixed size and position -->
        <foreignObject 
            x="-16" 
            y="-16" 
            width="32" 
            height="32" 
            class="icon-container"
            style:filter={isHovered ? `url(#${filterId})` : 'none'}
        >
            <div 
                class="icon-wrapper"
                {...{"xmlns": "http://www.w3.org/1999/xhtml"}}
            >
                <span 
                    class="material-symbols-outlined"
                    style:color={isHovered ? color : 'white'}
                >
                    {navigationData.icon}
                </span>
            </div>
        </foreignObject>

        <!-- Label - ALWAYS render but control visibility with CSS -->
        <text
            class="label"
            dy="30"
            style:fill={color}
            style:opacity={isHovered ? 1 : 0}
            style:pointer-events="none"
        >
            {navigationData.label}
        </text>
    </g>
</g>

<style>
    .navigation-node-wrapper {
        /* Prevent any unpredictable positioning */
        transform: none !important;
        will-change: auto;
    }

    .navigation-node {
        cursor: pointer;
        /* Disable any transitions that could affect layout */
        transform: none !important;
        will-change: auto;
    }

    .icon-container {
        overflow: visible;
        /* No transitions that could affect layout */
    }

    .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.navigation-node .material-symbols-outlined) {
        font-size: 24px;
        /* Only transition color, not any size or position properties */
        transition: color 0.3s ease;
    }

    .navigation-node:hover :global(.material-symbols-outlined) {
        /* Keep exact same size on hover */
        font-size: 24px;
    }

    /* Connection lines removed as requested */

    .label {
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
        /* Use opacity instead of display/visibility for smoother transitions */
        transition: opacity 0.2s ease-out;
    }
</style>