<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/word/WordReview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { fetchWithAuth } from '$lib/services/api';
    import FormNavigation from '../shared/FormNavigation.svelte';
  
    export let word = '';
    export let definition = '';
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;
  
    let shareToX = false;
  
    const dispatch = createEventDispatcher<{
      back: void;
      success: { message: string; word: string; };
      error: { message: string; };
    }>();
  
    let isSubmitting = false;
  
    function truncateText(text: string, maxLength: number = 150): string {
      if (!text) return '';
      return text.length > maxLength 
        ? text.substring(0, maxLength) + '...'
        : text;
    }
  
    async function handleSubmit() {
      isSubmitting = true;
      try {
        const wordData = {
          word: word.trim(),
          definition,
          discussion,
          publicCredit,
          createdBy: userId,
          shareToX,
        };
        
        if (browser) console.log('Submitting word creation form:', JSON.stringify(wordData, null, 2));
        
        const createdWord = await fetchWithAuth('/nodes/word', {
          method: 'POST',
          body: JSON.stringify(wordData),
        });
        
        if (browser) console.log('Word creation response:', JSON.stringify(createdWord, null, 2));
  
        dispatch('success', {
          message: `Word node "${createdWord.word}" created successfully`,
          word: createdWord.word
        });
  
        goto(`/nodes/word/${encodeURIComponent(createdWord.word.toLowerCase())}`);
      } catch (e) {
        if (browser) {
          console.error('Error creating word:', e);
          console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
        }
        const errorMessage = e instanceof Error ? e.message : 'Failed to create new word node';
        dispatch('error', { message: errorMessage });
      } finally {
        isSubmitting = false;
      }
    }
  </script>

<div class="form-wrapper">
  <div class="form-step">
    <div class="form-group summary">
      <div class="summary-content">
        <div class="summary-item">
          <span class="label">Word:</span>
          <span class="value">{word}</span>
        </div>
        
        {#if definition}
          <div class="summary-item">
            <span class="label">Definition:</span>
            <span class="value">{truncateText(definition, 150)}</span>
          </div>
        {/if}
        
        {#if discussion}
          <div class="summary-item">
            <span class="label">Discussion:</span>
            <span class="value">{truncateText(discussion, 150)}</span>
          </div>
        {/if}
      </div>
    
      <div class="options-section">
        <div class="options-grid">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={publicCredit}
              {disabled}
            />
            <span>Publicly credit creation</span>
          </label>
    
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={shareToX}
              {disabled}
            />
            <span>Share on X (Twitter)</span>
          </label>
        </div>
      </div>
    </div>
  </div>

  <div class="navigation-wrapper">
    <FormNavigation
      onBack={() => dispatch('back')}
      onNext={handleSubmit}
      nextLabel="Create Word Node"
      loading={isSubmitting}
      nextDisabled={disabled || isSubmitting}
    />
  </div>
</div>

<style>
  .form-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .form-step {
    margin-top: 2.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .summary {
    background: rgba(0, 0, 0, 0.2);
    padding: 1.5rem;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .summary-content {
    flex: 1;
    overflow-y: auto;
    max-height: 150px;
    padding-right: 0.5rem;
  }

  .summary-content::-webkit-scrollbar {
    width: 4px;
  }

  .summary-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .summary-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }

  .summary-item {
    margin-bottom: 1rem;
  }

  .summary-item .label {
    display: block;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.8rem;
    margin-bottom: 0.2rem;
  }

  .summary-item .value {
    display: block;
    color: white;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .options-section {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 1rem;
    margin-top: 0.5rem;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
    font-family: 'Orbitron', sans-serif;
    white-space: nowrap;
  }

  .checkbox-label input {
    width: auto;
  }

  .checkbox-label span {
    font-size: 0.8rem;
  }

  .navigation-wrapper {
    margin-top: -1.0rem;
  }
</style>