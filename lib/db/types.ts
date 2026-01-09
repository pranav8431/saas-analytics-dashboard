export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type TenantStatus = 'active' | 'suspended' | 'deleted';

export type UploadStatus = 'processing' | 'completed' | 'failed';

export type AnomalyType = 'spike' | 'drop' | 'outlier';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AggregationPeriod = 'hour' | 'day' | 'week' | 'month';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
  settings: Record<string, unknown>;
  status: TenantStatus;
}

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: UserRole;
  joined_at: Date;
  invited_by: string | null;
}

export interface TenantMemberWithDetails extends TenantMember {
  tenant_name: string;
  user_email: string;
  user_first_name: string | null;
  user_last_name: string | null;
}

export interface UploadedFile {
  id: string;
  tenant_id: string;
  uploaded_by: string;
  filename: string;
  file_size_bytes: number;
  row_count: number;
  columns: string[];
  schema_inferred: Record<string, string> | null;
  upload_status: UploadStatus;
  error_message: string | null;
  created_at: Date;
  processed_at: Date | null;
}

export interface AnalyticsEvent {
  id: string;
  tenant_id: string;
  file_id: string | null;
  event_type: string;
  event_timestamp: Date;
  metric_value: number | null;
  dimensions: Record<string, unknown>;
  raw_data: Record<string, unknown> | null;
  created_at: Date;
}

export interface AggregatedMetric {
  id: string;
  tenant_id: string;
  event_type: string;
  aggregation_period: AggregationPeriod;
  period_start: Date;
  period_end: Date;
  count_events: number;
  sum_value: number | null;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  stddev_value: number | null;
  dimensions: Record<string, unknown>;
  computed_at: Date;
}

export interface AnomalyResult {
  id: string;
  tenant_id: string;
  event_type: string;
  detected_at: Date;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  metric_value: number;
  expected_value: number | null;
  deviation_percentage: number | null;
  threshold_used: number | null;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  created_at: Date;
}
