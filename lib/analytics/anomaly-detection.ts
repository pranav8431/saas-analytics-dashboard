import { insertAnomalyResult } from '@/lib/db/queries';
import type { AnomalyType, AnomalySeverity } from '@/lib/db/types';
import type { TimeSeriesDataPoint } from './aggregation';

export interface AnomalyDetectionConfig {
  sensitivityLevel: number;
  minDataPoints: number;
  stddevThreshold: number;
}

const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  sensitivityLevel: parseInt(process.env.ANOMALY_DETECTION_SENSITIVITY || '3'),
  minDataPoints: 10,
  stddevThreshold: 2.5,
};

interface Statistics {
  mean: number;
  stddev: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
}

function calculateStatistics(values: number[]): Statistics {
  if (values.length === 0) {
    return { mean: 0, stddev: 0, median: 0, q1: 0, q3: 0, iqr: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stddev = Math.sqrt(variance);

  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return { mean, stddev, median, q1, q3, iqr };
}

function getSeverity(deviationPercentage: number, sensitivityLevel: number): AnomalySeverity {
  const adjustedThreshold = 100 / sensitivityLevel;

  if (deviationPercentage >= adjustedThreshold * 3) return 'critical';
  if (deviationPercentage >= adjustedThreshold * 2) return 'high';
  if (deviationPercentage >= adjustedThreshold) return 'medium';
  return 'low';
}

function detectOutliers(
  data: TimeSeriesDataPoint[],
  config: AnomalyDetectionConfig
): Array<{ dataPoint: TimeSeriesDataPoint; anomalyType: AnomalyType; severity: AnomalySeverity; expectedValue: number; deviationPercentage: number }> {
  const anomalies: Array<{ dataPoint: TimeSeriesDataPoint; anomalyType: AnomalyType; severity: AnomalySeverity; expectedValue: number; deviationPercentage: number }> = [];

  if (data.length < config.minDataPoints) {
    return anomalies;
  }

  const values = data.map((d) => d.value);
  const stats = calculateStatistics(values);

  if (stats.stddev === 0) {
    return anomalies;
  }

  const upperBound = stats.mean + config.stddevThreshold * stats.stddev;
  const lowerBound = stats.mean - config.stddevThreshold * stats.stddev;

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const value = point.value;

    if (value > upperBound) {
      const deviationPercentage = ((value - stats.mean) / stats.mean) * 100;
      const severity = getSeverity(deviationPercentage, config.sensitivityLevel);

      anomalies.push({
        dataPoint: point,
        anomalyType: 'spike',
        severity,
        expectedValue: stats.mean,
        deviationPercentage: Math.abs(deviationPercentage),
      });
    } else if (value < lowerBound && lowerBound > 0) {
      const deviationPercentage = ((stats.mean - value) / stats.mean) * 100;
      const severity = getSeverity(deviationPercentage, config.sensitivityLevel);

      anomalies.push({
        dataPoint: point,
        anomalyType: 'drop',
        severity,
        expectedValue: stats.mean,
        deviationPercentage: Math.abs(deviationPercentage),
      });
    }
  }

  return anomalies;
}

function detectTrendAnomalies(
  data: TimeSeriesDataPoint[],
  config: AnomalyDetectionConfig
): Array<{ dataPoint: TimeSeriesDataPoint; anomalyType: AnomalyType; severity: AnomalySeverity; expectedValue: number; deviationPercentage: number }> {
  const anomalies: Array<{ dataPoint: TimeSeriesDataPoint; anomalyType: AnomalyType; severity: AnomalySeverity; expectedValue: number; deviationPercentage: number }> = [];

  if (data.length < config.minDataPoints + 2) {
    return anomalies;
  }

  for (let i = 2; i < data.length; i++) {
    const current = data[i].value;
    const prev1 = data[i - 1].value;
    const prev2 = data[i - 2].value;

    const avgPrev = (prev1 + prev2) / 2;

    if (avgPrev === 0) continue;

    const changePercentage = ((current - avgPrev) / avgPrev) * 100;

    const threshold = 50 / config.sensitivityLevel;

    if (Math.abs(changePercentage) > threshold) {
      const anomalyType: AnomalyType = changePercentage > 0 ? 'spike' : 'drop';
      const severity = getSeverity(Math.abs(changePercentage), config.sensitivityLevel);

      anomalies.push({
        dataPoint: data[i],
        anomalyType,
        severity,
        expectedValue: avgPrev,
        deviationPercentage: Math.abs(changePercentage),
      });
    }
  }

  return anomalies;
}

export async function detectAnomalies(
  tenantId: string,
  eventType: string,
  data: TimeSeriesDataPoint[],
  config: Partial<AnomalyDetectionConfig> = {}
): Promise<void> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (data.length < fullConfig.minDataPoints) {
    return;
  }

  const outlierAnomalies = detectOutliers(data, fullConfig);
  const trendAnomalies = detectTrendAnomalies(data, fullConfig);

  const allAnomalies = [...outlierAnomalies, ...trendAnomalies];

  const uniqueAnomalies = Array.from(
    new Map(allAnomalies.map((a) => [a.dataPoint.timestamp.toISOString(), a])).values()
  );

  for (const anomaly of uniqueAnomalies) {
    await insertAnomalyResult({
      tenant_id: tenantId,
      event_type: eventType,
      detected_at: anomaly.dataPoint.timestamp,
      anomaly_type: anomaly.anomalyType,
      severity: anomaly.severity,
      metric_value: anomaly.dataPoint.value,
      expected_value: anomaly.expectedValue,
      deviation_percentage: anomaly.deviationPercentage,
      threshold_used: fullConfig.stddevThreshold,
      metadata: {
        count: anomaly.dataPoint.count,
        detection_method: 'statistical',
        sensitivity_level: fullConfig.sensitivityLevel,
      },
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });
  }
}

export function analyzeAnomalies(anomalies: Array<{ timestamp: Date; severity: AnomalySeverity; anomalyType: AnomalyType }>): {
  totalAnomalies: number;
  criticalCount: number;
  highCount: number;
  spikesCount: number;
  dropsCount: number;
  recentAnomalies: number;
} {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    totalAnomalies: anomalies.length,
    criticalCount: anomalies.filter((a) => a.severity === 'critical').length,
    highCount: anomalies.filter((a) => a.severity === 'high').length,
    spikesCount: anomalies.filter((a) => a.anomalyType === 'spike').length,
    dropsCount: anomalies.filter((a) => a.anomalyType === 'drop').length,
    recentAnomalies: anomalies.filter((a) => a.timestamp >= last24Hours).length,
  };
}
