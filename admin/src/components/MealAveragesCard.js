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
  Grid,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';

const TIMEFRAMES = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 60 Days', days: 60 },
  { label: 'Last 90 Days', days: 90 },
];

export default function MealAveragesCard({ apiBase, getAuthHeaders }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [timeframe, setTimeframe] = useState(30);
  const [openDialog, setOpenDialog] = useState(false);

  const fetchAverages = useCallback(async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - timeframe);

      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      const url = `${apiBase}/admin/meals/averages?start=${start.toISOString()}&end=${end.toISOString()}`;
      
      const res = await fetch(url, { headers, method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch meal averages');
      
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching meal averages:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, getAuthHeaders, timeframe]);

  useEffect(() => {
    fetchAverages();
  }, [fetchAverages]);

  if (loading) {
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
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  const overall = data?.overall || {};

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            transform: 'translateY(-4px)',
          },
        }}
        onClick={() => setOpenDialog(true)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: '#667eea' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Meal Averages
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 140 }} onClick={(e) => e.stopPropagation()}>
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

        <Grid container spacing={2}>
          <Grid item xs={12}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <RestaurantMenuIcon fontSize="small" />
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Average Daily Meals
                  </Typography>
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {overall.avg_daily_meals?.toFixed(1) || '0.0'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.5, display: 'block' }}>
                  {overall.total_meals || 0} total meals in {data?.timeframe?.days || 0} days
                </Typography>
              </Box>
          </Grid>

          <Grid item xs={12}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                  color: 'white',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocalFireDepartmentIcon fontSize="small" />
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Average Daily Calories
                  </Typography>
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {overall.avg_daily_calories?.toFixed(0) || '0'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.5, display: 'block' }}>
                  {overall.total_calories?.toLocaleString() || 0} total calories
                </Typography>
              </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <PeopleIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            Click to view per-user breakdown
          </Typography>
        </Box>
      </Paper>

      {/* Per-user breakdown dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Per-User Meal Averages
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {data?.timeframe?.days || 0} days period • {data?.per_user?.length || 0} active users
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {!data || data.per_user?.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No user data available for this timeframe</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Total Meals</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Avg Daily Meals</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Total Calories</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Avg Daily Calories</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.per_user.map((user, index) => (
                    <TableRow 
                      key={user.user_id} 
                      hover
                      sx={{ 
                        bgcolor: index < 3 ? 'rgba(102, 126, 234, 0.05)' : 'transparent' 
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.user_name}
                          {index === 0 && (
                            <Chip label="Top" size="small" color="primary" sx={{ height: 20 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{user.total_meals}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#667eea' }}>
                          {user.avg_daily_meals}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{user.total_calories.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#f59e0b' }}>
                          {user.avg_daily_calories.toFixed(0)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
