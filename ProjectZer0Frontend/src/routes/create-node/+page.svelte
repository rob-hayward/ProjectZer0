<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import WordNodeForm from '../nodes/word/WordNodeForm.svelte';
  import BaseZoomedPage from '$lib/components/graphElements/layouts/BaseZoomedPage.svelte';
  import { createNodeNavigationOptions } from '$lib/components/graphElements/nodes/navigationNode/navigationOptions';
  import { BaseZoomedCanvas, TEXT_STYLES } from '$lib/components/graphElements/layouts/baseZoomedCanvas';
  
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
        auth0.login();
      }
    } catch (e) {
      console.error('Error fetching user data:', e);
      auth0.login();
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
    // ProjectZer0 logo
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.logo);
    ctx.fillText('ProjectZer0', centerX, centerY - 180);

    // Create New Node text
    BaseZoomedCanvas.setTextStyle(ctx, {
      font: '18px "Orbitron", sans-serif',
      color: 'rgba(255, 255, 255, 0.7)',
      align: 'center',
      baseline: 'middle'
    });
    ctx.fillText('Create New Node', centerX, centerY - 140);
  }
</script>

<BaseZoomedPage
  navigationOptions={createNodeNavigationOptions}
  onNavigate={handleNavigation}
  drawContent={drawCreateNodeContent}
>
  <div class="content-overlay">
    <div class="messages">
      {#if error}
        <p class="error">{error}</p>
      {/if}

      {#if success}
        <p class="success">{success}</p>
      {/if}
    </div>

    <div class="create-node-container">
      <div class="create-node-form">
        <div class="form-group">
          <label for="node-type">Select Node Type</label>
          <select id="node-type" bind:value={selectedNodeType}>
            <option value="">Choose type...</option>
            <option value="word">Word</option>
          </select>
        </div>

        {#if selectedNodeType === 'word'}
          <div class="form-scroll-container">
            <WordNodeForm 
              on:nodeCreated={handleNodeCreated} 
              on:wordExists={handleWordExists}
              {user} 
            />
          </div>
        {/if}
      </div>
    </div>
  </div>
</BaseZoomedPage>

<style>
  .content-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    max-width: 90%;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 420px; /* Match circle size */
  }

  .messages {
    text-align: center;
    min-height: 30px;
    position: sticky;
    top: 0;
    z-index: 2;
    padding: 0.5rem;
    backdrop-filter: blur(4px);
    border-radius: 4px;
  }

  .error {
    color: #ff4444;
    margin: 0;
    font-size: 0.9rem;
  }

  .success {
    color: #44ff44;
    margin: 0;
    font-size: 0.9rem;
  }

  .create-node-container {
    position: relative;
    height: 100%;
    max-height: 360px;
  }

  .create-node-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
  }

  .form-scroll-container {
    overflow-y: auto;
    padding-right: 0.5rem;
    margin-right: -0.5rem;
    flex: 1;
  }

  /* Customize scrollbar */
  .form-scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .form-scroll-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .form-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }

  .form-scroll-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
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

  /* Global form styles */
  :global(.create-node-form input),
  :global(.create-node-form textarea) {
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

  :global(.create-node-form input:focus),
  :global(.create-node-form textarea:focus) {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(0, 0, 0, 0.5);
  }

  :global(.create-node-form button) {
    background: rgba(74, 144, 226, 0.3);
    border: 1px solid rgba(74, 144, 226, 0.4);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  :global(.create-node-form button:hover) {
    background: rgba(74, 144, 226, 0.4);
    border-color: rgba(74, 144, 226, 0.6);
  }

  :global(.create-node-form button:active) {
    transform: translateY(1px);
  }

  /* Fade effect for scrolling content */
  .create-node-container::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 20px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    pointer-events: none;
  }
</style>