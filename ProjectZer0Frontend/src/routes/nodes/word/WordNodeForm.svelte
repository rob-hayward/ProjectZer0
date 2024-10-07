<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { UserProfile } from '$lib/types/user';
  import { fetchWithAuth } from '$lib/services/api';

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
      const response = await fetchWithAuth(`/nodes/word/check/${encodeURIComponent(word.trim())}`);
      wordExists = response.exists;
      if (wordExists) {
        dispatch('wordExists', { word: word.trim() });
      }
    } catch (e: unknown) {
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
      const response = await fetchWithAuth('/nodes/word', {
        method: 'POST',
        body: JSON.stringify({
          word: word.trim(),
          definition,
          discussion,
          publicCredit,
          createdBy: user?.sub,
        }),
      });

      dispatch('nodeCreated', { 
        success: true, 
        message: `Word node "${word}" created successfully`,
        data: response
      });

      // Reset form
      word = '';
      definition = '';
      discussion = '';
      publicCredit = false;
      wordExists = null;
    } catch (e: unknown) {
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

  