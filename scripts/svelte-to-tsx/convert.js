"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/svelte-to-tsx/convert.ts
const svelte_to_tsx_converter_1 = require("./svelte-to-tsx-converter");
const CONFIG = {
    sourcePath: './ProjectZer0Frontend/src',
    outputPath: './ProjectZer0Frontend/tsx-converted',
    ignoreDirs: ['node_modules', '.svelte-kit', 'build', 'dist']
};
(0, svelte_to_tsx_converter_1.convertSvelteToTsx)(CONFIG).catch(console.error);
// To compile and run this script:
// npx tsc scripts/svelte-to-tsx/*.ts --module commonjs --target es2020
// node scripts/svelte-to-tsx/convert.ts
