<!-- src/lib/components/graph/nodes/ui/NodeHeader.svelte -->
<script lang="ts">
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
  
    // Props
    export let title: string;
    export let radius: number;
    export let size: 'small' | 'medium' | 'large' = 'medium';
    export let position: 'top' | 'center' = 'top';
    export let color: string = 'rgba(255, 255, 255, 0.7)';
    export let y: number | undefined = undefined;
    export let mode: 'preview' | 'detail' = 'detail';
  
    // Size mappings - using Inter font sizes
    const sizeMap = {
      small: '10px',
      medium: '14px',  // Changed to match Inter styling
      large: '18px'
    };
  
    // Position calculations - different offsets for preview vs detail
    $: modeOffset = mode === 'detail' ? 40 : 25; // Keep detail at 40, move preview to 25
    $: defaultYPosition = position === 'top' ? -radius + modeOffset : 0;
    $: yPosition = y ?? defaultYPosition;
  </script>
  
  <text
    y={yPosition}
    class="node-header"
    class:small={size === 'small'}
    class:medium={size === 'medium'}
    class:large={size === 'large'}
    style:font-family="Inter"
    style:font-size={sizeMap[size]}
    style:font-weight="500"
    style:fill={color}
  >
    {title}
  </text>
  
  <style>
    .node-header {
      text-anchor: middle;
      font-family: 'Inter', sans-serif;
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