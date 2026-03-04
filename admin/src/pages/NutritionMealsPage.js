import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  TextField, MenuItem, InputAdornment, Pagination,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import adminService from '../services/adminService';
import { Bar, Line } from 'react-chartjs-2';

function NutritionMealsPage() {
  const [loading, setLoading] = useState(true);
  const [mealsStats, setMealsStats] = useState(null);
  const [nutrientTrends, setNutrientTrends] = useState(null);
  const [meals, setMeals] = useState([]);
  const [totalMeals, setTotalMeals] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [trendDays, setTrendDays] = useState('30');
  const perPage = 15;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [stats, trends] = await Promise.allSettled([
          adminService.getMealsStats(),
          adminService.getMealsNutrientTrends({ days: trendDays }),
        ]);
        if (stats.status === 'fulfilled') setMealsStats(stats.value);
        if (trends.status === 'fulfilled') setNutrientTrends(trends.value);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [trendDays]);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const data = await adminService.browseMeals({ page, limit: perPage, search });
        setMeals(data.meals || []);
        setTotalMeals(data.total || 0);
      } catch (e) { console.error(e); }
    };
    fetchMeals();
  }, [page, search]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={60} /></Box>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        <RestaurantIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 36, color: '#10b981' }} />
        Nutrition & Meals
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Platform-wide nutrition analytics and meal browsing.
      </Typography>

      {/* Stats Cards */}
      {mealsStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Meals Logged', val: mealsStats.total_meals || 0, color: '#10b981', icon: <RestaurantIcon /> },
            { label: 'Avg Calories', val: `${(mealsStats.avg_calories || 0).toFixed(0)} kcal`, color: '#f59e0b', icon: <TrendingUpIcon /> },
            { label: 'Unique Users', val: mealsStats.unique_users || 0, color: '#667eea', icon: <RestaurantIcon /> },
            { label: 'This Week', val: mealsStats.this_week || 0, color: '#06b6d4', icon: <TrendingUpIcon /> },
          ].map((s, i) => (
            <Grid item xs={6} md={3} key={i}>
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                  <Avatar sx={{ bgcolor: s.color + '20', color: s.color }}>{s.icon}</Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{s.val}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Nutrient Trends Chart */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>Nutrient Trends</Typography>
              <TextField select size="small" value={trendDays} onChange={e => setTrendDays(e.target.value)} sx={{ width: 100 }}>
                <MenuItem value="7">7 days</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
              </TextField>
            </Box>
            {nutrientTrends && nutrientTrends.data_points ? (
              <Line
                data={{
                  labels: nutrientTrends.data_points.map(d => d.date),
                  datasets: [
                    { label: 'Calories', data: nutrientTrends.data_points.map(d => d.calories || 0), borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.4 },
                    { label: 'Protein (g)', data: nutrientTrends.data_points.map(d => d.protein || 0), borderColor: '#667eea', backgroundColor: 'transparent', tension: 0.4 },
                    { label: 'Carbs (g)', data: nutrientTrends.data_points.map(d => d.carbs || 0), borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.4 },
                    { label: 'Fat (g)', data: nutrientTrends.data_points.map(d => d.fat || 0), borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.4 },
                  ],
                }}
                options={{ plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }}
              />
            ) : <Typography variant="body2" color="text.secondary">No trend data</Typography>}
          </Paper>
        </Grid>

        {/* Macro Distribution */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>Avg Macro Split</Typography>
            {mealsStats && mealsStats.avg_protein !== undefined ? (
              <Box sx={{ maxWidth: 240, mx: 'auto', mt: 2 }}>
                <Bar
                  data={{
                    labels: ['Protein', 'Carbs', 'Fat'],
                    datasets: [{
                      label: 'Avg (g)',
                      data: [mealsStats.avg_protein || 0, mealsStats.avg_carbs || 0, mealsStats.avg_fat || 0],
                      backgroundColor: ['#667eea', '#f59e0b', '#10b981'],
                      borderRadius: 6,
                    }],
                  }}
                  options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                />
              </Box>
            ) : <Typography variant="body2" color="text.secondary">No data</Typography>}
          </Paper>
        </Grid>
      </Grid>

      {/* Meals Browse Table */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Browse Meals</Typography>
          <TextField size="small" placeholder="Search meals..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            sx={{ width: 260 }}
          />
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Food Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Calories</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Meal Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {meals.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No meals found</TableCell></TableRow>
              ) : meals.map((m, i) => (
                <TableRow key={i} hover>
                  <TableCell>{m.user_name || m.user || '—'}</TableCell>
                  <TableCell>{m.food_name || m.name || '—'}</TableCell>
                  <TableCell>{m.calories ? `${m.calories} kcal` : '—'}</TableCell>
                  <TableCell>
                    <Chip label={m.meal_type || 'Unknown'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{m.date ? new Date(m.date).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {totalMeals > perPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination count={Math.ceil(totalMeals / perPage)} page={page} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default NutritionMealsPage;
