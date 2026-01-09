import { sql } from './index';
import type {
  Tenant,
  User,
  TenantMember,
  TenantMemberWithDetails,
  UploadedFile,
  AnalyticsEvent,
  AggregatedMetric,
  AnomalyResult,
  UserRole,
} from './types';

export async function createOrUpdateUser(
  clerkUserId: string,
  email: string,
  firstName: string | null,
  lastName: string | null,
  avatarUrl: string | null
): Promise<User> {
  const [user] = await sql`
    INSERT INTO users (clerk_user_id, email, first_name, last_name, avatar_url)
    VALUES (${clerkUserId}, ${email}, ${firstName}, ${lastName}, ${avatarUrl})
    ON CONFLICT (clerk_user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    RETURNING *
  `;
  return user as User;
}

export async function getUserByClerkId(clerkUserId: string): Promise<User | null> {
  const [user] = await sql`
    SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
  `;
  return (user as User) || null;
}

export async function createTenant(name: string, slug: string, ownerId: string): Promise<Tenant> {
  const [tenant] = await sql`
    WITH new_tenant AS (
      INSERT INTO tenants (name, slug)
      VALUES (${name}, ${slug})
      RETURNING *
    ),
    new_member AS (
      INSERT INTO tenant_members (tenant_id, user_id, role)
      SELECT id, ${ownerId}, 'OWNER'
      FROM new_tenant
    )
    SELECT * FROM new_tenant
  `;
  return tenant as Tenant;
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const [tenant] = await sql`
    SELECT * FROM tenants WHERE id = ${tenantId} AND status = 'active'
  `;
  return (tenant as Tenant) || null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const [tenant] = await sql`
    SELECT * FROM tenants WHERE slug = ${slug} AND status = 'active'
  `;
  return (tenant as Tenant) || null;
}

export async function getUserTenants(userId: string): Promise<TenantMemberWithDetails[]> {
  const tenants = await sql`
    SELECT
      tm.*,
      t.name as tenant_name,
      t.slug as tenant_slug,
      t.created_at as tenant_created_at
    FROM tenant_members tm
    JOIN tenants t ON tm.tenant_id = t.id
    WHERE tm.user_id = ${userId} AND t.status = 'active'
    ORDER BY tm.joined_at DESC
  `;
  return tenants as unknown as TenantMemberWithDetails[];
}

export async function getTenantMember(
  tenantId: string,
  userId: string
): Promise<TenantMember | null> {
  const [member] = await sql`
    SELECT * FROM tenant_members
    WHERE tenant_id = ${tenantId} AND user_id = ${userId}
  `;
  return (member as TenantMember) || null;
}

export async function getTenantMembers(tenantId: string): Promise<TenantMemberWithDetails[]> {
  const members = await sql`
    SELECT
      tm.*,
      u.email as user_email,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.avatar_url as user_avatar_url
    FROM tenant_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tenant_id = ${tenantId}
    ORDER BY tm.joined_at DESC
  `;
  return members as unknown as TenantMemberWithDetails[];
}

export async function addTenantMember(
  tenantId: string,
  userId: string,
  role: UserRole,
  invitedBy: string
): Promise<TenantMember> {
  const [member] = await sql`
    INSERT INTO tenant_members (tenant_id, user_id, role, invited_by)
    VALUES (${tenantId}, ${userId}, ${role}, ${invitedBy})
    RETURNING *
  `;
  return member as TenantMember;
}

export async function createUploadedFile(
  tenantId: string,
  uploadedBy: string,
  filename: string,
  fileSizeBytes: number,
  columns: string[]
): Promise<UploadedFile> {
  const [file] = await sql`
    INSERT INTO uploaded_files (
      tenant_id, uploaded_by, filename, file_size_bytes, columns
    )
    VALUES (${tenantId}, ${uploadedBy}, ${filename}, ${fileSizeBytes}, ${JSON.stringify(columns)})
    RETURNING *
  `;
  return file as UploadedFile;
}

export async function updateFileStatus(
  fileId: string,
  status: 'completed' | 'failed',
  rowCount?: number,
  schemaInferred?: Record<string, string>,
  errorMessage?: string
): Promise<void> {
  await sql`
    UPDATE uploaded_files
    SET
      upload_status = ${status},
      row_count = COALESCE(${rowCount || null}, row_count),
      schema_inferred = COALESCE(${schemaInferred ? JSON.stringify(schemaInferred) : null}, schema_inferred),
      error_message = ${errorMessage || null},
      processed_at = NOW()
    WHERE id = ${fileId}
  `;
}

export async function getUploadedFiles(tenantId: string, limit = 50): Promise<UploadedFile[]> {
  const files = await sql`
    SELECT * FROM uploaded_files
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return files as UploadedFile[];
}

export async function getUploadedFile(fileId: string, tenantId: string): Promise<UploadedFile | null> {
  const [file] = await sql`
    SELECT * FROM uploaded_files
    WHERE id = ${fileId} AND tenant_id = ${tenantId}
  `;
  return (file as UploadedFile) || null;
}

export async function insertAnalyticsEvents(events: Omit<AnalyticsEvent, 'id' | 'created_at'>[]): Promise<void> {
  if (events.length === 0) return;

  // Insert events one by one (Neon serverless driver doesn't support batch VALUES)
  for (const e of events) {
    const timestamp = e.event_timestamp instanceof Date
      ? e.event_timestamp.toISOString()
      : String(e.event_timestamp);

    await sql`
      INSERT INTO analytics_events (
        tenant_id, file_id, event_type, event_timestamp,
        metric_value, dimensions, raw_data
      )
      VALUES (
        ${e.tenant_id},
        ${e.file_id},
        ${e.event_type},
        ${timestamp},
        ${e.metric_value},
        ${JSON.stringify(e.dimensions)},
        ${e.raw_data ? JSON.stringify(e.raw_data) : null}
      )
    `;
  }
}

export async function getAnalyticsEvents(
  tenantId: string,
  eventType?: string,
  startDate?: Date,
  endDate?: Date,
  limit = 1000
): Promise<AnalyticsEvent[]> {
  let query = sql`
    SELECT * FROM analytics_events
    WHERE tenant_id = ${tenantId}
  `;

  if (eventType) {
    query = sql`${query} AND event_type = ${eventType}`;
  }

  if (startDate) {
    query = sql`${query} AND event_timestamp >= ${startDate.toISOString()}`;
  }

  if (endDate) {
    query = sql`${query} AND event_timestamp <= ${endDate.toISOString()}`;
  }

  query = sql`${query} ORDER BY event_timestamp DESC LIMIT ${limit}`;

  const events = await query;
  return events as AnalyticsEvent[];
}

export async function getEventTypes(tenantId: string): Promise<string[]> {
  const types = await sql`
    SELECT DISTINCT event_type
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
    ORDER BY event_type
  `;
  return types.map((t: any) => t.event_type);
}

export async function insertAggregatedMetric(metric: Omit<AggregatedMetric, 'id' | 'computed_at'>): Promise<void> {
  await sql`
    INSERT INTO aggregated_metrics (
      tenant_id, event_type, aggregation_period, period_start, period_end,
      count_events, sum_value, avg_value, min_value, max_value, stddev_value, dimensions
    )
    VALUES (
      ${metric.tenant_id}, ${metric.event_type}, ${metric.aggregation_period},
      ${metric.period_start}, ${metric.period_end}, ${metric.count_events},
      ${metric.sum_value}, ${metric.avg_value}, ${metric.min_value},
      ${metric.max_value}, ${metric.stddev_value}, ${JSON.stringify(metric.dimensions)}
    )
    ON CONFLICT (tenant_id, event_type, aggregation_period, period_start, dimensions)
    DO UPDATE SET
      count_events = EXCLUDED.count_events,
      sum_value = EXCLUDED.sum_value,
      avg_value = EXCLUDED.avg_value,
      min_value = EXCLUDED.min_value,
      max_value = EXCLUDED.max_value,
      stddev_value = EXCLUDED.stddev_value,
      computed_at = NOW()
  `;
}

export async function getAggregatedMetrics(
  tenantId: string,
  eventType: string,
  period: 'hour' | 'day' | 'week' | 'month',
  startDate: Date,
  endDate: Date
): Promise<AggregatedMetric[]> {
  const metrics = await sql`
    SELECT * FROM aggregated_metrics
    WHERE tenant_id = ${tenantId}
      AND event_type = ${eventType}
      AND aggregation_period = ${period}
      AND period_start >= ${startDate.toISOString()}
      AND period_start <= ${endDate.toISOString()}
    ORDER BY period_start ASC
  `;
  return metrics as AggregatedMetric[];
}

export async function insertAnomalyResult(anomaly: Omit<AnomalyResult, 'id' | 'created_at'>): Promise<void> {
  await sql`
    INSERT INTO anomaly_results (
      tenant_id, event_type, detected_at, anomaly_type, severity,
      metric_value, expected_value, deviation_percentage, threshold_used, metadata
    )
    VALUES (
      ${anomaly.tenant_id}, ${anomaly.event_type}, ${anomaly.detected_at},
      ${anomaly.anomaly_type}, ${anomaly.severity}, ${anomaly.metric_value},
      ${anomaly.expected_value}, ${anomaly.deviation_percentage},
      ${anomaly.threshold_used}, ${JSON.stringify(anomaly.metadata)}
    )
  `;
}

export async function getAnomalies(
  tenantId: string,
  eventType?: string,
  startDate?: Date,
  acknowledged = false,
  limit = 100
): Promise<AnomalyResult[]> {
  let query = sql`
    SELECT * FROM anomaly_results
    WHERE tenant_id = ${tenantId}
      AND acknowledged = ${acknowledged}
  `;

  if (eventType) {
    query = sql`${query} AND event_type = ${eventType}`;
  }

  if (startDate) {
    query = sql`${query} AND detected_at >= ${startDate.toISOString()}`;
  }

  query = sql`${query} ORDER BY detected_at DESC, severity DESC LIMIT ${limit}`;

  const anomalies = await query;
  return anomalies as AnomalyResult[];
}

export async function acknowledgeAnomaly(anomalyId: string, userId: string): Promise<void> {
  await sql`
    UPDATE anomaly_results
    SET acknowledged = true,
        acknowledged_by = ${userId},
        acknowledged_at = NOW()
    WHERE id = ${anomalyId}
  `;
}

// Tenant dashboard summary stats (tenant-scoped)
export async function getTenantDashboardSummary(tenantId: string): Promise<{
  totalEvents: number;
  distinctEventTypes: number;
  lastUploadAt: Date | null;
}> {
  const [eventStats] = await sql`
    SELECT
      COUNT(*)::int as total_events,
      COUNT(DISTINCT event_type)::int as distinct_event_types
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
  `;

  const [lastUpload] = await sql`
    SELECT created_at
    FROM uploaded_files
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return {
    totalEvents: (eventStats as any)?.total_events || 0,
    distinctEventTypes: (eventStats as any)?.distinct_event_types || 0,
    lastUploadAt: lastUpload ? new Date((lastUpload as any).created_at) : null,
  };
}

// Get tenant info with user's role
export async function getTenantWithRole(
  tenantId: string,
  userId: string
): Promise<{ tenantName: string; role: string } | null> {
  const [result] = await sql`
    SELECT t.name as tenant_name, tm.role
    FROM tenants t
    JOIN tenant_members tm ON t.id = tm.tenant_id
    WHERE t.id = ${tenantId} AND tm.user_id = ${userId} AND t.status = 'active'
  `;

  if (!result) return null;

  return {
    tenantName: (result as any).tenant_name,
    role: (result as any).role,
  };
}
