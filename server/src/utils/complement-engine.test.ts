import { describe, it, expect } from 'vitest';
import { complementScore, calculateAddedStarts, getDateRange } from './complement-engine';

describe('Complement Engine', () => {
  describe('complementScore', () => {
    it('should calculate raw complement correctly', () => {
      const seedDates = new Set(['2024-01-01', '2024-01-02', '2024-01-03']);
      const otherDates = new Set(['2024-01-02', '2024-01-04', '2024-01-05']);
      
      const result = complementScore(seedDates, otherDates, false);
      
      expect(result.raw).toBe(2);
      expect(result.dates).toEqual(['2024-01-04', '2024-01-05']);
    });

    it('should handle empty sets', () => {
      const seedDates = new Set<string>();
      const otherDates = new Set(['2024-01-01', '2024-01-02']);
      
      const result = complementScore(seedDates, otherDates);
      
      expect(result.raw).toBe(2);
      expect(result.dates.length).toBe(2);
    });

    it('should handle no complement dates', () => {
      const seedDates = new Set(['2024-01-01', '2024-01-02']);
      const otherDates = new Set(['2024-01-01', '2024-01-02']);
      
      const result = complementScore(seedDates, otherDates);
      
      expect(result.raw).toBe(0);
      expect(result.dates).toEqual([]);
    });
  });

  describe('calculateAddedStarts', () => {
    it('should calculate added starts correctly', () => {
      const occupiedDates = new Set(['2024-01-01', '2024-01-02']);
      const candidateDates = new Set(['2024-01-02', '2024-01-03', '2024-01-04']);
      
      const result = calculateAddedStarts(occupiedDates, candidateDates);
      
      expect(result.addedStarts).toBe(2);
      expect(result.dates).toEqual(['2024-01-03', '2024-01-04']);
    });
  });

  describe('getDateRange', () => {
    it('should return correct date range for 7d window', () => {
      const result = getDateRange('7d');
      
      expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      const startDate = new Date(result.start);
      const endDate = new Date(result.end);
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(diffDays).toBe(7);
    });

    it('should return correct date range for season window', () => {
      const result = getDateRange('season');
      
      expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      const startDate = new Date(result.start);
      const endDate = new Date(result.end);
      
      expect(startDate.getMonth()).toBe(9);
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(5);
      expect(endDate.getDate()).toBe(15);
    });
  });
});