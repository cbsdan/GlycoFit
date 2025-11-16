import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();

  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <Typography variant="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
        404
      </Typography>
      <Typography variant="h5" color="textSecondary" sx={{ mb: 3 }}>
        Page not found
      </Typography>
      <Button variant="contained" onClick={() => navigate('/')}>
        Go to Dashboard
      </Button>
    </Box>
  );
}

export default NotFound;
