<script lang="ts">
  import { onMount } from 'svelte';
  import * as auth0 from '$lib/services/auth0';

  let user: any = null;
  let error: string | null = null;

  onMount(async () => {
    try {
      user = await auth0.getAuth0User();
    } catch (e) {
      error = 'Failed to fetch user data';
    }
  });

  function handleLogout() {
    auth0.logout();
  }
</script>

<h1>Dashboard</h1>

{#if user}
  <div class="user-info">
    <h2>Welcome, {user.name || user.nickname || 'User'}!</h2>
    <p>Email: {user.email || 'Not provided'}</p>
    {#if user.picture}
      <img src={user.picture} alt="User's avatar" class="profile-picture" />
    {/if}
    <h3>User Details:</h3>
    <pre>{JSON.stringify(user, null, 2)}</pre>
  </div>
{:else if error}
  <p class="error">{error}</p>
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