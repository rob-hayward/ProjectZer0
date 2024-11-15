<!-- ProjectZer0Frontend/src/routes/create-node/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import BaseZoomedPage from '$lib/components/graphElements/layouts/BaseZoomedPage.svelte';
  import { NavigationContext, getNavigationOptions, handleNavigation } from '$lib/services/navigation';
  import { BaseZoomedCanvas, TEXT_STYLES } from '$lib/components/graphElements/layouts/baseZoomedCanvas';

  import MessageDisplay from '$lib/components/forms/nodeCreation/shared/MessageDisplay.svelte';
  import StepIndicator from '$lib/components/forms/nodeCreation/shared/StepIndicator.svelte';
  import WordForm from '$lib/components/forms/nodeCreation/word/WordForm.svelte';
  import DefinitionForm from '$lib/components/forms/nodeCreation/word/DefinitionForm.svelte';
  import DiscussionForm from '$lib/components/forms/nodeCreation/shared/DiscussionForm.svelte';
  import WordReview from '$lib/components/forms/nodeCreation/word/WordReview.svelte';
  
  let user: UserProfile | null = null;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;
  let currentStep = 1;
  let isLoading = false;
  let time = 0;
  
  let formData = {
    nodeType: '',
    word: '',
    definition: '',
    discussion: '',
    publicCredit: false
  };

  const TOTAL_STEPS = 5;

  onMount(async () => {
    try {
      const fetchedUser = await auth0.getAuth0User();
      if (fetchedUser) {
        user = fetchedUser;
      } else {
        auth0.login();
      }
    } catch (e) {
      console.error('Error fetching user data:', e);
      auth0.login();
    }
  });

  function getTitle(): string {
    if (currentStep === 1) {
      return 'Create New Node';
    }
    return `Create ${formData.nodeType.charAt(0).toUpperCase() + formData.nodeType.slice(1)} Node`;
  }

  function handleNodeTypeSelection(event: Event) {
    const select = event.target as HTMLSelectElement;
    formData.nodeType = select.value;
    if (formData.nodeType) {
      currentStep++;
      time += 0.01;
    }
  }

  function nextStep() {
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      errorMessage = null;
      time += 0.01;
    }
  }

  function previousStep() {
    if (currentStep > 1) {
      currentStep--;
      errorMessage = null;
      time += 0.01;
    }
  }

  function handleWordExists({ detail }: CustomEvent<{ word: string }>) {
    goto(`/nodes/word/${detail.word}`);
  }

  function handleSuccess({ detail }: CustomEvent<{ message: string; word: string; }>) {
    successMessage = detail.message;
  }

  function handleError({ detail }: CustomEvent<{ message: string; }>) {
    errorMessage = detail.message;
  }

  function drawCreateNodeContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.logo);
    ctx.fillText(getTitle(), centerX, centerY - 160);
  }

  $: if (browser) {
    time;
    drawCreateNodeContent;
  }
</script>

{#if user}
  <BaseZoomedPage
    navigationOptions={getNavigationOptions(NavigationContext.CREATE_NODE)}
    onNavigate={(optionId) => handleNavigation(optionId)}
    drawContent={drawCreateNodeContent}
  >
    <div class="content-overlay">
      <div class="messages-wrapper">
        <MessageDisplay {errorMessage} {successMessage} />
      </div>
      <div class="create-node-container">
        <div class="create-node-form">
          <div class="form-content">
            {#if currentStep === 1}
              <div class="form-step" transition:fade={{ duration: 200 }}>
                <div class="form-group">
                  <label for="node-type">Select Node Type</label>
                  <select 
                    id="node-type" 
                    bind:value={formData.nodeType}
                    on:change={handleNodeTypeSelection}
                  >
                    <option value="">Choose type...</option>
                    <option value="word">Word</option>
                  </select>
                </div>
              </div>
            {/if}

            {#if currentStep === 2 && formData.nodeType === 'word'}
              <div class="form-step" transition:fade={{ duration: 200 }}>
                <WordForm
                  bind:word={formData.word}
                  disabled={isLoading}
                  on:back={previousStep}
                  on:proceed={nextStep}
                  on:wordExists={handleWordExists}
                />
              </div>
            {/if}

            {#if currentStep === 3}
              <div class="form-step" transition:fade={{ duration: 200 }}>
                <DefinitionForm
                  bind:definition={formData.definition}
                  disabled={isLoading}
                  on:back={previousStep}
                  on:proceed={nextStep}
                />
              </div>
            {/if}

            {#if currentStep === 4}
              <div class="form-step" transition:fade={{ duration: 200 }}>
                <DiscussionForm
                  bind:discussion={formData.discussion}
                  disabled={isLoading}
                  placeholder="Start a discussion around this word and its definition."
                  on:back={previousStep}
                  on:proceed={nextStep}
                />
              </div>
            {/if}

            {#if currentStep === 5}
              <div class="form-step" transition:fade={{ duration: 200 }}>
                <WordReview
                  word={formData.word}
                  definition={formData.definition}
                  discussion={formData.discussion}
                  bind:publicCredit={formData.publicCredit}
                  disabled={isLoading}
                  userId={user?.sub}
                  on:back={previousStep}
                  on:success={handleSuccess}
                  on:error={handleError}
                />
              </div>
            {/if}
          </div>

          <StepIndicator {currentStep} totalSteps={TOTAL_STEPS} />
        </div>
      </div>
    </div>
  </BaseZoomedPage>
{/if}

<style>
  .content-overlay {
    position: absolute;
    top: 55%; /* Move down slightly to avoid title overlap */
    left: 50%;
    transform: translate(-50%, -50%);
    width: 450px; /* Increase width */
    max-width: 90%;
    z-index: 1;
    height: 420px;
  }

  .messages-wrapper {
    position: absolute;
    top: -180px; /* Adjust to account for title */
    left: 0;
    right: 0;
    z-index: 2;
  }

  .create-node-container {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .create-node-form {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    padding: 0 1rem;
  }

  .form-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .form-step {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: fadeIn 0.3s ease-out;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
    font-family: 'Orbitron', sans-serif;
  }

  select {
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 4px;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    transition: border-color 0.2s;
  }

  select:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(0, 0, 0, 0.5);
  }

  select option {
    background: #1a1a1a;
    color: white;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>