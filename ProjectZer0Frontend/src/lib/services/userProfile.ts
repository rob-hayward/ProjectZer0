// src/lib/services/userProfile.ts
import type { UserProfile } from '../types/domain/user';
import { fetchWithAuth } from './api';

export async function updateUserProfile(userData: Partial<UserProfile>): Promise<UserProfile | null> {
  try {
    console.log('Updating user profile...');
    const updatedUserData = await fetchWithAuth('/users/update-profile', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    console.log('User profile updated:', updatedUserData);
    return updatedUserData;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null;
  }
}