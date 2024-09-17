<!-- auth0-response-handler.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createAuth0Client } from '@auth0/auth0-spa-js';
  
  onMount(async () => {
    try {
      // Initialize the Auth0 client
      const auth0 = await createAuth0Client({
        domain: import.meta.env.VITE_AUTH0_DOMAIN,
        clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
        authorizationParams: {
          redirect_uri: 'http://localhost:5173/auth0-response-handler'
        }
      });
  
      // Handle the authentication response from Auth0
      await auth0.handleRedirectCallback();
  
      // At this point, the user is authenticated.
      // You might want to fetch the user profile or do other post-authentication tasks here.
      const user = await auth0.getUser();
      console.log('Authenticated user:', user);
  
      // Store the authentication state or user info in your app's state management
      // For example, you might use a Svelte store:
      // import { userStore } from './stores';
      // userStore.set(user);
  
      // Redirect to the main application page or dashboard
      window.location.replace('/dashboard');
    } catch (error) {
      console.error('Error handling Auth0 authentication response:', error);
      // Handle errors, perhaps by redirecting to an error page
      window.location.replace('/auth-error');
    }
  });
  </script>
  
  <div>
    <p>Processing Auth0 authentication response...</p>
    <!-- You might want to add a loading spinner or more informative message here -->
  </div>