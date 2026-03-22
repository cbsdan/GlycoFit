import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
} from '@mui/material';
import {
  Android as AndroidIcon,
  Download as DownloadIcon,
  MonitorHeart as MonitorHeartIcon,
  Restaurant as RestaurantIcon,
  Psychology as PsychologyIcon,
  VideoCall as VideoCallIcon,
  LocalHospital as LocalHospitalIcon,
} from '@mui/icons-material';

const GLYCOFIT_APK = 'https://glycofit-downloads.nyc3.cdn.digitaloceanspaces.com/GlycoFit.apk';
const PHYSICIAN_APK = 'https://glycofit-downloads.nyc3.cdn.digitaloceanspaces.com/GlycoFitPhysician.apk';

const features = [
  {
    icon: <MonitorHeartIcon />,
    label: 'Health Tracking',
    desc: 'Monitor lifestyle such as diet, step count, sleep, smoking and alcohol consumption.',
  },
  {
    icon: <RestaurantIcon />,
    label: 'Nutrition Logging',
    desc: 'Track daily meals and nutritional intake with ease.',
  },
  {
    icon: <PsychologyIcon />,
    label: 'AI Risk Assessment',
    desc: 'Get personalised pre-diabetes risk evaluations powered by AI.',
  },
  {
    icon: <VideoCallIcon />,
    label: 'Physician Consultations',
    desc: 'Connect with licensed physicians.',
  },
];

function HomePage() {
  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #667eea 100%)',
          pt: { xs: 8, md: 12 },
          pb: { xs: 10, md: 14 },
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-40%',
            right: '-20%',
            width: '60%',
            height: '120%',
            background: 'radial-gradient(circle, rgba(100,181,246,0.12) 0%, transparent 70%)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '-30%',
            left: '-10%',
            width: '50%',
            height: '80%',
            background: 'radial-gradient(circle, rgba(118,75,162,0.1) 0%, transparent 70%)',
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* Icon badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              mb: 3,
            }}
          >
            <LocalHospitalIcon sx={{ fontSize: 46, color: '#fff' }} />
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              color: '#fff',
              mb: 1.5,
              fontSize: { xs: '2.4rem', md: '3.6rem' },
              letterSpacing: '-0.5px',
            }}
          >
            GlycoFit
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.82)',
              mb: 2.5,
              fontWeight: 400,
              maxWidth: 560,
              mx: 'auto',
              lineHeight: 1.65,
            }}
          >
            Pre-Diabetes Lifestyle Risk Assessment with Ongoing Management &amp; Monitoring
          </Typography>

          <Chip
            label="Available for Android"
            icon={<AndroidIcon sx={{ color: '#a5d6a7 !important' }} />}
            sx={{
              bgcolor: 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
              fontWeight: 500,
              mb: 5,
            }}
          />

          {/* CTA buttons */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            alignItems="center"
          >
            <Button
              variant="contained"
              size="large"
              href={GLYCOFIT_APK}
              download
              startIcon={<DownloadIcon />}
              sx={{
                bgcolor: '#fff',
                color: '#0d47a1',
                fontWeight: 700,
                px: 4,
                py: 1.6,
                borderRadius: 3,
                fontSize: '1rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
                '&:hover': {
                  bgcolor: '#e3f2fd',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
                },
                transition: 'all 0.25s ease',
              }}
            >
              Download GlycoFit
            </Button>

            <Button
              variant="outlined"
              size="large"
              href={PHYSICIAN_APK}
              download
              startIcon={<DownloadIcon />}
              sx={{
                borderColor: 'rgba(255,255,255,0.6)',
                color: '#fff',
                fontWeight: 700,
                px: 4,
                py: 1.6,
                borderRadius: 3,
                fontSize: '1rem',
                backdropFilter: 'blur(8px)',
                background: 'rgba(255,255,255,0.08)',
                '&:hover': {
                  borderColor: '#fff',
                  background: 'rgba(255,255,255,0.18)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.25s ease',
              }}
            >
              Download for Physicians
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── Features ────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
        <Typography
          variant="h5"
          sx={{ textAlign: 'center', fontWeight: 700, color: '#1a237e', mb: 1 }}
        >
          Everything you need to manage your health
        </Typography>
        <Typography
          variant="body1"
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            mb: 6,
            maxWidth: 500,
            mx: 'auto',
          }}
        >
          GlycoFit empowers users and physicians with intelligent tools for diabetes prevention
          and long-term lifestyle management.
        </Typography>

        <Grid container spacing={3}>
          {features.map((f) => (
            <Grid item xs={12} sm={6} md={3} key={f.label}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid rgba(102,126,234,0.15)',
                  boxShadow: '0 8px 28px rgba(15,23,42,0.06)',
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 16px 36px rgba(13,71,161,0.12)',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 1.5,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, rgba(102,126,234,0.14), rgba(118,75,162,0.1))',
                      color: '#667eea',
                      mb: 2,
                    }}
                  >
                    {f.icon}
                  </Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 0.5, color: '#1a237e' }}
                  >
                    {f.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {f.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ── Download Cards ──────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: 'rgba(102,126,234,0.04)',
          py: { xs: 7, md: 11 },
          borderTop: '1px solid rgba(102,126,234,0.12)',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h5"
            sx={{ textAlign: 'center', fontWeight: 700, color: '#1a237e', mb: 1 }}
          >
            Get the App
          </Typography>
          <Typography
            variant="body1"
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              mb: 6,
              maxWidth: 420,
              mx: 'auto',
            }}
          >
            Available for Android. Choose the version that fits your role.
          </Typography>

          <Grid container spacing={4} justifyContent="center">
            {/* ── GlycoFit User App ── */}
            <Grid item xs={12} sm={10} md={5}>
              <Card
                sx={{
                  borderRadius: 4,
                  border: '1px solid rgba(102,126,234,0.2)',
                  boxShadow: '0 12px 40px rgba(13,71,161,0.1)',
                  overflow: 'hidden',
                  position: 'relative',
                  height: '100%',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #667eea, #764ba2)',
                  },
                }}
              >
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2.5,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                        flexShrink: 0,
                      }}
                    >
                      <MonitorHeartIcon sx={{ color: '#fff', fontSize: 28 }} />
                    </Box>
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: '#1a237e', lineHeight: 1.2 }}
                      >
                        GlycoFit
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        For patients &amp; general users
                      </Typography>
                    </Box>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3, lineHeight: 1.75 }}
                  >
                    Track your health metrics, log meals, assess your diabetes risk, and consult
                    with physicians — all from your phone.
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3, flexGrow: 1, alignContent: 'flex-start' }}>
                    {['Risk Assessment', 'Meal Tracking', 'Step Counter', 'AI Chatbot'].map(
                      (tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(102,126,234,0.1)',
                            color: '#667eea',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )
                    )}
                  </Stack>

                  <Button
                    fullWidth
                    variant="contained"
                    href={GLYCOFIT_APK}
                    download
                    startIcon={<AndroidIcon />}
                    sx={{
                      mt: 'auto',
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: 2.5,
                      py: 1.4,
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      boxShadow: '0 6px 20px rgba(102,126,234,0.4)',
                      '&:hover': {
                        background: 'linear-gradient(90deg, #5a6fd6 0%, #6a3d99 100%)',
                        boxShadow: '0 8px 24px rgba(102,126,234,0.5)',
                        transform: 'translateY(-1px)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Download APK
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* ── Physician App ── */}
            <Grid item xs={12} sm={10} md={5}>
              <Card
                sx={{
                  borderRadius: 4,
                  border: '1px solid rgba(19,64,120,0.2)',
                  boxShadow: '0 12px 40px rgba(13,71,161,0.1)',
                  overflow: 'hidden',
                  position: 'relative',
                  height: '100%',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #0d47a1, #1a237e)',
                  },
                }}
              >
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2.5,
                        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                        flexShrink: 0,
                      }}
                    >
                      <LocalHospitalIcon sx={{ color: '#fff', fontSize: 28 }} />
                    </Box>
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: '#1a237e', lineHeight: 1.2 }}
                      >
                        GlycoFit Physician
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        For licensed physicians
                      </Typography>
                    </Box>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3, lineHeight: 1.75 }}
                  >
                    Manage your patients, monitor their health data, conduct video consultations,
                    and provide expert dietary and lifestyle guidance.
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3, flexGrow: 1, alignContent: 'flex-start' }}>
                    {['Patient Management', 'Consultations', 'Health Reports', 'Scheduling'].map(
                      (tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(13,71,161,0.08)',
                            color: '#0d47a1',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )
                    )}
                  </Stack>

                  <Button
                    fullWidth
                    variant="contained"
                    href={PHYSICIAN_APK}
                    download
                    startIcon={<AndroidIcon />}
                    sx={{
                      mt: 'auto',
                      background: 'linear-gradient(90deg, #1a237e 0%, #0d47a1 100%)',
                      borderRadius: 2.5,
                      py: 1.4,
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      boxShadow: '0 6px 20px rgba(13,71,161,0.35)',
                      '&:hover': {
                        background: 'linear-gradient(90deg, #0d1757 0%, #083589 100%)',
                        boxShadow: '0 8px 24px rgba(13,71,161,0.45)',
                        transform: 'translateY(-1px)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Download APK
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(90deg, #1a237e 0%, #0d47a1 100%)',
          py: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          © {new Date().getFullYear()} GlycoFit. All rights reserved.
        </Typography>
        <Button
          size="small"
          href="/login"
          sx={{
            color: 'rgba(255,255,255,0.45)',
            mt: 0.5,
            textTransform: 'none',
            fontSize: '0.75rem',
            '&:hover': { color: '#fff' },
          }}
        >
          Admin Login
        </Button>
      </Box>
    </Box>
  );
}

export default HomePage;
