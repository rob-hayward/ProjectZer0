<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import * as auth0 from '$lib/services/auth0';
  import { userStore } from '$lib/stores/userStore';
  import type { UserProfile } from '$lib/types/user';
  import UserNodeView from '$lib/components/nodeViews/UserNodeView.svelte';

  let user: UserProfile | null = null;
  let error: string | null = null;
  let isLoading = true;

  onMount(async () => {
    try {
      await auth0.handleAuthCallback();
      const fetchedUser = await auth0.getAuth0User();
      if (fetchedUser) {
        user = fetchedUser;
      } else {
        error = 'Failed to fetch user data';
      }
    } catch (e) {
      error = 'Failed to fetch user data';
    } finally {
      isLoading = false;
    }
  });
</script>

{#if isLoading}
  <p>Loading user data...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if user}
  <UserNodeView {user} />
{:else}
  <p>No user data available</p>
{/if}

<style>
  :global(body) {
    background-color: #000000;
    color: #ffffff;
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
  }

  .error {
    color: #ff4444;
  }
</style>