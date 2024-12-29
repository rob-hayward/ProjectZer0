<script lang="ts">
  import { onMount } from 'svelte';
  import { login } from '$lib/services/auth0';
  import ThreeJsHomeScene from '$lib/components/welcome/ThreeJsWelcomeScene.svelte';
  import * as auth0 from '$lib/services/auth0';
  import { userStore } from '$lib/stores/userStore';
  import { COLORS } from '$lib/constants/colors';

  let isInitialized = false;

  onMount(async () => {
    try {
      if (window.location.search.includes('code=')) {
        await auth0.handleAuthCallback();
      }
      // Pass false to prevent auto-redirect
      await auth0.getAuth0User(false);
    } catch (error) {
      console.error('Error checking user status:', error);
    } finally {
      isInitialized = true;
    }
  });

  function handleEnter() {
    login();
  }

  function handleLogout() {
    auth0.logout();
  }
</script>

<div class="home-page" style="--blue-glow: {COLORS.PRIMARY.BLUE}; --red-glow: {COLORS.PRIMARY.RED}">
  <ThreeJsHomeScene />
  <div class="centered-content">
    <h1>ProjectZer0</h1>
    <h2>EXPERIMENT / GAME / REVOLUTION</h2>
    {#if isInitialized}
      <div class="button-container">
        <button class="action-button" on:click={handleEnter}>ENTER</button>
        {#if $userStore}
          <span class="separator">/</span>
          <button class="action-button logout" on:click={handleLogout}>EXIT</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .home-page {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    color: white;
  }

  .centered-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateY(0vh);
  }

  h1, h2 {
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
  }

  h1 {
    font-size: 4.5vw;
    margin-bottom: 0;
  }

  h2 {
    font-size: 2vw;
    margin-bottom: 10vh;
  }

  .button-container {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .action-button {
    font-family: 'Orbitron', sans-serif;
    font-size: 2vw;
    font-weight: 900;
    color: white;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .action-button:hover {
    text-shadow: 0 0 20px var(--blue-glow);
  }

  .action-button.logout:hover {
    text-shadow: 0 0 20px var(--red-glow);
  }

  .action-button:focus {
    outline: none;
  }

  .separator {
    font-family: 'Orbitron', sans-serif;
    font-size: 2vw;
    font-weight: 900;
    color: white;
  }

  @media (max-width: 768px) {
    h1 { font-size: 8vw; }
    h2 { font-size: 3vw; }
    .action-button { font-size: 3vw; }
    .separator { font-size: 3vw; }
  }
</style>