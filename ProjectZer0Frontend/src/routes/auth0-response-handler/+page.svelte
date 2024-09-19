<script lang="ts">
  import { onMount } from 'svelte';
  import { createAuth0Client } from '@auth0/auth0-spa-js';
  import { verifyOrCreateUser } from '$lib/services/api';
  import { goto } from '$app/navigation';
  
  onMount(async () => {
    try {
      const auth0 = await createAuth0Client({
        domain: import.meta.env.VITE_AUTH0_DOMAIN,
        clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
        authorizationParams: {
          redirect_uri: 'http://localhost:5173/auth0-response-handler'
        }
      });
  
      await auth0.handleRedirectCallback();
  
      const user = await auth0.getUser();
      console.log('Authenticated user:', user);
  
      if (user && user.sub && user.email) {
        const userData = await verifyOrCreateUser(user.sub, user.email);
        
        // Store user data in a Svelte store or localStorage
        // For example:
        // userStore.set(userData);
        localStorage.setItem('userData', JSON.stringify(userData));
  
        // Redirect based on whether the user is new or existing
        if (userData.isNewUser) {
          goto('/edit-profile');
        } else {
          goto('/dashboard');
        }
      } else {
        console.error('User data is incomplete');
        goto('/auth-error');
      }
    } catch (error) {
      console.error('Error handling Auth0 authentication response:', error);
      goto('/auth-error');
    }
  });
</script>

<div>
  <p>Processing Auth0 authentication response...</p>
  <!-- You might want to add a loading spinner here -->
</div>