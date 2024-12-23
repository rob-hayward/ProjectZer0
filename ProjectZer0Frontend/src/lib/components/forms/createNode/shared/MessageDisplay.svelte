<!-- src/lib/components/forms/createNode/shared/MessageDisplay.svelte -->
<script lang="ts">
  import { FORM_STYLES } from '$lib/styles/forms';
  
  export let errorMessage: string | null = null;
  export let successMessage: string | null = null;
</script>

{#if errorMessage || successMessage}
  <g transform="translate({FORM_STYLES.layout.leftAlign}, 0)">
      <text 
          class="message"
          class:error={errorMessage}
          class:success={successMessage}
          x={FORM_STYLES.layout.fieldWidth / 2}
          y="0"
          text-anchor="middle"
      >
          {errorMessage || successMessage}
      </text>
  </g>
{/if}

<style>
  .message {
      font-family: 'Orbitron', sans-serif;
      font-size: 14px;
      transition: fill 0.2s ease;
  }

  .error {
      fill: #ff4444;
  }

  .success {
      fill: #4CAF50;
  }
</style>