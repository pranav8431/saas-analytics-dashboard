'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { acknowledgeAnomalyAction } from '@/actions/analytics';

interface Anomaly {
  id: string;
  event_type: string;
  detected_at: string;
  anomaly_type: 'spike' | 'drop' | 'outlier';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric_value: number;
  expected_value: number | null;
  deviation_percentage: number | null;
  threshold_used: number | null;
  metadata: Record<string, unknown> | null;
  acknowledged: boolean;
}

// Generates human-readable explanation for anomaly detection
function getAnomalyExplanation(anomaly: Anomaly): string {
  const threshold = anomaly.threshold_used ?? 2.5;
  const baseline = anomaly.expected_value?.toFixed(2) ?? 'N/A';
  const observed = anomaly.metric_value.toFixed(2);
  const deviation = anomaly.deviation_percentage?.toFixed(1) ?? 'N/A';

  switch (anomaly.anomaly_type) {
    case 'spike':
      return `Spike detected: value exceeded mean + ${threshold}σ threshold. Baseline: ${baseline} | Observed: ${observed} (+${deviation}%)`;
    case 'drop':
      return `Drop detected: value fell below mean - ${threshold}σ threshold. Baseline: ${baseline} | Observed: ${observed} (-${deviation}%)`;
    case 'outlier':
      return `Outlier detected: value deviates significantly from expected range. Baseline: ${baseline} | Observed: ${observed} (±${deviation}%)`;
    default:
      return `Anomaly detected: unexpected value observed. Baseline: ${baseline} | Observed: ${observed}`;
  }
}

interface AnomalyListProps {
  anomalies: Anomaly[];
  tenantId: string;
  canAcknowledge: boolean;
  onAcknowledge?: () => void;
}

const severityColors = {
  low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  high: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-purple-100 text-purple-800 border-purple-200',
};

const typeIcons = {
  spike: '↑',
  drop: '↓',
  outlier: '⚠',
};

export function AnomalyList({
  anomalies,
  tenantId,
  canAcknowledge,
  onAcknowledge,
}: AnomalyListProps) {
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const handleAcknowledge = async (anomalyId: string) => {
    setAcknowledging(anomalyId);
    try {
      await acknowledgeAnomalyAction(tenantId, anomalyId);
      if (onAcknowledge) onAcknowledge();
    } catch (error) {
      console.error('Error acknowledging anomaly:', error);
    } finally {
      setAcknowledging(null);
    }
  };

  if (anomalies.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Anomalies</h3>
        <div className="text-center py-8">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-xl">✓</span>
          </div>
          <p className="text-gray-600 font-medium">No anomalies detected</p>
          <p className="text-sm text-gray-500 mt-1">
            All metrics are within expected thresholds. Click &quot;Detect Anomalies&quot; to run analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Detected Anomalies ({anomalies.length})
      </h3>

      <div className="space-y-3">
        {anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className={`border rounded-lg p-4 ${severityColors[anomaly.severity]}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{typeIcons[anomaly.anomaly_type]}</span>
                  <div>
                    <span className="font-semibold text-sm uppercase">
                      {anomaly.severity} {anomaly.anomaly_type}
                    </span>
                    <p className="text-sm">{anomaly.event_type}</p>
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Value:</span> {anomaly.metric_value.toFixed(2)}
                    {anomaly.expected_value && (
                      <span className="text-gray-600">
                        {' '}
                        (expected: {anomaly.expected_value.toFixed(2)})
                      </span>
                    )}
                  </p>
                  {anomaly.deviation_percentage && (
                    <p>
                      <span className="font-medium">Deviation:</span>{' '}
                      {anomaly.deviation_percentage.toFixed(1)}%
                    </p>
                  )}
                  {/* Anomaly explanation - statistical reasoning */}
                  <p className="mt-2 text-xs bg-white/50 rounded px-2 py-1 border border-current/20">
                    💡 {getAnomalyExplanation(anomaly)}
                  </p>
                  <p className="text-gray-600">
                    {format(new Date(anomaly.detected_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {canAcknowledge && !anomaly.acknowledged && (
                <button
                  onClick={() => handleAcknowledge(anomaly.id)}
                  disabled={acknowledging === anomaly.id}
                  className="ml-4 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {acknowledging === anomaly.id ? 'Acknowledging...' : 'Acknowledge'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
