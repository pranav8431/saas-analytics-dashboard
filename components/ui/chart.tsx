'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface TimeSeriesChartProps {
  data: Array<{ timestamp: string; value: number; count: number }>;
  title?: string;
  type?: 'line' | 'area' | 'bar';
  color?: string;
}

export function TimeSeriesChart({
  data,
  title,
  type = 'area',
  color = '#3b82f6',
}: TimeSeriesChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    date: format(new Date(d.timestamp), 'MMM dd, HH:mm'),
  }));

  const ChartComponent = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;
  const DataComponent = type === 'line' ? Line : type === 'bar' ? Bar : Area;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

      {formattedData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ChartComponent data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <DataComponent
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={type === 'area' ? 0.3 : 1}
              name="Metric Value"
            />
          </ChartComponent>
        </ResponsiveContainer>
      )}
    </div>
  );
}
