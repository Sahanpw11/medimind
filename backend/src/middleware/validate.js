'use strict';
const { z } = require('zod');
const { ObjectId } = require('mongodb');
const { bad } = require('../errors');

const objectIdStr = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const toOid = (s) => new ObjectId(s);

// validate({ body, query, params }) -> replaces req parts with parsed (stripped, coerced) values.
function validate(schemas) {
  return (req, _res, next) => {
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const r = schemas[part].safeParse(req[part] ?? {});
      if (!r.success) {
        return next(bad('Validation failed', r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))));
      }
      req[part] = r.data; // unknown keys (e.g. a client-supplied "role") are stripped
    }
    next();
  };
}

const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function pageMeta(page, limit, total) { return { page, limit, total, pages: Math.ceil(total / limit) }; }

module.exports = { validate, objectIdStr, toOid, pagination, pageMeta, z };
