// src/units/__tests__/unit.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnitService } from '../unit.service';
import { NotFoundException } from '@nestjs/common';
import { UnitCategoryId } from '../interfaces/unit.interface';
import { UNIT_CATEGORIES } from '../constants/unit-categories';

describe('UnitService', () => {
  let service: UnitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitService],
    }).compile();

    service = module.get<UnitService>(UnitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllCategories', () => {
    it('should return all unit categories', () => {
      const categories = service.getAllCategories();
      expect(categories).toBeDefined();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toEqual(Object.values(UNIT_CATEGORIES));
    });
  });

  describe('getCategory', () => {
    it('should return a specific category', () => {
      const category = service.getCategory(UnitCategoryId.LENGTH);
      expect(category).toBeDefined();
      expect(category.id).toBe(UnitCategoryId.LENGTH);
    });

    it('should throw NotFoundException for unknown category', () => {
      expect(() => service.getCategory('nonexistent')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUnitsForCategory', () => {
    it('should return all units for a category', () => {
      const lengthUnits = service.getUnitsForCategory(UnitCategoryId.LENGTH);
      expect(lengthUnits).toBeDefined();
      expect(lengthUnits.length).toBeGreaterThan(0);
      expect(lengthUnits).toEqual(UNIT_CATEGORIES[UnitCategoryId.LENGTH].units);
    });

    it('should throw NotFoundException for unknown category', () => {
      expect(() => service.getUnitsForCategory('nonexistent')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUnit', () => {
    it('should return a specific unit in a category', () => {
      const meter = service.getUnit(UnitCategoryId.LENGTH, 'meter');
      expect(meter).toBeDefined();
      expect(meter.id).toBe('meter');
      expect(meter.symbol).toBe('m');
    });

    it('should throw NotFoundException for unknown unit', () => {
      expect(() =>
        service.getUnit(UnitCategoryId.LENGTH, 'nonexistent'),
      ).toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown category', () => {
      expect(() => service.getUnit('nonexistent', 'meter')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateUnitInCategory', () => {
    it('should return true for valid unit in category', () => {
      const isValid = service.validateUnitInCategory(
        UnitCategoryId.LENGTH,
        'meter',
      );
      expect(isValid).toBe(true);
    });

    it('should return false for invalid unit in category', () => {
      const isValid = service.validateUnitInCategory(
        UnitCategoryId.LENGTH,
        'nonexistent',
      );
      expect(isValid).toBe(false);
    });

    it('should return false for invalid category', () => {
      const isValid = service.validateUnitInCategory('nonexistent', 'meter');
      expect(isValid).toBe(false);
    });
  });

  describe('convert', () => {
    it('should convert between length units', () => {
      // 1 meter = 100 centimeters
      const result = service.convert(
        UnitCategoryId.LENGTH,
        1,
        'meter',
        'centimeter',
      );
      expect(result).toBeCloseTo(100, 5);
    });

    it('should convert between mass units', () => {
      // 1 kilogram = 1000 grams
      const result = service.convert(
        UnitCategoryId.MASS,
        1,
        'kilogram',
        'gram',
      );
      expect(result).toBeCloseTo(1000, 5);
    });

    it('should convert between temperature units', () => {
      // 0°C = 273.15K
      const result = service.convert(
        UnitCategoryId.TEMPERATURE,
        0,
        'celsius',
        'kelvin',
      );
      expect(result).toBeCloseTo(273.15, 5);

      // 0°C = 32°F
      const fahrenheit = service.convert(
        UnitCategoryId.TEMPERATURE,
        0,
        'celsius',
        'fahrenheit',
      );
      expect(fahrenheit).toBeCloseTo(32, 5);
    });

    it('should handle roundtrip conversions accurately', () => {
      // Convert from meter to foot then back to meter
      const feet = service.convert(UnitCategoryId.LENGTH, 1, 'meter', 'foot');
      const backToMeter = service.convert(
        UnitCategoryId.LENGTH,
        feet,
        'foot',
        'meter',
      );
      expect(backToMeter).toBeCloseTo(1, 5);
    });
  });

  describe('normalizeToBase', () => {
    it('should normalize length measurement to base unit', () => {
      const normalized = service.normalizeToBase(UnitCategoryId.LENGTH, {
        value: 100,
        unitId: 'centimeter',
      });

      expect(normalized.baseValue).toBeCloseTo(1, 5); // 100cm = 1m
      expect(normalized.baseUnitId).toBe('meter');
      expect(normalized.originalValue).toBe(100);
      expect(normalized.originalUnitId).toBe('centimeter');
    });

    it('should normalize temperature measurement to base unit', () => {
      const normalized = service.normalizeToBase(UnitCategoryId.TEMPERATURE, {
        value: 0,
        unitId: 'celsius',
      });

      expect(normalized.baseValue).toBeCloseTo(273.15, 5); // 0°C = 273.15K
      expect(normalized.baseUnitId).toBe('kelvin');
    });
  });

  describe('formatMeasurement', () => {
    it('should format measurement according to unit format rules', () => {
      // For currency with custom formatter
      const formatted = service.formatMeasurement(UnitCategoryId.CURRENCY, {
        value: 123.45,
        unitId: 'usd',
      });
      expect(formatted).toBe('$123.45');
    });

    it('should use default formatting for units without custom formatter', () => {
      // For length without custom formatter
      const formatted = service.formatMeasurement(UnitCategoryId.LENGTH, {
        value: 123.45,
        unitId: 'meter',
      });
      expect(formatted).toBe('123.45 m');
    });
  });

  describe('getDefaultUnit', () => {
    it('should return the default unit for a category', () => {
      const defaultUnit = service.getDefaultUnit(UnitCategoryId.LENGTH);
      expect(defaultUnit).toBeDefined();
      expect(defaultUnit.id).toBe(
        UNIT_CATEGORIES[UnitCategoryId.LENGTH].defaultUnit,
      );
    });
  });

  describe('calculateStatistics', () => {
    it('should calculate statistics for a set of measurements', () => {
      const measurements = [
        {
          originalValue: 10,
          originalUnitId: 'meter',
          baseValue: 10,
          baseUnitId: 'meter',
        },
        {
          originalValue: 20,
          originalUnitId: 'meter',
          baseValue: 20,
          baseUnitId: 'meter',
        },
        {
          originalValue: 30,
          originalUnitId: 'meter',
          baseValue: 30,
          baseUnitId: 'meter',
        },
      ];

      const stats = service.calculateStatistics(measurements);

      expect(stats.count).toBe(3);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(30);
      expect(stats.mean).toBe(20);
      expect(stats.median).toBe(20);
      expect(stats.standardDeviation).toBeCloseTo(8.165, 3);
      expect(stats.percentiles[50]).toBe(20);
    });

    it('should handle empty measurements array', () => {
      const stats = service.calculateStatistics([]);

      expect(stats.count).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.standardDeviation).toBe(0);
      expect(Object.keys(stats.percentiles).length).toBe(0);
    });
  });

  describe('generateNormalDistributionCurve', () => {
    it('should generate points for a normal distribution curve', () => {
      const points = service.generateNormalDistributionCurve(10, 2, 5);

      expect(points.length).toBe(5);

      // Each point should be an [x, y] pair
      points.forEach((point) => {
        expect(point.length).toBe(2);
        expect(typeof point[0]).toBe('number');
        expect(typeof point[1]).toBe('number');
      });

      // The highest y value should be at the mean
      const meanPoint = points.find((p) => p[0] === 10);
      if (meanPoint) {
        const otherPoints = points.filter((p) => p[0] !== 10);
        otherPoints.forEach((p) => {
          expect(p[1]).toBeLessThanOrEqual(meanPoint[1]);
        });
      }
    });

    it('should handle zero standard deviation', () => {
      const points = service.generateNormalDistributionCurve(10, 0);
      expect(points.length).toBe(1);
      expect(points[0][0]).toBe(10); // x value is the mean
      expect(points[0][1]).toBe(1); // y value is 1
    });
  });
});
