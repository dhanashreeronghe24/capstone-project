import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

/** Walks up from this file until docs/openapi/openapi.yaml is found (works for ts-node and compiled dist/). */
function findOpenApiPath(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, 'docs', 'openapi', 'openapi.yaml');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error('docs/openapi/openapi.yaml not found');
}

export const OPENAPI_PATH = findOpenApiPath();

export function loadOpenApiDocument(): Record<string, unknown> {
  return YAML.parse(fs.readFileSync(OPENAPI_PATH, 'utf8')) as Record<string, unknown>;
}
