<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import * as auth0 from '$lib/services/auth0';
    import type { UserProfile } from '$lib/types/user';
    import WordNodeForm from '../nodes/word/WordNodeForm.svelte';
  
    let user: UserProfile | null = null;
    let selectedNodeType: string = '';
    let error: string | null = null;
    let success: string | null = null;
  
    onMount(async () => {
      try {
        const fetchedUser = await auth0.getAuth0User();
        if (fetchedUser) {
          user = fetchedUser;
        } else {
          error = 'Failed to fetch user data';
        }
      } catch (e) {
        error = 'Failed to fetch user data';
      }
    });
  
    function handleNodeCreated(event: CustomEvent<{ success: boolean, message: string, data?: any }>) {
      if (event.detail.success) {
        success = event.detail.message;
        error = null;
        if (event.detail.data && event.detail.data.id) {
          goto(`/nodes/word/${event.detail.data.id}`);
        }
      } else {
        error = event.detail.message;
        success = null;
      }
    }
  
    function handleWordExists(event: CustomEvent<{ word: string }>) {
      goto(`/nodes/word/${event.detail.word}`);
    }
  </script>
  
  <h1>Create New Node</h1>
  
  {#if error}
    <p class="error">{error}</p>
  {/if}
  
  {#if success}
    <p class="success">{success}</p>
  {/if}
  
  <div class="create-node-form">
    <label for="node-type">Select Node Type:</label>
    <select id="node-type" bind:value={selectedNodeType}>
      <option value="">Select a node type</option>
      <option value="word">Word</option>
    </select>
  
    {#if selectedNodeType === 'word'}
      <WordNodeForm 
        on:nodeCreated={handleNodeCreated} 
        on:wordExists={handleWordExists}
        {user} 
      />
    {/if}
  </div>
  
  <style>
  .create-node-form {
    background-color: #f0f0f0;
    padding: 20px;
    border-radius: 8px;
    margin-top: 20px;
  }
  .error {
    color: red;
  }
  .success {
    color: green;
  }
  label {
    display: block;
    margin-top: 10px;
  }
  select {
    width: 100%;
    padding: 8px;
    margin-top: 5px;
  }
</style>