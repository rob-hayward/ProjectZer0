<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseSvgPreviewNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import type { SvgNodePosition } from '$lib/types/svgLayout';

    export let style: NodeStyle;
    export let position: SvgNodePosition;

    let isHovered = false;
    let centerX: number;
    let centerY: number;
    let radius: number;

    const dispatch = createEventDispatcher<{
        detail: void;  // Renamed from zoom to detail
        hover: { isHovered: boolean };
    }>();

    function handleMouseEnter() {
        isHovered = true;
        dispatch('hover', { isHovered });
    }

    function handleMouseLeave() {
        isHovered = false;
        dispatch('hover', { isHovered });
    }

    function handleClick() {
        dispatch('detail');  // Renamed from zoom
    }

    // Spring animation for hover effect
    const hoverScale = spring(1, {
        stiffness: 0.1,
        damping: 0.6
    });

    $: {
        centerX = position.x;
        centerY = position.y;
        radius = style.previewSize / 2;
        hoverScale.set(isHovered ? 1.05 : 1);
    }
</script>

<g 
    class="preview-node"
    transform={position.svgTransform}
>
    <!-- Separate group for hover animation to avoid conflicts with positioning -->
    <g transform={`scale(${$hoverScale})`}>
        <slot 
            {centerX} 
            {centerY} 
            {radius} 
            {isHovered} 
            {style}
        />
    </g>
</g>