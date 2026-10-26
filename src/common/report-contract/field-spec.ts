/**
 * A tiny declarative field-spec language for report payloads.
 *
 * The four report payloads are deep, mostly-optional, presentation-ready trees
 * assembled by Nursery. Expressing them as class-validator DTO classes would mean a
 * dozen nested classes per report and would still not give us the two behaviours the
 * contract actually requires — per-schema-version strictness, and *stripping* unknown
 * fields instead of rejecting them. A spec object gives us both in one place, keeps
 * the global validation policy for unrelated endpoints untouched, and is directly
 * unit-testable.
 */

export type FieldSpec =
  | StringSpec
  | NumberSpec
  | BooleanSpec
  | ImageSpec
  | ObjectSpec
  | ArraySpec;

interface BaseSpec {
  /** Absent keys fail validation when required. */
  required?: boolean;
  /** `null` is accepted in place of a value. Nursery emits null for "no value" widely. */
  nullable?: boolean;
}

export interface StringSpec extends BaseSpec {
  kind: 'string';
  maxLength?: number;
  /** When set, the value must be one of these exactly. */
  enum?: readonly string[];
}

export interface NumberSpec extends BaseSpec {
  kind: 'number';
  integer?: boolean;
  min?: number;
  max?: number;
}

export interface BooleanSpec extends BaseSpec {
  kind: 'boolean';
}

/** A base64 image data URI, validated against the MIME allow-list and the byte ceiling. */
export interface ImageSpec extends BaseSpec {
  kind: 'image';
}

export interface ObjectSpec extends BaseSpec {
  kind: 'object';
  fields: Readonly<Record<string, FieldSpec>>;
}

export interface ArraySpec extends BaseSpec {
  kind: 'array';
  maxItems: number;
  /** A thunk is allowed so a spec can reference itself (the evaluation node tree). */
  items: FieldSpec | (() => FieldSpec);
}

export function resolveItems(spec: ArraySpec): FieldSpec {
  return typeof spec.items === 'function' ? spec.items() : spec.items;
}

/** Shorthands — these specs are written out by hand, so brevity matters for readability. */
export const str = (opts: Omit<StringSpec, 'kind'> = {}): StringSpec => ({ kind: 'string', ...opts });
export const num = (opts: Omit<NumberSpec, 'kind'> = {}): NumberSpec => ({ kind: 'number', ...opts });
export const bool = (opts: Omit<BooleanSpec, 'kind'> = {}): BooleanSpec => ({ kind: 'boolean', ...opts });
export const image = (opts: Omit<ImageSpec, 'kind'> = {}): ImageSpec => ({ kind: 'image', ...opts });
export const obj = (
  fields: Readonly<Record<string, FieldSpec>>,
  opts: Omit<ObjectSpec, 'kind' | 'fields'> = {},
): ObjectSpec => ({ kind: 'object', fields, ...opts });
export const arr = (
  items: FieldSpec | (() => FieldSpec),
  maxItems: number,
  opts: Omit<ArraySpec, 'kind' | 'items' | 'maxItems'> = {},
): ArraySpec => ({ kind: 'array', items, maxItems, ...opts });
