'use client';

import { useState } from 'react';
import { uploadCSVAction } from '@/actions/upload';

interface UploadFormProps {
  tenantId: string;
  onSuccess?: () => void;
}

// Sample CSV content matching the required schema
const SAMPLE_CSV_CONTENT = `timestamp,event_type,value,user_id,region
2026-01-09T08:00:00.000Z,page_view,1,user_001,us-east
2026-01-09T08:15:00.000Z,page_view,1,user_002,eu-west
2026-01-09T08:30:00.000Z,signup,100,user_003,us-west
2026-01-09T08:45:00.000Z,page_view,1,user_004,us-east
2026-01-09T09:00:00.000Z,purchase,250,user_001,us-east
2026-01-09T09:15:00.000Z,page_view,1,user_005,eu-west
2026-01-09T09:30:00.000Z,purchase,150,user_002,eu-west
2026-01-09T09:45:00.000Z,page_view,1,user_006,us-west
2026-01-09T10:00:00.000Z,page_view,1,user_007,us-east
2026-01-09T10:15:00.000Z,signup,100,user_008,eu-west
2026-01-09T10:30:00.000Z,page_view,1,user_009,us-west
2026-01-09T10:45:00.000Z,purchase,300,user_004,us-east
2026-01-09T11:00:00.000Z,page_view,1,user_002,eu-west
2026-01-09T11:15:00.000Z,page_view,1,user_003,us-west
2026-01-09T11:30:00.000Z,purchase,175,user_005,eu-west
2026-01-09T11:45:00.000Z,page_view,1,user_006,us-west
2026-01-09T12:00:00.000Z,page_view,1,user_001,us-east
2026-01-09T12:15:00.000Z,signup,100,user_010,us-east
2026-01-09T12:30:00.000Z,page_view,1,user_008,eu-west
2026-01-09T12:45:00.000Z,purchase,200,user_009,us-west
2026-01-09T13:00:00.000Z,page_view,1,user_004,us-east
2026-01-09T13:15:00.000Z,page_view,1,user_005,eu-west
2026-01-09T13:30:00.000Z,purchase,450,user_006,us-west
2026-01-09T13:45:00.000Z,page_view,1,user_001,us-east
2026-01-09T14:00:00.000Z,page_view,1,user_002,eu-west`;

export function UploadForm({ tenantId, onSuccess }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Downloads a sample CSV file (client-side, no auth required)
  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-analytics.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadCSVAction(tenantId, formData);

      if (result.success) {
        setSuccess(`File uploaded successfully! Processed ${result.rowCount} rows.`);
        setFile(null);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        if (onSuccess) {
          setTimeout(onSuccess, 1000);
        }
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV Data</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="file-upload"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select CSV File
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError('');
              setSuccess('');
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            CSV files up to 10MB. Required columns: <code className="bg-gray-100 px-1 rounded">timestamp</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">event_type</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">value</code>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm whitespace-pre-wrap">
            <p className="font-medium mb-1">❌ Upload Failed</p>
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
            <p className="font-medium">✅ {success}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!file || loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>

        {/* Sample CSV download - works without authentication */}
        <button
          type="button"
          onClick={handleDownloadSample}
          className="w-full text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          📥 Download Sample CSV
        </button>
      </form>
    </div>
  );
}
