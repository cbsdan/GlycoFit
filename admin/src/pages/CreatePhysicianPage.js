import React from 'react';
import { Box, Typography } from '@mui/material';
import AdminCreatePhysician from '../components/AdminCreatePhysician';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

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
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
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
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <AdminCreatePhysician onSuccess={handleSuccess} />
      </motion.div>
    </Box>
  );
}

export default CreatePhysicianPage;
