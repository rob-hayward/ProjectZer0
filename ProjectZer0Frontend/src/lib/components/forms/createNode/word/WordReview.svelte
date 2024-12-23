<!-- src/lib/components/forms/createNode/word/WordReview.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { fetchWithAuth } from '$lib/services/api';
  import { FORM_STYLES } from '$lib/styles/forms';
  import FormNavigation from '../shared/FormNavigation.svelte';
  import MessageDisplay from '../shared/MessageDisplay.svelte';

  export let word = '';
  export let definition = '';
  export let discussion = '';
  export let publicCredit = false;
  export let disabled = false;
  export let userId: string | undefined = undefined;

  let shareToX = false;
  let isSubmitting = false;
  let errorMessage: string | null = null;
  let successMessage: string | null = null;

  const dispatch = createEventDispatcher<{
      back: void;
      success: { message: string; word: string; };
      error: { message: string; };
  }>();

  function truncateText(text: string, maxLength: number = 150): string {
      if (!text) return '';
      return text.length > maxLength 
          ? text.substring(0, maxLength) + '...'
          : text;
  }

  async function handleSubmit() {
      isSubmitting = true;
      errorMessage = null;
      
      try {
          const wordData = {
              word: word.trim(),
              definition,
              discussion,
              publicCredit,
              createdBy: userId,
              shareToX
          };
          
          const createdWord = await fetchWithAuth('/nodes/word', {
              method: 'POST',
              body: JSON.stringify(wordData),
          });
          
          successMessage = `Word node "${createdWord.word}" created successfully`;
          dispatch('success', {
              message: successMessage,
              word: createdWord.word
          });

          setTimeout(() => {
              goto(`/graph/word/${encodeURIComponent(createdWord.word.toLowerCase())}`);
          }, 2000);
      } catch (e) {
          errorMessage = e instanceof Error ? e.message : 'Failed to create new word node';
          dispatch('error', { message: errorMessage });
      } finally {
          isSubmitting = false;
      }
  }
</script>

<g>
  <!-- Review Title -->
  <text 
      x={FORM_STYLES.layout.leftAlign}
      y="0"
      class="review-title"
  >
      Review Your Word Node
  </text>

  <!-- Review Content -->
  <foreignObject
      x={FORM_STYLES.layout.leftAlign}
      y={FORM_STYLES.layout.verticalSpacing.labelToInput}
      width={FORM_STYLES.layout.fieldWidth}
      height="280"
  >
      <div class="review-container">
          <div class="review-item">
              <span class="label">Word:</span>
              <span class="value">{word}</span>
          </div>
          
          {#if definition}
              <div class="review-item">
                  <span class="label">Definition:</span>
                  <span class="value">{truncateText(definition)}</span>
              </div>
          {/if}
          
          {#if discussion}
              <div class="review-item">
                  <span class="label">Discussion:</span>
                  <span class="value">{truncateText(discussion)}</span>
              </div>
          {/if}

          <div class="options-grid">
              <label class="checkbox-label">
                  <input
                      type="checkbox"
                      bind:checked={publicCredit}
                      disabled={isSubmitting}
                  />
                  <span>Publicly credit creation</span>
              </label>

              <label class="checkbox-label">
                  <input
                      type="checkbox"
                      bind:checked={shareToX}
                      disabled={isSubmitting}
                  />
                  <span>Share on X (Twitter)</span>
              </label>
          </div>
      </div>
  </foreignObject>

  <!-- Messages -->
  {#if errorMessage || successMessage}
      <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 280})">
          <MessageDisplay {errorMessage} {successMessage} />
      </g>
  {/if}

  <!-- Navigation -->
  <g transform="translate(0, {FORM_STYLES.layout.verticalSpacing.betweenFields + 320})">
      <FormNavigation
          onBack={() => dispatch('back')}
          onNext={handleSubmit}
          nextLabel={isSubmitting ? "Creating..." : "Create Word Node"}
          loading={isSubmitting}
          nextDisabled={disabled || isSubmitting}
      />
  </g>
</g>

<style>
  .review-title {
      font-size: 18px;
      text-anchor: start;
      fill: white;
      font-family: 'Orbitron', sans-serif;
  }

  :global(.review-container) {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
  }

  :global(.review-item) {
      display: flex;
      flex-direction: column;
      gap: 4px;
  }

  :global(.review-item .label) {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-family: 'Orbitron', sans-serif;
  }

  :global(.review-item .value) {
      color: white;
      font-size: 14px;
      font-family: 'Orbitron', sans-serif;
      line-height: 1.4;
  }

  :global(.options-grid) {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global(.checkbox-label) {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      font-size: 12px;
      font-family: 'Orbitron', sans-serif;
  }

  :global(.checkbox-label input[type="checkbox"]) {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.9);
      cursor: pointer;
  }

  :global(.checkbox-label input[type="checkbox"]:checked) {
      background: rgba(74, 144, 226, 0.3);
      border-color: rgba(74, 144, 226, 0.4);
  }

  :global(.checkbox-label input[type="checkbox"]:disabled) {
      opacity: 0.5;
      cursor: not-allowed;
  }
</style>