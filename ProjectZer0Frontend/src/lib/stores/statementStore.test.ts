import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { statementStore } from './statementStore';
import { get } from 'svelte/store';
import type { StatementNode } from '$lib/types/domain/nodes';

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
  href: 'http://localhost:3000/graph/statement',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Sample statement data for testing
const mockStatementData: StatementNode = {
  id: 'statement-123',
  statement: 'Democracy requires active participation from citizens.',
  createdAt: new Date().toISOString(),
  createdBy: 'user-1',
  publicCredit: true,
  updatedAt: new Date().toISOString(),
  positiveVotes: 15,
  negativeVotes: 3,
  keywords: [
    { word: 'democracy', frequency: 1, source: 'user' },
    { word: 'participation', frequency: 1, source: 'user' }
  ],
  relatedStatements: [],
};

describe('statementStore', () => {
  beforeEach(() => {
    statementStore.reset();
    vi.resetAllMocks();
    mockLocation.href = 'http://localhost:3000/graph/statement';
    
    // Mock setTimeout to execute immediately
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with null value', () => {
    expect(get(statementStore)).toBeNull();
  });

  it('should update store value', () => {
    statementStore.set(mockStatementData);
    expect(get(statementStore)).toEqual(mockStatementData);
  });

  it('should update URL when setting statement data', () => {
    statementStore.set(mockStatementData);
    
    // Execute the setTimeout callback
    vi.runAllTimers();
    
    expect(mockReplaceState).toHaveBeenCalledWith(
      { id: mockStatementData.id },
      '',
      `/graph/statement?id=${encodeURIComponent(mockStatementData.id)}`
    );
  });

  it('should not update URL if statement ID is already in URL', () => {
    mockLocation.href = `http://localhost:3000/graph/statement?id=${encodeURIComponent(mockStatementData.id)}`;
    
    statementStore.set(mockStatementData);
    
    // Execute the setTimeout callback
    vi.runAllTimers();
    
    expect(mockReplaceState).not.toHaveBeenCalled();
  });

  it('should reset store to null', () => {
    statementStore.set(mockStatementData);
    expect(get(statementStore)).not.toBeNull();
    
    statementStore.reset();
    expect(get(statementStore)).toBeNull();
  });

  it('should provide getCurrentStatement method to get current statement', () => {
    statementStore.set(mockStatementData);
    expect(statementStore.getCurrentStatement()).toEqual(mockStatementData);
  });
  
  it('should handle console logging', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    statementStore.set(mockStatementData);
    vi.runAllTimers();
    
    expect(consoleSpy).toHaveBeenCalled();
    
    // Clean up spies
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});