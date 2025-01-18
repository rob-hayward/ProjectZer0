import { describe, it, expect, beforeEach } from 'vitest';
import { userStore } from './userStore';
import { get } from 'svelte/store';

describe('userStore', () => {
  beforeEach(() => {
    userStore.set(null);
  });

  it('should initialize with null value', () => {
    expect(get(userStore)).toBeNull();
  });

  it('should update store value', () => {
    const mockUser = { 
      sub: 'auth0|123',
      name: 'Test User',
      email: 'test@example.com',
      email_verified: true,
      nickname: 'testuser',
      picture: 'https://example.com/picture.jpg',
      updated_at: new Date().toISOString()
    };
    
    userStore.set(mockUser);
    expect(get(userStore)).toEqual(mockUser);
  });

  it('should notify subscribers of changes', () => {
    const mockUser = { 
      sub: 'auth0|123',
      email: 'test@example.com' 
    };
    
    let notifiedValue = null;
    const unsubscribe = userStore.subscribe(value => {
      notifiedValue = value;
    });
    
    userStore.set(mockUser);
    expect(notifiedValue).toEqual(mockUser);
    
    unsubscribe();
  });

  it('should handle null values', () => {
    const mockUser = { 
      sub: 'auth0|123',
      email: 'test@example.com' 
    };
    
    userStore.set(mockUser);
    userStore.set(null);
    expect(get(userStore)).toBeNull();
  });
});