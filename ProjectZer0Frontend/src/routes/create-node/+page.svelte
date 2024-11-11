<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import WordNodeForm from '../nodes/word/WordNodeForm.svelte';
  import BaseZoomedPage from '$lib/components/graphElements/layouts/BaseZoomedPage.svelte';
  import { createNodeNavigationOptions } from '$lib/components/graphElements/nodes/navigationNode/navigationOptions';
  
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

  function handleNavigation(optionId: string) {
    switch(optionId) {
      case 'dashboard':
        goto('/dashboard');
        break;
      case 'edit-profile':
        goto('/edit-profile');
        break;
      case 'logout':
        auth0.logout();
        break;
      default:
        goto(`/${optionId}`);
    }
  }

  function drawCreateNodeContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    ctx.font = '26px "Orbitron", sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Create New Node', centerX, centerY - 180);
  }
</script>

<BaseZoomedPage
  navigationOptions={createNodeNavigationOptions}
  onNavigate={handleNavigation}
  drawContent={drawCreateNodeContent}
>
  <div class="content-overlay">
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
  </div>
</BaseZoomedPage>

<style>
  .content-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    z-index: 1;
  }

  .create-node-form {
    background: rgba(0, 0, 0, 0.7);
    padding: 20px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(5px);
    color: white;
  }

  .error {
    color: #ff4444;
    margin-bottom: 10px;
  }

  .success {
    color: #44ff44;
    margin-bottom: 10px;
  }

  label {
    display: block;
    margin-top: 10px;
    color: rgba(255, 255, 255, 0.8);
  }

  select {
    width: 100%;
    padding: 8px;
    margin-top: 5px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 4px;
  }

  select option {
    background: #1a1a1a;
    color: white;
  }

  :global(.create-node-form input),
  :global(.create-node-form textarea) {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 4px;
    padding: 8px;
    width: 100%;
  }
</style>