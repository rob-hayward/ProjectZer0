// src/lib/utils/neo4j-utils.ts
/**
 * Utility function to consistently parse Neo4j number values
 * This ensures all parts of the application handle Neo4j numbers the same way
 * 
 * @param value - Any value returned from Neo4j or elsewhere that should be converted to a number
 * @returns A valid number. Returns 0 for null, undefined, complex objects, and non-numeric strings 
 */
export function getNeo4jNumber(value: any): number {
    // Handle null/undefined values
    if (value === null || value === undefined) {
        return 0;
    }
    
    // Direct number values return as is
    if (typeof value === 'number') {
        return value;
    }
    
    if (typeof value === 'object') {
        // Neo4j integer objects with 'low' property
        if ('low' in value) {
            return Number(value.low);
        }
        
        // Objects with valueOf method (sometimes used by Neo4j)
        if ('valueOf' in value && typeof value.valueOf === 'function') {
            try {
                const num = Number(value.valueOf());
                return isNaN(num) ? 0 : num;
            } catch (e) {
                return 0; // Return 0 if valueOf fails
            }
        }
        
        // Return 0 for other objects - complex or unsupported formats
        return 0;
    }
    
    // Handle string values
    if (typeof value === 'string') {
        const parsed = Number(value);
        // Return the parsed number, or 0 for invalid strings
        return isNaN(parsed) ? 0 : parsed;
    }
    
    // Last resort, try to convert to number and handle NaN
    const num = Number(value || 0);
    return isNaN(num) ? 0 : num;
}