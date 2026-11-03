import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OPENAPI_PATH } from '../../src/config/openapi';

interface Media {
  schema?: object;
}
interface ResponseObj {
  $ref?: string;
  content?: Record<string, Media>;
}
interface Operation {
  responses?: Record<string, ResponseObj>;
}
interface Spec {
  paths: Record<string, Record<string, Operation>>;
  components: { responses?: Record<string, ResponseObj>; schemas?: Record<string, object> };
}

let spec: Spec | undefined;
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const cache = new Map<string, ValidateFunction>();

/**
 * Parsed (not dereferenced) spec: recursive schemas such as CategoryNode would make a fully
 * dereferenced graph circular, so $refs are left in place and resolved by Ajv via `components`.
 */
export async function getSpec(): Promise<Spec> {
  if (!spec) spec = (await SwaggerParser.parse(OPENAPI_PATH)) as unknown as Spec;
  return spec;
}

const templateToRegex = (tpl: string): RegExp => new RegExp(`^${tpl.replace(/\{[^}]+\}/g, '[^/]+')}$`);

function resolveResponse(s: Spec, resp: ResponseObj): ResponseObj {
  if (!resp.$ref) return resp;
  const name = resp.$ref.split('/').pop()!;
  return s.components.responses?.[name] ?? resp;
}

/**
 * Asserts the status code is documented for the operation and that the JSON body satisfies the
 * documented response schema. Returns a list of problems (empty = compliant).
 */
export async function checkContract(
  method: string,
  urlPath: string,
  status: number,
  body: unknown,
): Promise<string[]> {
  const s = await getSpec();
  const pathOnly = urlPath.split('?')[0];
  const tpl = Object.keys(s.paths).find((p) => templateToRegex(p).test(pathOnly));
  if (!tpl) return [`${method} ${pathOnly}: path is not in the OpenAPI spec`];
  const op = s.paths[tpl][method.toLowerCase()];
  if (!op) return [`${method} ${tpl}: method is not in the OpenAPI spec`];
  const raw = op.responses?.[String(status)];
  if (!raw) return [`${method} ${tpl}: status ${status} is not documented`];
  const media = resolveResponse(s, raw).content;
  const schema = media && Object.values(media)[0]?.schema;
  if (!schema) return []; // e.g. 204
  const key = `${method} ${tpl} ${status}`;
  let validate = cache.get(key);
  if (!validate) {
    // Wrapping with `components` lets "#/components/schemas/X" refs resolve against the root.
    validate = ajv.compile({ ...schema, components: s.components });
    cache.set(key, validate);
  }
  return validate(body) ? [] : [`${key}: ${ajv.errorsText(validate.errors)}`];
}
