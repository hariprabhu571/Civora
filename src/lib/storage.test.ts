import { describe, it, expect, beforeEach } from 'vitest';
import { safeLocalStorage } from './storage';

describe('safeLocalStorage Utility', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('should set and get values correctly', () => {
    safeLocalStorage.setItem('test-key', 'test-value');
    expect(safeLocalStorage.getItem('test-key')).toBe('test-value');
  });

  it('should return null for non-existent keys', () => {
    expect(safeLocalStorage.getItem('non-existent-key')).toBeNull();
  });

  it('should remove items correctly', () => {
    safeLocalStorage.setItem('test-key-2', 'val-2');
    expect(safeLocalStorage.getItem('test-key-2')).toBe('val-2');
    safeLocalStorage.removeItem('test-key-2');
    expect(safeLocalStorage.getItem('test-key-2')).toBeNull();
  });

  it('should clear all items in the store', () => {
    safeLocalStorage.setItem('key1', '1');
    safeLocalStorage.setItem('key2', '2');
    expect(safeLocalStorage.getItem('key1')).toBe('1');
    expect(safeLocalStorage.getItem('key2')).toBe('2');

    safeLocalStorage.clear();
    expect(safeLocalStorage.getItem('key1')).toBeNull();
    expect(safeLocalStorage.getItem('key2')).toBeNull();
  });
});
