import * as fs from 'fs/promises';
import * as path from 'path';

interface ConversionConfig {
  sourcePath: string;
  outputPath: string;
  ignoreDirs?: string[];
}

async function convertSvelteToTsx(config: ConversionConfig) {
  const { sourcePath, outputPath, ignoreDirs = ['node_modules', '.svelte-kit'] } = config;

  async function processFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract script and template sections
    const scriptMatch = content.match(/<script.*?>([\s\S]*?)<\/script>/);
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>|(?<!<script.*?>[\s\S]*?)(?<!<style.*?>[\s\S]*?)([\s\S]+?)(?=<script|<style|$)/);
    
    let scriptContent = scriptMatch ? scriptMatch[1] : '';
    let templateContent = templateMatch ? (templateMatch[1] || templateMatch[2]).trim() : '';

    // Convert Svelte syntax to TSX
    templateContent = convertTemplate(templateContent);
    scriptContent = convertScript(scriptContent);

    // Get absolute path
    const absolutePath = path.resolve(filePath);

    // Combine into TSX format
    const tsxContent = `/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: ${absolutePath}
 * This conversion was created to share with Claude for development purposes.
 */

${scriptContent}

// Original Svelte Template:
/*
${templateContent}
*/

// Converted JSX:
export default function Component() {
  return (
    ${templateContent}
  );
}`;

    // Save to new location with .tsx extension
    const relativePath = path.relative(sourcePath, filePath);
    const tsxPath = path.join(outputPath, relativePath.replace('.svelte', '.tsx'));
    
    await fs.mkdir(path.dirname(tsxPath), { recursive: true });
    await fs.writeFile(tsxPath, tsxContent);
    
    console.log(`Converted ${filePath} -> ${tsxPath}`);
  }

  async function processDirectory(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          await processDirectory(fullPath);
        }
      } else if (entry.name.endsWith('.svelte')) {
        await processFile(fullPath);
      }
    }
  }

  function convertTemplate(template: string): string {
    // Basic Svelte -> JSX conversions
    return template
      // Convert on:click to onClick
      .replace(/on:([\w]+)=/g, (_, event) => `on${event.charAt(0).toUpperCase() + event.slice(1)}=`)
      // Convert class:name={condition} to className={condition ? "name" : ""}
      .replace(/class:([\w-]+)=\{([^}]+)\}/g, 'className={$2 ? "$1" : ""}')
      // Convert bind:value to value={} and onChange={}
      .replace(/bind:value=\{([^}]+)\}/g, 'value={$1} onChange={e => $1 = e.target.value}')
      // Convert {#if} to ternary expressions
      .replace(/{#if\s+([^}]+)}/g, '{$1 ? (')
      .replace(/{:else}/g, ') : (')
      .replace(/{\/if}/g, ')}')
      // Convert {#each} to map
      .replace(/{#each\s+([^}]+)}/g, '{$1.map((item, index) => (')
      .replace(/{\/each}/g, '))}');
  }

  function convertScript(script: string): string {
    // Basic script conversions
    return script
      // Convert $: reactive statements to useEffect
      .replace(/\$:\s*([^;]+);/g, 'useEffect(() => { $1; });')
      // Convert stores to useState
      .replace(/import\s*{\s*writable\s*}\s*from\s*['"]svelte\/store['"]/g, 'import { useState } from "react"')
      .replace(/const\s+(\w+)\s*=\s*writable\((.*?)\)/g, 'const [$1, set$1] = useState($2)');
  }

  // Create output directory if it doesn't exist
  await fs.mkdir(outputPath, { recursive: true });
  await processDirectory(sourcePath);
}

// Example usage:
// convertSvelteToTsx({
//   sourcePath: './src/routes',
//   outputPath: './tsx-converted',
//   ignoreDirs: ['node_modules', '.svelte-kit']
// });

export { convertSvelteToTsx };