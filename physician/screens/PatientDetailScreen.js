import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { patientAPI, soapNoteAPI, physicianAPI } from '../services/api';
import MEDICINES from '../assets/medicines.json';

const { width } = Dimensions.get('window');

// ===== SOAP TEMPLATES =====
// Keep only a minimal blank template. All other templates are user-managed and stored per-physician.
const SOAP_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank',
    icon: 'document-outline',
    color: '#6B7280',
    description: 'Start from scratch',
    data: {
      subjective: '',
      objective: { physical_exam_findings: '' },
      assessment: '',
      plan: '',
      prescriptions: [],
      follow_up_required: false,
    },
  },
];

export default function PatientDetailScreen({ route, navigation }) {
  const { patient, relationship } = route.params;
  const { colors: theme } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  // SOAP / Consultation state
  const [soapNotes, setSoapNotes] = useState([]);
  const [soapLoading, setSoapLoading] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showSoapModal, setShowSoapModal] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [userTemplates, setUserTemplates] = useState([]);
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [vitalsForm, setVitalsForm] = useState({ ogtt: '', fasting_blood_sugar: '', hba1c: '' });
  const [soapForm, setSoapForm] = useState({
    subjective: '',
    objective: { physical_exam_findings: '' },
    assessment: '',
    plan: '',
    prescriptions: [],
    follow_up_required: false,
  });
  const [newRx, setNewRx] = useState({ medication: '', dosage: '', frequency: '', duration: '' });
  const [showMedSuggestions, setShowMedSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', data: null, useCurrentForm: false });

  const filteredMeds = MEDICINES.filter((m) => {
    if (newRx.medication.length === 0) return false;
    const q = newRx.medication.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.brand && m.brand.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
  });

  const fetchSoapNotes = useCallback(async () => {
    try {
      setSoapLoading(true);
      const patientId = patient.id || patient._id;
      const response = await soapNoteAPI.getByPatient(patientId);
      if (response.success) {
        setSoapNotes(response.data || []);
      }
    } catch (e) {
      console.error('Error fetching SOAP notes:', e);
    } finally {
      setSoapLoading(false);
    }
  }, [patient]);

  useEffect(() => {
    fetchPatientDetails();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await physicianAPI.getTemplates();
      if (res && res.success) {
        setUserTemplates(res.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch templates', e);
    }
  };

  useEffect(() => {
    if (selectedTab === 'consultations') fetchSoapNotes();
  }, [selectedTab, fetchSoapNotes]);

  const fetchPatientDetails = async () => {
    try {
      setLoading(true);
      const patientId = patient.id || patient._id;
      const response = await patientAPI.getPatientDetails(patientId);
      
      if (response.success) {
        setPatientData(response.data);
      } else {
        // Use the passed patient data as fallback
        setPatientData({
          ...patient,
          health_data: {},
          tracking_data: {},
          prescriptions: [],
          consultations: [],
          appointments: [],
        });
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
      // Use passed data as fallback
      setPatientData({
        ...patient,
        health_data: {},
        tracking_data: {},
        prescriptions: [],
        consultations: [],
        appointments: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const openTemplateManager = () => {
    fetchTemplates();
    setShowTemplateManager(true);
  };

  const openEditTemplate = (tpl) => {
    setEditingTemplate(tpl || null);
    setTemplateForm({
      name: tpl ? tpl.name : '',
      description: tpl ? tpl.description : '',
      data: tpl ? tpl.data : soapForm,
      useCurrentForm: tpl ? false : true,
    });
    setShowTemplateEditor(true);
  };

  const handleSaveTemplate = async () => {
    try {
      setSubmitting(true);
      const payload = {
        name: templateForm.name,
        description: templateForm.description,
        data: templateForm.useCurrentForm ? soapForm : (templateForm.data || { subjective: '', objective: { physical_exam_findings: '' }, assessment: '', plan: '', prescriptions: [], follow_up_required: false }),
      };
      // Validate required fields
      if (!payload.name || String(payload.name).trim().length === 0) {
        showToast('Template name is required', 'error');
        setSubmitting(false);
        return;
      }
      let res;
      if (editingTemplate) {
        res = await physicianAPI.updateTemplate(editingTemplate.id, payload);
      } else {
        res = await physicianAPI.createTemplate(payload);
      }
      if (res && res.success) {
        showToast(editingTemplate ? 'Template updated' : 'Template created', 'success');
        // Close editor/manager
        setShowTemplateManager(false);
        setEditingTemplate(null);
        setTemplateForm({ name: '', description: '', data: null, useCurrentForm: false });
        setShowTemplateEditor(false);
        fetchTemplates();

        // If a new template was just created, open the SOAP modal prefilled with the template data
        if (!editingTemplate) {
          try {
            const tplData = payload.data || {};
            setSoapForm({
              subjective: tplData.subjective || '',
              objective: { ...(tplData.objective || { physical_exam_findings: '' }) },
              assessment: tplData.assessment || '',
              plan: tplData.plan || '',
              prescriptions: tplData.prescriptions ? [...tplData.prescriptions] : [],
              follow_up_required: tplData.follow_up_required || false,
            });
            setShowSoapModal(true);
          } catch (e) {
            console.error('Failed to open SOAP from template', e);
          }
        }
      }
    } catch (e) {
      console.error('Failed to save template', e);
      showToast('Failed to save template', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (tplId) => {
    try {
      const confirmed = true; // Could add confirmation UI
      if (!confirmed) return;
      const res = await physicianAPI.deleteTemplate(tplId);
      if (res && res.success) {
        showToast('Template deleted', 'success');
        fetchTemplates();
      }
    } catch (e) {
      console.error('Failed to delete template', e);
      showToast('Failed to delete template', 'error');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPatientDetails();
    setRefreshing(false);
  };

  const getGlucoseStatus = (level) => {
    if (!level) return { color: theme.secondary, status: 'No data', icon: 'help-circle' };
    if (level < 70) return { color: theme.error, status: 'Low', icon: 'arrow-down-circle' };
    if (level < 100) return { color: theme.success, status: 'Normal', icon: 'checkmark-circle' };
    if (level < 126) return { color: theme.warning, status: 'Pre-diabetic', icon: 'alert-circle' };
    return { color: theme.error, status: 'High', icon: 'arrow-up-circle' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Patient Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.secondary, marginTop: 16 }}>Loading patient data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const data = patientData || patient;
  const healthInfo = data.health_info || {};
  const healthData = data.health_data || {};
  const trackingData = data.tracking_data || {};
  const glucoseStatus = getGlucoseStatus(healthInfo.glucose_level || healthData.latest_glucose);

  const renderOverview = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Patient Info Card */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.patientHeader}>
          <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {data.first_name?.charAt(0) || '?'}{data.last_name?.charAt(0) || ''}
            </Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={[styles.patientName, { color: theme.text }]}>
              {`${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown Patient'}
            </Text>
            <Text style={[styles.patientEmail, { color: theme.secondary }]}>
              {data.email || 'No email'}
            </Text>
            {data.phone && (
              <Text style={[styles.patientPhone, { color: theme.secondary }]}>
                <Ionicons name="call-outline" size={14} /> {data.phone}
              </Text>
            )}
          </View>
        </View>
        
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={18} color={theme.secondary} />
            <Text style={[styles.infoLabel, { color: theme.secondary }]}>Patient Since</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {formatDate(data.relationship?.acceptance_date || relationship?.acceptance_date)}
            </Text>
          </View>
        </View>
      </View>

      {/* Health Overview - Comprehensive Health Tracking */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Health Overview</Text>
      
      {/* Diabetes Assessment */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.trackingHeader}>
          <Ionicons name="medical" size={22} color={theme.primary} />
          <Text style={[styles.trackingTitle, { color: theme.text }]}>Assessment Result</Text>
        </View>
        <View style={styles.trackingContent}>
          <View style={styles.trackingRow}>
            <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Risk Level:</Text>
            <Text style={[styles.trackingValue, { 
              color: trackingData.diabetes_assessment?.risk_level === 'low' ? theme.success : 
                     trackingData.diabetes_assessment?.risk_level === 'moderate' ? theme.warning : 
                     trackingData.diabetes_assessment?.risk_level === 'high' ? theme.error : theme.secondary
            }]}>
              {trackingData.diabetes_assessment?.risk_level?.toUpperCase() || 'N/A'}
            </Text>
          </View>
          <View style={styles.trackingRow}>
            <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Probability:</Text>
            <Text style={[styles.trackingValue, { color: theme.text }]}>
              {trackingData.diabetes_assessment?.percentage ? `${trackingData.diabetes_assessment.percentage.toFixed(1)}%` : 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      {/* Food Tracker */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.trackingHeader}>
          <Ionicons name="restaurant" size={22} color={theme.success} />
          <Text style={[styles.trackingTitle, { color: theme.text }]}>Food Tracker</Text>
        </View>
        {!trackingData.food_tracker?.has_data ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>N/A</Text>
        ) : trackingData.food_tracker.baseline_only ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>
            Baseline assessment completed. No daily logs yet.
          </Text>
        ) : (
          <View style={styles.trackingContent}>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Risk Score:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.food_tracker.risk_score ? `${trackingData.food_tracker.risk_score.toFixed(1)}/100` : 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Category:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.food_tracker.risk_category || 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Meals Analyzed:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.food_tracker.meals_analyzed ? `${trackingData.food_tracker.meals_analyzed} (last 7 days)` : 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Step Counter */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.trackingHeader}>
          <Ionicons name="footsteps" size={22} color={theme.primary} />
          <Text style={[styles.trackingTitle, { color: theme.text }]}>Step Counter</Text>
        </View>
        {!trackingData.step_counter?.has_data ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>N/A</Text>
        ) : trackingData.step_counter.baseline_only ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>
            Baseline set. No daily tracking data yet.
          </Text>
        ) : (
          <View style={styles.trackingContent}>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Avg Steps (7d):</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.step_counter.avg_steps_7d ? trackingData.step_counter.avg_steps_7d.toLocaleString() : 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Activity Level:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.step_counter.activity_level || 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Risk Category:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.step_counter.risk_category || 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Sleep Tracking */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.trackingHeader}>
          <Ionicons name="moon" size={22} color={theme.secondary} />
          <Text style={[styles.trackingTitle, { color: theme.text }]}>Sleep Tracking</Text>
        </View>
        {!trackingData.sleep_tracking?.has_data ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>N/A</Text>
        ) : (
          <View style={styles.trackingContent}>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Avg Sleep (7d):</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.sleep_tracking.avg_sleep_7d ? `${trackingData.sleep_tracking.avg_sleep_7d.toFixed(1)} hrs` : 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Risk Category:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.sleep_tracking.risk_category || 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Days Tracked:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.sleep_tracking.days_tracked || 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Smoking Intake */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.trackingHeader}>
          <Ionicons name="ban" size={22} color={theme.error} />
          <Text style={[styles.trackingTitle, { color: theme.text }]}>Smoking Intake</Text>
        </View>
        {!trackingData.smoking_intake?.has_data ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>N/A</Text>
        ) : (
          <View style={styles.trackingContent}>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Status:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.smoking_intake.smoking_status === 'never' ? 'Never Smoked' :
                 trackingData.smoking_intake.smoking_status === 'former' ? 'Former Smoker' : 
                 trackingData.smoking_intake.smoking_status === 'current' ? 'Current Smoker' : 'N/A'}
              </Text>
            </View>
            {trackingData.smoking_intake.smoking_status === 'current' && (
              <View style={styles.trackingRow}>
                <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Avg/day (7d):</Text>
                <Text style={[styles.trackingValue, { color: theme.text }]}>
                  {trackingData.smoking_intake.avg_cigarettes_7d ? `${trackingData.smoking_intake.avg_cigarettes_7d.toFixed(1)} cigarettes` : 'N/A'}
                </Text>
              </View>
            )}
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Risk Category:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.smoking_intake.risk_category || 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Alcohol Intake */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.trackingHeader}>
          <Ionicons name="wine" size={22} color={theme.warning} />
          <Text style={[styles.trackingTitle, { color: theme.text }]}>Alcohol Intake</Text>
        </View>
        {!trackingData.alcohol_intake?.has_data ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>N/A</Text>
        ) : trackingData.alcohol_intake.baseline_only ? (
          <Text style={[styles.baselineOnlyText, { color: theme.secondary }]}>
            Baseline assessment completed. No daily logs yet.
          </Text>
        ) : (
          <View style={styles.trackingContent}>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Drinks/week (7d):</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.alcohol_intake.drinks_per_week_7d ? trackingData.alcohol_intake.drinks_per_week_7d.toFixed(1) : 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Pattern:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.alcohol_intake.consumption_pattern || 'N/A'}
              </Text>
            </View>
            <View style={styles.trackingRow}>
              <Text style={[styles.trackingLabel, { color: theme.secondary }]}>Risk Category:</Text>
              <Text style={[styles.trackingValue, { color: theme.text }]}>
                {trackingData.alcohol_intake.risk_category || 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );

  // ========== SOAP / CONSULTATIONS TAB ==========
  const handleSubmitVitals = async () => {
    try {
      setSubmitting(true);
      const patientId = patient.id || patient._id;
      const payload = {
        patient_id: patientId,
        consultation_mode: 'quick_vitals',
        ogtt: vitalsForm.ogtt ? parseFloat(vitalsForm.ogtt) : null,
        fasting_blood_sugar: vitalsForm.fasting_blood_sugar ? parseFloat(vitalsForm.fasting_blood_sugar) : null,
        hba1c: vitalsForm.hba1c ? parseFloat(vitalsForm.hba1c) : null,
      };
      let res;
      if (editingNote && editingNote.consultation_mode === 'quick_vitals') {
        res = await soapNoteAPI.update(editingNote.id, payload);
      } else {
        res = await soapNoteAPI.create(payload);
      }
      if (res.success) {
        showToast(editingNote ? 'Vitals updated' : 'Quick vitals logged', 'success');
        setShowVitalsModal(false);
        setVitalsForm({ ogtt: '', fasting_blood_sugar: '', hba1c: '' });
        setEditingNote(null);
        fetchSoapNotes();
      }
    } catch (e) {
      showToast('Failed to log vitals', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const addPrescriptionItem = () => {
    if (!newRx.medication.trim()) return;
    setSoapForm(prev => ({
      ...prev,
      prescriptions: [...prev.prescriptions, { ...newRx }],
    }));
    setNewRx({ medication: '', dosage: '', frequency: '', duration: '' });
  };

  const removePrescriptionItem = (index) => {
    setSoapForm(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== index),
    }));
  };

  const handleDeleteNote = (noteId) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this consultation note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await soapNoteAPI.delete(noteId);
              if (res.success) {
                showToast('Note deleted', 'success');
                fetchSoapNotes();
              }
            } catch (e) {
              showToast('Failed to delete note', 'error');
            }
          },
        },
      ]
    );
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
      if (note.consultation_mode === 'quick_vitals') {
      const obj = note.soap_objective || {};
      setVitalsForm({
        ogtt: obj.ogtt != null ? String(obj.ogtt) : '',
        fasting_blood_sugar: obj.fasting_blood_sugar != null ? String(obj.fasting_blood_sugar) : '',
        hba1c: obj.hba1c != null ? String(obj.hba1c) : '',
      });
      setShowVitalsModal(true);
    } else {
      const obj = note.soap_objective || {};
      setSoapForm({
        subjective: note.soap_subjective || '',
        objective: {
          physical_exam_findings: obj.physical_exam_findings || '',
        },
        assessment: note.soap_assessment || '',
        plan: note.soap_plan || '',
        prescriptions: note.soap_prescriptions ? [...note.soap_prescriptions] : [],
        follow_up_required: note.follow_up_required || false,
      });
      setShowSoapModal(true);
    }
  };

  const handleSubmitSOAP = async () => {
    try {
      setSubmitting(true);
      const patientId = patient.id || patient._id;
      const payload = {
        patient_id: patientId,
        consultation_mode: 'full',
        subjective: soapForm.subjective,
        objective: {
          physical_exam_findings: soapForm.objective.physical_exam_findings,
        },
        assessment: soapForm.assessment,
        plan: soapForm.plan,
        prescriptions: soapForm.prescriptions,
        follow_up_required: soapForm.follow_up_required,
      };
      let res;
      if (editingNote && editingNote.consultation_mode === 'full') {
        res = await soapNoteAPI.update(editingNote.id, payload);
      } else {
        res = await soapNoteAPI.create(payload);
      }
      if (res.success) {
        showToast(editingNote ? 'Consultation updated' : 'Consultation created', 'success');
        setShowSoapModal(false);
        setSoapForm({
          subjective: '',
          objective: { physical_exam_findings: '' },
          assessment: '',
          plan: '',
          prescriptions: [],
          follow_up_required: false,
        });
        setEditingNote(null);
        fetchSoapNotes();
      }
    } catch (e) {
      showToast('Failed to create note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderConsultations = () => (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={soapLoading} onRefresh={fetchSoapNotes} />}
      >
        {/* Action Buttons */}
        <View style={styles.soapActionRow}>
          <TouchableOpacity
            style={[styles.soapActionBtn, { backgroundColor: theme.warning + '18', borderColor: theme.warning }]}
            onPress={() => setShowVitalsModal(true)}
          >
            <Ionicons name="pulse" size={22} color={theme.warning} />
            <Text style={[styles.soapActionBtnText, { color: theme.warning }]}>Log Quick Vitals</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.soapActionBtn, { backgroundColor: theme.primary + '18', borderColor: theme.primary }]}
            onPress={async () => { await fetchTemplates(); setShowTemplatePicker(true); }}
          >
            <Ionicons name="document-text" size={22} color={theme.primary} />
            <Text style={[styles.soapActionBtnText, { color: theme.primary }]}>New Consultation</Text>
          </TouchableOpacity>
        </View>

        {/* History */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Consultation History</Text>

        {soapLoading && soapNotes.length === 0 ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 24 }} />
        ) : soapNotes.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={48} color={theme.secondary} />
              <Text style={[styles.emptyText, { color: theme.secondary }]}>No consultation records yet</Text>
            </View>
          </View>
        ) : (
          soapNotes.map((note) => {
            const isQuick = note.consultation_mode === 'quick_vitals';
            const isExpanded = expandedNoteId === note.id;
            const obj = note.soap_objective || {};
            return (
              <View key={note.id} style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
                {/* Header row */}
                <View style={styles.noteHeaderRow}>
                  <View style={[styles.noteTypeBadge, { backgroundColor: isQuick ? theme.warning + '20' : theme.primary + '20' }]}>
                    <Ionicons name={isQuick ? 'pulse' : 'document-text'} size={14} color={isQuick ? theme.warning : theme.primary} />
                    <Text style={[styles.noteTypeBadgeText, { color: isQuick ? theme.warning : theme.primary }]}>
                      {isQuick ? 'Quick Vitals' : 'Full Consultation'}
                    </Text>
                  </View>
                  <View style={styles.noteActions}>
                    <TouchableOpacity style={styles.noteActionBtn} onPress={() => handleEditNote(note)}>
                      <Ionicons name="create-outline" size={18} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.noteActionBtn} onPress={() => handleDeleteNote(note.id)}>
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.noteDate, { color: theme.secondary, marginBottom: 6 }]}>
                  {formatDateTime(note.created_at)}
                  {note.updated_at && note.updated_at !== note.created_at ? `  ·  Updated ${formatDateTime(note.updated_at)}` : ''}
                </Text>

                {/* Always show vitals */}
                <View style={styles.vitalsGrid}>
                  {obj.ogtt != null && (
                    <View style={[styles.vitalChip, { backgroundColor: theme.background }]}>
                      <Text style={[styles.vitalChipLabel, { color: theme.secondary }]}>OGTT</Text>
                      <Text style={[styles.vitalChipValue, { color: theme.text }]}>{obj.ogtt}</Text>
                    </View>
                  )}
                  {obj.fasting_blood_sugar != null && (
                    <View style={[styles.vitalChip, { backgroundColor: theme.background }]}>
                      <Text style={[styles.vitalChipLabel, { color: theme.secondary }]}>FBS</Text>
                      <Text style={[styles.vitalChipValue, { color: theme.text }]}>{obj.fasting_blood_sugar} mg/dL</Text>
                    </View>
                  )}
                  {obj.hba1c != null && (
                    <View style={[styles.vitalChip, { backgroundColor: theme.background }]}>
                      <Text style={[styles.vitalChipLabel, { color: theme.secondary }]}>HbA1c</Text>
                      <Text style={[styles.vitalChipValue, { color: theme.text }]}>{obj.hba1c}%</Text>
                    </View>
                  )}
                </View>

                {/* Summary: objective snippet, prescriptions summary, follow-up flag (only when not expanded) */}
                {!isExpanded && (
                  <>
                    {note.soap_prescriptions && note.soap_prescriptions.length > 0 ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.smallLabel, { color: theme.secondary }]}>Prescriptions</Text>
                        <Text numberOfLines={1} style={[styles.smallText, { color: theme.text }]}>{note.soap_prescriptions.map(r => r.medication).join(', ')}</Text>
                      </View>
                    ) : null}

                    {note.follow_up_required ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <Ionicons name="checkbox" size={18} color={theme.primary} />
                        <Text style={{ color: theme.text, marginLeft: 8 }}>Follow-up required</Text>
                      </View>
                    ) : null}
                  </>
                )}

                {/* For full consultations, show expand button */}
                {!isQuick && (
                  <>
                    <TouchableOpacity
                      style={[styles.viewSoapBtn, { borderColor: theme.primary }]}
                      onPress={() => setExpandedNoteId(isExpanded ? null : note.id)}
                    >
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.primary} />
                      <Text style={[styles.viewSoapBtnText, { color: theme.primary }]}> 
                        {isExpanded ? 'Hide Consultation' : 'View Consultation'}
                      </Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.soapExpandedContent}>
                        {/* S */}
                        <View style={styles.soapSection}>
                          <Text style={[styles.soapSectionLabel, { color: theme.primary }]}>S — Subjective</Text>
                          <Text style={[styles.soapSectionText, { color: theme.text }]}>
                            {note.soap_subjective || 'N/A'}
                          </Text>
                        </View>
                        {/* O — Physical Exam (always show in expanded view, show 'N/A' if empty) */}
                        <View style={styles.soapSection}>
                          <Text style={[styles.soapSectionLabel, { color: theme.warning }]}>O — Physical Exam Findings</Text>
                          <Text style={[styles.soapSectionText, { color: theme.text }]}>
                            {obj.physical_exam_findings || 'N/A'}
                          </Text>
                        </View>
                        {/* A */}
                        <View style={styles.soapSection}>
                          <Text style={[styles.soapSectionLabel, { color: theme.error }]}>A — Assessment</Text>
                          <Text style={[styles.soapSectionText, { color: theme.text }]}>
                            {note.soap_assessment || 'N/A'}
                          </Text>
                        </View>
                        {/* P */}
                        <View style={styles.soapSection}>
                          <Text style={[styles.soapSectionLabel, { color: theme.success }]}>P — Plan</Text>
                          <Text style={[styles.soapSectionText, { color: theme.text }]}>
                            {note.soap_plan || 'N/A'}
                          </Text>
                        </View>
                        {/* Prescriptions */}
                        {note.soap_prescriptions && note.soap_prescriptions.length > 0 && (
                          <View style={styles.soapSection}>
                            <Text style={[styles.soapSectionLabel, { color: theme.primary }]}>Prescriptions</Text>
                            {note.soap_prescriptions.map((rx, i) => (
                              <View key={i} style={[styles.rxItem, { borderColor: theme.border }]}>
                                <Text style={[styles.rxName, { color: theme.text }]}>{rx.medication}</Text>
                                <Text style={[styles.rxDetail, { color: theme.secondary }]}>
                                  {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(' · ')}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ===== QUICK VITALS MODAL ===== */}
      <Modal visible={showVitalsModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingNote ? 'Edit Quick Vitals' : 'Log Quick Vitals'}</Text>
                <TouchableOpacity onPress={() => { setShowVitalsModal(false); setEditingNote(null); }}>
                  <Ionicons name="close" size={24} color={theme.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Oral Glucose Tolerance Test (mg/dL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. 140"
                  placeholderTextColor={theme.secondary}
                  keyboardType="decimal-pad"
                  value={vitalsForm.ogtt}
                  onChangeText={(v) => setVitalsForm(p => ({ ...p, ogtt: v }))}
                />

                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Fasting Blood Sugar (mg/dL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. 100"
                  placeholderTextColor={theme.secondary}
                  keyboardType="decimal-pad"
                  value={vitalsForm.fasting_blood_sugar}
                  onChangeText={(v) => setVitalsForm(p => ({ ...p, fasting_blood_sugar: v }))}
                />

                <Text style={[styles.inputLabel, { color: theme.secondary }]}>HbA1c (%)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. 5.7"
                  placeholderTextColor={theme.secondary}
                  keyboardType="decimal-pad"
                  value={vitalsForm.hba1c}
                  onChangeText={(v) => setVitalsForm(p => ({ ...p, hba1c: v }))}
                />
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.warning, opacity: submitting ? 0.6 : 1 }]}
                onPress={handleSubmitVitals}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>{editingNote ? 'Update Vitals' : 'Save Vitals'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ===== TEMPLATE MANAGER MODAL ===== */}
      <Modal visible={showTemplateManager} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.templateManagerContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Manage Templates</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setShowTemplateManager(false)}>
                  <Ionicons name="close" size={24} color={theme.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalBody}>
              {(userTemplates || []).length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color={theme.secondary} />
                  <Text style={[styles.emptyText, { color: theme.secondary }]}>No custom templates</Text>
                </View>
              ) : (
                (userTemplates || []).map((tpl) => (
                  <View key={tpl.id} style={[styles.templateRow, { borderColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.templateName, { color: theme.text }]}>{tpl.name}</Text>
                      <Text style={[styles.templateDesc, { color: theme.secondary }]} numberOfLines={2}>{tpl.description}</Text>
                    </View>
                    <View style={styles.templateActions}>
                      <TouchableOpacity onPress={() => openEditTemplate(tpl)} style={{ marginRight: 12 }}>
                        <Ionicons name="create-outline" size={20} color={theme.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteTemplate(tpl.id)}>
                        <Ionicons name="trash-outline" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 18 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== TEMPLATE EDIT MODAL ===== */}
      <Modal visible={showTemplateEditor} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingTemplate ? 'Edit Template' : 'New Template'}</Text>
                <TouchableOpacity onPress={() => { setEditingTemplate(null); setShowTemplateManager(false); setShowTemplateEditor(false); setTemplateForm({ name: '', description: '', data: null, useCurrentForm: false }); }}>
                  <Ionicons name="close" size={24} color={theme.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Template Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. Routine Diabetes Check-up"
                  placeholderTextColor={theme.secondary}
                  value={templateForm.name}
                  onChangeText={(v) => setTemplateForm(p => ({ ...p, name: v }))}
                />

                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Description</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Short description"
                  placeholderTextColor={theme.secondary}
                  value={templateForm.description}
                  onChangeText={(v) => setTemplateForm(p => ({ ...p, description: v }))}
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <TouchableOpacity onPress={() => setTemplateForm(p => ({ ...p, useCurrentForm: !p.useCurrentForm }))}>
                    <Ionicons name={templateForm.useCurrentForm ? 'checkbox' : 'square-outline'} size={22} color={theme.primary} />
                  </TouchableOpacity>
                  <Text style={{ color: theme.text, marginLeft: 8 }}>Use current form as template data</Text>
                </View>

                <View style={{ height: 12 }} />
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, opacity: submitting ? 0.6 : 1 }]}
                onPress={handleSaveTemplate}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSubmitBtnText}>{editingTemplate ? 'Update Template' : 'Create Template'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== TEMPLATE PICKER MODAL ===== */}
      <Modal visible={showTemplatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.templatePickerContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choose a Template</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => { openEditTemplate(null); setShowTemplatePicker(false); }} style={{ marginRight: 12 }}>
                  <Text style={{ color: theme.primary }}>New</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={openTemplateManager} style={{ marginRight: 12 }}>
                  <Text style={{ color: theme.primary }}>Manage</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTemplatePicker(false)}>
                  <Ionicons name="close" size={24} color={theme.secondary} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {(() => {
                const combined = [
                  ...(userTemplates || []).map((t) => ({ ...t, isCustom: true })),
                  ...SOAP_TEMPLATES.map((t) => ({ ...t, isCustom: false }))
                ];
                return combined.map((tpl) => (
                  <TouchableOpacity
                    key={tpl.id}
                    style={[styles.templateCard, { backgroundColor: (tpl.color || '#3B82F6') + '10', borderColor: (tpl.color || '#3B82F6') + '40' }]}
                    onPress={() => {
                      const data = tpl.data || tpl;
                      setSoapForm({
                        subjective: data.subjective || '',
                        objective: { ...(data.objective || { physical_exam_findings: '' }) },
                        assessment: data.assessment || '',
                        plan: data.plan || '',
                        prescriptions: data.prescriptions ? [...data.prescriptions] : [],
                        follow_up_required: data.follow_up_required || false,
                      });
                      setShowTemplatePicker(false);
                      setShowSoapModal(true);
                    }}
                  >
                    <View style={[styles.templateIconWrap, { backgroundColor: (tpl.color || '#3B82F6') + '20' }]}>
                      <Ionicons name={tpl.icon || 'document-text'} size={24} color={tpl.color || '#3B82F6'} />
                    </View>
                    <View style={styles.templateInfo}>
                      <Text style={[styles.templateName, { color: theme.text }]}>{tpl.name}</Text>
                      <Text style={[styles.templateDesc, { color: theme.secondary }]}>{tpl.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.secondary} />
                  </TouchableOpacity>
                ));
              })()}
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== FULL SOAP MODAL ===== */}
      <Modal visible={showSoapModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContentFull, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingNote ? 'Edit Consultation' : 'New Consultation'}</Text>
                <TouchableOpacity onPress={() => { setShowSoapModal(false); setEditingNote(null); }}>
                  <Ionicons name="close" size={24} color={theme.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* S — Subjective */}
                <Text style={[styles.soapFormSectionTitle, { color: theme.primary }]}>S — Subjective</Text>
                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Patient Complaints / History</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Describe patient's complaints, history..."
                  placeholderTextColor={theme.secondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={soapForm.subjective}
                  onChangeText={(v) => setSoapForm(p => ({ ...p, subjective: v }))}
                />

                {/* O — Objective */}
                <Text style={[styles.soapFormSectionTitle, { color: theme.warning }]}>O — Objective</Text>

                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Physical Exam Findings</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Describe physical exam findings..."
                  placeholderTextColor={theme.secondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={soapForm.objective.physical_exam_findings}
                  onChangeText={(v) => setSoapForm(p => ({ ...p, objective: { ...p.objective, physical_exam_findings: v } }))}
                />

                {/* A — Assessment */}
                <Text style={[styles.soapFormSectionTitle, { color: theme.error }]}>A — Assessment</Text>
                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Diagnosis</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Enter diagnosis..."
                  placeholderTextColor={theme.secondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={soapForm.assessment}
                  onChangeText={(v) => setSoapForm(p => ({ ...p, assessment: v }))}
                />

                {/* P — Plan */}
                <Text style={[styles.soapFormSectionTitle, { color: theme.success }]}>P — Plan</Text>
                <Text style={[styles.inputLabel, { color: theme.secondary }]}>Treatment / Lifestyle Advice</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Enter treatment plan, lifestyle advice..."
                  placeholderTextColor={theme.secondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={soapForm.plan}
                  onChangeText={(v) => setSoapForm(p => ({ ...p, plan: v }))}
                />

                {/* Prescription Builder */}
                <Text style={[styles.inputLabel, { color: theme.secondary, marginTop: 8 }]}>Prescription List</Text>
                {soapForm.prescriptions.map((rx, i) => (
                  <View key={i} style={[styles.rxRow, { borderColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rxName, { color: theme.text }]}>{rx.medication}</Text>
                      <Text style={[styles.rxDetail, { color: theme.secondary }]}>
                        {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removePrescriptionItem(i)}>
                      <Ionicons name="trash-outline" size={20} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={[styles.rxBuilder, { borderColor: theme.border }]}>
                  <View style={{ zIndex: 10 }}>
                    <TextInput
                      style={[styles.rxInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      placeholder="Medication"
                      placeholderTextColor={theme.secondary}
                      value={newRx.medication}
                      onChangeText={(v) => {
                        setNewRx(p => ({ ...p, medication: v }));
                        setShowMedSuggestions(v.length > 0);
                      }}
                      onFocus={() => setShowMedSuggestions(newRx.medication.length > 0)}
                    />
                    {showMedSuggestions && filteredMeds.length > 0 && (
                      <View style={[styles.suggestionDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        {filteredMeds.map((med) => (
                          <TouchableOpacity
                            key={med.id}
                            style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
                            onPress={() => {
                              setNewRx(p => ({ ...p, medication: med.name }));
                              setShowMedSuggestions(false);
                            }}
                          >
                            <Ionicons name="medical" size={16} color={theme.primary} style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.suggestionName, { color: theme.text }]}>{med.name}</Text>
                              <Text style={[styles.suggestionDetail, { color: theme.secondary }]}>
                                {med.brand}{med.category ? ` · ${med.category}` : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.rxInputRow}>
                    <TextInput
                      style={[styles.rxInputSmall, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      placeholder="Dosage"
                      placeholderTextColor={theme.secondary}
                      value={newRx.dosage}
                      onChangeText={(v) => setNewRx(p => ({ ...p, dosage: v }))}
                    />
                    <TextInput
                      style={[styles.rxInputSmall, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      placeholder="Frequency"
                      placeholderTextColor={theme.secondary}
                      value={newRx.frequency}
                      onChangeText={(v) => setNewRx(p => ({ ...p, frequency: v }))}
                    />
                    <TextInput
                      style={[styles.rxInputSmall, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      placeholder="Duration"
                      placeholderTextColor={theme.secondary}
                      value={newRx.duration}
                      onChangeText={(v) => setNewRx(p => ({ ...p, duration: v }))}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.addRxBtn, { backgroundColor: theme.primary + '15' }]}
                    onPress={addPrescriptionItem}
                  >
                    <Ionicons name="add-circle" size={20} color={theme.primary} />
                    <Text style={[styles.addRxBtnText, { color: theme.primary }]}>Add Prescription</Text>
                  </TouchableOpacity>
                </View>

                {/* Follow-up toggle */}
                <TouchableOpacity
                  style={styles.followUpToggle}
                  onPress={() => setSoapForm(p => ({ ...p, follow_up_required: !p.follow_up_required }))}
                >
                  <Ionicons
                    name={soapForm.follow_up_required ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={theme.primary}
                  />
                  <Text style={[styles.followUpToggleText, { color: theme.text }]}>Follow-up Required</Text>
                </TouchableOpacity>

                <View style={{ height: 16 }} />
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.primary, opacity: submitting ? 0.6 : 1 }]}
                onPress={handleSubmitSOAP}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>{editingNote ? 'Update Note' : 'Save Note'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );

  const renderMedications = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="medkit" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Active Prescriptions</Text>
        </View>
        
        {(data.prescriptions && data.prescriptions.length > 0) ? (
          data.prescriptions.map((rx, index) => (
            <View key={rx.id || index} style={[styles.medicationItem, { borderBottomColor: theme.border }]}>
              <View style={styles.medicationInfo}>
                <Text style={[styles.medicationName, { color: theme.text }]}>{rx.medication_name}</Text>
                <Text style={[styles.medicationDosage, { color: theme.secondary }]}>
                  {rx.dosage} - {rx.frequency}
                </Text>
                <Text style={[styles.medicationDate, { color: theme.secondary }]}>
                  Started: {formatDate(rx.start_date)}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
                <Text style={[styles.statusText, { color: theme.success }]}>Active</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyText, { color: theme.secondary }]}>No active prescriptions</Text>
          </View>
        )}
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Consultations History */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="videocam" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Consultations</Text>
        </View>
        
        {(data.consultations && data.consultations.length > 0) ? (
          data.consultations.slice(0, 5).map((consultation, index) => (
            <View key={consultation.id || index} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
              <View style={styles.historyIcon}>
                <Ionicons name="videocam-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  Video Consultation
                </Text>
                <Text style={[styles.historyDate, { color: theme.secondary }]}>
                  {formatDateTime(consultation.scheduled_date)}
                </Text>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: consultation.status === 'completed' ? theme.success + '20' : theme.warning + '20' }
              ]}>
                <Text style={[
                  styles.statusText, 
                  { color: consultation.status === 'completed' ? theme.success : theme.warning }
                ]}>
                  {consultation.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyText, { color: theme.secondary }]}>No consultation history</Text>
          </View>
        )}
      </View>

      {/* Appointments History */}
      <View style={[styles.card, { backgroundColor: theme.card, ...theme.shadow, marginTop: 16 }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar" size={24} color={theme.success} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Appointments</Text>
        </View>
        
        {(data.appointments && data.appointments.length > 0) ? (
          data.appointments.slice(0, 5).map((apt, index) => (
            <View key={apt.id || index} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
              <View style={styles.historyIcon}>
                <Ionicons name="location-outline" size={20} color={theme.success} />
              </View>
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  {apt.type || 'In-Person Visit'}
                </Text>
                <Text style={[styles.historyDate, { color: theme.secondary }]}>
                  {formatDateTime(apt.date)}
                </Text>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: apt.status === 'completed' ? theme.success + '20' : theme.primary + '20' }
              ]}>
                <Text style={[
                  styles.statusText, 
                  { color: apt.status === 'completed' ? theme.success : theme.primary }
                ]}>
                  {apt.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.secondary} />
            <Text style={[styles.emptyText, { color: theme.secondary }]}>No appointment history</Text>
          </View>
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {`${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Patient Details'}
        </Text>
        <TouchableOpacity 
          style={styles.chatIconButton}
          onPress={() => navigation.navigate('PatientChat', { patient: data, relationship })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {['overview', 'consultations', 'medications', 'history'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                selectedTab === tab && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setSelectedTab(tab)}
            >
            <Ionicons
              name={
                tab === 'overview' ? 'person' :
                tab === 'consultations' ? 'clipboard' :
                tab === 'medications' ? 'medkit' : 'time'
              }
              size={18}
              color={selectedTab === tab ? theme.primary : theme.secondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === tab ? theme.primary : theme.secondary },
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'consultations' && renderConsultations()}
        {selectedTab === 'medications' && renderMedications()}
        {selectedTab === 'history' && renderHistory()}
      </View>

      {/* Fixed Bottom Send Message Button */}
      <View style={[styles.fixedBottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.sendMessageButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('PatientChat', { patient: data, relationship })}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
          <Text style={styles.sendMessageButtonText}>Send Message</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  chatIconButton: {
    padding: 4,
  },
  tabContainer: {
    borderBottomWidth: 1,
  },
  tabScrollContent: {
    flexGrow: 1,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
    minWidth: 130,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  patientInfo: {
    flex: 1,
    marginLeft: 16,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  patientEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  patientPhone: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    width: (width - 48) / 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  metricInfo: {
    marginLeft: 12,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  medicationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '500',
  },
  medicationDosage: {
    fontSize: 14,
    marginTop: 2,
  },
  medicationDate: {
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  historyDate: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  trackingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  trackingContent: {
    gap: 8,
  },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  trackingLabel: {
    fontSize: 14,
    flex: 1,
  },
  trackingValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  baselineOnlyText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  fixedBottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  sendMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  sendMessageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // ===== SOAP / Consultation Styles =====
  soapActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  soapActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  soapActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  templatePickerContent: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  templateManagerContent: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  templateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  templateDesc: {
    fontSize: 12,
  },
  noteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteActionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  noteTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  noteTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteDate: {
    fontSize: 12,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  vitalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  vitalChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  vitalChipValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  viewSoapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 4,
  },
  viewSoapBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  soapExpandedContent: {
    marginTop: 12,
    gap: 10,
  },
  soapSection: {
    marginBottom: 4,
  },
  soapSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  soapSectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  rxItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
  },
  rxName: {
    fontSize: 14,
    fontWeight: '600',
  },
  rxDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  // ===== Modal Styles =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    maxHeight: '65%',
  },
  modalContainerFull: {
    width: '100%',
    maxHeight: '90%',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: 500,
  },
  modalContentFull: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 80,
  },
  soapFormSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 2,
  },
  rxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  rxBuilder: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderStyle: 'dashed',
  },
  rxInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  rxInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rxInputSmall: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
  },
  addRxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  suggestionDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionDetail: {
    fontSize: 11,
    marginTop: 1,
  },
  addRxBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  followUpToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  followUpToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalSubmitBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
