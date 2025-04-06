// src/lib/utils/neo4j-utils.ts
/**
 * Utility function to consistently parse Neo4j number values
 * This ensures all parts of the application handle Neo4j numbers the same way
 */
export function getNeo4jNumber(value: any): number {
    if (value === null || value === undefined) {
        // Handle null/undefined values
        return 0;
    }
    
    if (typeof value === 'number') {
        // Direct number value
        return value;
    }
    
    if (typeof value === 'object') {
        // Check for Neo4j integer object with 'low' property
        if ('low' in value) {
            return Number(value.low);
        }
        
        // Check for Neo4j value with valueOf method
        if ('valueOf' in value && typeof value.valueOf === 'function') {
            return Number(value.valueOf());
        }
    }
    
    // Last resort, try to convert to number
    return Number(value || 0);
}