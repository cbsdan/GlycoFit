import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Popover,
  IconButton,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import SummarizeIcon from '@mui/icons-material/Summarize';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

import { Pie, Line } from 'react-chartjs-2';
  import Avatar from '@mui/material/Avatar';
  import Stack from '@mui/material/Stack';
  import Chip from '@mui/material/Chip';
  import Divider from '@mui/material/Divider';
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale
);

const timeframeOptions = [7, 30, 90, 365];

export default function UsersStatsModal({ open, onClose, apiBase, getAuthHeaders, initialStats = {} }) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [registrationSeries, setRegistrationSeries] = useState([]);
  const [pieData, setPieData] = useState({ labels: ['Active', 'Temporarily Disabled'], datasets: [] });
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchAnalytics = async (d) => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - d + 1);

      const qs = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/admin/users/analytics${qs}`, { headers, method: 'GET' });
      if (!res.ok) {
        throw new Error('No analytics');
      }
      const data = await res.json();

      // Expecting data.registration = [{ date: '2026-01-01', count: 5 }, ...]
      if (data.registration && Array.isArray(data.registration)) {
        setRegistrationSeries(data.registration.map((r) => ({ x: r.date, y: r.count })));
      } else {
        setRegistrationSeries([]);
      }

      // Prefer temporary disabled count from backend when available
      const tempDisabled = typeof data.temporary_disabled_count === 'number' ? data.temporary_disabled_count : (typeof data.inactive_count === 'number' ? data.inactive_count : null);
      if (typeof data.active_count === 'number' && typeof tempDisabled === 'number') {
        setPieData({
          labels: ['Active', 'Temporarily Disabled'],
          datasets: [
            {
              data: [data.active_count, tempDisabled],
              backgroundColor: ['#06b6d4', '#f59e0b'],
            },
          ],
        });
      } else {
        // fallback to initialStats
        const active = initialStats.active_users || 0;
        const total = initialStats.total_users || 0;
        const inactive = Math.max(total - active, 0);
        setPieData({
          labels: ['Active', 'Temporarily Disabled'],
          datasets: [
            { data: [active, inactive], backgroundColor: ['#06b6d4', '#f59e0b'] },
          ],
        });
      }
    } catch (err) {
      // fallback: use initialStats
      const active = initialStats.active_users || 0;
      const total = initialStats.total_users || 0;
      const inactive = Math.max(total - active, 0);
      setPieData({
        labels: ['Active', 'Inactive'],
        datasets: [
          { data: [active, inactive], backgroundColor: ['#06b6d4', '#64748b'] },
        ],
      });

      // create simple registrationSeries from 0..days using initialStats if available
      const series = [];
      for (let i = d - 1; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        series.push({ x: day.toISOString(), y: 0 });
      }
      setRegistrationSeries(series);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      // use a large limit to attempt to fetch all users; backend supports `limit`
      const res = await fetch(`${apiBase}/admin/users?limit=10000`, { headers, method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      // backend returns { users: [...], total: N }
      setUsersList(data.users || []);
    } catch (err) {
      setUsersList([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAnalytics(days);
      fetchUsers();
    }
  }, [open, days]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [userMeals, setUserMeals] = useState([]);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleTotalClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleTotalClose = () => {
    setAnchorEl(null);
  };

  const openPopover = Boolean(anchorEl);

  const handleViewStats = async (user) => {
    setSelectedUser(user);
    setMealsLoading(true);
    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      // use admin route expecting user id
      const id = user.id || user.uid;
      const res = await fetch(`${apiBase}/admin/users/${id}/meals?limit=1000`, { headers, method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch meals');
      const data = await res.json();
      setUserMeals(data.meals || []);
    } catch (err) {
      setUserMeals([]);
    } finally {
      setMealsLoading(false);
    }
  };

  const closeUserDetail = () => {
    setSelectedUser(null);
    setAnchorEl(null);

    setUserMeals([]);
    setMealsLoading(false);
  };

  // Derived nutrition totals for selected user
  const nutritionTotals = userMeals.reduce(
    (acc, m) => {
      const n = m.nutrients || {};
      acc.calories += Number(n.Calories || 0);
      acc.protein += Number(n['Protein (g)'] || 0);
      acc.carbs += Number(n['Carbs (g)'] || 0);
      acc.fat += Number(n['Fat (g)'] || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const pieDataUser = {
    labels: ['Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)'],
    datasets: [
      {
        // Include calories as a slice as requested
        data: [nutritionTotals.calories, nutritionTotals.protein, nutritionTotals.carbs, nutritionTotals.fat],
        // Pastel color palette
        backgroundColor: ['#FCA5A5', '#93C5FD', '#FDE68A', '#A7F3D0'],
      },
    ],
  };

  const lineData = {
    datasets: [
      {
        label: 'New Registrations',
        data: registrationSeries,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102,126,234,0.12)',
        tension: 0.2,
        fill: true,
      },
    ],
  };

  const lineOptions = {
    scales: {
      x: { type: 'time', time: { unit: days <= 7 ? 'day' : 'day' } },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Users Overview</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">Timeframe</Typography>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="timeframe-label">Days</InputLabel>
            <Select
              labelId="timeframe-label"
              value={days}
              label="Days"
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {timeframeOptions.map((d) => (
                <MenuItem key={d} value={d}>{d} days</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 260 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Active vs Inactive</Typography>
                <Pie data={pieData} />
              </Box>

              <Box sx={{ flex: 2, minWidth: 300 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>New Registrations</Typography>
                <Line data={lineData} options={lineOptions} />
              </Box>
            </Box>
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Users</Typography>
              {loadingUsers ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
              ) : (
                <TableContainer component={Paper} sx={{ maxHeight: 360 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usersList.map((u) => (
                        <TableRow key={u.id || u.uid} hover>
                          <TableCell>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.role}</TableCell>
                          <TableCell>{u.is_disabled ? 'Disabled' : 'Active'}</TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="contained" onClick={() => handleViewStats(u)}>
                              View Stats
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onClose={closeUserDetail} fullWidth maxWidth="lg">
        <DialogTitle>{selectedUser ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email : 'User'}</DialogTitle>
        <DialogContent dividers>
          {mealsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
              {/* Left: Nutrition pie */}
              <Box sx={{ width: { xs: '100%', md: '35%' }, minWidth: 220 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1">Nutrition Summary</Typography>
                  <IconButton 
                    size="small" 
                    color="primary"
                    onMouseEnter={handleTotalClick}
                    onMouseLeave={handleTotalClose}
                    aria-describedby="nutrition-popover"
                    sx={{ 
                      bgcolor: 'primary.main', 
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      width: 32,
                      height: 32
                    }}
                  >
                    <SummarizeIcon fontSize="small" />
                  </IconButton>
                </Box>
                {userMeals.length === 0 ? (
                  <Typography color="text.secondary">No nutrition data available.</Typography>
                ) : (
                  <Box>
                    <Pie data={pieDataUser} />
                
                                  {/* Popover for nutrient totals */}
                                  <Popover
                                    id="nutrition-popover"
                                    open={openPopover}
                                    anchorEl={anchorEl}
                                    onClose={handleTotalClose}
                                    anchorOrigin={{
                                      vertical: 'bottom',
                                      horizontal: 'left',
                                    }}
                                    transformOrigin={{
                                      vertical: 'top',
                                      horizontal: 'left',
                                    }}
                                    disableRestoreFocus
                                    sx={{
                                      pointerEvents: 'none',
                                    }}
                                    PaperProps={{
                                      sx: {
                                        pointerEvents: 'auto',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                        borderRadius: 2,
                                      },
                                      onMouseEnter: handleTotalClick,
                                      onMouseLeave: handleTotalClose,
                                    }}
                                  >
                                    <Card sx={{ minWidth: 280 }}>
                                      <CardContent>
                                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                                          Total Nutrients
                                        </Typography>
                                        <Grid container spacing={2}>
                                          <Grid item xs={6}>
                                            <Box sx={{ 
                                              p: 1.5, 
                                              bgcolor: '#FCA5A5', 
                                              borderRadius: 1.5,
                                              textAlign: 'center'
                                            }}>
                                              <Typography variant="caption" sx={{ color: '#7f1d1d', fontWeight: 500 }}>
                                                Calories
                                              </Typography>
                                              <Typography variant="h6" sx={{ fontWeight: 700, color: '#991b1b' }}>
                                                {nutritionTotals.calories.toFixed(0)}
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={6}>
                                            <Box sx={{ 
                                              p: 1.5, 
                                              bgcolor: '#93C5FD', 
                                              borderRadius: 1.5,
                                              textAlign: 'center'
                                            }}>
                                              <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 500 }}>
                                                Protein
                                              </Typography>
                                              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e40af' }}>
                                                {nutritionTotals.protein.toFixed(1)}g
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={6}>
                                            <Box sx={{ 
                                              p: 1.5, 
                                              bgcolor: '#FDE68A', 
                                              borderRadius: 1.5,
                                              textAlign: 'center'
                                            }}>
                                              <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 500 }}>
                                                Carbs
                                              </Typography>
                                              <Typography variant="h6" sx={{ fontWeight: 700, color: '#92400e' }}>
                                                {nutritionTotals.carbs.toFixed(1)}g
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={6}>
                                            <Box sx={{ 
                                              p: 1.5, 
                                              bgcolor: '#A7F3D0', 
                                              borderRadius: 1.5,
                                              textAlign: 'center'
                                            }}>
                                              <Typography variant="caption" sx={{ color: '#064e3b', fontWeight: 500 }}>
                                                Fat
                                              </Typography>
                                              <Typography variant="h6" sx={{ fontWeight: 700, color: '#065f46' }}>
                                                {nutritionTotals.fat.toFixed(1)}g
                                              </Typography>
                                            </Box>
                                          </Grid>
                                        </Grid>
                                      </CardContent>
                                    </Card>
                                  </Popover>
                  </Box>
                )}
              </Box>

              {/* Right: Meals table */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Meals</Typography>
                {userMeals.length === 0 ? (
                  <Typography color="text.secondary">No meals found for this user.</Typography>
                ) : (
                  <TableContainer component={Paper} sx={{ maxHeight: 420 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Photo</TableCell>
                          <TableCell>Meal</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Datetime</TableCell>
                          <TableCell>Calories</TableCell>
                          <TableCell>Protein (g)</TableCell>
                          <TableCell>Carbs (g)</TableCell>
                          <TableCell>Fat (g)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {userMeals.map((m) => (
                          <TableRow key={m.id} hover>
                            <TableCell>
                              {m.image_url ? (
                                <Box component="img" src={m.image_url} alt={m.meal_name || 'meal'} sx={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 1 }} />
                              ) : (
                                <Box sx={{ width: 64, height: 48, bgcolor: '#f3f4f6', borderRadius: 1 }} />
                              )}
                            </TableCell>
                            <TableCell>{m.meal_name || '-'}</TableCell>
                            <TableCell>{m.food_type}</TableCell>
                            <TableCell>{m.meal_datetime ? new Date(m.meal_datetime).toLocaleString() : '-'}</TableCell>
                            <TableCell>{m.nutrients?.Calories ?? '-'}</TableCell>
                            <TableCell>{m.nutrients?.['Protein (g)'] ?? '-'}</TableCell>
                            <TableCell>{m.nutrients?.['Carbs (g)'] ?? '-'}</TableCell>
                            <TableCell>{m.nutrients?.['Fat (g)'] ?? '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUserDetail}>Close</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
