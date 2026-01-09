import { z } from 'zod';

// Zod schema for CSV row validation
// Required fields: timestamp (ISO string), event_type (string), value (number)
export const csvRowSchema = z.object({
  timestamp: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: 'Invalid timestamp format. Expected ISO string or parseable date.' }
  ),
  event_type: z.string().min(1, 'event_type is required'),
  value: z.union([
    z.number(),
    z.string().refine(
      (val) => !isNaN(Number(val)),
      { message: 'value must be a valid number' }
    ),
  ]).transform((val) => Number(val)),
});

export type ValidatedCSVRow = z.infer<typeof csvRowSchema>;

export interface ValidationResult {
  valid: boolean;
  validRows: Record<string, any>[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  summary: {
    totalRows: number;
    validRowCount: number;
    invalidRowCount: number;
  };
}

// Validates CSV data against the required schema
// Returns validated rows and detailed error messages
export function validateCSVData(
  data: Record<string, any>[],
  columns: string[]
): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const validRows: Record<string, any>[] = [];

  // Check for required columns with flexible matching
  const timestampCol = columns.find((c) =>
    ['timestamp', 'time', 'date', 'created_at', 'event_time'].includes(c.toLowerCase())
  );
  const eventTypeCol = columns.find((c) =>
    ['event_type', 'type', 'event', 'action'].includes(c.toLowerCase())
  );
  const valueCol = columns.find((c) =>
    ['value', 'amount', 'count', 'metric', 'metric_value'].includes(c.toLowerCase())
  );

  // Check required columns exist
  const missingColumns: string[] = [];
  if (!timestampCol) missingColumns.push('timestamp');
  if (!eventTypeCol) missingColumns.push('event_type');
  if (!valueCol) missingColumns.push('value');

  if (missingColumns.length > 0) {
    return {
      valid: false,
      validRows: [],
      errors: [{
        row: 0,
        field: 'schema',
        message: `Missing required columns: ${missingColumns.join(', ')}. ` +
          `Expected: timestamp (or time/date), event_type (or type/event), value (or amount/metric).`,
      }],
      summary: {
        totalRows: data.length,
        validRowCount: 0,
        invalidRowCount: data.length,
      },
    };
  }

  // Validate each row
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2; // +2 for 1-indexed + header row

    // Construct normalized row for validation
    const normalizedRow = {
      timestamp: row[timestampCol!],
      event_type: row[eventTypeCol!],
      value: row[valueCol!],
    };

    const result = csvRowSchema.safeParse(normalizedRow);

    if (result.success) {
      // Keep original row with validated data
      validRows.push({
        ...row,
        _validated: result.data,
        _timestampCol: timestampCol,
        _eventTypeCol: eventTypeCol,
        _valueCol: valueCol,
      });
    } else {
      result.error.issues.forEach((err) => {
        errors.push({
          row: rowNumber,
          field: err.path.join('.') || 'unknown',
          message: err.message,
        });
      });
    }
  }

  // Limit error messages to first 10 for readability
  const displayErrors = errors.slice(0, 10);
  if (errors.length > 10) {
    displayErrors.push({
      row: 0,
      field: 'summary',
      message: `... and ${errors.length - 10} more validation errors`,
    });
  }

  return {
    valid: errors.length === 0,
    validRows,
    errors: displayErrors,
    summary: {
      totalRows: data.length,
      validRowCount: validRows.length,
      invalidRowCount: data.length - validRows.length,
    },
  };
}

// Formats validation errors into a user-friendly message
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) return '';

  const lines = [
    `CSV Validation Failed: ${result.summary.invalidRowCount} of ${result.summary.totalRows} rows are invalid.`,
    '',
  ];

  result.errors.forEach((err) => {
    if (err.row === 0) {
      lines.push(`  - ${err.message}`);
    } else {
      lines.push(`  - Row ${err.row}: ${err.field} - ${err.message}`);
    }
  });

  return lines.join('\n');
}
