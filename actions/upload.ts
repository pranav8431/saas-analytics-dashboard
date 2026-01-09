'use server';

import { revalidatePath } from 'next/cache';
import { getTenantAuthContext, requireTenantAuth } from '@/lib/auth/context';
import { canUploadFiles } from '@/lib/auth/permissions';
import {
  createUploadedFile,
  updateFileStatus,
  insertAnalyticsEvents,
} from '@/lib/db/queries';
import { parseCSVFile, detectEventMapping, normalizeValue } from '@/lib/csv/parser';
import { validateCSVData, formatValidationErrors } from '@/lib/csv/validation';
import type { AnalyticsEvent } from '@/lib/db/types';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760');

export async function uploadCSVAction(tenantId: string, formData: FormData) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    if (!canUploadFiles(tenantAuth!.role)) {
      return {
        success: false,
        error: 'You do not have permission to upload files',
      };
    }

    const file = formData.get('file') as File;

    if (!file) {
      return {
        success: false,
        error: 'No file provided',
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    if (!file.name.endsWith('.csv')) {
      return {
        success: false,
        error: 'Only CSV files are supported',
      };
    }

    const fileContent = await file.text();

    const parsed = await parseCSVFile(fileContent);

    // Validate CSV data using Zod schema
    const validationResult = validateCSVData(parsed.data, parsed.columns);

    if (!validationResult.valid) {
      return {
        success: false,
        error: formatValidationErrors(validationResult),
        validationErrors: validationResult.errors,
      };
    }

    const uploadedFile = await createUploadedFile(
      tenantId,
      tenantAuth!.userId,
      file.name,
      file.size,
      parsed.columns
    );

    const mapping = detectEventMapping(parsed.columns, parsed.schema);

    const events: Omit<AnalyticsEvent, 'id' | 'created_at'>[] = [];

    for (const row of parsed.data) {
      const eventType = mapping.eventTypeColumn
        ? String(row[mapping.eventTypeColumn] || 'unknown')
        : 'unknown';

      const timestamp = mapping.timestampColumn
        ? normalizeValue(row[mapping.timestampColumn], 'timestamp')
        : new Date();

      const metricValue = mapping.metricValueColumn
        ? normalizeValue(row[mapping.metricValueColumn], parsed.schema[mapping.metricValueColumn])
        : null;

      const dimensions: Record<string, unknown> = {};
      for (const dimColumn of mapping.dimensionColumns || []) {
        if (dimColumn !== mapping.timestampColumn && dimColumn !== mapping.eventTypeColumn && dimColumn !== mapping.metricValueColumn) {
          dimensions[dimColumn] = row[dimColumn];
        }
      }

      events.push({
        tenant_id: tenantId,
        file_id: uploadedFile.id,
        event_type: eventType,
        event_timestamp: timestamp,
        metric_value: metricValue,
        dimensions,
        raw_data: row,
      });
    }

    await insertAnalyticsEvents(events);

    await updateFileStatus(uploadedFile.id, 'completed', parsed.rowCount, parsed.schema);

    revalidatePath(`/dashboard/${tenantId}`);

    return {
      success: true,
      fileId: uploadedFile.id,
      rowCount: parsed.rowCount,
      columns: parsed.columns,
    };
  } catch (error) {
    console.error('Error uploading CSV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload and process CSV file',
    };
  }
}
