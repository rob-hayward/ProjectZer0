<!-- src/lib/components/nodeViews/UserNodeView.svelte -->
<script lang="ts">
    import BaseNodeView from './BaseNodeView.svelte';
    import type { UserProfile } from '$lib/types/user';
  
    export let user: UserProfile;
  </script>
  
  <BaseNodeView title="User Dashboard">
    <div class="user-info">
      <h2>Welcome, {user.preferred_username || user.name || user.nickname || 'User'}!</h2>
      {#if user.picture}
        <img src={user.picture} alt="User's avatar" class="profile-picture" />
      {/if}
      <p>Preferred Username: {user.preferred_username || 'Not set'}</p>
      <p>Mission Statement: {user.mission_statement || 'Not provided'}</p>
    </div>
  </BaseNodeView>
  
  <style>
    .user-info {
      text-align: center;
    }
  
    .profile-picture {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 20px;
    }
  </style>