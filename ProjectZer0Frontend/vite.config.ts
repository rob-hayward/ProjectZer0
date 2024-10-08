import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  console.log('Vite Config - Auth0 Domain:', env.VITE_AUTH0_DOMAIN);
  console.log('Vite Config - Auth0 Client ID:', env.VITE_AUTH0_CLIENT_ID);
  console.log('Vite Config - Auth0 Audience:', env.VITE_AUTH0_AUDIENCE);
  
  return {
    plugins: [sveltekit()],
    define: {
      'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify(env.VITE_AUTH0_DOMAIN),
      'import.meta.env.VITE_AUTH0_CLIENT_ID': JSON.stringify(env.VITE_AUTH0_CLIENT_ID),
      'import.meta.env.VITE_AUTH0_AUDIENCE': JSON.stringify(env.VITE_AUTH0_AUDIENCE),
    },
    test: {
      include: ['src/**/*.{test,spec}.{js,ts}'],
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.ts'],
      // Exclude the default Vitest includes
      exclude: [...configDefaults.exclude, 'tests'],
    },
  };
});