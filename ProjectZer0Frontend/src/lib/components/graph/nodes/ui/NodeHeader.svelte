<!-- src/lib/components/graph/nodes/ui/NodeHeader.svelte -->
<script lang="ts">
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
  
    // Props
    export let title: string;
    export let radius: number;
    export let size: 'small' | 'medium' | 'large' = 'medium';
    export let position: 'top' | 'center' = 'top';
    export let color: string = 'rgba(255, 255, 255, 0.7)';
  
    // Size mappings
    const sizeMap = {
      small: '10px',
      medium: NODE_CONSTANTS.FONTS.title.size,
      large: '18px'
    };
  
    // Position calculations
    $: yPosition = position === 'top' ? -radius + 40 : 0;
  </script>
  
  <text
    y={yPosition}
    class="node-header"
    class:small={size === 'small'}
    class:medium={size === 'medium'}
    class:large={size === 'large'}
    style:font-family={NODE_CONSTANTS.FONTS.title.family}
    style:font-size={sizeMap[size]}
    style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
    style:fill={color}
  >
    {title}
  </text>
  
  <style>
    .node-header {
      text-anchor: middle;
      font-family: 'Orbitron', sans-serif;
      dominant-baseline: middle;
      pointer-events: none;
    }
  
    .node-header.small {
      opacity: 0.8;
    }
  
    .node-header.medium {
      opacity: 0.7;
    }
  
    .node-header.large {
      opacity: 0.9;
      font-weight: 600;
    }
  </style>