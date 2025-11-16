import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

function ProtectedRoute({ children }) {
  const { currentUser, userDetails, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: '#f5f5f5'
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!currentUser || !userDetails || userDetails.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
