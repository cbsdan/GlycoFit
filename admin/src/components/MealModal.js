import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Divider,
  Avatar,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import DownloadIcon from '@mui/icons-material/Download';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import GrainIcon from '@mui/icons-material/Grain';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import OpacityIcon from '@mui/icons-material/Opacity';
import mealService from '../services/mealService';

function MealModal({ open, onClose, userId, userName }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('cards'); // 'cards' or 'list'
  const [query, setQuery] = useState('');
  const [totalsOpen, setTotalsOpen] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchMeals();
    }
    // eslint-disable-next-line
  }, [open, userId]);

  const fetchMeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mealService.getUserMeals(userId);
      if (data.status === 'success' && data.meals) {
        setMeals(data.meals);
      } else if (data.meals) {
        setMeals(data.meals);
      } else {
        setError('No meals data received');
        setMeals([]);
      }
    } catch (err) {
      setError(err?.error || err.message || 'Failed to load meals');
      setMeals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMeals([]);
    setError(null);
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString || 'N/A';
    }
  };

  const filteredMeals = useMemo(() => {
    if (!query) return meals;
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    return meals.filter(m => {
      const name = (m.meal_name || '').toLowerCase();
      const foodType = (m.food_type || '').toLowerCase();
      const notes = (m.notes || '').toLowerCase();
      const date = (m.meal_datetime || m.date || '').toString().toLowerCase();
      const nutrients = JSON.stringify(m.nutrients || {}).toLowerCase();
      return tokens.every(t => name.includes(t) || foodType.includes(t) || notes.includes(t) || date.includes(t) || nutrients.includes(t));
    });
  }, [meals, query]);

  const totals = useMemo(() => {
    const t = { calories: 0, carbs: 0, protein: 0, fat: 0 };
    const parseVal = (v) => {
      if (v === null || v === undefined) return 0;
      const s = String(v).replace(/[^0-9.-]/g, '');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };
    filteredMeals.forEach((m) => {
      const n = m.nutrients || {};
      const cals = parseVal(n['Calories'] ?? n['Energy'] ?? m.calories);
      const carbs = parseVal(n['Carbs (g)'] ?? n['Carbs'] ?? m.carbs);
      const protein = parseVal(n['Protein (g)'] ?? n['Protein'] ?? m.protein);
      const fat = parseVal(n['Fat (g)'] ?? n['Fat'] ?? m.fat);
      t.calories += cals;
      t.carbs += carbs;
      t.protein += protein;
      t.fat += fat;
    });
    return {
      calories: Math.round(t.calories * 100) / 100,
      carbs: Math.round(t.carbs * 100) / 100,
      protein: Math.round(t.protein * 100) / 100,
      fat: Math.round(t.fat * 100) / 100,
    };
  }, [filteredMeals]);

  const exportToCsv = (rows) => {
    const headers = ['Meal Name','Meal Time','Food Type','Calories','Carbs','Protein','Fat','Notes'];
    const lines = [headers.join(',')];
    rows.forEach(m => {
      const time = m.meal_datetime || m.date || '';
      const cals = m.nutrients?.['Calories'] ?? m.calories ?? '';
      const carbs = m.nutrients?.['Carbs (g)'] ?? m.carbs ?? '';
      const protein = m.nutrients?.['Protein (g)'] ?? m.protein ?? '';
      const fat = m.nutrients?.['Fat (g)'] ?? m.fat ?? '';
      const row = [m.meal_name || '', time, m.food_type || '', cals, carbs, protein, fat, m.notes || ''];
      lines.push(row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meals_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          position: 'relative',
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestaurantIcon />
          <Typography variant="h6" fontWeight={600}>
            Meals for {userName}
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            <IconButton size="small" aria-label="cards view" color={view === 'cards' ? 'inherit' : 'default'} onClick={() => setView('cards')}>
              <ViewModuleIcon sx={{ color: 'white' }} />
            </IconButton>
            <IconButton size="small" aria-label="list view" color={view === 'list' ? 'inherit' : 'default'} onClick={() => setView('list')}>
              <ViewListIcon sx={{ color: 'white' }} />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 4 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : meals.length === 0 ? (
          <Alert severity="info">
            No meals found for this user.
          </Alert>
        ) : (
            <>
              <Box sx={{ width: '100%', mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', maxWidth: 760 }}>
                    <TextField
                      size="small"
                      placeholder="Search meals by name, type, notes..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      sx={{ flex: 1 }}
                      InputProps={{ sx: { borderRadius: 2 } }}
                    />
                    <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => exportToCsv(filteredMeals)}>
                      Export
                    </Button>
                    <Button variant="text" size="small" onClick={() => setQuery('')}>Clear</Button>
                    <Button variant="contained" size="small" startIcon={<LocalFireDepartmentIcon />} onClick={() => setTotalsOpen(prev => !prev)} sx={{ ml: 1 }}>
                      Totals
                    </Button>
                    <Box sx={{ display: 'flex', ml: 1 }}>
                      <IconButton size="small" aria-label="cards view" color={view === 'cards' ? 'primary' : 'default'} onClick={() => setView('cards')}>
                        <ViewModuleIcon />
                      </IconButton>
                      <IconButton size="small" aria-label="list view" color={view === 'list' ? 'primary' : 'default'} onClick={() => setView('list')}>
                        <ViewListIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>

                
              </Box>
              {view === 'cards' ? (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  {meals.map((meal) => (
                    <Grid item xs={12} sm={6} md={4} key={meal._id}>
                      <Card 
                        sx={{ 
                          boxShadow: '0 8px 24px rgba(99,102,241,0.06)',
                          borderRadius: 3,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform 0.28s ease, box-shadow 0.28s ease',
                          '&:hover': {
                            transform: totalsOpen ? 'translateY(-8px) translateX(-6px)' : 'translateY(-6px)',
                            boxShadow: totalsOpen ? '0 18px 48px rgba(99,102,241,0.16)' : '0 12px 36px rgba(99,102,241,0.12)',
                          },
                        }}
                      >
                        {meal.image_url ? (
                          <CardMedia
                            component="img"
                            height="180"
                            image={meal.image_url}
                            alt={meal.meal_name || 'Meal Photo'}
                            sx={{ objectFit: 'cover', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
                          />
                        ) : (
                          <Box
                            sx={{
                              height: 180,
                              bgcolor: '#f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#aaa',
                              fontSize: 18,
                              fontWeight: 500,
                            }}
                          >
                            No Photo
                          </Box>
                        )}
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" gutterBottom>
                            {meal.meal_name || 'N/A'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            <strong>Meal Time:</strong>{' '}
                            {meal.meal_datetime
                              ? formatDate(meal.meal_datetime)
                              : meal.date
                              ? formatDate(meal.date)
                              : 'N/A'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            <strong>Food Type:</strong> {meal.food_type || '-'}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2">
                              <strong>Calories:</strong> {meal.nutrients?.['Calories'] ?? meal.calories ?? '-'} kcal
                            </Typography>
                            <Typography variant="body2">
                              <strong>Carbs:</strong> {meal.nutrients?.['Carbs (g)'] ?? meal.carbs ?? '-'} g
                            </Typography>
                            <Typography variant="body2">
                              <strong>Protein:</strong> {meal.nutrients?.['Protein (g)'] ?? meal.protein ?? '-'} g
                            </Typography>
                            <Typography variant="body2">
                              <strong>Fat:</strong> {meal.nutrients?.['Fat (g)'] ?? meal.fat ?? '-'} g
                            </Typography>
                            {meal.notes && (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>Notes:</strong> {meal.notes}
                              </Typography>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {meals.map((meal) => (
                    <Grid item xs={12} key={meal._id}>
                      <Card sx={{ display: 'flex', gap: 2, alignItems: 'stretch', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', transition: 'transform 0.28s ease, box-shadow 0.28s ease', '&:hover': { transform: totalsOpen ? 'translateX(-6px)' : 'none', boxShadow: totalsOpen ? '0 12px 30px rgba(0,0,0,0.12)' : undefined } }}>
                        <Box sx={{ width: { xs: '40%', sm: 240 }, flexShrink: 0 }}>
                          {meal.image_url ? (
                            <CardMedia component="img" image={meal.image_url} alt={meal.meal_name || 'Meal Photo'} sx={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Box sx={{ height: 160, bgcolor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                              No Photo
                            </Box>
                          )}
                        </Box>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" gutterBottom>{meal.meal_name || 'N/A'}</Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            <strong>Meal Time:</strong>{' '}
                            {meal.meal_datetime ? formatDate(meal.meal_datetime) : meal.date ? formatDate(meal.date) : 'N/A'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            <strong>Food Type:</strong> {meal.food_type || '-'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 3, mt: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2"><strong>Calories:</strong> {meal.nutrients?.['Calories'] ?? meal.calories ?? '-'} kcal</Typography>
                            <Typography variant="body2"><strong>Carbs:</strong> {meal.nutrients?.['Carbs (g)'] ?? meal.carbs ?? '-'} g</Typography>
                            <Typography variant="body2"><strong>Protein:</strong> {meal.nutrients?.['Protein (g)'] ?? meal.protein ?? '-'} g</Typography>
                            <Typography variant="body2"><strong>Fat:</strong> {meal.nutrients?.['Fat (g)'] ?? meal.fat ?? '-'} g</Typography>
                          </Box>
                          {meal.notes && <Typography variant="body2" sx={{ mt: 1 }}><strong>Notes:</strong> {meal.notes}</Typography>}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
        )}
        <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'gray' }}>
          Total meals: {meals.length}
        </Typography>

        {totalsOpen && (
          <Box sx={{ position: 'absolute', right: { xs: 12, sm: 16 }, top: 140, width: { xs: 220, sm: 240 }, height: 'calc(100% - 180px)', bgcolor: 'background.paper', boxShadow: 6, borderRadius: 2, overflowY: 'auto', zIndex: 1200, animation: '0.26s cubic-bezier(.2,.8,.2,1) slideIn'}}>
            {/* keyframes for slideIn */}
            <style>{`@keyframes slideIn { from { transform: translateX(12px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LocalFireDepartmentIcon color="primary" />
                <Typography variant="subtitle1">Nutrition Summary</Typography>
                <Box sx={{ ml: 'auto' }}>
                  <Button size="small" onClick={() => setTotalsOpen(false)}>Close</Button>
                </Box>
              </Box>
              <Divider sx={{ mb: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}><LocalFireDepartmentIcon sx={{ color: 'white', fontSize: 20 }} /></Avatar>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Calories</Typography>
                      <Typography variant="subtitle1">{totals.calories} kcal</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}><GrainIcon sx={{ color: 'white', fontSize: 20 }} /></Avatar>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Carbs</Typography>
                      <Typography variant="subtitle1">{totals.carbs} g</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'info.main', width: 40, height: 40 }}><FitnessCenterIcon sx={{ color: 'white', fontSize: 20 }} /></Avatar>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Protein</Typography>
                      <Typography variant="subtitle1">{totals.protein} g</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 40, height: 40 }}><OpacityIcon sx={{ color: 'white', fontSize: 20 }} /></Avatar>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Fat</Typography>
                      <Typography variant="subtitle1">{totals.fat} g</Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MealModal;
