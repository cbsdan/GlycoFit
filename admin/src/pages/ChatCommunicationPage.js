import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
  List, ListItem, ListItemText, ListItemAvatar, Divider, Pagination,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import adminService from '../services/adminService';

function ChatCommunicationPage() {
  const [loading, setLoading] = useState(true);
  const [chatStats, setChatStats] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [msgDialogOpen, setMsgDialogOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);
  const perPage = 15;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [stats] = await Promise.allSettled([adminService.getChatStats()]);
        if (stats.status === 'fulfilled') setChatStats(stats.value);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const fetchConvs = async () => {
      try {
        const data = await adminService.getChatConversations({ page, limit: perPage });
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      } catch (e) { console.error(e); }
    };
    fetchConvs();
  }, [page]);

  const viewMessages = async (conv) => {
    setSelectedConv(conv);
    setMsgDialogOpen(true);
    setMsgLoading(true);
    try {
      const data = await adminService.getConversationMessages(conv._id || conv.id, { limit: 50 });
      setMessages(data.messages || []);
    } catch (e) { console.error(e); }
    setMsgLoading(false);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={60} /></Box>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        <ChatIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 36, color: '#7c3aed' }} />
        Chat & Communication
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitor patient–physician messaging conversations.
      </Typography>

      {/* Stats Cards */}
      {chatStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Conversations', val: chatStats.total_conversations || 0, color: '#7c3aed' },
            { label: 'Total Messages', val: chatStats.total_messages || 0, color: '#667eea' },
            { label: 'Active Today', val: chatStats.active_today || 0, color: '#10b981' },
            { label: 'Avg Messages/Conv', val: (chatStats.avg_messages_per_conversation || 0).toFixed(1), color: '#06b6d4' },
          ].map((s, i) => (
            <Grid item xs={6} md={3} key={i}>
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                  <Avatar sx={{ bgcolor: s.color + '20', color: s.color }}><ChatIcon /></Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{s.val}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Conversations Table */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>Conversations</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Participants</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Messages</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Activity</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">View</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conversations.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No conversations</TableCell></TableRow>
              ) : conversations.map((c, i) => (
                <TableRow key={i} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip icon={<PersonIcon />} label={c.patient_name || c.patient || '—'} size="small" variant="outlined" />
                      <Typography variant="body2">↔</Typography>
                      <Chip icon={<MedicalServicesIcon />} label={c.physician_name || c.physician || '—'} size="small" variant="outlined" color="success" />
                    </Box>
                  </TableCell>
                  <TableCell>{c.message_count || c.messages || 0}</TableCell>
                  <TableCell>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    <Chip label={c.status || 'active'} size="small"
                      color={c.status === 'active' ? 'success' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => viewMessages(c)} color="primary">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {total > perPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination count={Math.ceil(total / perPage)} page={page} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        )}
      </Paper>

      {/* Messages Dialog */}
      <Dialog open={msgDialogOpen} onClose={() => setMsgDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>Conversation Messages</Typography>
            {selectedConv && (
              <Typography variant="caption" color="text.secondary">
                {selectedConv.patient_name || selectedConv.patient} ↔ {selectedConv.physician_name || selectedConv.physician}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setMsgDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {msgLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : messages.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No messages</Typography>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {messages.map((m, i) => (
                <React.Fragment key={i}>
                  <ListItem alignItems="flex-start" sx={{ py: 0.5 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: m.sender_role === 'physician' ? '#10b981' : '#667eea', fontSize: 13 }}>
                        {(m.sender_name || m.sender || '?').charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" fontWeight={600}>{m.sender_name || m.sender || 'Unknown'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}
                          </Typography>
                        </Box>
                      }
                      secondary={m.content || m.text || m.message || ''}
                    />
                  </ListItem>
                  {i < messages.length - 1 && <Divider variant="inset" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setMsgDialogOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChatCommunicationPage;
