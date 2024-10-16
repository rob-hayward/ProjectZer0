<!-- src/lib/components/navigation/NavGraphDashboard.svelte -->
<script lang="ts">
    import NavGraph from './NavGraph.svelte';
    import { goto } from '$app/navigation';
    import * as auth0 from '$lib/services/auth0';
  
    const dashboardOptions = [
      { id: 'network', label: 'Network', icon: '\uf0c0' },
      { id: 'creations', label: 'Creations', icon: '\uf12e' },
      { id: 'interactions', label: 'Interactions', icon: '\uf140' },
      { id: 'explore', label: 'Explore', icon: '\uf002' },
      { id: 'create-node', label: 'Create Node', icon: '\uf067' },
      { id: 'edit-profile', label: 'Edit Profile', icon: '\uf007' },
      { id: 'logout', label: 'Logout', icon: '\uf08b' }
    ];
  
    function handleNavigation(event: CustomEvent<string>) {
      const optionId = event.detail;
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
  </script>
  
  <div class="nav-graph-dashboard">
    <NavGraph options={dashboardOptions} currentView="dashboard" on:navigate={handleNavigation} />
  </div>
  
  <style>
    .nav-graph-dashboard {
      width: 100%;
      height: 100%;
    }
  </style>