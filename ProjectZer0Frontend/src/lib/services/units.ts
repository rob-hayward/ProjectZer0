// src/lib/services/units.ts
import { fetchWithAuth } from './api';

// Cache for unit categories and units to reduce API calls
const categoryCache = new Map();
const unitCache = new Map();
const unitsByCategoryCache = new Map();
const conversionCache = new Map();
const failedEndpoints = new Set();

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  conversionFactor: number; // Factor relative to base unit
  isBase?: boolean;
}

export interface UnitCategory {
  id: string;
  name: string;
  description: string;
  baseUnit: string; // Reference to the base unit ID in this category
  defaultUnit: string;
  units: Unit[];
}

/**
 * Get all unit categories
 */
export async function getUnitCategories(): Promise<UnitCategory[]> {
  try {
    // Return from cache if available
    if (categoryCache.size > 0) {
      return Array.from(categoryCache.values());
    }
    
    const categories = await fetchWithAuth('/units/categories');
    
    // Cache each category
    if (Array.isArray(categories)) {
      categories.forEach(category => {
        categoryCache.set(category.id, category);
      });
    }
    
    return categories;
  } catch (error) {
    console.error('Error fetching unit categories:', error);
    throw error;
  }
}

/**
 * Get a specific unit category
 */
export async function getUnitCategory(categoryId: string): Promise<UnitCategory | null> {
  try {
    // Return from cache if available
    if (categoryCache.has(categoryId)) {
      return categoryCache.get(categoryId);
    }
    
    const category = await fetchWithAuth(`/units/categories/${categoryId}`);
    
    // Cache the category
    if (category) {
      categoryCache.set(category.id, category);
      
      // Also cache all units in this category for easy access
      if (Array.isArray(category.units)) {
        category.units.forEach((unit: Unit) => {
          unitCache.set(unit.id, unit);
        });
      }
    }
    
    return category;
  } catch (error) {
    console.error(`Error fetching unit category ${categoryId}:`, error);
    return null;
  }
}

/**
 * Get all units for a category
 */
export async function getUnitsForCategory(categoryId: string): Promise<Unit[]> {
  try {
    // Return from cache if available
    if (unitsByCategoryCache.has(categoryId)) {
      return unitsByCategoryCache.get(categoryId);
    }
    
    const units = await fetchWithAuth(`/units/categories/${categoryId}/units`);
    
    // Cache units
    if (Array.isArray(units)) {
      unitsByCategoryCache.set(categoryId, units);
      
      // Also cache individual units
      units.forEach(unit => {
        unitCache.set(unit.id, unit);
      });
    }
    
    return units;
  } catch (error) {
    console.error(`Error fetching units for category ${categoryId}:`, error);
    return [];
  }
}

/**
 * Get a specific unit
 */
export async function getUnit(unitId: string): Promise<Unit | null> {
  try {
    // Return from cache if available
    if (unitCache.has(unitId)) {
      return unitCache.get(unitId);
    }
    
    // Try to find in any cached category
    for (const category of categoryCache.values()) {
      const unit = category.units.find((u: Unit) => u.id === unitId);
      if (unit) {
        unitCache.set(unitId, unit);
        return unit;
      }
    }
    
    // As a last resort, fetch from API
    const unit = await fetchWithAuth(`/units/${unitId}`);
    
    // Cache the unit
    if (unit) {
      unitCache.set(unitId, unit);
    }
    
    return unit;
  } catch (error) {
    console.error(`Error fetching unit ${unitId}:`, error);
    return null;
  }
}

/**
 * Convert a value from one unit to another within the same category
 */
export async function convertValue(
  value: number,
  fromUnitId: string,
  toUnitId: string,
  categoryId?: string
): Promise<number> {
  try {
    // If same unit, return value as is
    if (fromUnitId === toUnitId) {
      return value;
    }
    
    // Check if we've already computed this conversion
    const cacheKey = `${value}_${fromUnitId}_${toUnitId}_${categoryId || ''}`;
    if (conversionCache.has(cacheKey)) {
      return conversionCache.get(cacheKey);
    }
    
    // Generate API endpoint key to track failed endpoints
    const endpointKey = `/units/convert_${categoryId}`;
    
    // Try direct API conversion first if categoryId is provided and endpoint hasn't failed
    if (categoryId && !failedEndpoints.has(endpointKey)) {
      try {
        const response = await fetchWithAuth('/units/convert', {
          method: 'POST',
          body: JSON.stringify({
            categoryId,
            value,
            fromUnitId,
            toUnitId
          })
        });
        
        if (response && typeof response.convertedValue === 'number') {
          // Cache the conversion result
          conversionCache.set(cacheKey, response.convertedValue);
          return response.convertedValue;
        }
      } catch (error) {
        console.warn('Direct unit conversion API failed, falling back to client-side conversion:', error);
        // Mark this endpoint as failed to avoid retrying too many times
        failedEndpoints.add(endpointKey);
      }
    }
    
    // Client-side conversion - get units from cache or fetch them
    let category: UnitCategory | null = null;
    
    if (categoryId) {
      category = await getUnitCategory(categoryId);
    } else {
      // Try to find a category that contains both units
      const categories = await getUnitCategories();
      category = categories.find(cat => 
        cat.units.some(u => u.id === fromUnitId) && 
        cat.units.some(u => u.id === toUnitId)
      ) || null;
    }
    
    if (!category) {
      console.error('Could not find category for unit conversion');
      return value; // Return original value
    }
    
    // Get the units
    const fromUnit = category.units.find((u: Unit) => u.id === fromUnitId);
    const toUnit = category.units.find((u: Unit) => u.id === toUnitId);
    
    if (!fromUnit || !toUnit) {
      console.error('Could not find units for conversion:', { fromUnitId, toUnitId });
      return value; // Return original value
    }
    
    // Get the base unit of the category
    const baseUnit = category.units.find((u: Unit) => u.id === category.baseUnit);
    if (!baseUnit) {
      console.error('Could not find base unit for category:', category.id);
      return value;
    }
    
    // FIXED CONVERSION LOGIC:
    let convertedValue: number;
    
    // If from unit is the base unit
    if (fromUnit.isBase || fromUnit.id === category.baseUnit) {
      // Direct conversion from base to target
      // If conversion factor means 1 base unit = X target units
      convertedValue = value * toUnit.conversionFactor;
    }
    // If to unit is the base unit
    else if (toUnit.isBase || toUnit.id === category.baseUnit) {
      // Direct conversion from source to base
      // If conversion factor means 1 base unit = X source units
      convertedValue = value / fromUnit.conversionFactor;
    }
    // Both are non-base units
    else {
      // Two-step conversion through base unit
      // First convert to base unit
      const valueInBaseUnit = value / fromUnit.conversionFactor;
      // Then convert from base to target
      convertedValue = valueInBaseUnit * toUnit.conversionFactor;
    }
    
    // Log the conversion for debugging
    console.debug(`Converted ${value} ${fromUnit.symbol} to ${convertedValue.toFixed(6)} ${toUnit.symbol} using conversion factors: ${fromUnit.id}=${fromUnit.conversionFactor}, ${toUnit.id}=${toUnit.conversionFactor}`);
    
    // Cache the conversion result
    conversionCache.set(cacheKey, convertedValue);
    
    return convertedValue;
  } catch (error) {
    console.error(`Error converting ${value} from ${fromUnitId} to ${toUnitId}:`, error);
    return value; // Return original value in case of error
  }
}

/**
 * Get unit name and symbol
 */
export async function getUnitDisplay(unitId: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const unit = await getUnit(unitId);
    if (!unit) return null;
    
    return {
      name: unit.name,
      symbol: unit.symbol
    };
  } catch (error) {
    console.error(`Error getting unit display for ${unitId}:`, error);
    return null;
  }
}

/**
 * Format a value with its unit symbol
 */
export function formatValueWithUnit(value: number, unitSymbol: string): string {
  // Format the number appropriately
  let formattedValue;
  if (Math.abs(value) < 0.01) {
    formattedValue = value.toExponential(2);
  } else if (Number.isInteger(value)) {
    formattedValue = value.toString();
  } else {
    formattedValue = value.toFixed(2);
  }
  
  return `${formattedValue} ${unitSymbol}`;
}

/**
 * Clear all caches
 */
export function clearCache(): void {
  categoryCache.clear();
  unitCache.clear();
  unitsByCategoryCache.clear();
  conversionCache.clear();
  failedEndpoints.clear();
}