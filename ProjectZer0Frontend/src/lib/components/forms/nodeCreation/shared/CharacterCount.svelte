<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/shared/CharacterCount.svelte -->
<script lang="ts">
  export let currentLength: number;
  export let maxLength: number;

  $: remaining = maxLength - currentLength;
  $: isNearLimit = remaining <= 20;
  $: isOverLimit = remaining < 0;
</script>

<div class="character-count" class:near-limit={isNearLimit} class:over-limit={isOverLimit}>
  {remaining} characters remaining
</div>

<style>
  .character-count {
    font-size: 0.8rem;
    font-family: 'Orbitron', sans-serif;
    color: rgba(255, 255, 255, 0.6);
    text-align: right;
    margin-top: 0.25rem;
  }

  .near-limit {
    color: #ffd700;
  }

  .over-limit {
    color: #ff4444;
  }
</style>