import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { ArraySpec, FieldSpec, ObjectSpec, resolveItems } from './field-spec';
import { REPORT_SCHEMAS, ReportType } from './report-schemas';
import {
  CURRENT_SCHEMA_VERSION,
  ReportLocale,
  ReportMeta,
  SUPPORTED_SCHEMA_VERSIONS,
  resolveMeta,
} from './report-meta';
import { validateImageDataUri } from './data-uri.util';
import { ReportRuntimeConfig } from 'src/config/report.config';

export interface ValidatedReportPayload<T = unknown> {
  /** The payload with unknown fields removed. Only validated keys survive. */
  data: T;
  meta: ReportMeta;
  locale: ReportLocale;
  /** True when the caller sent no `meta` and was defaulted to English. */
  unversioned: boolean;
  /** Count of unknown fields that were stripped — telemetry only, never the field values. */
  strippedFieldCount: number;
  /** Serialized size of the accepted payload, in bytes. */
  payloadBytes: number;
}

interface FieldError {
  field: string;
  message: string;
}

/** Recursion guard — deeper than any legitimate report tree, shallow enough to be safe. */
const MAX_DEPTH = 32;

/**
 * Version-aware validator for the four report payloads.
 *
 * This is deliberately *not* wired into the global `AppValidationPipe`: that pipe is
 * `forbidNonWhitelisted`, and the report contract needs the opposite behaviour for
 * schema version 1 — unknown fields are stripped so that a Nursery deploy which adds a
 * field cannot break rendering. Everything else is strict: required fields, types,
 * enums, sizes, images and unsafe values all reject.
 */
@Injectable()
export class ReportPayloadValidator {
  constructor(private readonly config: ReportRuntimeConfig) {}

  validate<T = unknown>(reportType: ReportType, raw: unknown): ValidatedReportPayload<T> {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException([{ field: 'body', message: 'Report payload must be an object.' }]);
    }

    const payloadBytes = Buffer.byteLength(JSON.stringify(raw), 'utf8');
    if (payloadBytes > this.config.maxPayloadBytes) {
      throw new PayloadTooLargeException(
        `Report payload of ${payloadBytes} bytes exceeds the ${this.config.maxPayloadBytes} byte limit.`,
      );
    }

    const { meta, unversioned } = resolveMeta(raw);

    if (!unversioned) {
      this.assertSupportedVersion(raw);
    }

    const errors: FieldError[] = [];
    const stripped = { count: 0 };

    const data = this.walkObject(REPORT_SCHEMAS[reportType], raw, '', errors, stripped, 0) as T;

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return {
      data,
      meta,
      locale: meta.locale,
      unversioned,
      strippedFieldCount: stripped.count,
      payloadBytes,
    };
  }

  /**
   * A present-but-unsupported `schemaVersion` is rejected rather than coerced: breaking
   * contract changes get a new version, and silently rendering a version we do not
   * understand would produce a wrong document rather than an error.
   */
  private assertSupportedVersion(raw: unknown): void {
    const version = (raw as { meta?: { schemaVersion?: unknown } }).meta?.schemaVersion;

    if (!SUPPORTED_SCHEMA_VERSIONS.includes(version as number)) {
      throw new BadRequestException([
        {
          field: 'meta.schemaVersion',
          message: `Unsupported report schema version. Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`,
        },
      ]);
    }

    const locale = (raw as { meta?: { locale?: unknown } }).meta?.locale;
    if (locale !== undefined && locale !== null && typeof locale !== 'string') {
      throw new BadRequestException([{ field: 'meta.locale', message: 'meta.locale must be a string.' }]);
    }
  }

  // -------------------------------------------------------------------------
  // Walkers — each returns the cleaned value and pushes any errors it found.
  // -------------------------------------------------------------------------

  private walkObject(
    spec: ObjectSpec,
    value: unknown,
    path: string,
    errors: FieldError[],
    stripped: { count: number },
    depth: number,
  ): Record<string, unknown> {
    if (depth > MAX_DEPTH) {
      errors.push({ field: path || 'body', message: 'Report payload is nested too deeply.' });
      return {};
    }

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, fieldSpec] of Object.entries(spec.fields)) {
      const childPath = path ? `${path}.${key}` : key;
      const present = Object.prototype.hasOwnProperty.call(source, key);
      const childValue = present ? source[key] : undefined;

      if (!present || childValue === undefined) {
        if (fieldSpec.required) {
          errors.push({ field: childPath, message: 'is required.' });
        }
        continue;
      }

      if (childValue === null) {
        if (fieldSpec.nullable) {
          result[key] = null;
        } else if (fieldSpec.required) {
          errors.push({ field: childPath, message: 'must not be null.' });
        }
        continue;
      }

      result[key] = this.walkField(fieldSpec, childValue, childPath, errors, stripped, depth + 1);
    }

    // Everything the spec does not name is dropped. Only the count is retained: the
    // field names could carry payload data and telemetry must stay PII-free.
    for (const key of Object.keys(source)) {
      if (!Object.prototype.hasOwnProperty.call(spec.fields, key)) {
        // `meta` is the known versioning/localization envelope. It is deliberately kept
        // out of template data, but must not make every healthy versioned request look
        // like contract drift in the stripped-field telemetry.
        if (depth === 0 && key === 'meta') {
          continue;
        }
        stripped.count += 1;
      }
    }

    return result;
  }

  private walkField(
    spec: FieldSpec,
    value: unknown,
    path: string,
    errors: FieldError[],
    stripped: { count: number },
    depth: number,
  ): unknown {
    switch (spec.kind) {
      case 'string':
        return this.walkString(spec, value, path, errors);

      case 'number':
        return this.walkNumber(spec, value, path, errors);

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({ field: path, message: 'must be a boolean.' });
          return undefined;
        }
        return value;

      case 'image':
        return this.walkImage(value, path, errors);

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push({ field: path, message: 'must be an object.' });
          return undefined;
        }
        return this.walkObject(spec, value, path, errors, stripped, depth);

      case 'array':
        return this.walkArray(spec, value, path, errors, stripped, depth);
    }
  }

  private walkString(
    spec: Extract<FieldSpec, { kind: 'string' }>,
    value: unknown,
    path: string,
    errors: FieldError[],
  ): string | undefined {
    if (typeof value !== 'string') {
      errors.push({ field: path, message: 'must be a string.' });
      return undefined;
    }
    if (spec.enum && !spec.enum.includes(value)) {
      errors.push({ field: path, message: `must be one of: ${spec.enum.join(', ')}.` });
      return undefined;
    }
    if (spec.maxLength !== undefined && value.length > spec.maxLength) {
      errors.push({ field: path, message: `must be at most ${spec.maxLength} characters.` });
      return undefined;
    }
    return value;
  }

  private walkNumber(
    spec: Extract<FieldSpec, { kind: 'number' }>,
    value: unknown,
    path: string,
    errors: FieldError[],
  ): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push({ field: path, message: 'must be a finite number.' });
      return undefined;
    }
    if (spec.integer && !Number.isInteger(value)) {
      errors.push({ field: path, message: 'must be an integer.' });
      return undefined;
    }
    if (spec.min !== undefined && value < spec.min) {
      errors.push({ field: path, message: `must be at least ${spec.min}.` });
      return undefined;
    }
    if (spec.max !== undefined && value > spec.max) {
      errors.push({ field: path, message: `must be at most ${spec.max}.` });
      return undefined;
    }
    return value;
  }

  /**
   * An invalid image is an error, not a silently-dropped field: Nursery is expected to
   * have already validated and bounded what it forwards, so anything arriving here that
   * is not a safe, in-budget data URI means the two services disagree.
   */
  private walkImage(value: unknown, path: string, errors: FieldError[]): string | undefined {
    const result = validateImageDataUri(value, this.config.maxImageBytes);
    if (!result.valid) {
      errors.push({ field: path, message: `is not an accepted image data URI (${result.reason}).` });
      return undefined;
    }
    return value as string;
  }

  private walkArray(
    spec: ArraySpec,
    value: unknown,
    path: string,
    errors: FieldError[],
    stripped: { count: number },
    depth: number,
  ): unknown[] | undefined {
    if (!Array.isArray(value)) {
      errors.push({ field: path, message: 'must be an array.' });
      return undefined;
    }
    if (value.length > spec.maxItems) {
      errors.push({ field: path, message: `must contain at most ${spec.maxItems} items.` });
      return undefined;
    }
    if (depth > MAX_DEPTH) {
      errors.push({ field: path, message: 'Report payload is nested too deeply.' });
      return undefined;
    }

    const itemSpec = resolveItems(spec);

    return value.map((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (item === null) {
        errors.push({ field: itemPath, message: 'must not be null.' });
        return undefined;
      }
      return this.walkField(itemSpec, item, itemPath, errors, stripped, depth + 1);
    });
  }
}

export { CURRENT_SCHEMA_VERSION };
