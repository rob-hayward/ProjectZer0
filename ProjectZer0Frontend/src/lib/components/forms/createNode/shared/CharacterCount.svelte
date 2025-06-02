<!-- src/lib/components/forms/createNode/shared/CharacterCount.svelte -->
<script lang="ts">
  import { FORM_STYLES } from '$lib/styles/forms';

  export let currentLength: number;
  export let maxLength: number;
  
  $: remaining = maxLength - currentLength;
  $: isNearLimit = remaining <= 20;
  $: isOverLimit = remaining < 0;
</script>

<text
  x={FORM_STYLES.layout.leftAlign + FORM_STYLES.layout.fieldWidth}
  y="0"
  class="character-count"
  class:near-limit={isNearLimit}
  class:over-limit={isOverLimit}
  text-anchor="end"
>
  {remaining} characters remaining
</text>

<style>
  .character-count {
      font-size: 12px;
      font-family: 'Inter', sans-serif;  
      font-weight: 400;
      fill: rgba(255, 255, 255, 0.6);
      transition: fill 0.2s ease;
  }

  .near-limit {
      fill: #ffd700;
  }

  .over-limit {
      fill: #ff4444;
  }
</style>