<!-- src/lib/components/graph/nodes/navigation/NavigationNode.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { RenderableNode } from '$lib/types/graph/enhanced';
    import type { NavigationOption } from '$lib/types/domain/navigation';
    import { handleNavigation } from '$lib/services/navigation';
    import type { NavigationOptionId } from '$lib/services/navigation';
    import { getNavigationColor } from './navigationColors';
    import { isNavigationData } from '$lib/types/graph/enhanced';
    import { graphStore } from '$lib/stores/graphStore';
    import type { ViewType } from '$lib/types/graph/enhanced';
    import { coordinateSystem } from '$lib/services/graph/CoordinateSystem';

    export let node: RenderableNode;

    const dispatch = createEventDispatcher<{
        hover: { isHovered: boolean };
    }>();

    let isHovered = false;
    let connectionEndpoint = { x: 0, y: 0 }; // Point on central node's perimeter
    const filterId = `nav-glow-${Math.random().toString(36).slice(2)}`;
    
    // Type guard for navigation data
    if (!isNavigationData(node.data)) {
        throw new Error('Invalid node data type for NavigationNode');
    }

    const navigationData = node.data as NavigationOption;
    
    // Get color from navigation option ID
    $: color = getNavigationColor(navigationData.id);

    /**
     * Calculate connection endpoint using the CoordinateSystem service
     */
    function calculateConnectionEndpoint() {
        if (!node.position) return { x: 0, y: 0 };
        
        // Let the coordinate system handle the calculation
        const viewType = graphStore.getViewType();
        return coordinateSystem.calculateNavigationConnectionEndpoint(node.position, viewType);
    }

    // Ensure endpoint is calculated on component initialization
    onMount(() => {
        connectionEndpoint = calculateConnectionEndpoint();
        console.debug(`[NavigationNode:${navigationData.id}] Initial connection point:`, connectionEndpoint);
    });

    // Recalculate on store changes
    $: if ($graphStore) {
        connectionEndpoint = calculateConnectionEndpoint();
    }

    // Force recalculation on any graph update
    // This ensures navigation nodes respond to statement node size changes
    $: {
        if ($graphStore) {
            // Use setTimeout to let the store update properly first
            setTimeout(() => {
                connectionEndpoint = calculateConnectionEndpoint();
                console.debug(`[NavigationNode:${navigationData.id}] Updated connection with:`, connectionEndpoint);
            }, 10);
        }
    }

    async function handleClick() {
        // Get the target view type based on navigation option
        const targetViewType = navigationData.id === 'dashboard' ? 'dashboard' : 
                             navigationData.id === 'create-word' ? 'create-node' :
                             navigationData.id === 'edit-profile' ? 'edit-profile' : 'dashboard';
        
        console.log('[NAVIGATION] Clicked node:', { 
            id: navigationData.id, 
            targetViewType 
        });
        
        // 1. FIRST update the graph store directly
        if (graphStore && graphStore.setViewType) {
            console.log('[NAVIGATION] Directly updating graph store:', targetViewType);
            graphStore.setViewType(targetViewType as ViewType);
            
            // Force immediate refresh
            if (graphStore.forceTick) {
                console.log('[NAVIGATION] Forcing immediate graph update');
                graphStore.forceTick(); // No arguments to avoid TS error
            }
        }
        
        // 2. THEN perform navigation
        try {
            // Force a small timeout to give store update time to propagate
            await new Promise(resolve => setTimeout(resolve, 10));
            handleNavigation(navigationData.id as NavigationOptionId);
            console.log('[NAVIGATION] Navigation completed');
        } catch (e) {
            console.error('[NAVIGATION] Error during navigation:', e);
        }
    }

    function handleMouseEnter() {
        isHovered = true;
        console.debug(`[NavigationNode:${navigationData.id}] Mouse enter, isHovered=${isHovered}`);
        dispatch('hover', { isHovered: true });
        
        // Ensure positions stay fixed during hover interactions
        if (graphStore.fixNodePositions) {
            // First force stop the simulation completely
            if (graphStore.stopSimulation) {
                graphStore.stopSimulation();
            }
            
            // Fix node positions - no alpha, no restart
            graphStore.fixNodePositions();
            
            // Recalculate connection endpoint for the current state
            connectionEndpoint = calculateConnectionEndpoint();
            
            // Additional force tick to ensure everything is properly positioned
            if (graphStore.forceTick) {
                graphStore.forceTick();
            }
        }
    }

    function handleMouseLeave() {
        isHovered = false;
        console.debug(`[NavigationNode:${navigationData.id}] Mouse leave, isHovered=${isHovered}`);
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

    <!-- Connection line from nav node to dashboard perimeter -->
    <line 
        class="connection-line"
        x1="0"
        y1="0"
        x2={connectionEndpoint.x}
        y2={connectionEndpoint.y}
        stroke={`${color}80`}
        stroke-width="2.5"
        class:visible={isHovered}
    />

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

    .connection-line {
        pointer-events: none;
        vector-effect: non-scaling-stroke;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.2s ease-out;
    }

    .connection-line.visible {
        visibility: visible;
        opacity: 1;
    }

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