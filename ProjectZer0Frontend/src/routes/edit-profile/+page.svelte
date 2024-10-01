<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getAuth0User, handleAuthCallback } from '$lib/services/auth0';
  import { updateUserProfile } from '$lib/services/userProfile';
  import { goto } from '$app/navigation';
  import type { UserProfile } from '$lib/types/user';
  import { userStore } from '$lib/stores/userStore';

  let user: UserProfile | null = null;
  let loading = true;
  let preferred_username = '';
  let email = '';
  let mission_statement = '';
  let updateSuccess = false;

  async function loadUser() {
    await handleAuthCallback();
    user = await getAuth0User();
    if (!user) {
      goto('/');
    } else {
      preferred_username = user.preferred_username || '';
      email = user.email || '';
      mission_statement = user.mission_statement || '';
    }
    loading = false;
  }

  async function handleUpdateUserProfile(event: Event) {
    event.preventDefault();
    if (!user) return;

    try {
      const updatedUser = await updateUserProfile({
        sub: user.sub,
        preferred_username,
        email,
        mission_statement
      });

      if (updatedUser) {
        console.log('Profile updated:', updatedUser);
        userStore.set(updatedUser);
        updateSuccess = true;
        setTimeout(() => {
          goto('/dashboard');
        }, 2000); // Redirect after 2 seconds
      } else {
        console.error('Failed to update profile: No data returned');
        // You might want to show an error message to the user here
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      // Here you might want to show an error message to the user
    }
  }

  if (browser) {
    onMount(loadUser);
  }
</script>

<div class="container">
  <h1>Edit Profile</h1>
  {#if loading}
    <p>Loading...</p>
  {:else if user}
    <form on:submit={handleUpdateUserProfile}>
      <div class="form-group">
        <label for="preferred_username">Preferred Username:</label>
        <input
          type="text"
          id="preferred_username"
          bind:value={preferred_username}
          placeholder="Enter your preferred username"
        />
      </div>

      <div class="form-group">
        <label for="email">Email:</label>
        <input
          type="email"
          id="email"
          bind:value={email}
          placeholder="Enter your email"
        />
      </div>

      <div class="form-group">
        <label for="mission_statement">Mission Statement:</label>
        <textarea
          id="mission_statement"
          bind:value={mission_statement}
          placeholder="Enter your mission statement"
          rows="4"
        ></textarea>
      </div>

      <button type="submit">Save Profile</button>
    </form>

    {#if updateSuccess}
      <div class="success-message">
        Profile updated successfully! Redirecting to dashboard...
      </div>
    {/if}
  {:else}
    <p>No user found. Please log in.</p>
  {/if}
</div>

<style>
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }

  h1 {
    text-align: center;
    color: #333;
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    margin-bottom: 5px;
    color: #666;
  }

  input, textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
  }

  textarea {
    resize: vertical;
  }

  button {
    display: block;
    width: 100%;
    padding: 10px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
  }

  button:hover {
    background-color: #0056b3;
  }

  .success-message {
    background-color: #d4edda;
    color: #155724;
    padding: 10px;
    border-radius: 4px;
    margin-top: 20px;
  }
</style>