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
  try {
    console.log(`Fetching ${url} with options:`, options);
    const response = await fetch(`${API_BASE_URL}${url}`, { 
      ...options, 
      headers,
      credentials: 'include'
    });
    
    console.log('Fetch response:', response);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Error response body:', errorBody);
      throw new Error(`API call failed: ${response.status} ${response.statusText}, body: ${errorBody}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      console.log('JSON response:', jsonResponse);
      return jsonResponse;
    } else {
      const textResponse = await response.text();
      console.log('Text response:', textResponse);
      return textResponse;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}