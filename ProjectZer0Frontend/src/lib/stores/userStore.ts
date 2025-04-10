// src/lib/stores/userStore.ts
import { writable } from 'svelte/store';
import type { UserProfile } from '../types/domain/user';

export const userStore = writable<UserProfile | null>(null);