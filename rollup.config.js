import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import metablock from 'rollup-plugin-userscript-metablock';
import pkg from './package.json'; // assert { type: 'json' };
import fs from 'fs';

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

fs.mkdir('dist/', { recursive: true }, () => null);

export default {
    input: 'src/app.js',
    output: {
        file: 'dist/bundle.js',
        format: 'iife', // immediately-invoked function expression — suitable for <script> tags
        sourcemap: true,
    },
    plugins: [
        resolve({ browser: true }), // tells Rollup how to find jquery in node_modules
        commonjs(), // converts jquery to ES modules
        production && terser(), // minify, but only in production
        metablock({
            file: './meta.json',
            override: {
                name: pkg.name,
                version: pkg.version,
                description: pkg.description,
                homepage: pkg.homepage,
                author: pkg.author,
                license: pkg.license,
            },
        }),
    ],
};
