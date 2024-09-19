<script lang="ts">
    import { onMount } from 'svelte';
    import { getAuth0User } from '$lib/services/auth0';
    import { getDashboardData } from '$lib/services/api';
    import type { UserProfile, DashboardData } from '$lib/services/api';
  
    let user: UserProfile | null = null;
    let dashboardData: DashboardData | null = null;
  
    onMount(async () => {
      user = await getAuth0User();
      if (user && user.id) {
        dashboardData = await getDashboardData(user.id);
      }
    });
  </script>
  
  {#if user}
    <h1>Welcome to your dashboard, {user.name}!</h1>
    <!-- Display dashboard data here -->
    {#if dashboardData}
      <!-- Add your dashboard data display logic here -->
    {:else}
      <p>Loading dashboard data...</p>
    {/if}
  {:else}
    <p>Loading user data...</p>
  {/if}