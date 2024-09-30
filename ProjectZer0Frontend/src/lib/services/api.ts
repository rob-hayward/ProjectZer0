// src/lib/services/api.ts
import { jwtStore } from '../stores/JWTStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = jwtStore.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}${url}`, { 
    ...options, 
    headers,
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return response.json();
}