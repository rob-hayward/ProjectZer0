<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/shared/MessageDisplay.svelte -->
<script lang="ts">
    import { fade } from 'svelte/transition';
    
    export let errorMessage: string | null = null;
    export let successMessage: string | null = null;
</script>

{#if errorMessage || successMessage}
  <div class="messages">
    {#if errorMessage}
      <p class="error" transition:fade>{errorMessage}</p>
    {/if}
    {#if successMessage}
      <p class="success" transition:fade>{successMessage}</p>
    {/if}
  </div>
{/if}

<style>
    .messages {
      text-align: center;
      min-height: 30px;
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 0.5rem;
      backdrop-filter: blur(4px);
      border-radius: 4px;
    }

    .error {
      color: #ff4444;
      margin: 0;
      font-size: 0.9rem;
    }

    .success {
      color: #44ff44;
      margin: 0;
      font-size: 0.9rem;
    }
</style>