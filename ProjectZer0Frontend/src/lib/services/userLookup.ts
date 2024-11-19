import { fetchWithAuth } from './api';
import type { UserProfile } from '$lib/types/user';

export async function getUserDetails(userId: string): Promise<UserProfile | null> {
  try {
    const userDetails = await fetchWithAuth(`/users/${userId}/details`);
    return userDetails;
  } catch (error) {
    console.error(`Error fetching user details for ${userId}:`, error);
    return null;
  }
}