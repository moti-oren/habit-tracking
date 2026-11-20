// Runs vitest from a working directory with an uppercase drive letter.
//
// On Windows, VS Code can start the terminal in `c:\...` (lowercase drive). Vitest then loads its
// runtime from `c:\...` but the test files from `C:\...`, Node treats them as two different module
// URLs, and `describe` reaches a copy of the runner that was never set up:
// "TypeError: Cannot read properties of undefined (reading 'config')".
// The fix has to happen before vitest starts, so this script re-launches it from the normalized path.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, d => d.toUpperCase());
const cli = join(cwd, 'node_modules', 'vitest', 'vitest.mjs');

const { status } = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(status ?? 1);
