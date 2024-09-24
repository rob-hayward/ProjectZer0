<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getAuth0User } from '$lib/services/auth0';
  import { goto } from '$app/navigation';

  let user: any = null;
  let loading = true;

  async function loadUser() {
    user = await getAuth0User();
    if (!user) {
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
{:else if user}
  <p data-testid="user-id">Editing profile for user {user.sub}</p>
  <!-- Add form fields for editing profile here -->
  <button on:click={handleSave}>Save Profile</button>
{:else}
  <p>No user found. Please log in.</p>
{/if}
