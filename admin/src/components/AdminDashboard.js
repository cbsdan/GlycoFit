import React, { useState } from 'react';
import { Box, CssBaseline, AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardHome from './DashboardHome';
import UsersManagement from './UsersManagement';
import AdminCreatePhysician from './AdminCreatePhysician';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const drawerWidth = 240;

function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/login';
  };

  const menuItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, page: 'dashboard' },
    { label: 'Users', icon: <PeopleIcon />, page: 'users' },
    { label: 'Create Physician', icon: <PersonAddIcon />, page: 'create_physician' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#1976d2' }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            GlycoFit Admin Dashboard
          </Typography>
          <LogoutIcon sx={{ cursor: 'pointer' }} onClick={handleLogout} />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', marginTop: '64px' },
        }}
      >
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.page}
              onClick={() => setCurrentPage(item.page)}
              sx={{
                bgcolor: currentPage === item.page ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                borderLeft: currentPage === item.page ? '4px solid #1976d2' : 'none',
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: '#f5f5f5', p: 3, marginTop: '64px' }}>
        {currentPage === 'dashboard' && <DashboardHome />}
        {currentPage === 'users' && <UsersManagement />}
        {currentPage === 'create_physician' && <AdminCreatePhysician />}
      </Box>
    </Box>
  );
}

export default AdminDashboard;
