'use server';

import { getTenantAuthContext, requireTenantAuth } from '@/lib/auth/context';
import { canAcknowledgeAnomalies } from '@/lib/auth/permissions';
import {
  getEventTypes,
  getAnomalies,
  acknowledgeAnomaly as dbAcknowledgeAnomaly,
  getUploadedFiles,
  getTenantDashboardSummary,
  getTenantWithRole,
} from '@/lib/db/queries';
import { aggregateMetrics, getEventTypeStats } from '@/lib/analytics/aggregation';
import { detectAnomalies } from '@/lib/analytics/anomaly-detection';
import type { AggregationPeriod } from '@/lib/db/types';

export async function getEventTypesAction(tenantId: string) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const eventTypes = await getEventTypes(tenantId);

    return {
      success: true,
      eventTypes,
    };
  } catch (error) {
    console.error('Error fetching event types:', error);
    return {
      success: false,
      error: 'Failed to fetch event types',
      eventTypes: [],
    };
  }
}

export async function getTimeSeriesDataAction(
  tenantId: string,
  eventType: string,
  startDate: string,
  endDate: string,
  period: AggregationPeriod
) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const data = await aggregateMetrics({
      tenantId,
      eventType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      period,
    });

    return {
      success: true,
      data: data.map((d) => ({
        timestamp: d.timestamp.toISOString(),
        value: d.value,
        count: d.count,
      })),
    };
  } catch (error) {
    console.error('Error fetching time series data:', error);
    return {
      success: false,
      error: 'Failed to fetch analytics data',
      data: [],
    };
  }
}

export async function getEventStatsAction(tenantId: string) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const stats = await getEventTypeStats(tenantId);

    return {
      success: true,
      stats: stats.map((s) => ({
        ...s,
        firstEventDate: s.firstEventDate?.toISOString() || null,
        lastEventDate: s.lastEventDate?.toISOString() || null,
      })),
    };
  } catch (error) {
    console.error('Error fetching event stats:', error);
    return {
      success: false,
      error: 'Failed to fetch event statistics',
      stats: [],
    };
  }
}

export async function detectAnomaliesAction(
  tenantId: string,
  eventType: string,
  startDate: string,
  endDate: string,
  period: AggregationPeriod
) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const data = await aggregateMetrics({
      tenantId,
      eventType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      period,
    });

    await detectAnomalies(tenantId, eventType, data);

    return {
      success: true,
      message: 'Anomaly detection completed',
    };
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    return {
      success: false,
      error: 'Failed to detect anomalies',
    };
  }
}

export async function getAnomaliesAction(
  tenantId: string,
  eventType?: string,
  acknowledged = false
) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const anomalies = await getAnomalies(tenantId, eventType, undefined, acknowledged);

    return {
      success: true,
      anomalies: anomalies.map((a) => ({
        ...a,
        detected_at: a.detected_at.toISOString(),
        acknowledged_at: a.acknowledged_at?.toISOString() || null,
        created_at: a.created_at.toISOString(),
        threshold_used: a.threshold_used,
        metadata: a.metadata,
      })),
    };
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    return {
      success: false,
      error: 'Failed to fetch anomalies',
      anomalies: [],
    };
  }
}

export async function acknowledgeAnomalyAction(tenantId: string, anomalyId: string) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    if (!canAcknowledgeAnomalies(tenantAuth!.role)) {
      return {
        success: false,
        error: 'You do not have permission to acknowledge anomalies',
      };
    }

    await dbAcknowledgeAnomaly(anomalyId, tenantAuth!.userId);

    return {
      success: true,
      message: 'Anomaly acknowledged',
    };
  } catch (error) {
    console.error('Error acknowledging anomaly:', error);
    return {
      success: false,
      error: 'Failed to acknowledge anomaly',
    };
  }
}

export async function getFilesAction(tenantId: string) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const files = await getUploadedFiles(tenantId);

    return {
      success: true,
      files: files.map((f) => ({
        ...f,
        created_at: f.created_at.toISOString(),
        processed_at: f.processed_at?.toISOString() || null,
      })),
    };
  } catch (error) {
    console.error('Error fetching files:', error);
    return {
      success: false,
      error: 'Failed to fetch files',
      files: [],
    };
  }
}

// Get tenant info with current user's role for header display
export async function getTenantInfoAction(tenantId: string) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const tenantInfo = await getTenantWithRole(tenantId, tenantAuth!.userId);

    if (!tenantInfo) {
      return {
        success: false,
        error: 'Tenant not found',
        tenantName: null,
        role: null,
      };
    }

    return {
      success: true,
      tenantName: tenantInfo.tenantName,
      role: tenantInfo.role,
    };
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    return {
      success: false,
      error: 'Failed to fetch tenant info',
      tenantName: null,
      role: null,
    };
  }
}

// Get tenant-scoped dashboard summary
export async function getDashboardSummaryAction(tenantId: string) {
  try {
    const tenantAuth = await getTenantAuthContext(tenantId);
    requireTenantAuth(tenantAuth);

    const summary = await getTenantDashboardSummary(tenantId);

    return {
      success: true,
      totalEvents: summary.totalEvents,
      distinctEventTypes: summary.distinctEventTypes,
      lastUploadAt: summary.lastUploadAt?.toISOString() || null,
    };
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return {
      success: false,
      error: 'Failed to fetch summary',
      totalEvents: 0,
      distinctEventTypes: 0,
      lastUploadAt: null,
    };
  }
}
