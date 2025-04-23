// src/units/interfaces/unit.interface.ts

/**
 * Interface for a single unit within a category
 */
export interface Unit {
  // Unique identifier for the unit
  id: string;

  // Display name for the unit
  name: string;

  // Symbol or abbreviation (e.g., km, $, kg)
  symbol: string;

  // Conversion factor to the base unit in the category
  // Base unit will have conversionFactor = 1
  conversionFactor: number;

  // Optional custom conversion functions for more complex conversions
  // like temperature where linear conversion isn't sufficient
  fromBase?: (baseValue: number) => number;
  toBase?: (unitValue: number) => number;

  // For formatting display of values (e.g., prefixing with currency symbol)
  format?: (value: number) => string;

  // Whether this is the base unit for the category
  isBase?: boolean;
}

/**
 * Interface for a category of units (e.g., length, mass, currency)
 */
export interface UnitCategory {
  // Unique identifier for the category
  id: string;

  // Display name for the category
  name: string;

  // Description of what this category measures
  description: string;

  // All available units in this category
  units: Unit[];

  // The default unit for this category
  defaultUnit: string; // references a unit id

  // The base unit used for conversions
  baseUnit: string; // references a unit id
}

/**
 * Interface for a measurement with a value and unit
 */
export interface Measurement {
  value: number;
  unitId: string;
}

/**
 * Interface for a normalized measurement (converted to base unit)
 */
export interface NormalizedMeasurement {
  originalValue: number;
  originalUnitId: string;
  baseValue: number;
  baseUnitId: string;
}

/**
 * Supported unit categories
 */
export enum UnitCategoryId {
  CURRENCY = 'currency',
  LENGTH = 'length',
  MASS = 'mass',
  TEMPERATURE = 'temperature',
  TIME = 'time',
  VOLUME = 'volume',
  AREA = 'area',
  PERCENTAGE = 'percentage',
  COUNT = 'count',
}
