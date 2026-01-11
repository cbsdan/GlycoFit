import React, { useEffect, useState, useMemo, forwardRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  TextField,
  Stack,
  Chip,
  Avatar,
  IconButton,
  Slide,
  Popover,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SummarizeIcon from '@mui/icons-material/Summarize';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Pie } from 'react-chartjs-2';
import {
  Chart,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

Chart.register(
  ArcElement,
  ChartTooltip,
  Legend,
);

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function ActiveUsersModal({ open, onClose, apiBase, getAuthHeaders }) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userMeals, setUserMeals] = useState([]);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/admin/users?limit=10000`, { headers, method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      const list = (data.users || [])
        .filter(u => ['user', 'admin'].includes((u.role || '').toLowerCase()))
        .filter(u => !u.is_disabled);
      setUsers(list);
    } catch (err) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchUsers();
  }, [open]);

  const filteredUsers = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    return users.filter(u => {
      const first = (u.first_name || '').toLowerCase();
      const last = (u.last_name || '').toLowerCase();
      const full = `${first} ${last}`.trim();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const id = (u.id || u.uid || '').toString().toLowerCase();
      return tokens.every(t => full.includes(t) || first.includes(t) || last.includes(t) || email.includes(t) || role.includes(t) || id.includes(t));
    });
  }, [users, query]);

  const exportToCsv = (rows) => {
    const headers = ['Name','Email','Role','Status'];
    const lines = [headers.join(',')];
    rows.forEach(u => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.email || '');
      const status = u.is_disabled ? 'Disabled' : 'Active';
      const row = [name, u.email || '', u.role || '', status];
      lines.push(row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'active_users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const initials = (first, last) => {
    const f = (first || '').trim()[0] || '';
    const l = (last || '').trim()[0] || '';
    return (f + l).toUpperCase() || 'U';
  };

  const handleViewStats = async (user) => {
    setSelectedUser(user);
    setMealsLoading(true);
    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
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
    setUserMeals([]);
    setMealsLoading(false);
    setAnchorEl(null);
  };

  const handleTotalClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleTotalClose = () => {
    setAnchorEl(null);
  };

  const openPopover = Boolean(anchorEl);

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
        data: [nutritionTotals.calories, nutritionTotals.protein, nutritionTotals.carbs, nutritionTotals.fat],
        backgroundColor: ['#FCA5A5', '#93C5FD', '#FDE68A', '#A7F3D0'],
      },
    ],
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" TransitionComponent={Transition} keepMounted>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PeopleAltIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Active Users (User & Admin)</Typography>
          <Chip label={`${users.length} active`} size="small" color="success" sx={{ ml: 1 }} />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Showing active users with roles: user, admin
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search name, email, id..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  sx={{ width: { xs: '100%', sm: 320 } }}
                />
                <IconButton aria-label="Export CSV" onClick={() => exportToCsv(filteredUsers)}>
                  <DownloadIcon />
                </IconButton>
              </Stack>
            </Stack>

            <TableContainer 
              component={Paper} 
              sx={{ maxHeight: 440, borderRadius: 3, boxShadow: '0 6px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">No users found</TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id || u.uid} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar 
                              src={u.avatar?.url} 
                              sx={{ bgcolor: 'primary.main' }}
                            >
                              {initials(u.first_name, u.last_name)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID: {u.id || u.uid}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Chip label={u.role} size="small" color={u.role === 'admin' ? 'warning' : 'primary'} />
                        </TableCell>
                        <TableCell>
                          <Chip label={u.is_disabled ? 'Disabled' : 'Active'} size="small" color={u.is_disabled ? 'error' : 'success'} />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="contained" onClick={() => handleViewStats(u)}>
                            View Stats
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
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
              {/* Left: Nutrition pie + totals */}
              <Box sx={{ width: { xs: '100%', md: '35%' }, minWidth: 220 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1">Nutrition Summary</Typography>
                  <IconButton 
                    size="small" 
                    color="primary"
                    onMouseEnter={(e) => handleTotalClick(e)}
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
                      sx={{ pointerEvents: 'none' }}
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
                              <Box sx={{ p: 1.5, bgcolor: '#FCA5A5', borderRadius: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#7f1d1d', fontWeight: 500 }}>Calories</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#991b1b' }}>
                                  {nutritionTotals.calories.toFixed(0)}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ p: 1.5, bgcolor: '#93C5FD', borderRadius: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 500 }}>Protein</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e40af' }}>
                                  {nutritionTotals.protein.toFixed(1)}g
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ p: 1.5, bgcolor: '#FDE68A', borderRadius: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 500 }}>Carbs</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#92400e' }}>
                                  {nutritionTotals.carbs.toFixed(1)}g
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ p: 1.5, bgcolor: '#A7F3D0', borderRadius: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#064e3b', fontWeight: 500 }}>Fat</Typography>
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
