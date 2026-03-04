import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Box, Divider, Typography, Tooltip } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 260;
const collapsedWidth = 72;

function Sidebar({ open = true }) {
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

  const width = open ? drawerWidth : collapsedWidth;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #1a237e 0%, #0d47a1 100%)',
          color: '#fff',
          borderRight: 'none',
          transition: 'width 200ms ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ p: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <LocalHospitalIcon sx={{ fontSize: 40, color: '#64b5f6' }} />
      </Box>
      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.08)', my: 1 }} />
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <Tooltip key={item.text} title={open ? '' : item.text} placement="right">
            <ListItem
              button
              onClick={() => navigate(item.path)}
              sx={{
                mb: 1,
                borderRadius: 2,
                transition: 'all 0.2s ease',
                bgcolor: isActive(item.path) ? 'rgba(100, 181, 246, 0.16)' : 'transparent',
                border: isActive(item.path) ? '1px solid rgba(100, 181, 246, 0.32)' : '1px solid transparent',
                '&:hover': {
                  bgcolor: 'rgba(100, 181, 246, 0.12)',
                  transform: open ? 'translateX(8px)' : 'none',
                },
                color: '#fff',
                px: open ? 2 : 1.2,
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive(item.path) ? '#64b5f6' : '#fff',
                  minWidth: 40,
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {open && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive(item.path) ? 600 : 400,
                    fontSize: '0.95rem',
                  }}
                />
              )}
            </ListItem>
          </Tooltip>
        ))}
      </List>
    </Drawer>
  );
}

export default Sidebar;
