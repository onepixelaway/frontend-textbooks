import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = resolve(directory, "../../schemas");
const schemaNames = Object.freeze({
  "book-config": "book-config.schema.json",
  "book-plan": "book-plan.schema.json",
  "repair-actions": "repair-actions.schema.json",
  "aesthetic-review": "aesthetic-review.schema.json",
  "artifact-manifest": "artifact-manifest.schema.json",
  diagnostics: "diagnostics.schema.json",
  "repair-tasks": "repair-tasks.schema.json"
});
const supportedSchemaKeywords = new Set([
  "$schema", "$id", "title", "description", "default", "type", "properties", "required", "additionalProperties", "enum",
  "minLength", "maxLength", "pattern", "minimum", "maximum", "minItems", "maxItems", "uniqueItems", "items"
]);

export function contractNames() {
  return Object.keys(schemaNames);
}

export function assertSupportedSchema(schema, path = "schema") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new Error(`${path} must be a schema object`);
  for (const key of Object.keys(schema)) {
    if (!supportedSchemaKeywords.has(key)) throw new Error(`${path} uses unsupported JSON Schema keyword: ${key}`);
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) assertSupportedSchema(child, `${path}.properties.${name}`);
  if (schema.items) assertSupportedSchema(schema.items, `${path}.items`);
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    assertSupportedSchema(schema.additionalProperties, `${path}.additionalProperties`);
  }
  return schema;
}

export function readContractSchema(name) {
  const filename = schemaNames[name];
  if (!filename) throw new Error(`Unknown JSON contract: ${name}`);
  return assertSupportedSchema(JSON.parse(readFileSync(resolve(schemaDirectory, filename), "utf8")), name);
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function validateNode(value, schema, path, errors) {
  const actualType = valueType(value);
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const compatible = allowed.includes(actualType) || (actualType === "integer" && allowed.includes("number"));
    if (!compatible) {
      errors.push(`${path} must be ${allowed.join(" or ")}; received ${actualType}`);
      return;
    }
  }
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) errors.push(`${path} must not be empty`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} must contain at most ${schema.maxLength} characters`);
    if (schema.pattern && !(new RegExp(schema.pattern, "u")).test(value)) errors.push(`${path} does not match ${schema.pattern}`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} must contain at most ${schema.maxItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path} must contain unique items`);
    if (schema.items) value.forEach((item, index) => validateNode(item, schema.items, `${path}[${index}]`, errors));
  }
  if (actualType === "object") {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!(required in value)) errors.push(`${path}.${required} is required`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) {
        validateNode(child, properties[key], `${path}.${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} is not allowed`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validateNode(child, schema.additionalProperties, `${path}.${key}`, errors);
      }
    }
  }
}

export function validateContract(name, value) {
  const errors = [];
  validateNode(value, readContractSchema(name), name, errors);
  return { valid: errors.length === 0, errors };
}

export function assertContract(name, value) {
  const result = validateContract(name, value);
  if (!result.valid) throw new Error(`Invalid ${name}:\n- ${result.errors.join("\n- ")}`);
  return value;
}

export function readContractFile(name, filename) {
  let value;
  try {
    value = JSON.parse(readFileSync(filename, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${name} JSON from ${filename}: ${error.message}`);
  }
  return assertContract(name, value);
}
