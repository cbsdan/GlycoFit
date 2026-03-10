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
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
  const [summaryOpen, setSummaryOpen] = useState(false);

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#ef4444' }} />
              Risk Score Trend
            </Typography>
            <Tooltip title="View Summary">
              <IconButton size="small" onClick={() => setSummaryOpen(true)}>
                <InfoOutlinedIcon fontSize="small" sx={{ color: '#9ca3af' }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Average diabetes risk score across all assessed users over time. Higher scores indicate greater overall risk.
          </Typography>
        </Box>
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

      {/* Trend Summary Dialog */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>📊 Risk Score Trend — Summary</DialogTitle>
        <DialogContent dividers>
          {trendData.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No trend data available for the selected period.</Typography>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Showing <strong>{trendData.length}</strong> data point{trendData.length > 1 ? 's' : ''} over the selected period.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                {[
                  { label: 'Latest Score', value: trendData[trendData.length - 1].avg_score, color: '#ef4444' },
                  { label: 'Peak Score', value: Math.max(...trendData.map(d => d.avg_score)), color: '#f59e0b' },
                  { label: 'Lowest Score', value: Math.min(...trendData.map(d => d.avg_score)), color: '#10b981' },
                ].map(({ label, value, color }) => (
                  <Box key={label} sx={{ textAlign: 'center', p: 1.5, bgcolor: color + '15', borderRadius: 2, flex: 1, minWidth: 80 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Box>
                ))}
              </Box>
              {(() => {
                const first = trendData[0].avg_score;
                const last = trendData[trendData.length - 1].avg_score;
                const diff = +(last - first).toFixed(1);
                const direction = diff > 2 ? '📈 Increasing' : diff < -2 ? '📉 Decreasing' : '→ Stable';
                const dirColor = diff > 2 ? '#ef4444' : diff < -2 ? '#10b981' : '#6b7280';
                return (
                  <Typography variant="body2" sx={{ color: dirColor, fontWeight: 600, mb: 1 }}>
                    Overall trend: {direction} ({diff > 0 ? '+' : ''}{diff} pts from start to latest)
                  </Typography>
                );
              })()}
              <Typography variant="caption" color="text.secondary">
                Total assessments in period: <strong>{trendData.reduce((s, d) => s + (d.assessments || 0), 0)}</strong>
              </Typography>
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
