// src/lib/services/auth0.ts
import type { UserProfile } from '../types/user';
import { jwtStore } from '../stores/JWTStore';
import { userStore } from '../stores/userStore';

const API_URL = 'http://localhost:3000/api'; 

export function login() {
  window.location.href = `${API_URL}/auth/login`;
}

export function logout() {
  jwtStore.clearToken();
  userStore.set(null);
  window.location.href = `${API_URL}/auth/logout`;
}

export async function handleAuthCallback() {
  // The token is now in a secure cookie, so we don't need to extract it from the URL
  await getAuth0User();
}

export async function getAuth0User(): Promise<UserProfile | null> {
  try {
    console.log('Fetching user data from backend...');
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      if (response.status === 401) {
        console.log('User is not authenticated. Redirecting to login...');
        login();
        return null;
      }
      throw new Error(`Failed to fetch user data: ${response.statusText}`);
    }

    const userData: UserProfile = await response.json();
    console.log('User data received:', userData);
    return userData;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}