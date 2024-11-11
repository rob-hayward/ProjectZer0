<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as auth0 from '$lib/services/auth0';
  import type { UserProfile } from '$lib/types/user';
  import type { UserActivity } from '$lib/services/userActivity';
  import { getUserActivity } from '$lib/services/userActivity';
  import BaseZoomedPage from '$lib/components/graphElements/layouts/BaseZoomedPage.svelte';
  import { dashboardNavigationOptions } from '$lib/components/graphElements/nodes/navigationNode/navigationOptions';
  import { drawUserNode } from './dashboardCanvas';

  export let node: UserProfile;
  let userActivity: UserActivity | undefined;

  onMount(async () => {
    try {
      userActivity = await getUserActivity();
    } catch (error) {
      console.error('Error fetching user activity:', error);
    }
  });

  function handleNavigation(optionId: string) {
    switch(optionId) {
      case 'create-node':
        goto('/create-node');
        break;
      case 'edit-profile':
        goto('/edit-profile');
        break;
      case 'logout':
        auth0.logout();
        break;
      default:
        goto(`/${optionId}`);
    }
  }

  function drawDashboardContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    drawUserNode(ctx, centerX, centerY, node, userActivity);
  }
</script>

<BaseZoomedPage
  navigationOptions={dashboardNavigationOptions}
  onNavigate={handleNavigation}
  drawContent={drawDashboardContent}
/>