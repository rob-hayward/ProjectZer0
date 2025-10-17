<!-- src/lib/components/graph/nodes/ui/NodeMetadata.svelte -->
<script lang="ts">
  export let createdAt: string;  // ISO timestamp
  export let updatedAt: string | undefined = undefined;  // ISO timestamp, optional
  export let radius: number;

  // Format timestamp for display
  function formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Use relative time for recent dates (<7 days)
      if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          if (diffMinutes === 0) {
            return 'just now';
          }
          return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        }
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else if (diffDays === 1) {
        return 'yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      }

      // Use absolute date for older dates (≥7 days)
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp;
    }
  }

  // Check if updatedAt is different from createdAt
  $: hasBeenUpdated = updatedAt && updatedAt !== createdAt;
  $: formattedCreatedAt = formatTimestamp(createdAt);
  $: formattedUpdatedAt = hasBeenUpdated ? formatTimestamp(updatedAt!) : null;

  // Position above CreatorCredits in detail mode
  $: yPosition = radius + 5;
</script>

<g class="node-metadata" transform="translate(0, {yPosition})">
  <!-- Created timestamp -->
  <text
    x="0"
    y="0"
    style:font-family="Inter"
    style:font-size="10px"
    style:font-weight="400"
    style:fill="rgba(255, 255, 255, 0.7)"
    style:text-anchor="middle"
    style:dominant-baseline="middle"
  >
    Created: {formattedCreatedAt}
  </text>

  <!-- Updated timestamp (only if different from created) -->
  {#if formattedUpdatedAt}
    <text
      x="0"
      y="12"
      style:font-family="Inter"
      style:font-size="10px"
      style:font-weight="400"
      style:fill="rgba(255, 255, 255, 0.6)"
      style:text-anchor="middle"
      style:dominant-baseline="middle"
    >
      Updated: {formattedUpdatedAt}
    </text>
  {/if}
</g>

<style>
  .node-metadata {
    pointer-events: none;
    user-select: none;
  }
</style>