<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as auth0 from '$lib/services/auth0';
  import { userStore } from '$lib/stores/userStore';
  import type { UserProfile } from '$lib/types/user';

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

  function handleLogout() {
    auth0.logout();
  }

  function handleEditProfile() {
    goto('/edit-profile');
  }
</script>

<h1>Dashboard</h1>

{#if isLoading}
  <p>Loading user data...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if user}
  <div class="user-info">
    <h2>Welcome, {user.preferred_username || user.name || user.nickname || 'User'}!</h2>
    <p>Email: {user.email || 'Not provided'}</p>
    {#if user.picture}
      <img src={user.picture} alt="User's avatar" class="profile-picture" />
    {/if}
    <p>Preferred Username: {user.preferred_username || 'Not set'}</p>
    <p>Mission Statement: {user.mission_statement || 'Not provided'}</p>
    <h3>User Details:</h3>
    <pre>{JSON.stringify(user, null, 2)}</pre>
    <button on:click={handleEditProfile}>Edit Profile</button>
  </div>
{:else}
  <p>No user data available</p>
{/if}

<button on:click={handleLogout}>Logout</button>

<style>
  .user-info {
    background-color: #f0f0f0;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  .profile-picture {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
  }
  .error {
    color: red;
  }
  button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 10px;
  }
  button:hover {
    background-color: #0056b3;
  }
  pre {
    background-color: #e0e0e0;
    padding: 10px;
    border-radius: 4px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>