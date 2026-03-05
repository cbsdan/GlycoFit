import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Line } from 'react-chartjs-2';
import adminService from '../services/adminService';
import '../config/chartSetup';

const PERIODS = [
  { label: 'Last 4 Weeks', days: 28 },
  { label: 'Last 12 Weeks', days: 84 },
  { label: 'Last 6 Months', days: 180 },
];

export default function RiskTrendChart() {
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(84);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - period);
        const result = await adminService.getRiskTrend({
          start: start.toISOString(),
          end: end.toISOString(),
        });
        setTrendData(result.trend || []);
      } catch (e) {
        console.error('RiskTrendChart error:', e);
        setTrendData([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  const chartData = {
    labels: trendData.map((d) => d.week || d.date || ''),
    datasets: [
      {
        label: 'Avg Risk Score',
        data: trendData.map((d) => d.avg_score),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ef4444',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Avg Score: ${ctx.parsed.y}`,
          afterLabel: (ctx) => {
            const point = trendData[ctx.dataIndex];
            return point ? `Assessments: ${point.assessments}` : '';
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Risk Score (0–100)', font: { size: 11 } },
      },
      x: {
        ticks: { maxRotation: 45, font: { size: 10 } },
      },
    },
  };

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#ef4444' }} />
          Risk Score Trend
        </Typography>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={period}
            label="Period"
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.days} value={p.days}>{p.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
          <CircularProgress size={32} />
        </Box>
      ) : trendData.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
          <Typography variant="body2" color="text.secondary">No trend data available</Typography>
        </Box>
      ) : (
        <Box sx={{ height: 220 }}>
          <Line data={chartData} options={chartOptions} />
        </Box>
      )}
    </Paper>
  );
}
