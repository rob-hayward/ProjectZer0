import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoordinateSystem } from './CoordinateSystem';
import * as d3 from 'd3';

describe('CoordinateSystem', () => {
  let coordinateSystem: CoordinateSystem;
  
  beforeEach(() => {
    coordinateSystem = new CoordinateSystem();
  });
  
  describe('Transform Management', () => {
    it('should initialize with default transform', () => {
      const transform = coordinateSystem.getCurrentTransform();
      
      // Should be initialized with default scale from constants
      expect(transform.k).toBeGreaterThan(0);
      expect(transform.x).toBe(0);
      expect(transform.y).toBe(0);
    });
    
    it('should update transform when called', () => {
      const newTransform = d3.zoomIdentity.translate(100, 50).scale(2);
      
      coordinateSystem.updateTransform(newTransform);
      
      const currentTransform = coordinateSystem.getCurrentTransform();
      expect(currentTransform.k).toBe(2);
      expect(currentTransform.x).toBe(100);
      expect(currentTransform.y).toBe(50);
    });
    
    it('should notify subscribers when transform changes', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = coordinateSystem.transform.subscribe(mockSubscriber);
      
      // Initial call with default transform
      expect(mockSubscriber).toHaveBeenCalledTimes(1);
      
      const newTransform = d3.zoomIdentity.translate(100, 50).scale(2);
      coordinateSystem.updateTransform(newTransform);
      
      // Should be called again with new transform
      expect(mockSubscriber).toHaveBeenCalledTimes(2);
      expect(mockSubscriber).toHaveBeenLastCalledWith(newTransform);
      
      unsubscribe();
    });
  });
  
  describe('Coordinate Conversion', () => {
    it('should convert world coordinates to view coordinates', () => {
      // Set a known transform for testing
      const transform = d3.zoomIdentity.translate(100, 50).scale(2);
      coordinateSystem.updateTransform(transform);
      
      const worldCoords = { x: 10, y: 20 };
      const viewCoords = coordinateSystem.worldToView(worldCoords.x, worldCoords.y);
      
      // Apply the transform manually to check
      // viewX = worldX * scale + translateX
      // viewY = worldY * scale + translateY
      expect(viewCoords.x).toBe(10 * 2 + 100);
      expect(viewCoords.y).toBe(20 * 2 + 50);
    });
    
    it('should convert view coordinates to world coordinates', () => {
      // Set a known transform for testing
      const transform = d3.zoomIdentity.translate(100, 50).scale(2);
      coordinateSystem.updateTransform(transform);
      
      const viewCoords = { x: 120, y: 90 };
      const worldCoords = coordinateSystem.viewToWorld(viewCoords.x, viewCoords.y);
      
      // Apply the inverse transform manually to check
      // worldX = (viewX - translateX) / scale
      // worldY = (viewY - translateY) / scale
      expect(worldCoords.x).toBe((120 - 100) / 2);
      expect(worldCoords.y).toBe((90 - 50) / 2);
    });
    
    it('should convert world sizes to view sizes', () => {
      // Set a known transform for testing
      const transform = d3.zoomIdentity.translate(100, 50).scale(2);
      coordinateSystem.updateTransform(transform);
      
      const worldSize = 15;
      const viewSize = coordinateSystem.worldToViewSize(worldSize);
      
      // View size = world size * scale
      expect(viewSize).toBe(15 * 2);
    });
    
    it('should convert view sizes to world sizes', () => {
      // Set a known transform for testing
      const transform = d3.zoomIdentity.translate(100, 50).scale(2);
      coordinateSystem.updateTransform(transform);
      
      const viewSize = 30;
      const worldSize = coordinateSystem.viewToWorldSize(viewSize);
      
      // World size = view size / scale
      expect(worldSize).toBe(30 / 2);
    });
  });
  
  describe('SVG Transform Creation', () => {
    it('should create correct SVG transform string', () => {
      const transformStr = coordinateSystem.createSVGTransform(10, 20);
      expect(transformStr).toBe('translate(10, 20)');
      
      const transformWithScale = coordinateSystem.createSVGTransform(10, 20, 2);
      expect(transformWithScale).toBe('translate(10, 20) scale(2)');
    });
  });
  
  describe('Point Calculation', () => {
    it('should calculate perimeter point correctly', () => {
      const fromX = 0;
      const fromY = 0;
      const toX = 100;
      const toY = 0;
      const viewRadius = 20;
      
      const point = coordinateSystem.calculatePerimeterPoint(
        fromX, fromY, toX, toY, viewRadius
      );
      
      // Should be on the x-axis, at radius distance
      // Using the RADIUS_SCALE_FACTOR which is exposed as 1/9
      const expectedX = toX - ((viewRadius * (1/9)));
      expect(point.x).toBeCloseTo(expectedX);
      expect(point.y).toBeCloseTo(0);
    });
    
    it('should calculate dashboard connection point correctly', () => {
      const nodePosition = { x: 100, y: 0 };
      const dashboardViewRadius = 45;
      
      const point = coordinateSystem.calculateDashboardConnectionPoint(
        nodePosition, dashboardViewRadius
      );
      
      // Should point towards origin, scaled by radius
      const expectedX = -(45 * (1/9)); // Negative because we're pointing towards origin
      expect(point.x).toBeCloseTo(expectedX);
      expect(point.y).toBeCloseTo(0);
    });
    
    it('should calculate navigation connection endpoint correctly', () => {
      const nodePosition = { x: 100, y: 0 };
      const viewType = 'dashboard';
      
      const point = coordinateSystem.calculateNavigationConnectionEndpoint(
        nodePosition, viewType
      );
      
      // Should point towards the origin, with an appropriate scaling
      expect(point.x).toBeLessThan(0); // Negative because we're pointing towards origin
      expect(point.y).toBeCloseTo(0);
    });
    
    it('should calculate navigation connection endpoint with word-specific logic', () => {
      const nodePosition = { x: 100, y: 0 };
      const viewType = 'word';
      
      const point = coordinateSystem.calculateNavigationConnectionEndpoint(
        nodePosition, viewType
      );
      
      // For word view, should use different scaling factors
      expect(point.x).toBeLessThan(0);
      expect(point.y).toBeCloseTo(0);
    });
    
    it('should calculate navigation connection endpoint with statement-specific logic', () => {
      const nodePosition = { x: 100, y: 0 };
      const viewType = 'statement';
      
      const point = coordinateSystem.calculateNavigationConnectionEndpoint(
        nodePosition, viewType
      );
      
      // For statement view, should use different scaling factors
      expect(point.x).toBeLessThan(0);
      expect(point.y).toBeCloseTo(0);
    });
    
    it('should handle zero distance case in perimeter calculation', () => {
      const fromX = 10;
      const fromY = 20;
      const toX = 10; // Same point
      const toY = 20;
      const viewRadius = 50;
      
      const point = coordinateSystem.calculatePerimeterPoint(
        fromX, fromY, toX, toY, viewRadius
      );
      
      // Should return the target point unchanged
      expect(point.x).toBe(toX);
      expect(point.y).toBe(toY);
    });
  });
});