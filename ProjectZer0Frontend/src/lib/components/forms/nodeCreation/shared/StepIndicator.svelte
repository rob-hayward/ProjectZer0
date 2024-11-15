<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/shared/StepIndicator.svelte -->
<script lang="ts">
    export let currentStep: number;
    export let totalSteps: number;
  </script>
  
  <div class="step-indicator">
    {#each Array(totalSteps) as _, i}
      <div class="step {currentStep >= i + 1 ? 'active' : ''}" />
    {/each}
  </div>
  
  <style>
    .step-indicator {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }
  
    .step {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      transition: all 0.3s;
    }
  
    .step.active {
      background: rgba(255, 255, 255, 0.8);
      transform: scale(1.2);
    }
  </style>