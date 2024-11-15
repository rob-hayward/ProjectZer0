<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/shared/FormNavigation.svelte -->
<script lang="ts">
    export let onBack: () => void;
    export let onNext: () => void;
    export let backLabel = "Back";
    export let nextLabel = "Next";
    export let loading = false;
    export let nextDisabled = false;
  </script>
  
  <div class="step-navigation">
    <button class="secondary" on:click={onBack}>
      {backLabel}
    </button>
    <button 
      class="primary" 
      on:click={onNext}
      disabled={loading || nextDisabled}
    >
      {#if loading}
        <span class="loading-text">Loading...</span>
      {:else}
        {nextLabel}
      {/if}
    </button>
  </div>
  
  <style>
    .step-navigation {
      display: flex;
      justify-content: space-between;
      margin-top: 1rem;
    }
  
    button {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      color: white;
      min-width: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  
    button.secondary {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  
    button.primary {
      background: rgba(74, 144, 226, 0.3);
      border: 1px solid rgba(74, 144, 226, 0.4);
    }
  
    button:hover:not(:disabled) {
      transform: translateY(-1px);
    }
  
    button:active:not(:disabled) {
      transform: translateY(0);
    }
  
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  
    .loading-text {
      opacity: 0.7;
    }
  </style>