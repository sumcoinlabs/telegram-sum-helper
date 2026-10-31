// One version source of truth for logs, commands and release checks.
import {readFileSync} from 'node:fs';
export const VERSION=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
