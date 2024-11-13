<script lang="ts">
  import { onMount } from 'svelte';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import DashboardNode from './DashboardNode.svelte';

  let user: UserProfile | null = null;

  onMount(async () => {
      try {
          await auth0.handleAuthCallback();
          const fetchedUser = await auth0.getAuth0User();
          if (!fetchedUser) {
              auth0.login();
          }
          user = fetchedUser;
      } catch (error) {
          console.error('Error fetching user data:', error);
          auth0.login();
      }
  });
</script>

{#if user}
  <DashboardNode node={user} />
{/if}