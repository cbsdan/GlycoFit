import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Alert,
  IconButton,
  TextField,
  Divider,
  Chip,
  Collapse,
  Pagination,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import mealService from '../services/mealService';

const PER_PAGE = 9;

/* helpers */
const parseVal = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const fmt = (v, decimals = 1) => (v === null ? '—' : Number(v).toFixed(decimals));
const getNutrient = (n = {}, ...keys) => {
  for (const k of keys) { const v = parseVal(n[k]); if (v !== null) return v; }
  return null;
};

const foodTypeColor = {
  breakfast: 'warning', lunch: 'success', dinner: 'primary',
  snacks: 'info', drinks: 'secondary', dessert: 'error',
  other: 'default', unlabeled: 'default',
};
const confidenceColor = (rate) => {
  if (rate == null) return 'default';
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'error';
};

/* NutrientRow */
const NutrientRow = memo(({ label, value, unit, highlight }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 0.35, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 }, bgcolor: highlight ? 'action.hover' : 'transparent', px: 0.5, borderRadius: 0.5 }}>
    <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary', fontSize: '0.74rem' }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.74rem', minWidth: 48, textAlign: 'right' }}>
      {value}{value !== '—' && unit ? <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.3 }}>{unit}</Typography> : null}
    </Typography>
  </Box>
));

/* NutrientPanel */
const NutrientPanel = memo(function NutrientPanel({ nutrients = {}, servingSize }) {
  const [expanded, setExpanded] = useState(false);
  const cals    = getNutrient(nutrients, 'Calories', 'Energy');
  const protein = getNutrient(nutrients, 'Protein (g)', 'Protein');
  const carbs   = getNutrient(nutrients, 'Carbs (g)', 'Carbs', 'Carbohydrates (g)');
  const fat     = getNutrient(nutrients, 'Fat (g)', 'Fat', 'Total Fat (g)');
  const fiber   = getNutrient(nutrients, 'Dietary Fiber (g)', 'Fiber (g)', 'Fiber');
  const sugar   = getNutrient(nutrients, 'Added Sugars (g)', 'Sugar (g)', 'Sugars (g)');
  const satFat  = getNutrient(nutrients, 'Saturated Fat (g)', 'Saturated Fat');
  const unsatFat= getNutrient(nutrients, 'Unsaturated Fat (g)', 'Unsaturated Fat');
  const sodium  = getNutrient(nutrients, 'Sodium (mg)', 'Sodium');
  const gl      = getNutrient(nutrients, 'Glycemic Load', 'glycemic_load');

  const macros = [
    { label: 'Calories', value: fmt(cals, 0),  unit: 'kcal', color: '#e57373' },
    { label: 'Carbs',    value: fmt(carbs),     unit: 'g',    color: '#ffb74d' },
    { label: 'Protein',  value: fmt(protein),   unit: 'g',    color: '#64b5f6' },
    { label: 'Fat',      value: fmt(fat),       unit: 'g',    color: '#81c784' },
  ];

  return (
    <Box>
      {servingSize && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.68rem' }}>
          Serving: {servingSize}
        </Typography>
      )}
      <Grid container spacing={0.5} sx={{ mb: 0.5 }}>
        {macros.map((m) => (
          <Grid item xs={6} key={m.label}>
            <Box sx={{ bgcolor: `${m.color}20`, border: `1px solid ${m.color}60`, borderRadius: 1.5, p: 0.6, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.63rem' }}>{m.label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem', color: m.color }}>
                {m.value}
                <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.3, fontSize: '0.63rem' }}>{m.unit}</Typography>
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      <Button size="small" onClick={() => setExpanded((p) => !p)}
        endIcon={expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        sx={{ p: 0, minWidth: 0, fontSize: '0.68rem', color: 'text.secondary', textTransform: 'none', mb: 0.25 }}>
        {expanded ? 'Hide' : 'More'} nutrients
      </Button>
      <Collapse in={expanded}>
        <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 0.75 }}>
          <NutrientRow label="Dietary Fiber"   value={fmt(fiber)}      unit="g"  />
          <NutrientRow label="Added Sugars"    value={fmt(sugar)}      unit="g"  />
          <NutrientRow label="Saturated Fat"   value={fmt(satFat)}     unit="g"  />
          <NutrientRow label="Unsaturated Fat" value={fmt(unsatFat)}   unit="g"  />
          <NutrientRow label="Sodium"          value={fmt(sodium, 0)}  unit="mg" />
          <NutrientRow label="Glycemic Load"   value={fmt(gl, 1)}      unit=""   highlight />
        </Box>
      </Collapse>
    </Box>
  );
});

/* MealCard */
const MealCard = memo(function MealCard({ meal, formatDate }) {
  const [imgError, setImgError] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  return (
    <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.07)', transition: 'transform 0.2s,box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 10px 28px rgba(0,0,0,0.12)' } }}>
      {/* Fixed-height image zone — always 150px regardless of image presence */}
      <Box sx={{ height: 150, flexShrink: 0, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {meal.image_url && !imgError ? (
          <CardMedia component="img" image={meal.image_url} alt={meal.meal_name || 'Meal'} loading="lazy" onError={() => setImgError(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <RestaurantIcon sx={{ fontSize: 40, color: 'grey.300' }} />
        )}
      </Box>
      <CardContent sx={{ flexGrow: 1, pt: 1.5, pb: '12px !important', px: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, fontSize: '0.84rem', lineHeight: 1.3 }}>
            {meal.meal_name || 'Unnamed Meal'}
          </Typography>
          {meal.confidence_rate != null && (
            <Chip label={`${meal.confidence_rate}%`} size="small" color={confidenceColor(meal.confidence_rate)} sx={{ height: 18, fontSize: '0.63rem' }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
          {meal.food_type && (
            <Chip label={meal.food_type} size="small" color={foodTypeColor[meal.food_type] || 'default'} variant="outlined" sx={{ height: 18, fontSize: '0.63rem', textTransform: 'capitalize' }} />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontSize: '0.68rem' }}>
          {formatDate(meal.meal_datetime || meal.date)}
        </Typography>
        <Divider sx={{ my: 0.75 }} />
        <NutrientPanel nutrients={meal.nutrients} servingSize={meal.serving_size} />
        {meal.notes && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontStyle: 'italic', fontSize: '0.68rem' }}>
            📝 {meal.notes}
          </Typography>
        )}
        {meal.health_assessment && (
          <>
            <Button size="small" onClick={() => setAssessOpen((p) => !p)} sx={{ p: 0, mt: 0.5, fontSize: '0.67rem', textTransform: 'none', color: 'primary.main' }}>
              {assessOpen ? 'Hide' : 'Show'} health note
            </Button>
            <Collapse in={assessOpen}>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.4, color: 'text.secondary', fontSize: '0.68rem', lineHeight: 1.4 }}>
                {meal.health_assessment}
              </Typography>
            </Collapse>
          </>
        )}
        {meal.ingredient_nutrients?.length > 0 && (
          <Box sx={{ mt: 0.75 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.66rem' }}>
              Ingredients ({meal.ingredient_nutrients.length})
            </Typography>
            {meal.ingredient_nutrients.slice(0, 3).map((ing, i) => (
              <Typography key={i} variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem', pl: 1 }}>
                • {ing.name || ing.ingredient || `Item ${i + 1}`}
              </Typography>
            ))}
            {meal.ingredient_nutrients.length > 3 && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', pl: 1 }}>
                +{meal.ingredient_nutrients.length - 3} more
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

/* MealListRow */
const MealListRow = memo(function MealListRow({ meal, formatDate }) {
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const n = meal.nutrients || {};
  const fiber   = getNutrient(n, 'Dietary Fiber (g)', 'Fiber (g)');
  const sugar   = getNutrient(n, 'Added Sugars (g)', 'Sugar (g)');
  const satFat  = getNutrient(n, 'Saturated Fat (g)');
  const sodium  = getNutrient(n, 'Sodium (mg)');
  const gl      = getNutrient(n, 'Glycemic Load');

  return (
    <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', mb: 1 }}>
      <CardContent sx={{ p: '12px !important' }}>
        <Grid container spacing={1.5} alignItems="flex-start">
          <Grid item xs="auto">
            <Box sx={{ width: 68, height: 68, borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {meal.image_url && !imgError ? (
                <img src={meal.image_url} alt={meal.meal_name || 'Meal'} loading="lazy" onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <RestaurantIcon sx={{ color: 'grey.400', fontSize: 22 }} />
              )}
            </Box>
          </Grid>
          <Grid item xs>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 0.5, mb: 0.2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, fontSize: '0.84rem' }}>
                {meal.meal_name || 'Unnamed Meal'}
              </Typography>
              {meal.food_type && (
                <Chip label={meal.food_type} size="small" color={foodTypeColor[meal.food_type] || 'default'} variant="outlined" sx={{ height: 18, fontSize: '0.63rem', textTransform: 'capitalize' }} />
              )}
              {meal.confidence_rate != null && (
                <Chip label={`AI ${meal.confidence_rate}%`} size="small" color={confidenceColor(meal.confidence_rate)} sx={{ height: 18, fontSize: '0.63rem' }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
              {formatDate(meal.meal_datetime || meal.date)}{meal.serving_size ? ` · ${meal.serving_size}` : ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.6, flexWrap: 'wrap' }}>
              {[
                { label: 'Cal',     value: fmt(getNutrient(n,'Calories','Energy'), 0), unit: 'kcal', color: '#e57373' },
                { label: 'Carbs',   value: fmt(getNutrient(n,'Carbs (g)','Carbs')),    unit: 'g',    color: '#ffb74d' },
                { label: 'Protein', value: fmt(getNutrient(n,'Protein (g)','Protein')),unit: 'g',    color: '#64b5f6' },
                { label: 'Fat',     value: fmt(getNutrient(n,'Fat (g)','Fat')),         unit: 'g',    color: '#81c784' },
              ].map((m) => (
                <Box key={m.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem' }}>{m.label}: </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: m.color, fontSize: '0.74rem' }}>
                    {m.value}<Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', ml: 0.2 }}>{m.unit}</Typography>
                  </Typography>
                </Box>
              ))}
            </Box>
            {meal.notes && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4, fontStyle: 'italic', fontSize: '0.68rem' }}>
                📝 {meal.notes}
              </Typography>
            )}
          </Grid>
          <Grid item xs="auto">
            <Tooltip title={expanded ? 'Collapse' : 'Full details'}>
              <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.63rem' }}>Full Nutrition</Typography>
              <Box sx={{ mt: 0.5 }}>
                <NutrientRow label="Dietary Fiber"   value={fmt(fiber)}      unit="g"  />
                <NutrientRow label="Added Sugars"    value={fmt(sugar)}      unit="g"  />
                <NutrientRow label="Saturated Fat"   value={fmt(satFat)}     unit="g"  />
                <NutrientRow label="Sodium"          value={fmt(sodium, 0)}  unit="mg" />
                <NutrientRow label="Glycemic Load"   value={fmt(gl, 1)}      unit=""   highlight />
              </Box>
            </Grid>
            {meal.ingredient_nutrients?.length > 0 && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.63rem' }}>Ingredients</Typography>
                <Box sx={{ mt: 0.5 }}>
                  {meal.ingredient_nutrients.map((ing, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{ing.name || ing.ingredient || `Item ${i + 1}`}</Typography>
                      {ing.calories && <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>{fmt(parseVal(ing.calories), 0)} kcal</Typography>}
                    </Box>
                  ))}
                </Box>
              </Grid>
            )}
            {meal.health_assessment && (
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.63rem' }}>Health Assessment</Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary', fontSize: '0.7rem', lineHeight: 1.4 }}>
                  {meal.health_assessment}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
});

/* Main MealModal */
function MealModal({ open, onClose, userId, userName }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('cards');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchMeals = useCallback(async (p = 1) => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await mealService.getUserMeals(userId, p, PER_PAGE);
      setMeals(data.meals || []);
      setTotal(data.total ?? data.count ?? 0);
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to load meals');
      setMeals([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) {
      setPage(1);
      setQuery('');
      fetchMeals(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const handlePageChange = (_, value) => {
    setPage(value);
    setQuery('');
    fetchMeals(value);
  };

  const handleClose = () => {
    setMeals([]);
    setError(null);
    setPage(1);
    setTotal(0);
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return String(dateString); }
  };

  const displayed = query
    ? meals.filter((m) => {
        const q = query.toLowerCase();
        return (m.meal_name || '').toLowerCase().includes(q) ||
               (m.food_type || '').toLowerCase().includes(q) ||
               (m.notes || '').toLowerCase().includes(q);
      })
    : meals;

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 3, height: '90vh', display: 'flex', flexDirection: 'column' } }}>

      {/* Header */}
      <DialogTitle sx={{ background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', color: 'white', py: 2, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RestaurantIcon />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Meals — {userName}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>{total} meal{total !== 1 ? 's' : ''} logged</Typography>
          </Box>
          <Tooltip title="Card view">
            <IconButton size="small" onClick={() => setView('cards')} sx={{ color: view === 'cards' ? 'white' : 'rgba(255,255,255,0.45)' }}>
              <ViewModuleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="List view">
            <IconButton size="small" onClick={() => setView('list')} sx={{ color: view === 'list' ? 'white' : 'rgba(255,255,255,0.45)' }}>
              <ViewListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      {/* Search */}
      <Box sx={{ px: 2.5, pt: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <TextField size="small" placeholder="Filter on this page…" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth
          InputProps={{ startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 0.75, fontSize: 18 }} />, sx: { borderRadius: 2, bgcolor: 'grey.50' } }} />
      </Box>

      {/* Body */}
      <DialogContent sx={{ flex: 1, overflowY: 'auto', pt: 2, pb: 1, px: 2.5 }}>
        {loading && <Box sx={{ mb: 1 }}><LinearProgress /></Box>}
        {!loading && error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && meals.length === 0 && <Alert severity="info">No meals found for this user.</Alert>}

        {!error && displayed.length > 0 && (
          view === 'cards' ? (
            <Grid container spacing={2}>
              {displayed.map((meal) => (
                <Grid item xs={12} sm={6} md={4} key={meal.id || meal._id}>
                  <MealCard meal={meal} formatDate={formatDate} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box>
              {displayed.map((meal) => (
                <MealListRow key={meal.id || meal._id} meal={meal} formatDate={formatDate} />
              ))}
            </Box>
          )
        )}

        {query && displayed.length === 0 && meals.length > 0 && (
          <Alert severity="info">No meals match your search on this page.</Alert>
        )}
      </DialogContent>

      {/* Pagination footer */}
      <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary">
          Page {page} of {totalPages || 1} · {total} total
        </Typography>
        {totalPages > 1 && (
          <Pagination count={totalPages} page={page} onChange={handlePageChange} size="small" color="primary" disabled={loading} />
        )}
        <Button size="small" variant="outlined" onClick={handleClose}>Close</Button>
      </Box>
    </Dialog>
  );
}

export default MealModal;
