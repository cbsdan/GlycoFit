import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Bar } from 'react-chartjs-2';
import adminService from '../services/adminService';
import '../config/chartSetup';

const COMPONENT_LABELS = {
  initial_assessment: 'Diabetes Assessment',
  food: 'Diet',
  sleep: 'Sleep',
  steps: 'Physical Activity',
  smoking: 'Smoking',
  alcohol: 'Alcohol',
  bmi: 'BMI',
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
  const [summaryOpen, setSummaryOpen] = useState(false);

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
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <MonitorHeartIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#8b5cf6' }} />
              Risk Component Averages
            </Typography>
            <Tooltip title="View Summary">
              <IconButton size="small" onClick={() => setSummaryOpen(true)}>
                <InfoOutlinedIcon fontSize="small" sx={{ color: '#9ca3af' }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Average risk scores per health category (diet, sleep, activity, etc.) across all users. Identifies which lifestyle factor contributes most to risk.
          </Typography>
        </Box>
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

      {/* Component Averages Summary Dialog */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>🧠 Risk Component Averages — Summary</DialogTitle>
        <DialogContent dividers>
          {keys.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No assessment data available.</Typography>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Based on <strong>{data?.total_assessed || 0}</strong> assessed users. Components ranked by average risk score (highest first):
              </Typography>
              {[...keys].sort((a, b) => components[b] - components[a]).map((k, i) => {
                const score = components[k];
                const label = COMPONENT_LABELS[k] || k;
                const color = COMPONENT_COLORS[keys.indexOf(k) % COMPONENT_COLORS.length];
                return (
                  <Box key={k} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 24, textAlign: 'center', flexShrink: 0 }}>#{i + 1}</Typography>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{score} / 100</Typography>
                  </Box>
                );
              })}
              {highestLabel && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fef2f2', borderRadius: 2 }}>
                  <Typography variant="body2" color="error" fontWeight={600}>
                    ⚠ Highest-risk area: {highestLabel} — targeted interventions are recommended for users in this category.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
