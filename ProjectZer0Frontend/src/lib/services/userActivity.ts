// src/lib/services/userActivity.ts
import { fetchWithAuth } from './api';

export interface UserActivity {
  nodesCreated: number;
  votesCast: number;
  commentsMade: number;
}

export async function getUserActivity(): Promise<UserActivity> {
  try {
    console.log('Fetching user activity...'); // Debug log
    const data = await fetchWithAuth('/users/activity');
    console.log('Received activity data:', data); // Debug log
    return data;
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return {
      nodesCreated: 0,
      votesCast: 0,
      commentsMade: 0
    };
  }
}