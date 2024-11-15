<!-- ProjectZer0Frontend/src/lib/components/forms/nodeCreation/word/WordForm.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import FormNavigation from '../shared/FormNavigation.svelte';
  
    export let word = '';
    export let disabled = false;
  
    const dispatch = createEventDispatcher<{
      back: void;
      wordExists: { word: string };
      proceed: void;
    }>();
  
    let isCheckingWord = false;
    let errorMessage: string | null = null;
  
    async function checkWordExistence() {
      if (!word.trim()) {
        errorMessage = 'Please enter a word';
        return;
      }
  
      isCheckingWord = true;
      errorMessage = null;
      try {
        if (browser) console.log('Checking word existence for:', word);
        const response = await fetchWithAuth(`/nodes/word/check/${encodeURIComponent(word.trim())}`);
        
        if (browser) console.log('Word existence check response:', JSON.stringify(response, null, 2));
        
        if (response.exists) {
          dispatch('wordExists', { word: word.trim() });
        } else {
          dispatch('proceed');
        }
      } catch (e) {
        if (browser) {
          console.error('Error checking word existence:', e);
          console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
        }
        errorMessage = e instanceof Error ? e.message : 'Failed to check word existence';
      } finally {
        isCheckingWord = false;
      }
    }
  </script>
  
  <div class="form-group">
    <label for="word">Word</label>
    <input 
      type="text" 
      id="word" 
      bind:value={word}
      placeholder="Enter the keyword you believe to be important for use in ProjectZer0"
      {disabled}
    />
    {#if errorMessage}
      <span class="error-text">{errorMessage}</span>
    {/if}
  </div>
  
  <FormNavigation
    onBack={() => dispatch('back')}
    onNext={checkWordExistence}
    nextLabel="Check Word"
    loading={isCheckingWord}
    nextDisabled={!word.trim() || disabled}
  />
  
  <style>
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
  
    input {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 4px;
      padding: 0.5rem;
      width: 100%;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
  
    input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.4);
      background: rgba(0, 0, 0, 0.5);
    }
  
    .error-text {
      color: #ff4444;
      font-size: 0.8rem;
    }
  </style>