// scripts/utils/batch-statement-creator.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// API Base URL - using your existing VITE_ prefixed variable
let API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
let AUTH_TOKEN = '';
let COOKIE_NAME = 'jwt';

// Define our statements with rich keyword interconnections and diverse vote patterns
const statementSeeds = [
    // Technology & Society Topics - Varied Vote Distributions
    {
        text: "Big tech companies should be broken up to promote competition and protect consumers.",
        keywords: ["technology", "regulation", "competition", "consumer rights"],
        targetVotes: { positive: 72, negative: 58 }  // Slightly positive
    },
    {
        text: "Internet access should be regulated as a public utility with price controls.",
        keywords: ["technology", "internet", "regulation", "public services"],
        targetVotes: { positive: 48, negative: 62 }  // Slightly negative
    },
    {
        text: "Social media has done more harm than good for society and mental health.",
        keywords: ["technology", "social media", "mental health", "society"],
        targetVotes: { positive: 60, negative: 55 }  // Nearly neutral
    },
    {
        text: "Facial recognition technology should be banned in all public spaces.",
        keywords: ["technology", "privacy", "surveillance", "regulation"],
        targetVotes: { positive: 65, negative: 45 }  // Moderately positive
    },
    
    // Economic Debate Topics - More Negative Net Values
    {
        text: "The wealth tax is the most effective way to address economic inequality.",
        keywords: ["economy", "taxation", "wealth", "inequality"],
        targetVotes: { positive: 40, negative: 70 }  // Notably negative
    },
    {
        text: "Capitalism is fundamentally incompatible with environmental sustainability.",
        keywords: ["economy", "capitalism", "environment", "sustainability"],
        targetVotes: { positive: 35, negative: 85 }  // Strongly negative
    },
    {
        text: "Universal basic income would lead to widespread economic stagnation.",
        keywords: ["economy", "basic income", "policy", "employment"],
        targetVotes: { positive: 30, negative: 80 }  // Strongly negative
    },
    {
        text: "Economic growth should be prioritized over environmental concerns.",
        keywords: ["economy", "growth", "environment", "priorities"],
        targetVotes: { positive: 25, negative: 95 }  // Very negative
    },
    
    // Political & Governance Topics - Mixed Vote Patterns
    {
        text: "Direct democracy should replace representative democracy for most decisions.",
        keywords: ["government", "democracy", "policy", "representation"],
        targetVotes: { positive: 45, negative: 75 }  // Moderately negative
    },
    {
        text: "Term limits should be implemented for all elected officials.",
        keywords: ["government", "elections", "policy", "reform"],
        targetVotes: { positive: 95, negative: 15 }  // Strongly positive
    },
    {
        text: "Open borders would strengthen economies and reduce global inequality.",
        keywords: ["government", "immigration", "economy", "equality"],
        targetVotes: { positive: 35, negative: 85 }  // Strongly negative
    },
    {
        text: "Government surveillance is justified to prevent terrorism and crime.",
        keywords: ["government", "surveillance", "security", "privacy"],
        targetVotes: { positive: 25, negative: 85 }  // Strongly negative
    },
    
    // Environmental Controversies - Mixed Vote Patterns
    {
        text: "Nuclear energy is essential for addressing climate change effectively.",
        keywords: ["environment", "energy", "climate", "technology"],
        targetVotes: { positive: 55, negative: 65 }  // Slightly negative
    },
    {
        text: "GMO foods are necessary to ensure global food security.",
        keywords: ["environment", "agriculture", "technology", "food"],
        targetVotes: { positive: 60, negative: 60 }  // Perfectly neutral
    },
    {
        text: "Individual carbon footprint reduction is meaningless without system change.",
        keywords: ["environment", "climate", "sustainability", "policy"],
        targetVotes: { positive: 90, negative: 20 }  // Strongly positive
    },
    {
        text: "Geoengineering should be pursued as a solution to climate change.",
        keywords: ["environment", "technology", "climate", "policy"],
        targetVotes: { positive: 35, negative: 75 }  // Notably negative
    }
];

// Helper function to make authenticated API requests with cookies
async function fetchWithAuth(endpoint, options = {}) {
    if (!AUTH_TOKEN) {
        throw new Error('No auth token provided.');
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
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        const responseText = await response.text();
        
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
            initialComment: "Automatically created for statement network demo.",
            publicCredit: true
        };
        
        const response = await fetchWithAuth('/nodes/statement', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        
        console.log(`Created statement: "${seed.text.substring(0, 30)}..." (ID: ${response.id})`);
        return { 
            id: response.id, 
            text: seed.text,
            keywords: seed.keywords,
            targetVotes: seed.targetVotes
        };
    } catch (error) {
        console.error(`Failed to create statement: ${error}`);
        throw error;
    }
}

// Main execution function
async function seedStatements() {
    console.log('Starting batch statement creation process...');
    const createdStatements = [];
    
    // Create statements
    for (let i = 0; i < statementSeeds.length; i++) {
        try {
            console.log(`\n==== Creating statement ${i+1}/${statementSeeds.length} ====`);
            const result = await createStatement(statementSeeds[i]);
            createdStatements.push(result);
            
            // Add a delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
            console.error(`Failed to process statement: ${error}`);
        }
    }
    
    console.log('\nBatch statement creation complete!');
    console.log('Created statements:');
    
    // Print in format suitable for Neo4j queries
    console.log('\n==== Statement IDs and Vote Targets ====');
    console.log('For use in Neo4j Aura:');
    console.log('```cypher');
    
    for (const statement of createdStatements) {
        console.log(`// "${statement.text.substring(0, 50)}..."`)
        console.log(`MATCH (s:Statement {id: "${statement.id}"})`)
        console.log(`SET s.positiveVotes = ${statement.targetVotes.positive}, s.negativeVotes = ${statement.targetVotes.negative};`)
        console.log();
    }
    
    console.log('```');
    
    // Print keyword information for reference
    console.log('\n==== Keyword Connections ====');
    for (const statement of createdStatements) {
        console.log(`Statement: "${statement.text.substring(0, 50)}..."`);
        console.log(`ID: ${statement.id}`);
        console.log(`Keywords: ${statement.keywords.join(', ')}`);
        console.log();
    }
    
    return createdStatements;
}

// Parse arguments
function parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--token' && args[i+1]) {
            AUTH_TOKEN = args[i+1];
            i++;
        } else if (args[i] === '--cookie' && args[i+1]) {
            COOKIE_NAME = args[i+1];
            i++;
        } else if (args[i] === '--api' && args[i+1]) {
            API_BASE_URL = args[i+1];
            i++;
        }
    }
}

// Main function
async function main() {
    parseArgs();
    
    if (!AUTH_TOKEN) {
        console.error('No auth token provided. Use --token "your_token_here"');
        process.exit(1);
    }
    
    console.log(`Using API: ${API_BASE_URL}`);
    console.log(`Using cookie: ${COOKIE_NAME}`);
    
    await seedStatements();
}

main().catch(console.error);