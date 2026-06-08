import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, Button, Grid, Stack, AppBar, Toolbar, IconButton, Drawer, List, ListItem, ListItemText, GlobalStyles
} from '@mui/material';
import {
  MonitorHeart, Restaurant, DirectionsRun, Bedtime, Dashboard, 
  LocalHospital, NotificationsActive, Spa, Science, VerifiedUser,
  WarningAmber, Android, Menu
} from '@mui/icons-material';

const GLYCOFIT_APK = process.env.REACT_APP_GLYCOFIT_APK;
const PHYSICIAN_APK = process.env.REACT_APP_PHYSICIAN_APK;

const NAV_LINKS = ['Watch Demo', 'About', 'Features', 'How it Works', 'Download'];

const corePrinciples = [
  { title: 'Preventive, not diagnostic', icon: <Spa sx={{ fontSize: 58, color: '#60a5fa' }} /> },
  { title: 'Data-driven insights', icon: <Science sx={{ fontSize: 58, color: '#c084fc' }} /> },
  { title: 'User-centered experience', icon: <VerifiedUser sx={{ fontSize: 58, color: '#f472b6' }} /> },
  { title: 'Ethical & responsible AI', icon: <MonitorHeart sx={{ fontSize: 58, color: '#34d399' }} /> }
];

const functionalities = [
  { icon: <MonitorHeart sx={{ fontSize: 40 }} />, title: 'Lifestyle Risk Assessment', text: 'Generates a risk score based on lifestyle data with clear interpretation.' },
  { icon: <Restaurant sx={{ fontSize: 40 }} />, title: 'Food Analysis (AI)', text: 'Scan food via image recognition to detect calories, carbs, and sugar.' },
  { icon: <DirectionsRun sx={{ fontSize: 40 }} />, title: 'Activity Tracking', text: 'Tracks daily steps and physical activity to correlate with health trends.' },
  { icon: <Bedtime sx={{ fontSize: 40 }} />, title: 'Sleep Monitoring', text: 'Logs sleep duration and patterns to identify lifestyle impacts.' },
  { icon: <Dashboard sx={{ fontSize: 40 }} />, title: 'Dashboard & Insights', text: 'Visual overview of nutrient intake, activity levels, and sleep trends.' },
  { icon: <LocalHospital sx={{ fontSize: 40 }} />, title: 'Physician Interaction', text: 'Request consultations, communicate with pros, and monitor recommended actions.' },
  { icon: <NotificationsActive sx={{ fontSize: 40 }} />, title: 'Alerts & Reminders', text: 'Daily health tips, habit reminders, and progress alerts.' }
];

const steps = [
  { title: 'Register', text: 'Users create their profile & input basic data.' },
  { title: 'Assess', text: 'System evaluates lifestyle risk.' },
  { title: 'Track', text: 'Log your food, activity, and sleep.' },
  { title: 'Analyze', text: 'AI processes inputs & generates insights.' },
  { title: 'Monitor', text: 'Track progress & adjust habits.' }
];

const GlassCard = ({ children, sx = {} }) => (
  <Box sx={{
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
    padding: 4,
    transformStyle: 'preserve-3d',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    '&:hover': {
      transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg) scale3d(1.02, 1.02, 1.02)',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 40px 80px rgba(59, 130, 246, 0.15)',
    },
    ...sx
  }}>
    {children}
  </Box>
);

function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id.toLowerCase().replace(/ /g, '-'));
    if(el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileOpen(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#020617', color: '#f8fafc', overflowX: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <GlobalStyles styles={{
        '@keyframes float': {
          '0%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(5deg)' },
          '100%': { transform: 'translateY(0) rotate(0deg)' }
        },
        '@keyframes pulseGlow': {
          '0%': { opacity: 0.4, transform: 'scale(1)' },
          '50%': { opacity: 0.6, transform: 'scale(1.1)' },
          '100%': { opacity: 0.4, transform: 'scale(1)' }
        },
        '@keyframes scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        'html': { scrollBehavior: 'smooth' }
      }} />

      {/* Abstract Background Orbs */}
      <Box sx={{ position: 'fixed', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(100px)', zIndex: 0, animation: 'pulseGlow 10s infinite alternate' }} />
      <Box sx={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(120px)', zIndex: 0, animation: 'pulseGlow 12s infinite alternate-reverse' }} />

      {/* Header */}
      <AppBar position="fixed" sx={{ 
        background: scrolled ? 'rgba(2, 6, 23, 0.8)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.5)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <Container maxWidth="xl">
          <Toolbar sx={{ py: 1, px: { xs: 0, md: 2 }}}>
            <Typography variant="h4" fontWeight="900" sx={{ flexGrow: 1, background: 'linear-gradient(90deg, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-1px' }}>
              GlycoFit
            </Typography>
            <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {NAV_LINKS.map(link => (
                <Button key={link} onClick={() => scrollTo(link)} sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.95rem', borderRadius: '12px', px: 3, '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' } }}>
                  {link}
                </Button>
              ))}
            </Stack>
            <IconButton edge="end" color="inherit" onClick={() => setMobileOpen(true)} sx={{ display: { xs: 'flex', md: 'none' } }}>
              <Menu />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { width: 280, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.1)' } }}>
        <List sx={{ mt: 8 }}>
          {NAV_LINKS.map(link => (
            <ListItem button key={link} onClick={() => scrollTo(link)}>
              <ListItemText primary={link} primaryTypographyProps={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', textAlign: 'center' }} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* 1. Hero Section */}
        <Container maxWidth="lg" sx={{ pt: { xs: 20, md: 28 }, pb: { xs: 12, md: 16 }, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Box sx={{ position: 'relative' }}>
                <Typography variant="h1" fontWeight="900" sx={{ fontSize: { xs: '3.5rem', md: '5rem' }, lineHeight: 1.1, mb: 3, background: 'linear-gradient(to right bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Pre-Diabetes<br/><span style={{ color: '#3b82f6', WebkitTextFillColor: '#3b82f6' }}>Lifestyle Risk</span><br/>Assessment
                </Typography>
                <Typography variant="h5" sx={{ color: '#94a3b8', mb: 5, fontWeight: 400, lineHeight: 1.6, maxWidth: '600px' }}>
                  Take control of your health through AI-powered insights, lifestyle tracking, and continuous monitoring designed to help you understand and reduce your risk of Type 2 Diabetes.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                  <Button variant="contained" onClick={() => scrollTo('Download')}
                    sx={{ background: 'linear-gradient(45deg, #2563eb, #7c3aed)', fontSize: '1.1rem', fontWeight: 800, px: 5, py: 2, borderRadius: '50px', boxShadow: '0 10px 30px rgba(59,130,246,0.4)', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 15px 40px rgba(124,58,237,0.5)' }, transition: 'all 0.3s' }}>
                    Get Started
                  </Button>
                  <Button variant="outlined" onClick={() => scrollTo('About')}
                    sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', fontSize: '1.1rem', fontWeight: 800, px: 5, py: 2, borderRadius: '50px', '&:hover': { background: 'rgba(255,255,255,0.1)', borderColor: '#fff' } }}>
                    Learn More
                  </Button>
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ position: 'relative', height: '500px', perspective: '1000px' }}>
                <GlassCard sx={{ position: 'absolute', top: '10%', right: '10%', width: '80%', height: '80%', background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.2)', animation: 'float 6s ease-in-out infinite', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <MonitorHeart sx={{ fontSize: 120, mb: 3, color: '#60a5fa', filter: 'drop-shadow(0 10px 20px rgba(96,165,250,0.5))' }} />
                  <Typography variant="h4" fontWeight="800">AI Analysis</Typography>
                  <Typography color="#94a3b8">Active Monitoring</Typography>
                </GlassCard>
                <GlassCard sx={{ position: 'absolute', bottom: '0', left: '0', width: '60%', p: 3, animation: 'float 8s ease-in-out infinite reverse', background: 'rgba(15,23,42,0.6)' }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Science sx={{ color: '#c084fc', fontSize: 40 }} />
                    <Box>
                      <Typography fontWeight="bold">Risk Score</Typography>
                      <Typography variant="body2" color="#34d399">Optimized</Typography>
                    </Box>
                  </Stack>
                </GlassCard>
              </Box>
            </Grid>
          </Grid>
        </Container>

        {/* App Preview / Teaser Section */}
        <Container id="watch-demo" maxWidth="lg" sx={{ py: { xs: 10, md: 15 }, position: 'relative', zIndex: 2 }}>
          <Box textAlign="center" mb={6}>
            <Typography variant="h6" color="#f472b6" fontWeight="bold" letterSpacing={2} mb={1}>SEE IT IN ACTION</Typography>
            <Typography variant="h2" fontWeight="900" mb={2}>App Preview</Typography>
            <Typography variant="h5" color="#94a3b8" maxWidth="800px" mx="auto" fontWeight={400}>
              Take a closer look at GlycoFit's features and modern experience in this comprehensive walkthrough.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            {/* Soft glow behind the video */}
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', background: 'radial-gradient(ellipse, rgba(244,114,182,0.15) 0%, transparent 60%)', filter: 'blur(50px)', zIndex: -1 }} />
            
            <GlassCard sx={{ p: { xs: 1, md: 2 }, width: '100%', maxWidth: '1000px', aspectRatio: '16/9', borderRadius: '32px', '&:hover': { borderColor: '#f472b6', transform: 'scale(1.02) translateY(-5px)', boxShadow: '0 40px 80px rgba(244, 114, 182, 0.2)' } }}>
              <Box sx={{ width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden', background: '#000', position: 'relative' }}>
                <iframe 
                  src="https://drive.google.com/file/d/1ShD4zt1XBlQMGj2KrCScq0Itq3_8ttm4/preview" 
                  width="100%" 
                  height="100%" 
                  title="GlycoFit Teaser"
                  allow="autoplay" 
                  style={{ border: 'none', position: 'absolute', top: 0, left: 0 }}
                ></iframe>
              </Box>
            </GlassCard>
          </Box>
        </Container>

        {/* 2 & 3. About Us */}
        <Container id="about" maxWidth="lg" sx={{ py: 15 }}>
          <Box textAlign="center" mb={10}>
            <Typography variant="h6" color="#3b82f6" fontWeight="bold" letterSpacing={2} mb={1}>THE PLATFORM</Typography>
            <Typography variant="h2" fontWeight="900" mb={4}>What is GlycoFit?</Typography>
            <Typography variant="h5" color="#94a3b8" maxWidth="800px" mx="auto" fontWeight={400} lineHeight={1.8}>
              An AI-powered web and mobile platform evaluating lifestyle factors like diet, activity, and sleep to estimate prediabetes risk. Focuses on awareness and habit-building not medical diagnosis.
            </Typography>
          </Box>

          <Grid container spacing={4} mb={10}>
            <Grid item xs={12} md={6}>
              <GlassCard sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h3" fontWeight="900" mb={3} sx={{ background: 'linear-gradient(90deg, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Who We Are
                </Typography>
                <Typography variant="h6" color="#cbd5e1" fontWeight={400} lineHeight={1.8}>
                  A health-focused digital platform promoting awareness and prevention of prediabetes and Type 2 Diabetes. We empower users to make informed decisions through data-driven insights and continuous engagement.
                </Typography>
              </GlassCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={4}>
                <GlassCard>
                  <Typography variant="h5" fontWeight="800" mb={2} color="#fff">Our Mission</Typography>
                  <Typography color="#94a3b8" fontSize="1.1rem">To provide accessible, intelligent tools that help individuals understand their health risks and improve daily habits.</Typography>
                </GlassCard>
                <GlassCard>
                  <Typography variant="h5" fontWeight="800" mb={2} color="#fff">Our Vision</Typography>
                  <Typography color="#94a3b8" fontSize="1.1rem">To become a leading digital solution in preventive healthcare by combining AI, lifestyle monitoring, and personalization.</Typography>
                </GlassCard>
              </Stack>
            </Grid>
          </Grid>

          <Typography variant="h4" textAlign="center" fontWeight="900" mb={6}>Core Principles</Typography>
          <Grid container spacing={3} justifyContent="center" alignItems="stretch">
            {corePrinciples.map((item, idx) => (
              <Grid item xs={12} sm={6} md={3} key={idx} sx={{ display: 'flex' }}>
                <GlassCard sx={{ textAlign: 'center', py: 6, height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ display: 'inline-block', p: 2, borderRadius: '20px', background: 'rgba(255,255,255,0.05)', mb: 3 }}>
                    {item.icon}
                  </Box>
                  <Typography variant="h6" fontWeight="bold" lineHeight={1.4}>{item.title}</Typography>
                </GlassCard>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* Developers Section */}
        <Container maxWidth="lg" sx={{ pb: 15 }}>
          <Box sx={{ position: 'relative', pt: 10 }}>
            <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '200px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(192,132,252,0.5), transparent)' }} />
            <Typography variant="h4" textAlign="center" fontWeight="900" mb={8}>Meet the Team</Typography>
            
            {/* Hierarchical Connecting Line (background) */}
            <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: '260px', left: '50%', width: '2px', height: '60px', background: 'rgba(255,255,255,0.1)', transform: 'translateX(-50%)', zIndex: 0 }} />
            <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: '320px', left: '15%', right: '15%', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }} />

            {/* Technical Adviser */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 6, md: 10 }, position: 'relative', zIndex: 1 }}>
              <GlassCard sx={{ textAlign: 'center', p: 4, width: { xs: '100%', sm: '420px' }, '&:hover': { borderColor: '#60a5fa', transform: 'translateY(-5px)' } }}>
                <Box component="img" src="joan.jpg" alt="Mag-isa, Joan C." sx={{ width: 130, height: 130, borderRadius: '50%', mb: 3, objectFit: 'cover', border: '4px solid rgba(96,165,250,0.8)', boxShadow: '0 0 20px rgba(96,165,250,0.3)' }} />
                <Typography variant="h5" fontWeight="900" mb={1}>Mag-isa, Joan C.</Typography>
                <Typography color="#60a5fa" fontWeight="bold" letterSpacing={1}>TECHNICAL ADVISER</Typography>
              </GlassCard>
            </Box>

            {/* Developers */}
            <Grid container spacing={4} justifyContent="center" alignItems="stretch" position="relative" zIndex={1}>
              {[
                { name: 'Cabasa, Daniel O.', role: 'Fullstack Developer', img: 'dan.png', color: '#c084fc', border: 'rgba(192,132,252,0.8)' },
                { name: 'Diaz, Romel Jan C.', role: 'Documentation', img: 'romel.jpg', color: '#f472b6', border: 'rgba(244,114,182,0.8)' },
                { name: 'Esquivel, Cassley Ann Mina A.', role: 'UI/UX Designer', img: 'cassley.jpg', color: '#34d399', border: 'rgba(52,211,153,0.8)' },
                { name: 'Lebosada, Jury Andrew Nathaniel', role: 'AI/ML Engineer', img: 'jury.jpg', color: '#fbbf24', border: 'rgba(251,191,36,0.8)' }
              ].map((dev, idx) => (
                <Grid item xs={12} sm={6} md={3} key={idx} sx={{ display: 'flex' }}>
                  <GlassCard sx={{ textAlign: 'center', p: 4, height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', '&:hover': { borderColor: dev.color, transform: 'translateY(-5px)' } }}>
                    <Box component="img" src={dev.img} alt={dev.name} sx={{ width: 100, height: 100, borderRadius: '50%', mb: 3, objectFit: 'cover', border: `3px solid ${dev.border}`, boxShadow: `0 0 15px ${dev.border.replace('0.8', '0.2')}` }} />
                    <Typography variant="h6" fontWeight="bold" lineHeight={1.3} mb={1.5}>{dev.name}</Typography>
                    <Typography color={dev.color} fontSize="0.85rem" fontWeight="bold" letterSpacing={1} sx={{ mt: 'auto' }}>{dev.role.toUpperCase()}</Typography>
                  </GlassCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>

        {/* 4. Functionalities */}
        <Box id="features" sx={{ py: 15, position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: '20%', left: '0', width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)' }} />
          <Container maxWidth="xl">
            <Typography variant="h6" color="#c084fc" fontWeight="bold" letterSpacing={2} mb={1} textAlign="center">CAPABILITIES</Typography>
            <Typography variant="h2" fontWeight="900" mb={10} textAlign="center">Key Functionalities</Typography>
          </Container>

          <Box sx={{ overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', width: '100%', py: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              gap: 4,
              animation: 'scroll 40s linear infinite', 
              width: 'max-content',
              pl: 4,
              '&:hover': { animationPlayState: 'paused' }
            }}>
              {[...functionalities, ...functionalities, ...functionalities].map((func, i) => (
                <Box key={i} sx={{ width: { xs: 280, sm: 320, md: 350 }, flexShrink: 0, whiteSpace: 'normal', height: '100%' }}>
                  <GlassCard sx={{ height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { borderColor: '#3b82f6', transform: 'translateY(-5px) scale(1.02)' } }}>
                    <Box sx={{ color: '#fff', mb: 3, display: 'inline-flex', p: 2, background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))', borderRadius: '16px', alignSelf: 'flex-start' }}>
                      {func.icon}
                    </Box>
                    <Typography variant="h5" fontWeight="800" mb={2}>{func.title}</Typography>
                    <Typography color="#94a3b8" fontSize="1.05rem" lineHeight={1.6}>{func.text}</Typography>
                  </GlassCard>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* 5. How it Works */}
        <Container id="how-it-works" maxWidth="lg" sx={{ py: 15 }}>
          <Typography variant="h6" color="#34d399" fontWeight="bold" letterSpacing={2} mb={1} textAlign="center">THE PROCESS</Typography>
          <Typography variant="h2" fontWeight="900" mb={10} textAlign="center">How It Works</Typography>

          <Box sx={{ position: 'relative' }}>
            <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: '50%', left: '5%', right: '5%', height: '4px', background: 'rgba(255,255,255,0.1)', transform: 'translateY(-50%)', zIndex: 0 }} />
            <Grid container spacing={4} position="relative" zIndex={1} alignItems="stretch">
              {steps.map((step, idx) => (
                <Grid item xs={12} md key={idx} sx={{ display: 'flex' }}>
                  <GlassCard sx={{ textAlign: 'center', px: 2, py: 5, background: 'rgba(15, 23, 42, 0.8)', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Typography variant="h1" fontWeight="900" sx={{ color: 'rgba(255,255,255,0.05)', position: 'absolute', top: -10, right: 10, lineHeight: 1 }}>{idx+1}</Typography>
                    <Typography variant="h5" fontWeight="800" color="#fff" mb={2} position="relative">{step.title}</Typography>
                    <Typography color="#94a3b8" position="relative">{step.text}</Typography>
                  </GlassCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>

        {/* 8. Disclaimer / Warning Full Section */}
        <Box sx={{ width: '100%', py: { xs: 8, md: 10 }, background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.2) 50%, rgba(245, 158, 11, 0.1) 100%)', borderTop: '2px solid rgba(245, 158, 11, 0.4)', borderBottom: '2px solid rgba(245, 158, 11, 0.4)', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle warning diagonal stripes in background */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05, backgroundImage: 'repeating-linear-gradient(45deg, #fbbf24 0, #fbbf24 2px, transparent 2px, transparent 15px)', zIndex: 0 }} />
          
          <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 4, md: 6 } }}>
            <Box sx={{ p: 2, background: 'rgba(245, 158, 11, 0.15)', borderRadius: '50%', border: '2px dashed rgba(245, 158, 11, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WarningAmber sx={{ color: '#fbbf24', fontSize: { xs: 60, md: 80 } }} />
            </Box>
            
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography variant="h3" fontWeight="900" color="#fbbf24" mb={2} sx={{ letterSpacing: '1px' }}>
                IMPORTANT DISCLAIMER
              </Typography>
              <Typography color="#fcd34d" variant="h6" fontWeight="400" lineHeight={1.8} sx={{ maxWidth: '850px' }}>
                GlycoFit is a lifestyle risk assessment and monitoring tool. It <strong style={{ color: '#fff', fontWeight: 800 }}>does not provide medical diagnosis</strong> or replace professional healthcare consultation. Users are strictly advised to consult licensed medical professionals for clinical evaluation, diagnosis, and treatment.
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* 10. CTA */}
        <Box id="download" sx={{ py: 15, textAlign: 'center', position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', background: 'radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: -1 }} />
          <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h2" fontWeight="900" mb={4}>Start Your Health Journey</Typography>
            <Typography variant="h5" mb={8} color="#94a3b8">
              Understand your lifestyle. Monitor your habits. Reduce your risk.
            </Typography>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} justifyContent="center">
              <Button variant="contained" size="large" href={GLYCOFIT_APK} download startIcon={<Android sx={{ fontSize: 28 }} />}
                sx={{ background: 'linear-gradient(45deg, #2563eb, #3b82f6)', px: 6, py: 2.5, borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 10px 30px rgba(37,99,235,0.5)', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 15px 40px rgba(37,99,235,0.6)' } }}>
                Download GlycoFit
              </Button>
              <Button variant="outlined" size="large" href={PHYSICIAN_APK} download startIcon={<LocalHospital sx={{ fontSize: 28 }} />}
                sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff', px: 6, py: 2.5, borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', '&:hover': { background: 'rgba(255,255,255,0.15)', borderColor: '#fff', transform: 'translateY(-5px)' } }}>
                For Physicians
              </Button>
            </Stack>
          </Container>
        </Box>

        {/* Footer */}
        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', py: 6, textAlign: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <Typography variant="body1" color="#64748b" mb={2} fontWeight="bold">
            {new Date().getFullYear()} GlycoFit. All rights reserved.
          </Typography>
          <Button size="small" href="/login" sx={{ color: '#475569', fontWeight: 'bold', '&:hover': { color: '#94a3b8' } }}>Admin Login</Button>
        </Box>
      </Box>
    </Box>
  );
}

export default HomePage;
