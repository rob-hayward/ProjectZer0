<script lang="ts">
    import { onMount } from 'svelte';
    import { getAuth0User } from '$lib/services/auth0';
    import { saveUserProfile } from '$lib/services/api';
    import { goto } from '$app/navigation';
    import type { UserProfile } from '$lib/services/api';
  
    let user: UserProfile | null = null;
    let name = '';
    let email = '';
  
    onMount(async () => {
      user = await getAuth0User();
      if (user) {
        name = user.name || '';
        email = user.email || '';
      }
    });
  
    async function handleSubmit() {
      if (user && user.id) {
        await saveUserProfile(user.id, { name, email });
        goto('/dashboard');
      }
    }
  </script>
  
  {#if user}
    <h1>Edit Your Profile</h1>
    <form on:submit|preventDefault={handleSubmit}>
      <label>
        Name:
        <input type="text" bind:value={name} required>
      </label>
      <label>
        Email:
        <input type="email" bind:value={email} required>
      </label>
      <button type="submit">Save Profile</button>
    </form>
  {:else}
    <p>Loading...</p>
  {/if}