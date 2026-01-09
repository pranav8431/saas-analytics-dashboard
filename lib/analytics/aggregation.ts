import { sql } from '@/lib/db';
import { insertAggregatedMetric } from '@/lib/db/queries';
import type { AggregationPeriod } from '@/lib/db/types';

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  count: number;
}

export interface AggregationOptions {
  tenantId: string;
  eventType: string;
  startDate: Date;
  endDate: Date;
  period: AggregationPeriod;
}

async function aggregateByHour(tenantId: string, eventType: string, startDate: Date, endDate: Date) {
  return sql`
    SELECT
      date_trunc('hour', event_timestamp) as period_start,
      COUNT(*) as count_events,
      AVG(metric_value) as avg_value
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
      AND event_type = ${eventType}
      AND event_timestamp >= ${startDate.toISOString()}
      AND event_timestamp <= ${endDate.toISOString()}
    GROUP BY date_trunc('hour', event_timestamp)
    ORDER BY period_start ASC
  `;
}

async function aggregateByDay(tenantId: string, eventType: string, startDate: Date, endDate: Date) {
  return sql`
    SELECT
      date_trunc('day', event_timestamp) as period_start,
      COUNT(*) as count_events,
      AVG(metric_value) as avg_value
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
      AND event_type = ${eventType}
      AND event_timestamp >= ${startDate.toISOString()}
      AND event_timestamp <= ${endDate.toISOString()}
    GROUP BY date_trunc('day', event_timestamp)
    ORDER BY period_start ASC
  `;
}

async function aggregateByWeek(tenantId: string, eventType: string, startDate: Date, endDate: Date) {
  return sql`
    SELECT
      date_trunc('week', event_timestamp) as period_start,
      COUNT(*) as count_events,
      AVG(metric_value) as avg_value
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
      AND event_type = ${eventType}
      AND event_timestamp >= ${startDate.toISOString()}
      AND event_timestamp <= ${endDate.toISOString()}
    GROUP BY date_trunc('week', event_timestamp)
    ORDER BY period_start ASC
  `;
}

async function aggregateByMonth(tenantId: string, eventType: string, startDate: Date, endDate: Date) {
  return sql`
    SELECT
      date_trunc('month', event_timestamp) as period_start,
      COUNT(*) as count_events,
      AVG(metric_value) as avg_value
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
      AND event_type = ${eventType}
      AND event_timestamp >= ${startDate.toISOString()}
      AND event_timestamp <= ${endDate.toISOString()}
    GROUP BY date_trunc('month', event_timestamp)
    ORDER BY period_start ASC
  `;
}

export async function aggregateMetrics(options: AggregationOptions): Promise<TimeSeriesDataPoint[]> {
  const { tenantId, eventType, startDate, endDate, period } = options;

  let results;
  switch (period) {
    case 'hour':
      results = await aggregateByHour(tenantId, eventType, startDate, endDate);
      break;
    case 'day':
      results = await aggregateByDay(tenantId, eventType, startDate, endDate);
      break;
    case 'week':
      results = await aggregateByWeek(tenantId, eventType, startDate, endDate);
      break;
    case 'month':
      results = await aggregateByMonth(tenantId, eventType, startDate, endDate);
      break;
    default:
      results = await aggregateByDay(tenantId, eventType, startDate, endDate);
  }

  return results.map((r: any) => ({
    timestamp: new Date(r.period_start),
    value: parseFloat(r.avg_value) || 0,
    count: parseInt(r.count_events) || 0,
  }));
}

async function computeAggregationByHour(tenantId: string, eventType: string, startDate: Date, endDate: Date) {
  return sql`
    SELECT
      date_trunc('hour', event_timestamp) as period_start,
      date_trunc('hour', event_timestamp) + interval '1 hour' as period_end,
      COUNT(*) as count_events,
      SUM(metric_value) as sum_value,
      AVG(metric_value) as avg_value,
      MIN(metric_value) as min_value,
      MAX(metric_value) as max_value,
      STDDEV(metric_value) as stddev_value
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
      AND event_type = ${eventType}
      AND event_timestamp >= ${startDate.toISOString()}
      AND event_timestamp <= ${endDate.toISOString()}
    GROUP BY date_trunc('hour', event_timestamp)
  `;
}

async function computeAggregationByDay(tenantId: string, eventType: string, startDate: Date, endDate: Date) {
  return sql`
    SELECT
      date_trunc('day', event_timestamp) as period_start,
      date_trunc('day', event_timestamp) + interval '1 day' as period_end,
      COUNT(*) as count_events,
      SUM(metric_value) as sum_value,
      AVG(metric_value) as avg_value,
      MIN(metric_value) as min_value,
      MAX(metric_value) as max_value,
      STDDEV(metric_value) as stddev_value
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
      AND event_type = ${eventType}
      AND event_timestamp >= ${startDate.toISOString()}
      AND event_timestamp <= ${endDate.toISOString()}
    GROUP BY date_trunc('day', event_timestamp)
  `;
}

export async function computeAndStoreAggregations(
  tenantId: string,
  eventType: string,
  period: AggregationPeriod,
  startDate: Date,
  endDate: Date
): Promise<void> {
  let results;
  switch (period) {
    case 'hour':
      results = await computeAggregationByHour(tenantId, eventType, startDate, endDate);
      break;
    case 'day':
    default:
      results = await computeAggregationByDay(tenantId, eventType, startDate, endDate);
      break;
  }

  for (const row of results as any[]) {
    await insertAggregatedMetric({
      tenant_id: tenantId,
      event_type: eventType,
      aggregation_period: period,
      period_start: new Date(row.period_start),
      period_end: new Date(row.period_end),
      count_events: parseInt(row.count_events) || 0,
      sum_value: row.sum_value ? parseFloat(row.sum_value) : null,
      avg_value: row.avg_value ? parseFloat(row.avg_value) : null,
      min_value: row.min_value ? parseFloat(row.min_value) : null,
      max_value: row.max_value ? parseFloat(row.max_value) : null,
      stddev_value: row.stddev_value ? parseFloat(row.stddev_value) : null,
      dimensions: {},
    });
  }
}

export interface EventTypeStats {
  eventType: string;
  totalEvents: number;
  uniqueDates: number;
  avgValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  firstEventDate: Date | null;
  lastEventDate: Date | null;
}

export async function getEventTypeStats(tenantId: string): Promise<EventTypeStats[]> {
  const results = await sql`
    SELECT
      event_type,
      COUNT(*) as total_events,
      COUNT(DISTINCT DATE(event_timestamp)) as unique_dates,
      AVG(metric_value) as avg_value,
      MIN(metric_value) as min_value,
      MAX(metric_value) as max_value,
      MIN(event_timestamp) as first_event_date,
      MAX(event_timestamp) as last_event_date
    FROM analytics_events
    WHERE tenant_id = ${tenantId}
    GROUP BY event_type
    ORDER BY total_events DESC
  `;

  return results.map((r: any) => ({
    eventType: r.event_type,
    totalEvents: parseInt(r.total_events) || 0,
    uniqueDates: parseInt(r.unique_dates) || 0,
    avgValue: r.avg_value ? parseFloat(r.avg_value) : null,
    minValue: r.min_value ? parseFloat(r.min_value) : null,
    maxValue: r.max_value ? parseFloat(r.max_value) : null,
    firstEventDate: r.first_event_date ? new Date(r.first_event_date) : null,
    lastEventDate: r.last_event_date ? new Date(r.last_event_date) : null,
  }));
}

export async function getRecentMetrics(
  tenantId: string,
  eventType: string,
  hours: number = 24
): Promise<TimeSeriesDataPoint[]> {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  return aggregateMetrics({
    tenantId,
    eventType,
    startDate,
    endDate: new Date(),
    period: hours <= 24 ? 'hour' : 'day',
  });
}
