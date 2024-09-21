<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getAuth0User } from '$lib/services/auth0';
  import { goto } from '$app/navigation';

  export let testUser: { sub: string } | null = null;

  let userId: string | null = null;
  let loading = true;

  async function loadUser() {
    const user = testUser || await getAuth0User();
    if (user && user.sub) {
      userId = user.sub;
    } else {
      goto('/');
    }
    loading = false;
  }

  function handleSave() {
    // Here you would typically save the profile data
    goto('/dashboard');
  }

  if (browser) {
    onMount(loadUser);
  }
</script>

<h1>Edit Profile</h1>
{#if loading}
  <p>Loading...</p>
{:else if userId}
  <p data-testid="user-id">Editing profile for user {userId}</p>
  <button on:click={handleSave}>Save Profile</button>
{:else}
  <p>No user found. Please log in.</p>
{/if}
