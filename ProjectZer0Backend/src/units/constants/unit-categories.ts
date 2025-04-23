// src/units/constants/unit-categories.ts
import { UnitCategory, UnitCategoryId } from '../interfaces/unit.interface';

// Currency units with USD as base unit
export const CURRENCY_CATEGORY: UnitCategory = {
  id: UnitCategoryId.CURRENCY,
  name: 'Currency',
  description: 'Monetary values in different currencies',
  baseUnit: 'usd',
  defaultUnit: 'usd',
  units: [
    {
      id: 'usd',
      name: 'US Dollar',
      symbol: '$',
      conversionFactor: 1,
      isBase: true,
      format: (value) => `$${value.toFixed(2)}`,
    },
    {
      id: 'eur',
      name: 'Euro',
      symbol: '€',
      conversionFactor: 0.91, // 1 USD = 0.91 EUR
      format: (value) => `€${value.toFixed(2)}`,
    },
    {
      id: 'gbp',
      name: 'British Pound',
      symbol: '£',
      conversionFactor: 0.78, // 1 USD = 0.78 GBP
      format: (value) => `£${value.toFixed(2)}`,
    },
    {
      id: 'jpy',
      name: 'Japanese Yen',
      symbol: '¥',
      conversionFactor: 110.33, // 1 USD = 110.33 JPY
      format: (value) => `¥${Math.round(value)}`,
    },
  ],
};

// Length units with meter as base unit
export const LENGTH_CATEGORY: UnitCategory = {
  id: UnitCategoryId.LENGTH,
  name: 'Length',
  description: 'Distance or length measurements',
  baseUnit: 'meter',
  defaultUnit: 'meter',
  units: [
    {
      id: 'meter',
      name: 'Meter',
      symbol: 'm',
      conversionFactor: 1,
      isBase: true,
    },
    {
      id: 'kilometer',
      name: 'Kilometer',
      symbol: 'km',
      conversionFactor: 0.001, // 1 m = 0.001 km
    },
    {
      id: 'centimeter',
      name: 'Centimeter',
      symbol: 'cm',
      conversionFactor: 100, // 1 m = 100 cm
    },
    {
      id: 'millimeter',
      name: 'Millimeter',
      symbol: 'mm',
      conversionFactor: 1000, // 1 m = 1000 mm
    },
    {
      id: 'inch',
      name: 'Inch',
      symbol: 'in',
      conversionFactor: 39.3701, // 1 m = 39.3701 inches
    },
    {
      id: 'foot',
      name: 'Foot',
      symbol: 'ft',
      conversionFactor: 3.28084, // 1 m = 3.28084 feet
    },
    {
      id: 'yard',
      name: 'Yard',
      symbol: 'yd',
      conversionFactor: 1.09361, // 1 m = 1.09361 yards
    },
    {
      id: 'mile',
      name: 'Mile',
      symbol: 'mi',
      conversionFactor: 0.000621371, // 1 m = 0.000621371 miles
    },
  ],
};

// Mass units with kilogram as base unit
export const MASS_CATEGORY: UnitCategory = {
  id: UnitCategoryId.MASS,
  name: 'Mass',
  description: 'Weight or mass measurements',
  baseUnit: 'kilogram',
  defaultUnit: 'kilogram',
  units: [
    {
      id: 'kilogram',
      name: 'Kilogram',
      symbol: 'kg',
      conversionFactor: 1,
      isBase: true,
    },
    {
      id: 'gram',
      name: 'Gram',
      symbol: 'g',
      conversionFactor: 1000, // 1 kg = 1000 g
    },
    {
      id: 'milligram',
      name: 'Milligram',
      symbol: 'mg',
      conversionFactor: 1000000, // 1 kg = 1,000,000 mg
    },
    {
      id: 'pound',
      name: 'Pound',
      symbol: 'lb',
      conversionFactor: 2.20462, // 1 kg = 2.20462 lbs
    },
    {
      id: 'ounce',
      name: 'Ounce',
      symbol: 'oz',
      conversionFactor: 35.274, // 1 kg = 35.274 oz
    },
    {
      id: 'ton',
      name: 'Metric Ton',
      symbol: 't',
      conversionFactor: 0.001, // 1 kg = 0.001 metric tons
    },
  ],
};

// Temperature units with Kelvin as base unit
// Temperature requires custom conversion functions due to non-linear scaling
export const TEMPERATURE_CATEGORY: UnitCategory = {
  id: UnitCategoryId.TEMPERATURE,
  name: 'Temperature',
  description: 'Temperature measurements',
  baseUnit: 'kelvin',
  defaultUnit: 'celsius',
  units: [
    {
      id: 'kelvin',
      name: 'Kelvin',
      symbol: 'K',
      conversionFactor: 1,
      isBase: true,
    },
    {
      id: 'celsius',
      name: 'Celsius',
      symbol: '°C',
      conversionFactor: 1, // Not used for temperature
      // Custom conversion functions
      toBase: (celsius) => celsius + 273.15, // C to K
      fromBase: (kelvin) => kelvin - 273.15, // K to C
    },
    {
      id: 'fahrenheit',
      name: 'Fahrenheit',
      symbol: '°F',
      conversionFactor: 1, // Not used for temperature
      // Custom conversion functions
      toBase: (fahrenheit) => (fahrenheit + 459.67) * (5 / 9), // F to K
      fromBase: (kelvin) => kelvin * (9 / 5) - 459.67, // K to F
    },
  ],
};

// Time units with second as base unit
export const TIME_CATEGORY: UnitCategory = {
  id: UnitCategoryId.TIME,
  name: 'Time',
  description: 'Time duration measurements',
  baseUnit: 'second',
  defaultUnit: 'second',
  units: [
    {
      id: 'second',
      name: 'Second',
      symbol: 's',
      conversionFactor: 1,
      isBase: true,
    },
    {
      id: 'minute',
      name: 'Minute',
      symbol: 'min',
      conversionFactor: 1 / 60, // 1 s = 1/60 min
    },
    {
      id: 'hour',
      name: 'Hour',
      symbol: 'h',
      conversionFactor: 1 / 3600, // 1 s = 1/3600 h
    },
    {
      id: 'day',
      name: 'Day',
      symbol: 'd',
      conversionFactor: 1 / 86400, // 1 s = 1/86400 d
    },
    {
      id: 'week',
      name: 'Week',
      symbol: 'wk',
      conversionFactor: 1 / 604800, // 1 s = 1/604800 week
    },
    {
      id: 'month',
      name: 'Month (30 days)',
      symbol: 'mo',
      conversionFactor: 1 / 2592000, // 1 s = 1/2592000 month (30 days)
    },
    {
      id: 'year',
      name: 'Year (365 days)',
      symbol: 'yr',
      conversionFactor: 1 / 31536000, // 1 s = 1/31536000 year
    },
  ],
};

// Volume units with liter as base unit
export const VOLUME_CATEGORY: UnitCategory = {
  id: UnitCategoryId.VOLUME,
  name: 'Volume',
  description: 'Volume measurements',
  baseUnit: 'liter',
  defaultUnit: 'liter',
  units: [
    {
      id: 'liter',
      name: 'Liter',
      symbol: 'L',
      conversionFactor: 1,
      isBase: true,
    },
    {
      id: 'milliliter',
      name: 'Milliliter',
      symbol: 'mL',
      conversionFactor: 1000, // 1 L = 1000 mL
    },
    {
      id: 'cubic_meter',
      name: 'Cubic Meter',
      symbol: 'm³',
      conversionFactor: 0.001, // 1 L = 0.001 m³
    },
    {
      id: 'gallon_us',
      name: 'US Gallon',
      symbol: 'gal',
      conversionFactor: 0.264172, // 1 L = 0.264172 gal (US)
    },
    {
      id: 'quart_us',
      name: 'US Quart',
      symbol: 'qt',
      conversionFactor: 1.05669, // 1 L = 1.05669 qt (US)
    },
    {
      id: 'pint_us',
      name: 'US Pint',
      symbol: 'pt',
      conversionFactor: 2.11338, // 1 L = 2.11338 pt (US)
    },
    {
      id: 'cup_us',
      name: 'US Cup',
      symbol: 'cup',
      conversionFactor: 4.22675, // 1 L = 4.22675 cups (US)
    },
    {
      id: 'fluid_ounce_us',
      name: 'US Fluid Ounce',
      symbol: 'fl oz',
      conversionFactor: 33.814, // 1 L = 33.814 fl oz (US)
    },
  ],
};

// Area units with square meter as base unit
export const AREA_CATEGORY: UnitCategory = {
  id: UnitCategoryId.AREA,
  name: 'Area',
  description: 'Area measurements',
  baseUnit: 'square_meter',
  defaultUnit: 'square_meter',
  units: [
    {
      id: 'square_meter',
      name: 'Square Meter',
      symbol: 'm²',
      conversionFactor: 1,
      isBase: true,
    },
    {
      id: 'square_kilometer',
      name: 'Square Kilometer',
      symbol: 'km²',
      conversionFactor: 0.000001, // 1 m² = 0.000001 km²
    },
    {
      id: 'square_centimeter',
      name: 'Square Centimeter',
      symbol: 'cm²',
      conversionFactor: 10000, // 1 m² = 10,000 cm²
    },
    {
      id: 'square_millimeter',
      name: 'Square Millimeter',
      symbol: 'mm²',
      conversionFactor: 1000000, // 1 m² = 1,000,000 mm²
    },
    {
      id: 'square_foot',
      name: 'Square Foot',
      symbol: 'ft²',
      conversionFactor: 10.7639, // 1 m² = 10.7639 ft²
    },
    {
      id: 'square_inch',
      name: 'Square Inch',
      symbol: 'in²',
      conversionFactor: 1550, // 1 m² = 1,550 in²
    },
    {
      id: 'acre',
      name: 'Acre',
      symbol: 'ac',
      conversionFactor: 0.000247105, // 1 m² = 0.000247105 acres
    },
    {
      id: 'hectare',
      name: 'Hectare',
      symbol: 'ha',
      conversionFactor: 0.0001, // 1 m² = 0.0001 hectares
    },
  ],
};

// Percentage (special case - only one unit)
export const PERCENTAGE_CATEGORY: UnitCategory = {
  id: UnitCategoryId.PERCENTAGE,
  name: 'Percentage',
  description: 'Percentage values',
  baseUnit: 'percent',
  defaultUnit: 'percent',
  units: [
    {
      id: 'percent',
      name: 'Percent',
      symbol: '%',
      conversionFactor: 1,
      isBase: true,
      format: (value) => `${value}%`,
    },
  ],
};

// Count (special case - only one unit, for discrete counting)
export const COUNT_CATEGORY: UnitCategory = {
  id: UnitCategoryId.COUNT,
  name: 'Count',
  description: 'Discrete counting of items',
  baseUnit: 'count',
  defaultUnit: 'count',
  units: [
    {
      id: 'count',
      name: 'Count',
      symbol: '',
      conversionFactor: 1,
      isBase: true,
      format: (value) =>
        value % 1 === 0 ? value.toString() : value.toFixed(2),
    },
  ],
};

// Map of all categories by ID for easy lookup
export const UNIT_CATEGORIES: Record<string, UnitCategory> = {
  [UnitCategoryId.CURRENCY]: CURRENCY_CATEGORY,
  [UnitCategoryId.LENGTH]: LENGTH_CATEGORY,
  [UnitCategoryId.MASS]: MASS_CATEGORY,
  [UnitCategoryId.TEMPERATURE]: TEMPERATURE_CATEGORY,
  [UnitCategoryId.TIME]: TIME_CATEGORY,
  [UnitCategoryId.VOLUME]: VOLUME_CATEGORY,
  [UnitCategoryId.AREA]: AREA_CATEGORY,
  [UnitCategoryId.PERCENTAGE]: PERCENTAGE_CATEGORY,
  [UnitCategoryId.COUNT]: COUNT_CATEGORY,
};
