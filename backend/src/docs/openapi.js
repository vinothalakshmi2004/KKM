import { zodToJsonSchema } from 'zod-to-json-schema';
import { requireAuth } from '../middlewares/auth.js';
import { parseMultipartData } from '../middlewares/validate.js';
import { EXAMPLES, FILE_FIELDS, FILE_RESPONSES, OPERATIONS, TAGS } from './meta.js';

/**
 * OpenAPI 3 spec built from the live Express routes: every route, its path / query / body
 * validation (zod → JSON schema) and whether it needs a login. Titles and examples come from
 * meta.js. Because it reads the real routes, a new endpoint shows up in the docs by itself.
 */

const toJsonSchema = (schema) => {
  const json = zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
    effectStrategy: 'input',
    pipeStrategy: 'input',
    dateStrategy: 'format:date-time',
  });
  delete json.$schema;
  return json;
};

/** "/bookings" from the regexp Express 4 keeps for router.use('/bookings', …) */
function mountPath(layer) {
  if (layer.regexp?.fast_slash) return '';
  return layer.regexp.source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
}

/** Every route of a router (recursively) with its full path, methods and middleware. */
function collectRoutes(router, prefix = '', locked = false, out = []) {
  let afterAuth = locked;
  for (const layer of router.stack) {
    if (layer.route) {
      const handles = layer.route.stack.map((l) => l.handle);
      for (const method of Object.keys(layer.route.methods).filter((m) => m !== '_all')) {
        out.push({
          method,
          path: `${prefix}${layer.route.path === '/' ? '' : layer.route.path}` || '/',
          handles,
          secure: afterAuth || handles.includes(requireAuth),
        });
      }
    } else if (layer.handle === requireAuth) {
      afterAuth = true; // router.use(requireAuth): everything below needs a login
    } else if (layer.handle?.stack) {
      collectRoutes(layer.handle, prefix + mountPath(layer), afterAuth, out);
    }
  }
  return out;
}

const isPrimitive = (s) => s && ['string', 'number', 'integer', 'boolean'].includes(s.type) || s?.enum || s?.anyOf?.every(isPrimitive);

function parametersFrom(schema, where) {
  if (!schema) return [];
  const json = toJsonSchema(schema);
  const required = new Set(json.required || []);
  return Object.entries(json.properties || {}).map(([name, s]) => ({
    name,
    in: where,
    required: where === 'path' || required.has(name),
    schema: s,
    ...(s.description ? { description: s.description } : {}),
  }));
}

function requestBody(key, bodySchema, multipart) {
  const files = FILE_FIELDS[key] || [];
  if (!bodySchema && !files.length) return undefined;
  const json = bodySchema ? toJsonSchema(bodySchema) : { type: 'object', properties: {} };
  const example = EXAMPLES[key];
  const content = {};
  const jsonOnlyByFiles = key === 'POST /api/public/hotels/:slug/book';

  if (!jsonOnlyByFiles) content['application/json'] = { schema: json, ...(example ? { example } : {}) };

  if (multipart || files.length) {
    const fileProps = Object.fromEntries(
      files.map(([name, max]) => [
        name,
        max > 1
          ? { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: max, description: `Up to ${max} files (jpg, png, webp, pdf)` }
          : { type: 'string', format: 'binary', description: 'One file' },
      ])
    );
    const props = json.properties || {};
    const allPrimitive = Object.values(props).every(isPrimitive);
    // Simple bodies are sent as plain form fields; nested ones as JSON text in "data"
    const formProps = allPrimitive
      ? Object.fromEntries(Object.entries(props).map(([n, s]) => [n, { ...s, type: s.type || 'string' }]))
      : {
          data: {
            type: 'string',
            description: 'The request body as JSON text (same fields as the application/json schema).',
            ...(example ? { example: JSON.stringify(example) } : {}),
          },
        };
    content['multipart/form-data'] = {
      schema: {
        type: 'object',
        properties: { ...formProps, ...fileProps },
        ...(allPrimitive && json.required?.length ? { required: json.required } : !allPrimitive ? { required: ['data'] } : {}),
      },
    };
  }
  return { required: Boolean(bodySchema), content };
}

const ENVELOPE = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: { description: 'The result (object, list page or null)' },
    message: { type: 'string' },
  },
};

export function buildOpenApi(apiRouter, { prefix = '/api' } = {}) {
  const paths = {};
  const missing = [];

  for (const route of collectRoutes(apiRouter, prefix)) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    const meta = OPERATIONS[key];
    if (!meta) missing.push(key);
    const [tag, summary, description] = meta || [route.path.split('/')[2] || 'Other', key];

    const schemas = Object.assign({}, ...route.handles.filter((h) => h.schemas).map((h) => h.schemas));
    const openPath = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    const params = [...parametersFrom(schemas.params, 'path'), ...parametersFrom(schemas.query, 'query')];
    // Path params not covered by a schema still need declaring
    for (const [, name] of openPath.matchAll(/\{([^}]+)\}/g)) {
      if (!params.some((p) => p.in === 'path' && p.name === name)) params.push({ name, in: 'path', required: true, schema: { type: 'string' } });
    }

    const fileResponse = FILE_RESPONSES[key];
    const responses = {
      '2XX': fileResponse
        ? { description: fileResponse[1], content: { [fileResponse[0]]: { schema: { type: 'string', format: 'binary' } } } }
        : { description: 'Success', content: { 'application/json': { schema: ENVELOPE } } },
      400: { $ref: '#/components/responses/BadRequest' },
      ...(route.secure ? { 401: { $ref: '#/components/responses/Unauthorized' } } : {}),
      404: { $ref: '#/components/responses/NotFound' },
      ...(['post', 'put', 'delete'].includes(route.method) ? { 409: { $ref: '#/components/responses/Conflict' } } : {}),
      ...(route.path.startsWith('/api/public') || route.path === '/api/auth/login' ? { 429: { $ref: '#/components/responses/TooMany' } } : {}),
    };

    paths[openPath] ||= {};
    paths[openPath][route.method] = {
      tags: [tag],
      summary,
      ...(description ? { description } : {}),
      operationId: `${route.method}_${openPath.replace(/^\/api\//, '').replace(/[{}]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}`,
      ...(params.length ? { parameters: params } : {}),
      ...(['post', 'put', 'patch'].includes(route.method)
        ? (() => {
            const body = requestBody(key, schemas.body, route.handles.includes(parseMultipartData));
            return body ? { requestBody: body } : {};
          })()
        : {}),
      responses,
      ...(route.secure ? {} : { security: [] }),
    };
  }

  const error = (example) => ({
    description: example,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example },
            errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
          },
        },
      },
    },
  });

  return {
    openapi: '3.0.3',
    info: {
      title: 'KKM Hotels API',
      version: '1.0.0',
      description: [
        'REST API of the KKM Hotels booking and management system.',
        '',
        '**How to test**',
        '1. Open **Auth → POST /api/auth/login**, click **Try it out**, enter the admin email and password, **Execute**. The token is applied automatically (or click **Authorize** and paste it).',
        '2. Run **Hotels → GET /api/hotels** to get a `hotelId`; most endpoints need it.',
        '3. Endpoints under **Public website** need no login.',
        '',
        'Every JSON reply is `{ success, data, message }`. Dates without a time zone (e.g. `2026-11-20T12:00`) are read as India time. Money is in rupees.',
      ].join('\n'),
    },
    servers: [{ url: '/', description: 'This server' }],
    tags: TAGS,
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token from POST /api/auth/login' } },
      responses: {
        BadRequest: error('Validation failed'),
        Unauthorized: error('Authentication required'),
        NotFound: error('Not found'),
        Conflict: error('Conflict (e.g. room not available, wrong status)'),
        TooMany: error('Too many requests, please slow down.'),
      },
    },
    'x-undocumented': missing,
  };
}
