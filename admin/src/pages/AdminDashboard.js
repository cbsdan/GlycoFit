import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import Dashboard from './Dashboard';
import UsersPage from './UsersPage';
import NotFound from './NotFound';
import CreatePhysicianPage from './CreatePhysicianPage';

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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/create-physician" element={<CreatePhysicianPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default AdminDashboard;
