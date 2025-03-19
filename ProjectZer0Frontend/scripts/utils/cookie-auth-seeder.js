// scripts/utils/cookie-auth-seeder.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API Base URL - using your existing VITE_ prefixed variable
let API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Auth token - you'll need to provide this when running the script
let AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// The cookie name where your JWT is stored
// Common names: 'jwt', 'token', 'auth_token', 'access_token'
let COOKIE_NAME = 'jwt';

// Define our seed data
const statementSeeds = [
    // Strongly positive statements
    {
        text: "Human beings need access to clean water in order to survive.",
        keywords: ["water", "survival", "human rights"],
        expectedVotes: {
            positive: 125,
            negative: 3
        }
    },
    {
        text: "Education should be accessible to all children regardless of their economic background.",
        keywords: ["education", "equality", "children"],
        expectedVotes: {
            positive: 98,
            negative: 7
        }
    }
];

// Helper function to make authenticated API requests with cookies
async function fetchWithAuth(endpoint, options = {}) {
    if (!AUTH_TOKEN) {
        throw new Error('No auth token provided. Set AUTH_TOKEN environment variable or pass as argument.');
    }
    
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Set cookie header for authentication
    const headers = {
        'Content-Type': 'application/json',
        'Cookie': `${COOKIE_NAME}=${AUTH_TOKEN}`,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'http://localhost:5173',
        'Referer': 'http://localhost:5173/',
        ...options.headers
    };
    
    // Debug log - print request details
    console.log(`Making request to: ${url}`);
    console.log(`Method: ${options.method || 'GET'}`);
    console.log(`Headers: ${JSON.stringify(headers, null, 2)}`);
    if (options.body) {
        console.log(`Body: ${options.body.substring(0, 200)}${options.body.length > 200 ? '...' : ''}`);
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        const responseText = await response.text();
        console.log(`Response status: ${response.status}`);
        console.log(`Response body: ${responseText.substring(0, 500)}`);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${responseText}`);
        }
        
        // Parse the response as JSON if possible
        try {
            return JSON.parse(responseText);
        } catch (e) {
            return responseText;
        }
    } catch (error) {
        console.error(`Fetch error: ${error.message}`);
        throw error;
    }
}

// Function to create a statement - with cookie authentication
async function createStatement(seed) {
    try {
        // Make sure this matches the exact structure your API expects
        const payload = {
            statement: seed.text,
            userKeywords: seed.keywords,
            initialComment: "Automatically created for demo purposes.",
            publicCredit: true
        };
        
        const response = await fetchWithAuth('/nodes/statement', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        
        console.log(`Created statement: "${seed.text.substring(0, 30)}..."`);
        return response.id;
    } catch (error) {
        console.error(`Failed to create statement: ${error}`);
        throw error;
    }
}

// Function to add votes to a statement
async function addVotes(statementId, positiveCount, negativeCount) {
    // Add positive votes
    for (let i = 0; i < positiveCount; i++) {
        try {
            await fetchWithAuth(`/nodes/statement/${statementId}/vote`, {
                method: 'POST',
                body: JSON.stringify({ isPositive: true })
            });
            
            // Add a small delay to avoid overwhelming the server
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`Failed to add positive vote: ${error}`);
        }
    }
    
    // Add negative votes
    for (let i = 0; i < negativeCount; i++) {
        try {
            await fetchWithAuth(`/nodes/statement/${statementId}/vote`, {
                method: 'POST',
                body: JSON.stringify({ isPositive: false })
            });
            
            // Add a small delay to avoid overwhelming the server
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`Failed to add negative vote: ${error}`);
        }
    }
    
    console.log(`Added votes to statement: +${positiveCount}/-${negativeCount}`);
}

// Main execution function - start with just 1-2 statements
async function seedStatements() {
    console.log('Starting statement seeding process...');
    const createdIds = [];
    
    // Create just the first 2 statements as a test
    for (let i = 0; i < Math.min(2, statementSeeds.length); i++) {
        try {
            const id = await createStatement(statementSeeds[i]);
            createdIds.push(id);
            
            // Add a slight delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Failed to process statement: ${error}`);
        }
    }
    
    console.log('\nAll statements created. Adding votes...');
    
    // Only vote on successfully created statements
    for (let i = 0; i < createdIds.length; i++) {
        const seed = statementSeeds[i];
        const id = createdIds[i];
        
        try {
            await addVotes(id, seed.expectedVotes.positive, seed.expectedVotes.negative);
            
            // Add a slight delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Failed to add votes: ${error}`);
        }
    }
    
    console.log('\nSeeding process complete!');
    console.log('Created statements with IDs:');
    for (let i = 0; i < createdIds.length; i++) {
        console.log(`[${i}] ${statementSeeds[i].text.substring(0, 30)}... -> ${createdIds[i]}`);
    }
    
    return createdIds;
}

// CLI argument handling
function parseArgs() {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--token' && args[i+1]) {
            AUTH_TOKEN = args[i+1];
            i++;
        } else if (args[i] === '--api' && args[i+1]) {
            API_BASE_URL = args[i+1];
            i++;
        } else if (args[i] === '--cookie' && args[i+1]) {
            COOKIE_NAME = args[i+1];
            i++;
        }
    }
}

// Execute the script
async function main() {
    try {
        parseArgs();
        
        if (!AUTH_TOKEN) {
            console.error('Error: No authentication token provided.');
            console.error('Please provide a token using --token YOUR_TOKEN or set the AUTH_TOKEN environment variable.');
            process.exit(1);
        }
        
        // Print the token info for verification
        console.log('JWT Token Info:');
        const tokenParts = AUTH_TOKEN.split('.');
        if (tokenParts.length === 3) {
            try {
                const payload = JSON.parse(
                    Buffer.from(tokenParts[1], 'base64').toString()
                );
                console.log(`Subject: ${payload.sub}`);
                console.log(`Issued at: ${new Date(payload.iat * 1000).toISOString()}`);
                console.log(`Expires at: ${new Date(payload.exp * 1000).toISOString()}`);
                
                // Check if expired
                const now = Math.floor(Date.now() / 1000);
                if (now > payload.exp) {
                    console.error('WARNING: Token has expired!');
                    console.error('Please get a fresh token and try again.');
                    process.exit(1);
                }
                
                console.log(`Minutes until expiration: ${Math.floor((payload.exp - now) / 60)}`);
            } catch (e) {
                console.error('Error parsing token:', e);
            }
        }
        
        console.log(`Using API base URL: ${API_BASE_URL}`);
        console.log(`Using cookie name: ${COOKIE_NAME}`);
        
        // Try with multiple cookie names if the default doesn't work
        await seedStatements();
    } catch (error) {
        console.error('Error running seed script:', error);
        process.exit(1);
    }
}

main();