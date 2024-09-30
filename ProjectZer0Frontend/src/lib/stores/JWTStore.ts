// src/lib/stores/JWTStore.ts
import { writable } from 'svelte/store';

function createJWTStore() {
  const { subscribe, set, update } = writable<string | null>(null);

  return {
    subscribe,
    setToken: (token: string) => set(token),
    clearToken: () => set(null),
    getToken: () => {
      let token: string | null = null;
      subscribe(value => {
        token = value;
      })();
      return token;
    }
  };
}

export const jwtStore = createJWTStore();