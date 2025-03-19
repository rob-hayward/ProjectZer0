// scripts/utils/improved-seeder.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API Base URL - using your existing VITE_ prefixed variable
let API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Auth token - you'll need to provide this when running the script
let AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// The cookie name where your JWT is stored
let COOKIE_NAME = 'jwt';

// Define our seed data with explicit shared keywords to test connections
const statementSeeds = [
    // First batch - already created
    // {
    //     text: "Human beings need access to clean water in order to survive.",
    //     keywords: ["water", "survival", "human rights"],
    //     expectedVotes: {
    //         positive: 125,
    //         negative: 3
    //     }
    // },
    // {
    //     text: "Education should be accessible to all children regardless of their economic background.",
    //     keywords: ["education", "equality", "children"],
    //     expectedVotes: {
    //         positive: 98,
    //         negative: 7
    //     }
    // },
    
    // Second batch - with shared keywords
    {
        text: "Clean water access is a fundamental human right that governments must ensure.",
        keywords: ["water", "human rights", "government"],
        expectedVotes: {
            positive: 85,
            negative: 15
        }
    },
    {
        text: "Climate change threatens global water security and requires immediate action.",
        keywords: ["water", "climate", "environment"],
        expectedVotes: {
            positive: 75,
            negative: 25
        }
    },
    {
        text: "Universal education is essential for reducing inequality in society.",
        keywords: ["education", "equality", "society"],
        expectedVotes: {
            positive: 92,
            negative: 8
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

// Enhanced function to add votes to a statement with better debugging
async function addVotes(statementId, positiveCount, negativeCount) {
    console.log(`\n==== Adding votes to statement: ${statementId} ====`);
    console.log(`Target votes: +${positiveCount} / -${negativeCount}`);
    
    // Try to check current vote count first
    try {
        console.log(`Checking current vote status...`);
        const voteStatus = await fetchWithAuth(`/nodes/statement/${statementId}/vote`);
        console.log(`Current vote status: ${JSON.stringify(voteStatus)}`);
    } catch (error) {
        console.warn(`Could not get current vote status: ${error.message}`);
    }
    
    // Add positive votes with longer delays
    console.log(`\nAdding ${positiveCount} positive votes...`);
    for (let i = 0; i < positiveCount; i++) {
        try {
            // Adding progress info
            if (i % 10 === 0 || i === positiveCount - 1) {
                console.log(`Adding positive vote ${i+1}/${positiveCount}...`);
            }
            
            // Try different formats if needed
            const result = await fetchWithAuth(`/nodes/statement/${statementId}/vote`, {
                method: 'POST',
                body: JSON.stringify({ isPositive: true })
            });
            
            // Wait longer between requests (500ms)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Only show detailed output for first and last votes
            if (i === 0 || i === positiveCount - 1) {
                console.log(`Vote result: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            console.error(`Failed to add positive vote #${i+1}: ${error.message}`);
            // Break on first error to avoid flooding
            if (i < 5) {
                console.log("Continuing with fewer votes...");
            } else {
                console.log("Too many vote errors, skipping remaining positive votes.");
                break;
            }
        }
    }
    
    // Add negative votes
    console.log(`\nAdding ${negativeCount} negative votes...`);
    for (let i = 0; i < negativeCount; i++) {
        try {
            // Adding progress info
            if (i % 10 === 0 || i === negativeCount - 1) {
                console.log(`Adding negative vote ${i+1}/${negativeCount}...`);
            }
            
            const result = await fetchWithAuth(`/nodes/statement/${statementId}/vote`, {
                method: 'POST',
                body: JSON.stringify({ isPositive: false })
            });
            
            // Wait longer between requests (500ms)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Only show detailed output for first and last votes
            if (i === 0 || i === negativeCount - 1) {
                console.log(`Vote result: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            console.error(`Failed to add negative vote #${i+1}: ${error.message}`);
            // Break on first error to avoid flooding
            if (i < 5) {
                console.log("Continuing with fewer votes...");
            } else {
                console.log("Too many vote errors, skipping remaining negative votes.");
                break;
            }
        }
    }
    
    // Check final vote counts
    try {
        console.log(`\nVerifying final vote status...`);
        const finalStatus = await fetchWithAuth(`/nodes/statement/${statementId}/vote`);
        console.log(`Final vote status: ${JSON.stringify(finalStatus)}`);
    } catch (error) {
        console.warn(`Could not get final vote status: ${error.message}`);
    }
}

// Main execution function - focus on shared keywords to test connections
async function seedStatements() {
    console.log('Starting statement seeding process...');
    const createdIds = [];
    
    // Create statements
    for (let i = 0; i < statementSeeds.length; i++) {
        try {
            console.log(`\n==== Creating statement ${i+1}/${statementSeeds.length} ====`);
            const id = await createStatement(statementSeeds[i]);
            createdIds.push(id);
            
            // Add a slight delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
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
            
            // Add a longer delay between statement votes
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`Failed to add votes to statement ${id}: ${error}`);
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
        
        await seedStatements();
    } catch (error) {
        console.error('Error running seed script:', error);
        process.exit(1);
    }
}

main();