import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { Bar } from 'react-chartjs-2';
import adminService from '../services/adminService';
import '../config/chartSetup';

const COMPONENT_LABELS = {
  diet: 'Diet',
  sleep: 'Sleep',
  steps: 'Physical Activity',
  smoking: 'Smoking',
  alcohol: 'Alcohol',
  diabetes_assessment: 'Diabetes Assessment',
  health_metrics: 'Health Metrics',
};

const COMPONENT_COLORS = [
  '#667eea',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export default function RiskComponentsChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await adminService.getRiskComponentAverages();
        setData(result);
      } catch (e) {
        console.error('RiskComponentsChart error:', e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const components = data?.component_averages || {};
  const keys = Object.keys(components);
  const values = keys.map((k) => components[k]);

  const chartData = {
    labels: keys.map((k) => COMPONENT_LABELS[k] || k),
    datasets: [
      {
        label: 'Avg Risk Score',
        data: values,
        backgroundColor: keys.map((_, i) => COMPONENT_COLORS[i % COMPONENT_COLORS.length]),
        borderRadius: 5,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.x} / 100`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Avg Score (0–100)', font: { size: 10 } },
      },
      y: {
        ticks: { font: { size: 11 } },
      },
    },
  };

  const highestKey = data?.highest_risk_component;
  const highestLabel = highestKey ? (COMPONENT_LABELS[highestKey] || highestKey) : null;

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          <MonitorHeartIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#8b5cf6' }} />
          Risk Component Averages
        </Typography>
      </Box>

      {highestLabel && (
        <Box sx={{ mb: 2 }}>
          <Chip
            label={`Highest Risk: ${highestLabel}`}
            size="small"
            sx={{ bgcolor: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: '0.75rem' }}
          />
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
          <CircularProgress size={32} />
        </Box>
      ) : keys.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
          <Typography variant="body2" color="text.secondary">No assessment data available</Typography>
        </Box>
      ) : (
        <Box sx={{ height: 220 }}>
          <Bar data={chartData} options={chartOptions} />
        </Box>
      )}

      {data && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Based on {data.total_assessed || 0} assessed users
        </Typography>
      )}
    </Paper>
  );
}
