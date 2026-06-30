import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "./heartprefs.schema.json" with { type: "json" };

export interface ValidationResult {
  valid: boolean;
  /** ajv error objects (empty when valid) */
  errors: ErrorObject[];
}

let _validator: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (_validator) return _validator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  // The schema's own $id is the w3id URL, which need not resolve at runtime;
  // compiling it directly is sufficient for validation.
  _validator = ajv.compile(schema as object);
  return _validator;
}

/**
 * Validate a value against the frozen HeartPrefs v0.1 JSON Schema
 * (draft 2020-12). Returns `{ valid, errors }`; never throws on a malformed
 * document — invalid input simply yields `valid: false` with ajv errors.
 */
export function validate(doc: unknown): ValidationResult {
  const validator = getValidator();
  const valid = validator(doc) as boolean;
  return {
    valid,
    errors: valid ? [] : ((validator.errors ?? []) as ErrorObject[]),
  };
}

/** The frozen schema object, exported for tooling that needs the raw schema. */
export const heartprefsSchema = schema as object;
