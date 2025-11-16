import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress, Alert, Snackbar } from '@mui/material';
import UsersTable from '../components/users/UsersTable';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { currentUser } = useAuth();

  const getAuthHeaders = useCallback(async () => {
    if (!currentUser) return {};
    
    try {
      const token = await currentUser.getIdToken();
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
    } catch (err) {
      console.error('Error getting auth token:', err);
      return { 'Content-Type': 'application/json' };
    }
  }, [currentUser]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/users?skip=0&limit=50`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDisableUser = async (uid, reason, days, isPermanent) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/users/${uid}/disable`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          reason, 
          is_permanent: isPermanent, 
          days: isPermanent ? 0 : days 
        })
      });

      if (!response.ok) throw new Error('Failed to disable user');
      
      fetchUsers();
      const message = isPermanent 
        ? 'User disabled permanently!' 
        : `User disabled for ${days} days!`;
      setSuccessMessage(message);
    } catch (err) {
      setError('Failed to disable user');
    }
  };

  const handleEnableUser = async (uid) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/users/${uid}/enable`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: 'User enabled by admin' })
      });

      if (!response.ok) throw new Error('Failed to enable user');
      
      fetchUsers();
      setSuccessMessage('User enabled successfully!');
    } catch (err) {
      setError('Failed to enable user');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <UsersTable 
        users={users} 
        onRefresh={fetchUsers}
        onDisable={handleDisableUser}
        onEnable={handleEnableUser}
      />
      
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      />
    </Box>
  );
}

export default UsersPage;
