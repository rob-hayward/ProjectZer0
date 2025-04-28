import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { wordStore, type WordViewType } from './wordStore';
import { get } from 'svelte/store';
import type { WordNode } from '$lib/types/domain/nodes';

// Mock the window.history API
const mockReplaceState = vi.fn();
Object.defineProperty(window, 'history', {
  value: {
    replaceState: mockReplaceState,
  },
  writable: true,
});

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000/graph/word',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Sample word data for testing
const mockWordData: WordNode = {
  id: 'word-123',
  word: 'democracy',
  createdAt: new Date().toISOString(),
  createdBy: 'user-1',
  publicCredit: true,
  updatedAt: new Date().toISOString(),
  definitions: [
    {
      id: 'def-1',
      definitionText: 'A system of government by the whole population or all the eligible members of a state, typically through elected representatives.',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
      positiveVotes: 5,
      negativeVotes: 1,
    }
  ],
  positiveVotes: 10,
  negativeVotes: 2,
};

describe('wordStore', () => {
  beforeEach(() => {
    wordStore.reset();
    vi.resetAllMocks();
    mockLocation.href = 'http://localhost:3000/graph/word';
    
    // Mock setTimeout to execute immediately
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with null value', () => {
    expect(get(wordStore)).toBeNull();
  });

  it('should update store value', () => {
    wordStore.set(mockWordData);
    expect(get(wordStore)).toEqual(mockWordData);
  });

  it('should update URL when setting word data', () => {
    wordStore.set(mockWordData);
    
    // Execute the setTimeout callback
    vi.runAllTimers();
    
    expect(mockReplaceState).toHaveBeenCalledWith(
      { word: mockWordData.word },
      '',
      `/graph/word?word=${encodeURIComponent(mockWordData.word)}`
    );
  });

  it('should update URL with correct view type', () => {
    const view: WordViewType = 'alternative-definitions';
    wordStore.set(mockWordData, view);
    
    // Execute the setTimeout callback
    vi.runAllTimers();
    
    expect(mockReplaceState).toHaveBeenCalledWith(
      { word: mockWordData.word },
      '',
      `/graph/${view}?word=${encodeURIComponent(mockWordData.word)}`
    );
  });

  it('should not update URL if word is already in URL', () => {
    mockLocation.href = `http://localhost:3000/graph/word?word=${encodeURIComponent(mockWordData.word)}`;
    
    wordStore.set(mockWordData);
    
    // Execute the setTimeout callback
    vi.runAllTimers();
    
    expect(mockReplaceState).not.toHaveBeenCalled();
  });

  it('should reset store to null', () => {
    wordStore.set(mockWordData);
    expect(get(wordStore)).not.toBeNull();
    
    wordStore.reset();
    expect(get(wordStore)).toBeNull();
  });

  it('should provide getCurrentWord method to get current word', () => {
    wordStore.set(mockWordData);
    expect(wordStore.getCurrentWord()).toEqual(mockWordData);
  });
});