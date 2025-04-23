// src/units/unit.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Unit,
  UnitCategory,
  Measurement,
  NormalizedMeasurement,
} from './interfaces/unit.interface';
import { UNIT_CATEGORIES } from './constants/unit-categories';

@Injectable()
export class UnitService {
  private readonly logger = new Logger(UnitService.name);

  /**
   * Get all available unit categories
   */
  getAllCategories(): UnitCategory[] {
    return Object.values(UNIT_CATEGORIES);
  }

  /**
   * Get a unit category by its ID
   */
  getCategory(categoryId: string): UnitCategory {
    const category = UNIT_CATEGORIES[categoryId];
    if (!category) {
      throw new NotFoundException(`Unit category '${categoryId}' not found`);
    }
    return category;
  }

  /**
   * Get all units for a specific category
   */
  getUnitsForCategory(categoryId: string): Unit[] {
    return this.getCategory(categoryId).units;
  }

  /**
   * Get a specific unit by its ID and category
   */
  getUnit(categoryId: string, unitId: string): Unit {
    const category = this.getCategory(categoryId);
    const unit = category.units.find((u) => u.id === unitId);

    if (!unit) {
      throw new NotFoundException(
        `Unit '${unitId}' not found in category '${categoryId}'`,
      );
    }

    return unit;
  }

  /**
   * Normalize a measurement to its base unit
   */
  normalizeToBase(
    categoryId: string,
    measurement: Measurement,
  ): NormalizedMeasurement {
    const unit = this.getUnit(categoryId, measurement.unitId);
    const baseUnit = this.getUnit(
      categoryId,
      this.getCategory(categoryId).baseUnit,
    );

    let baseValue: number;

    // Use custom conversion if available, otherwise use conversion factor
    if (unit.toBase) {
      baseValue = unit.toBase(measurement.value);
    } else {
      // If conversionFactor represents how many of this unit in 1 base unit
      baseValue = measurement.value / unit.conversionFactor;
    }

    return {
      originalValue: measurement.value,
      originalUnitId: measurement.unitId,
      baseValue,
      baseUnitId: baseUnit.id,
    };
  }

  /**
   * Convert a value from one unit to another within the same category
   */
  convert(
    categoryId: string,
    value: number,
    fromUnitId: string,
    toUnitId: string,
  ): number {
    const fromUnit = this.getUnit(categoryId, fromUnitId);
    const toUnit = this.getUnit(categoryId, toUnitId);

    // First normalize to base unit
    let baseValue: number;
    if (fromUnit.toBase) {
      baseValue = fromUnit.toBase(value);
    } else {
      baseValue = value / fromUnit.conversionFactor;
    }

    // Then convert from base to target unit
    let convertedValue: number;
    if (toUnit.fromBase) {
      convertedValue = toUnit.fromBase(baseValue);
    } else {
      convertedValue = baseValue * toUnit.conversionFactor;
    }

    return convertedValue;
  }

  /**
   * Format a measurement value according to its unit's formatting rules
   */
  formatMeasurement(categoryId: string, measurement: Measurement): string {
    const unit = this.getUnit(categoryId, measurement.unitId);

    if (unit.format) {
      return unit.format(measurement.value);
    }

    // Default formatting if no custom formatter is defined
    return `${measurement.value} ${unit.symbol}`;
  }

  /**
   * Get the default unit for a category
   */
  getDefaultUnit(categoryId: string): Unit {
    const category = this.getCategory(categoryId);
    return this.getUnit(categoryId, category.defaultUnit);
  }

  /**
   * Validate that a unit belongs to a specified category
   */
  validateUnitInCategory(categoryId: string, unitId: string): boolean {
    try {
      this.getUnit(categoryId, unitId);
      return true;
    } catch {
      // Deliberately catch and ignore errors
      return false;
    }
  }

  /**
   * Calculate statistical measures for an array of normalized measurements
   */
  calculateStatistics(measurements: NormalizedMeasurement[]): {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    standardDeviation: number;
    percentiles: Record<number, number>; // key is percentile (e.g., 25, 75), value is the measurement
  } {
    if (!measurements || measurements.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        standardDeviation: 0,
        percentiles: {},
      };
    }

    // Extract base values for calculations
    const values = measurements.map((m) => m.baseValue).sort((a, b) => a - b);
    const count = values.length;

    // Basic statistics
    const min = values[0];
    const max = values[count - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Calculate median
    const median =
      count % 2 === 0
        ? (values[count / 2 - 1] + values[count / 2]) / 2
        : values[Math.floor(count / 2)];

    // Calculate standard deviation
    const squaredDifferences = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDifferences.reduce((a, b) => a + b, 0) / count;
    const standardDeviation = Math.sqrt(variance);

    // Calculate percentiles (25th, 50th, 75th, 90th, 95th, 99th)
    const percentiles: Record<number, number> = {};
    [25, 50, 75, 90, 95, 99].forEach((p) => {
      const index = Math.ceil((p / 100) * count) - 1;
      percentiles[p] = values[Math.min(index, count - 1)];
    });

    return {
      count,
      min,
      max,
      mean,
      median,
      standardDeviation,
      percentiles,
    };
  }

  /**
   * Generate data points for a normal distribution curve based on statistics
   * Returns array of [x, y] points for plotting
   */
  generateNormalDistributionCurve(
    mean: number,
    standardDeviation: number,
    points = 100,
    rangeMultiplier = 3, // How many standard deviations to include on each side
  ): number[][] {
    if (standardDeviation === 0) {
      // Special case: all values are identical
      return [[mean, 1]];
    }

    const result: number[][] = [];
    const minX = mean - rangeMultiplier * standardDeviation;
    const maxX = mean + rangeMultiplier * standardDeviation;
    const step = (maxX - minX) / (points - 1);

    for (let i = 0; i < points; i++) {
      const x = minX + i * step;
      // Normal distribution probability density function
      const y =
        (1 / (standardDeviation * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * Math.pow((x - mean) / standardDeviation, 2));
      result.push([x, y]);
    }

    return result;
  }
}
