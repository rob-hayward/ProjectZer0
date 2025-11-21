<!-- src/lib/components/graph/nodes/ui/CreatorCredits.svelte -->
<script lang="ts">
    import { getDisplayName } from '../utils/nodeUtils';
  
    // Props
    export let createdBy: string;
    export let publicCredit: boolean = true;
    export let creatorDetails: any = null;
    export let prefix: string = 'created by:';
    export let color: string = 'rgba(255, 255, 255, 0.5)';
    export let fontSize: string = '10px';
  
    // Get display name
    $: displayName = getDisplayName(createdBy, creatorDetails, !publicCredit);
</script>
  
{#if createdBy}
    <text
      y={0}
      class="creator-credits"
      style:font-size={fontSize}
      style:fill={color}
    >
      {prefix} {displayName}
    </text>
{/if}
  
<style>
    .creator-credits {
      text-anchor: middle;
      font-family: Inter;
      dominant-baseline: middle;
      pointer-events: none;
    }
</style>