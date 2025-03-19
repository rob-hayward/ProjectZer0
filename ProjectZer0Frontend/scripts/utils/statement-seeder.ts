// scripts/utils/statement-seeder.ts
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API Base URL - using your existing VITE_ prefixed variable
let API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Auth token - you'll need to provide this when running the script
let AUTH_TOKEN = process.env.AUTH_TOKEN || '';

interface StatementSeed {
    text: string;
    keywords: string[];
    expectedVotes: {
        positive: number;
        negative: number;
    };
    relatedIds?: number[]; // Optional direct relationships (indices of statements to relate to)
}

// Define our seed data
const statementSeeds: StatementSeed[] = [
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
    },
    
    // Moderately positive statements
    {
        text: "Renewable energy sources should be prioritized over fossil fuels to combat climate change.",
        keywords: ["energy", "climate", "environment"],
        expectedVotes: {
            positive: 75,
            negative: 25
        }
    },
    
    // Neutral statements
    {
        text: "Economic growth and environmental protection can sometimes be in conflict.",
        keywords: ["economy", "environment", "growth"],
        expectedVotes: {
            positive: 50,
            negative: 50
        }
    },
    
    // Moderately negative statements
    {
        text: "Increasing the minimum wage always leads to higher unemployment.",
        keywords: ["economy", "wages", "employment"],
        expectedVotes: {
            positive: 30,
            negative: 70
        }
    },
    
    // Strongly negative statements
    {
        text: "The government should never regulate any industries under any circumstances.",
        keywords: ["government", "regulation", "market"],
        expectedVotes: {
            positive: 10,
            negative: 90
        }
    },

    // More specific examples with deliberate keyword overlaps
    {
        text: "Market economies distribute resources more efficiently than centrally planned economies.",
        keywords: ["market", "economy", "efficiency"],
        expectedVotes: {
            positive: 65,
            negative: 35
        },
        relatedIds: [5] // Related to the government regulation statement
    },
    {
        text: "Free markets lead to the most innovation and technological progress.",
        keywords: ["market", "innovation", "technology"],
        expectedVotes: {
            positive: 70,
            negative: 30
        },
        relatedIds: [6] // Related to the market economies statement
    },
    
    // Health/water topics (connecting to first statement)
    {
        text: "Public health initiatives should prioritize access to clean water in developing regions.",
        keywords: ["water", "health", "development"],
        expectedVotes: {
            positive: 85,
            negative: 15
        },
        relatedIds: [0] // Related to the clean water statement
    },
    
    // No shared keywords example
    {
        text: "Chess is the most intellectually demanding board game ever created.",
        keywords: ["chess", "games", "intelligence"],
        expectedVotes: {
            positive: 45,
            negative: 55
        }
    },
    
    // Additional statements with tweet-length constraints and varying keyword overlaps
    {
        text: "Universal basic income could help reduce poverty and provide economic security in an increasingly automated world.",
        keywords: ["economy", "poverty", "automation"],
        expectedVotes: {
            positive: 60,
            negative: 40
        },
        relatedIds: [4] // Related to minimum wage statement
    },
    {
        text: "Healthcare should be viewed as a human right, not a privilege limited by one's economic circumstances.",
        keywords: ["healthcare", "human rights", "economy"],
        expectedVotes: {
            positive: 80,
            negative: 20
        },
        relatedIds: [0, 1] // Related to water and education statements
    },
    {
        text: "Technological innovation alone cannot solve climate change without significant policy changes and individual behavior modifications.",
        keywords: ["technology", "climate", "policy"],
        expectedVotes: {
            positive: 72,
            negative: 28
        },
        relatedIds: [2] // Related to renewable energy statement
    },
    {
        text: "Social media platforms should be regulated like other media companies to combat misinformation and protect user privacy.",
        keywords: ["regulation", "technology", "media"],
        expectedVotes: {
            positive: 65,
            negative: 35
        },
        relatedIds: [5, 7] // Related to regulation and technology statements
    },
    {
        text: "Cryptocurrency represents the future of finance and will eventually replace traditional banking systems.",
        keywords: ["economy", "technology", "finance"],
        expectedVotes: {
            positive: 40,
            negative: 60
        },
        relatedIds: [7] // Related to innovation statement
    }
];

// Helper function to make authenticated API requests
async function fetchWithAuth(endpoint: string, options: any = {}) {
    if (!AUTH_TOKEN) {
        throw new Error('No auth token provided. Set AUTH_TOKEN environment variable or pass as argument.');
    }
    
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...options.headers
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
    }
    
    return response.json();
}

// Function to create a statement
async function createStatement(seed: StatementSeed): Promise<string> {
    try {
        const response = await fetchWithAuth('/nodes/statement', {
            method: 'POST',
            body: JSON.stringify({
                statement: seed.text,
                userKeywords: seed.keywords,
                initialComment: "Automatically created for demo purposes.",
                publicCredit: true
            })
        });
        
        console.log(`Created statement: "${seed.text.substring(0, 30)}..."`);
        return response.id;
    } catch (error) {
        console.error(`Failed to create statement: ${error}`);
        throw error;
    }
}

// Function to add votes to a statement
async function addVotes(statementId: string, positiveCount: number, negativeCount: number) {
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

// Function to create explicit relationships between statements
async function createDirectRelationship(sourceId: string, targetId: string) {
    try {
        await fetchWithAuth(`/nodes/statement/${sourceId}/relate/${targetId}`, {
            method: 'POST'
        });
        console.log(`Created direct relationship between ${sourceId} and ${targetId}`);
    } catch (error) {
        console.error(`Failed to create relationship: ${error}`);
    }
}

// Main execution function
async function seedStatements() {
    console.log('Starting statement seeding process...');
    const createdIds: string[] = [];
    
    // Create all statements
    for (const seed of statementSeeds) {
        try {
            const id = await createStatement(seed);
            createdIds.push(id);
            
            // Add a slight delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Failed to process statement: ${error}`);
        }
    }
    
    console.log('\nAll statements created. Adding votes...');
    
    // Add votes to each statement
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
    
    console.log('\nAll votes added. Creating direct relationships...');
    
    // Create relationships based on the relatedIds in the seed data
    for (let i = 0; i < statementSeeds.length; i++) {
        const relatedIds = statementSeeds[i].relatedIds;
        if (relatedIds && relatedIds.length > 0) {
            for (const targetIndex of relatedIds) {
                if (targetIndex < createdIds.length) {
                    await createDirectRelationship(createdIds[i], createdIds[targetIndex]);
                    // Add a slight delay
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
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
        
        console.log(`Using API base URL: ${API_BASE_URL}`);
        await seedStatements();
    } catch (error) {
        console.error('Error running seed script:', error);
        process.exit(1);
    }
}

main();