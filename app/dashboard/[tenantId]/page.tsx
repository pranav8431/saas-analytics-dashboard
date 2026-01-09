'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { TimeSeriesChart } from '@/components/ui/chart';
import { UploadForm } from '@/components/dashboard/upload-form';
import { AnomalyList } from '@/components/dashboard/anomaly-list';
import {
  getEventTypesAction,
  getTimeSeriesDataAction,
  getAnomaliesAction,
  detectAnomaliesAction,
  getEventStatsAction,
  getFilesAction,
  getTenantInfoAction,
  getDashboardSummaryAction,
} from '@/actions/analytics';
import { format, subDays } from 'date-fns';

export default function TenantDashboard() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [period, setPeriod] = useState<'hour' | 'day'>('hour');
  const [dateRange, setDateRange] = useState(7);
  const [chartData, setChartData] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tenant info for header
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Dashboard summary stats
  const [summary, setSummary] = useState({
    totalEvents: 0,
    distinctEventTypes: 0,
    lastUploadAt: null as string | null,
  });

  const loadInitialData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [eventsResult, statsResult, filesResult, tenantInfoResult, summaryResult] = await Promise.all([
        getEventTypesAction(tenantId),
        getEventStatsAction(tenantId),
        getFilesAction(tenantId),
        getTenantInfoAction(tenantId),
        getDashboardSummaryAction(tenantId),
      ]);

      if (eventsResult.success && eventsResult.eventTypes.length > 0) {
        setEventTypes(eventsResult.eventTypes);
        setSelectedEvent(eventsResult.eventTypes[0]);
      }

      if (statsResult.success) {
        setStats(statsResult.stats);
      }

      if (filesResult.success) {
        setFiles(filesResult.files);
      }

      if (tenantInfoResult.success) {
        setTenantName(tenantInfoResult.tenantName);
        setUserRole(tenantInfoResult.role);
      } else {
        setError('Unable to load tenant information. Please check your permissions.');
      }

      if (summaryResult.success) {
        setSummary({
          totalEvents: summaryResult.totalEvents,
          distinctEventTypes: summaryResult.distinctEventTypes,
          lastUploadAt: summaryResult.lastUploadAt,
        });
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadChartData = useCallback(async () => {
    if (!selectedEvent || !tenantId) return;

    try {
      const endDate = new Date();
      const startDate = subDays(endDate, dateRange);

      const result = await getTimeSeriesDataAction(
        tenantId,
        selectedEvent,
        startDate.toISOString(),
        endDate.toISOString(),
        period
      );

      if (result.success) {
        setChartData(result.data);
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  }, [tenantId, selectedEvent, dateRange, period]);

  const loadAnomalies = useCallback(async () => {
    if (!tenantId) return;
    try {
      const result = await getAnomaliesAction(tenantId, selectedEvent, false);
      if (result.success) {
        setAnomalies(result.anomalies);
      }
    } catch (error) {
      console.error('Error loading anomalies:', error);
    }
  }, [tenantId, selectedEvent]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedEvent) {
      loadChartData();
      loadAnomalies();
    }
  }, [selectedEvent, period, dateRange, loadChartData, loadAnomalies]);

  const handleDetectAnomalies = async () => {
    if (!selectedEvent || !tenantId) return;

    setDetecting(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, dateRange);

      await detectAnomaliesAction(
        tenantId,
        selectedEvent,
        startDate.toISOString(),
        endDate.toISOString(),
        period
      );

      await loadAnomalies();
    } catch (error) {
      console.error('Error detecting anomalies:', error);
    } finally {
      setDetecting(false);
    }
  };

  const handleUploadSuccess = () => {
    loadInitialData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-red-200 max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadInitialData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-xl font-bold text-blue-600">
                AnalyticsSaaS
              </Link>
              <span className="text-gray-400">|</span>
              {/* Tenant visibility: Organization name and user role */}
              {tenantName && userRole && (
                <span className="text-sm text-gray-600">
                  <span className="text-gray-500">Organization:</span>{' '}
                  <span className="font-medium text-gray-900">{tenantName}</span>
                  <span className="mx-2 text-gray-400">·</span>
                  <span className="text-gray-500">Role:</span>{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {userRole}
                  </span>
                </span>
              )}
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Monitor metrics and detect anomalies in real-time
          </p>
        </div>

        {/* Tenant-Scoped Data Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 Tenant Data Summary
            <span className="text-xs font-normal text-gray-500 ml-2">(scoped to current organization)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Total Events Ingested</p>
              <p className="text-2xl font-bold text-blue-600">
                {summary.totalEvents > 0 ? summary.totalEvents.toLocaleString() : '—'}
              </p>
              {summary.totalEvents === 0 && (
                <p className="text-xs text-gray-500 mt-1">No data uploaded yet</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Distinct Event Types</p>
              <p className="text-2xl font-bold text-indigo-600">
                {summary.distinctEventTypes > 0 ? summary.distinctEventTypes : '—'}
              </p>
              {summary.distinctEventTypes === 0 && (
                <p className="text-xs text-gray-500 mt-1">Upload CSV to see types</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Last CSV Upload</p>
              <p className="text-lg font-semibold text-gray-800">
                {summary.lastUploadAt
                  ? format(new Date(summary.lastUploadAt), 'MMM dd, yyyy HH:mm')
                  : '—'}
              </p>
              {!summary.lastUploadAt && (
                <p className="text-xs text-gray-500 mt-1">No uploads yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {stats.slice(0, 3).map((stat, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600 mb-1">{stat.eventType}</h3>
              <p className="text-3xl font-bold text-gray-900">{stat.totalEvents.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Total Events</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            {eventTypes.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No data found
                </h3>
                <p className="text-gray-600 mb-4">
                  Upload a CSV file to get started with analytics, or adjust your filters.
                </p>
                <p className="text-sm text-gray-500">
                  Required columns: <code className="bg-gray-100 px-1 rounded">timestamp</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">event_type</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">value</code>
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Type
                      </label>
                      <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      >
                        {eventTypes.map((type) => (
                          <option key={type} value={type} className="bg-white text-gray-900 py-2">
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Period
                      </label>
                      <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as 'hour' | 'day')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      >
                        <option value="hour" className="bg-white text-gray-900">Hourly</option>
                        <option value="day" className="bg-white text-gray-900">Daily</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Range
                      </label>
                      <select
                        value={dateRange}
                        onChange={(e) => setDateRange(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      >
                        <option value={1} className="bg-white text-gray-900">Last 24 hours</option>
                        <option value={7} className="bg-white text-gray-900">Last 7 days</option>
                        <option value={30} className="bg-white text-gray-900">Last 30 days</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={handleDetectAnomalies}
                        disabled={detecting}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {detecting ? 'Detecting...' : 'Detect Anomalies'}
                      </button>
                    </div>
                  </div>
                </div>

                <TimeSeriesChart
                  data={chartData}
                  title="Metric Trend"
                  type="area"
                  color="#3b82f6"
                />

                <AnomalyList
                  anomalies={anomalies}
                  tenantId={tenantId}
                  canAcknowledge={true}
                  onAcknowledge={loadAnomalies}
                />
              </>
            )}
          </div>

          <div className="space-y-6">
            <UploadForm tenantId={tenantId} onSuccess={handleUploadSuccess} />

            {files.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Uploads</h3>
                <div className="space-y-2">
                  {files.slice(0, 5).map((file) => (
                    <div key={file.id} className="text-sm border-b pb-2 last:border-b-0">
                      <p className="font-medium text-gray-900 truncate">{file.filename}</p>
                      <p className="text-gray-600">{file.row_count} rows</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(file.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
