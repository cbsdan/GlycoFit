import React, { useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

const Dashboard = lazy(() => import('./Dashboard'));
const UsersPage = lazy(() => import('./UsersPage'));
const NotFound = lazy(() => import('./NotFound'));
const CreatePhysicianPage = lazy(() => import('./CreatePhysicianPage'));

function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={sidebarOpen} />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Header onMenuClick={toggleSidebar} />
        <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f8fafc', mt: 8, minHeight: '100vh' }}>
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/create-physician" element={<CreatePhysicianPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}

export default AdminDashboard;
