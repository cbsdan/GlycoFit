import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Box, Divider, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 260;

function Sidebar({ open }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Users', icon: <PeopleIcon />, path: '/dashboard/users' },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #1a237e 0%, #0d47a1 100%)',
          color: '#fff',
          borderRight: 'none',
        },
      }}
    >
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <LocalHospitalIcon sx={{ fontSize: 48, color: '#64b5f6', mb: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          GlycoFit
        </Typography>
        <Typography variant="caption" sx={{ color: '#90caf9', textTransform: 'uppercase', letterSpacing: 2 }}>
          Admin Panel
        </Typography>
      </Box>
      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />
      <List sx={{ px: 2 }}>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => navigate(item.path)}
            sx={{
              mb: 1,
              borderRadius: 2,
              transition: 'all 0.3s ease',
              bgcolor: isActive(item.path) ? 'rgba(100, 181, 246, 0.2)' : 'transparent',
              border: isActive(item.path) ? '1px solid rgba(100, 181, 246, 0.4)' : '1px solid transparent',
              '&:hover': { 
                bgcolor: 'rgba(100, 181, 246, 0.15)',
                transform: 'translateX(8px)',
              },
              color: '#fff',
            }}
          >
            <ListItemIcon 
              sx={{ 
                color: isActive(item.path) ? '#64b5f6' : '#fff',
                minWidth: 40,
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.text}
              primaryTypographyProps={{
                fontWeight: isActive(item.path) ? 600 : 400,
                fontSize: '0.95rem',
              }}
            />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}

export default Sidebar;
