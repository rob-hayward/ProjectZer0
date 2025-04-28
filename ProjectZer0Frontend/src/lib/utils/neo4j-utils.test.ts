import { describe, it, expect } from 'vitest';
import { getNeo4jNumber } from './neo4j-utils';

describe('Neo4j Utils', () => {
  describe('getNeo4jNumber', () => {
    it('should return the same value when given a regular number', () => {
      expect(getNeo4jNumber(42)).toBe(42);
      expect(getNeo4jNumber(0)).toBe(0);
      expect(getNeo4jNumber(-10)).toBe(-10);
      expect(getNeo4jNumber(3.14)).toBe(3.14);
    });

    it('should handle null and undefined values', () => {
      expect(getNeo4jNumber(null)).toBe(0);
      expect(getNeo4jNumber(undefined)).toBe(0);
    });

    it('should extract number from Neo4j integer objects with low property', () => {
      const neo4jInteger = { low: 42, high: 0 };
      expect(getNeo4jNumber(neo4jInteger)).toBe(42);
      
      const negativeNeo4jInteger = { low: -15, high: -1 };
      expect(getNeo4jNumber(negativeNeo4jInteger)).toBe(-15);
    });

    it('should use valueOf method if available', () => {
      const objectWithValueOf = {
        valueOf: () => 123
      };
      expect(getNeo4jNumber(objectWithValueOf)).toBe(123);
    });

    it('should convert string numbers to actual numbers', () => {
      expect(getNeo4jNumber('42')).toBe(42);
      expect(getNeo4jNumber('-10.5')).toBe(-10.5);
    });

    it('should handle empty strings and non-numeric strings', () => {
      expect(getNeo4jNumber('')).toBe(0);
      expect(getNeo4jNumber('not a number')).toBe(0); // NaN gets converted to 0
    });

    it('should handle complex nested objects', () => {
      const complexObject = {
        data: {
          number: {
            low: 99,
            high: 0
          }
        }
      };
      
      // This should return 0 since the function doesn't recursively search
      expect(getNeo4jNumber(complexObject)).toBe(0);
    });

    it('should handle boolean values', () => {
      expect(getNeo4jNumber(true)).toBe(1);
      expect(getNeo4jNumber(false)).toBe(0);
    });
  });
});