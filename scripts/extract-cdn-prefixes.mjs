// Regenerates build/cdn-autoprefixer-prefixes.json: the autoprefixer prefix table the Tailwind Play
// CDN 3.4.17 shipped with (precompiled for its target browsers, mid-2023 data). The build prefixes
// Tailwind's output with this table, so vendor prefixes are exactly what the original page got.
//
// Usage: node scripts/extract-cdn-prefixes.mjs [path-to-downloaded-cdn.js]
// Without a path the script downloads https://cdn.tailwindcss.com/3.4.17. Nothing from the file is
// executed: the table (an object literal) is parsed with espree and converted to JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';
import * as prettier from 'prettier';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build/cdn-autoprefixer-prefixes.json');
const CDN_URL = 'https://cdn.tailwindcss.com/3.4.17';

const source = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : await (await fetch(CDN_URL)).text();

// The table is the object literal exported by the module that starts with {"backdrop-filter":{feature:…
const start = source.indexOf('exports={"backdrop-filter":{feature:"css-backdrop-filter"');
if (start === -1) throw new Error('prefix table not found in the CDN script');
const literalStart = source.indexOf('{', start);
let depth = 0;
let end = literalStart;
for (; end < source.length; end++) {
    const c = source[end];
    if (c === '"') {
        end = source.indexOf('"', end + 1); // no escaped quotes inside this data
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
}
const literal = source.slice(literalStart, end + 1);

function toValue(node) {
    switch (node.type) {
        case 'ObjectExpression':
            return Object.fromEntries(
                node.properties.map(p => [p.key.type === 'Identifier' ? p.key.name : p.key.value, toValue(p.value)])
            );
        case 'ArrayExpression':
            return node.elements.map(toValue);
        case 'Literal':
            return node.value;
        case 'UnaryExpression':
            if (node.operator === '!' && node.argument.type === 'Literal') return !node.argument.value;
            break;
    }
    throw new Error(`unexpected ${node.type} in the prefix table`);
}

const ast = espree.parse(`(${literal})`, { ecmaVersion: 'latest' });
const table = toValue(ast.body[0].expression);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const json = await prettier.format(JSON.stringify(table), { ...(await prettier.resolveConfig(OUT)), filepath: OUT });
fs.writeFileSync(OUT, json);
const browsers = [...new Set(Object.values(table).flatMap(e => e.browsers || []))].sort();
console.log(`${Object.keys(table).length} features, browsers: ${browsers.join(', ')}`);
