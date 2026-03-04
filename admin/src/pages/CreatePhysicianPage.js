import React from 'react';
import { Box, Typography } from '@mui/material';
import AdminCreatePhysician from '../components/AdminCreatePhysician';
import { useNavigate } from 'react-router-dom';

function CreatePhysicianPage() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // Optionally navigate to users page after successful creation
    setTimeout(() => {
      navigate('/dashboard/users');
    }, 2000);
  };

  return (
    <Box>
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            fontWeight: 700,
            mb: 1,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Create Physician Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Add a new physician to the platform
        </Typography>
      <AdminCreatePhysician onSuccess={handleSuccess} />
    </Box>
  );
}

export default CreatePhysicianPage;
