import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import mealService from '../services/mealService';

function MealModal({ open, onClose, userId, userName }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
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
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
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
          <Grid container spacing={3}>
            {meals.map((meal) => (
              <Grid item xs={12} sm={6} md={4} key={meal._id}>
                <Card 
                  sx={{ 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderRadius: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    },
                  }}
                >
                  {meal.image_url ? (
                    <CardMedia
                      component="img"
                      height="180"
                      image={meal.image_url}
                      alt={meal.meal_name || 'Meal Photo'}
                      sx={{ objectFit: 'cover' }}
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
        )}
        <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'gray' }}>
          Total meals: {meals.length}
        </Typography>
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
