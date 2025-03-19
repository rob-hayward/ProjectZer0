// scripts/utils/statement-seeder.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { register } from 'ts-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup ts-node for TypeScript support
register({
  project: '../../tsconfig-scripts.json'
});

// Import and run the TypeScript module
const require = createRequire(import.meta.url);
require('./statement-seeder.ts');