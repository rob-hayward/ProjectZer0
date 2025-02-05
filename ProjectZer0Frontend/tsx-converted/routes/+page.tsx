/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/routes/+page.svelte
 * This conversion was created to share with Claude for development purposes.
 */


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


// Original Svelte Template:
/*
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
    {isInitialized ? (
      <div class="button-container">
        <button class="action-button" onClick={handleEnter}>ENTER</button>
        {$userStore ? (
          <span class="separator">/</span>
          <button class="action-button logout" onClick={handleLogout}>EXIT</button>
        )}
      </div>
    )}
  </div>
</div>
*/

// Converted JSX:
export default function Component() {
  return (
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
    {isInitialized ? (
      <div class="button-container">
        <button class="action-button" onClick={handleEnter}>ENTER</button>
        {$userStore ? (
          <span class="separator">/</span>
          <button class="action-button logout" onClick={handleLogout}>EXIT</button>
        )}
      </div>
    )}
  </div>
</div>
  );
}