<!-- ProjectZer0Frontend/src/routes/nodes/word/WordNodeForm.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { UserProfile } from '$lib/types/user';
  import { fetchWithAuth } from '$lib/services/api';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  export let user: UserProfile | null;

  let word: string = '';
  let definition: string = '';
  let discussion: string = '';
  let publicCredit: boolean = false;
  let error: string | null = null;
  let wordExists: boolean | null = null;
  let isCheckingWord: boolean = false;
  let isCreatingWord: boolean = false;

  const dispatch = createEventDispatcher();

  async function checkWordExistence() {
    if (!word.trim()) {
      error = 'Please enter a word';
      return;
    }

    isCheckingWord = true;
    error = null;
    try {
      if (browser) console.log('Checking word existence for:', word);
      const response = await fetchWithAuth(`/nodes/word/check/${encodeURIComponent(word.trim())}`);
      if (browser) console.log('Word existence check response:', response);
      wordExists = response.exists;
      if (wordExists) {
        dispatch('wordExists', { word: word.trim() });
      }
    } catch (e: unknown) {
      if (browser) console.error('Error checking word existence:', e);
      error = e instanceof Error ? e.message : 'Failed to check word existence';
    } finally {
      isCheckingWord = false;
    }
  }

  async function handleSubmit() {
    if (!word.trim()) {
      error = 'Please enter a word';
      return;
    }

    isCreatingWord = true;
    error = null;
    try {
      if (browser) console.log('Submitting word creation form:', { word, definition, discussion, publicCredit });
      const createdWord = await fetchWithAuth('/nodes/word', {
        method: 'POST',
        body: JSON.stringify({
          word: word.trim(),
          definition,
          discussion,
          publicCredit,
          createdBy: user?.sub,
        }),
      });
      
      if (browser) console.log('Word creation response:', createdWord);

      dispatch('nodeCreated', { 
        success: true, 
        message: `Word node "${createdWord.word}" created successfully`,
        data: createdWord
      });

      // Navigate to the newly created word's page
      goto(`/nodes/word/${encodeURIComponent(createdWord.word.toLowerCase())}`);

      // Reset form
      word = '';
      definition = '';
      discussion = '';
      publicCredit = false;
      wordExists = null;
    } catch (e: unknown) {
      if (browser) console.error('Error creating word:', e);
      error = e instanceof Error ? e.message : 'Failed to create new word node';
      dispatch('nodeCreated', { 
        success: false, 
        message: error
      });
    } finally {
      isCreatingWord = false;
    }
  }
</script>
<form on:submit|preventDefault={handleSubmit}>
  <label for="word">Word:</label>
  <input
    type="text"
    id="word"
    bind:value={word}
    placeholder="Enter the keyword you believe to be important for use in ProjectZer0"
    disabled={wordExists !== null || isCreatingWord}
  />
  <button type="button" on:click={checkWordExistence} disabled={isCheckingWord || wordExists !== null || isCreatingWord}>
    {isCheckingWord ? 'Checking...' : 'Check word existence'}
  </button>

  {#if wordExists === false}
    <label for="definition">Definition (optional):</label>
    <textarea
      id="definition"
      bind:value={definition}
      placeholder="Enter your definition of this word within the context of its use in ProjectZer0. If you do not provide a definition, a placeholder definition will be automatically generated from Free Online Dictionary."
      disabled={isCreatingWord}
    ></textarea>

    <label for="discussion">Discussion:</label>
    <textarea
      id="discussion"
      bind:value={discussion}
      placeholder="Would you like to start a discussion around this word and its definition? If so, please kick off the discussion by adding your creator comment here."
      disabled={isCreatingWord}
    ></textarea>

    <label>
      <input type="checkbox" bind:checked={publicCredit} disabled={isCreatingWord} />
      Would you like to be publicly credited for the creation of this node?
    </label>

    <button type="submit" disabled={isCreatingWord}>
      {isCreatingWord ? 'Creating Word Node...' : 'Create Word Node'}
    </button>
  {/if}
</form>

{#if error}
  <p class="error">{error}</p>
{/if}
  
<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  label {
    font-weight: bold;
  }
  input[type="text"], textarea {
    width: 100%;
    padding: 0.5rem;
  }
  button {
    align-self: flex-start;
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
  .error {
    color: red;
  }
</style>