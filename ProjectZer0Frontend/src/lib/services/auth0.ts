// src/lib/services/auth0.ts
import type { UserProfile } from '../types/domain/user';
import { jwtStore } from '../stores/JWTStore';
import { userStore } from '../stores/userStore';

// Use environment variable with fallback to localhost for development
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

export function login() {
 window.location.href = `${API_URL}/auth/login`;
}

export function logout() {
 jwtStore.clearToken();
 userStore.set(null);
 window.location.href = `${API_URL}/auth/logout`;
}

export async function getAuth0User(autoRedirect: boolean = true): Promise<UserProfile | null> {
 try {
   const response = await fetch(`${API_URL}/auth/profile`, {
     method: 'GET',
     credentials: 'include',
     headers: {
       'Content-Type': 'application/json',
     },
   });
   
   if (!response.ok) {
     if (response.status === 401) {
       if (autoRedirect) {
         login();
       }
       return null;
     }
     throw new Error(`Failed to fetch user data: ${response.statusText}`);
   }

   const userData: UserProfile = await response.json();
   console.log('User data received:', userData);
   userStore.set(userData);
   return userData;
 } catch (error) {
   console.error('Error getting user data:', error);
   return null;
 }
}

export async function handleAuthCallback() {
 await getAuth0User(true);  // Always enable auto-redirect for auth callback
}