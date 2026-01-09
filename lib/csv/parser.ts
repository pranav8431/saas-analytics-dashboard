import Papa from 'papaparse';

export interface ParsedCSVResult {
  data: Record<string, any>[];
  columns: string[];
  schema: Record<string, string>;
  rowCount: number;
}

export function inferDataType(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'string';
  }

  const str = String(value).trim();

  if (!isNaN(Number(str)) && str !== '') {
    return str.includes('.') ? 'number' : 'integer';
  }

  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  ];

  if (datePatterns.some((pattern) => pattern.test(str))) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return 'timestamp';
    }
  }

  if (str.toLowerCase() === 'true' || str.toLowerCase() === 'false') {
    return 'boolean';
  }

  return 'string';
}

export function inferSchema(data: Record<string, any>[], columns: string[]): Record<string, string> {
  const schema: Record<string, string> = {};
  const sampleSize = Math.min(100, data.length);

  for (const column of columns) {
    const types = new Map<string, number>();

    for (let i = 0; i < sampleSize; i++) {
      const value = data[i]?.[column];
      const type = inferDataType(value);
      types.set(type, (types.get(type) || 0) + 1);
    }

    let dominantType = 'string';
    let maxCount = 0;

    for (const [type, count] of types.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    schema[column] = dominantType;
  }

  return schema;
}

export async function parseCSVFile(fileContent: string): Promise<ParsedCSVResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map((e) => e.message).join(', ')}`));
          return;
        }

        const data = results.data as Record<string, any>[];
        const columns = results.meta.fields || [];

        if (columns.length === 0 || data.length === 0) {
          reject(new Error('CSV file is empty or has no valid columns'));
          return;
        }

        const schema = inferSchema(data, columns);

        resolve({
          data,
          columns,
          schema,
          rowCount: data.length,
        });
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

export interface AnalyticsEventMapping {
  eventTypeColumn?: string;
  timestampColumn?: string;
  metricValueColumn?: string;
  dimensionColumns?: string[];
}

export function detectEventMapping(
  columns: string[],
  schema: Record<string, string>
): AnalyticsEventMapping {
  const mapping: AnalyticsEventMapping = {
    dimensionColumns: [],
  };

  const timestampPatterns = ['timestamp', 'time', 'date', 'created', 'occurred', 'event_time'];
  const typePatterns = ['type', 'event_type', 'event', 'action', 'category'];
  const valuePatterns = ['value', 'amount', 'count', 'metric', 'score', 'revenue', 'total'];

  for (const column of columns) {
    const lowerColumn = column.toLowerCase();

    if (!mapping.timestampColumn && schema[column] === 'timestamp') {
      if (timestampPatterns.some((p) => lowerColumn.includes(p))) {
        mapping.timestampColumn = column;
        continue;
      }
    }

    if (!mapping.eventTypeColumn && schema[column] === 'string') {
      if (typePatterns.some((p) => lowerColumn.includes(p))) {
        mapping.eventTypeColumn = column;
        continue;
      }
    }

    if (!mapping.metricValueColumn && (schema[column] === 'number' || schema[column] === 'integer')) {
      if (valuePatterns.some((p) => lowerColumn.includes(p))) {
        mapping.metricValueColumn = column;
        continue;
      }
    }

    mapping.dimensionColumns?.push(column);
  }

  if (!mapping.timestampColumn) {
    const timestampCols = columns.filter((c) => schema[c] === 'timestamp');
    if (timestampCols.length > 0) {
      mapping.timestampColumn = timestampCols[0];
      mapping.dimensionColumns = mapping.dimensionColumns?.filter((c) => c !== timestampCols[0]);
    }
  }

  if (!mapping.eventTypeColumn) {
    mapping.eventTypeColumn = 'default_event';
  }

  return mapping;
}

export function normalizeValue(value: any, type: string): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (type) {
    case 'number':
    case 'integer':
      const num = Number(value);
      return isNaN(num) ? null : num;

    case 'timestamp':
      const date = new Date(value);
      return isNaN(date.getTime()) ? new Date() : date;

    case 'boolean':
      const str = String(value).toLowerCase();
      return str === 'true' || str === '1' || str === 'yes';

    default:
      return String(value);
  }
}
