<script lang="ts">
  import { onMount } from 'svelte';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import type { UserActivity } from '$lib/services/userActivity';
  import { getUserActivity } from '$lib/services/userActivity';
  import BaseZoomedPage from '$lib/components/graphElements/layouts/BaseZoomedPage.svelte';
  import { NavigationContext, getNavigationOptions, handleNavigation } from '$lib/services/navigation';
  import { drawUserNode } from './dashboardCanvas';

  let user: UserProfile | null = null;
  let userActivity: UserActivity | undefined;

  onMount(async () => {
    try {
      await auth0.handleAuthCallback();
      const fetchedUser = await auth0.getAuth0User();
      if (!fetchedUser) {
        auth0.login();
      }
      user = fetchedUser;
      userActivity = await getUserActivity();
    } catch (error) {
      console.error('Error fetching user data:', error);
      auth0.login();
    }
  });

  function drawDashboardContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    if (user) {
      drawUserNode(ctx, centerX, centerY, user, userActivity);
    }
  }
</script>

{#if user}
  <BaseZoomedPage
    navigationOptions={getNavigationOptions(NavigationContext.DASHBOARD)}
    onNavigate={(optionId) => handleNavigation(optionId)}
    drawContent={drawDashboardContent}
  />
{/if}