import React from 'react';
import { Box, Typography } from '@mui/material';
import UsersManagement from '../components/UsersManagement';

function UsersPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 1,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Users Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage all registered users
        </Typography>
      </Box>

      <UsersManagement />
    </Box>
  );
}

export default UsersPage;
