import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import { Bar } from 'react-chartjs-2';
import '../config/chartSetup';

const TIMEFRAMES = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 60 Days', days: 60 },
  { label: 'Last 90 Days', days: 90 },
];

export default function TopFoodsChart({ apiBase, getAuthHeaders }) {
  const [loading, setLoading] = useState(true);
  const [topFoods, setTopFoods] = useState([]);
  const [timeframe, setTimeframe] = useState(30);

  const fetchTopFoods = useCallback(async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - timeframe);

      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      const url = `${apiBase}/admin/meals/top-foods?start=${start.toISOString()}&end=${end.toISOString()}&limit=10`;
      
      const res = await fetch(url, { headers, method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch top foods');
      
      const data = await res.json();
      setTopFoods(data.top_foods || []);
    } catch (err) {
      console.error('Error fetching top foods:', err);
      setTopFoods([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, getAuthHeaders, timeframe]);

  useEffect(() => {
    fetchTopFoods();
  }, [fetchTopFoods]);

  const chartData = {
    labels: topFoods.map(f => f.food),
    datasets: [
      {
        label: 'Meal Count',
        data: topFoods.map(f => f.count),
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(118, 75, 162, 0.8)',
          'rgba(6, 182, 212, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(20, 184, 166, 0.8)',
        ],
        borderColor: [
          'rgba(102, 126, 234, 1)',
          'rgba(118, 75, 162, 1)',
          'rgba(6, 182, 212, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(236, 72, 153, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(20, 184, 166, 1)',
        ],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            return `Meals: ${context.parsed.y}`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: {
            size: 11,
          },
          stepSize: 1,
        },
      },
    },
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestaurantIcon sx={{ color: '#667eea' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Top Foods
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Timeframe</InputLabel>
          <Select
            value={timeframe}
            label="Timeframe"
            onChange={(e) => setTimeframe(e.target.value)}
          >
            {TIMEFRAMES.map((tf) => (
              <MenuItem key={tf.days} value={tf.days}>
                {tf.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
          <CircularProgress />
        </Box>
      ) : topFoods.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
          <Typography color="text.secondary">No meal data available</Typography>
        </Box>
      ) : (
        <Box sx={{ height: 320 }}>
          <Bar data={chartData} options={chartOptions} />
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
        Most common foods logged in the selected timeframe
      </Typography>
    </Paper>
  );
}
