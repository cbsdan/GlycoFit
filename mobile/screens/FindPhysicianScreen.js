import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const FindPhysicianScreen = ({ navigation }) => {
  const { colors: theme } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all'); // all, my-physician, pending

  const [allPhysicians, setAllPhysicians] = useState([]);
  const [myPhysicians, setMyPhysicians] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  const [selectedPhysician, setSelectedPhysician] = useState(null);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestUrgency, setRequestUrgency] = useState('low');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Consultation request states
  const [consultationModalVisible, setConsultationModalVisible] = useState(false);
  const [consultationPhysician, setConsultationPhysician] = useState(null);
  const [consultationDate, setConsultationDate] = useState(new Date());
  const [consultationTime, setConsultationTime] = useState('09:00');
  const [consultationReason, setConsultationReason] = useState('');
  const [sendingConsultation, setSendingConsultation] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAvailablePhysicians(),
        fetchMyPhysicians()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load physicians');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchAvailablePhysicians = async () => {
    try {
      const response = await api.getAvailablePhysicians();
      if (response.success) {
        setAllPhysicians(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching physicians:', error);
    }
  };

  const fetchMyPhysicians = async () => {
    try {
      const response = await api.getMyPhysician();
      if (response.success) {
        const data = response.data || [];
        setMyPhysicians(data.filter(item => item.relationship.status === 'active'));
        setPendingRequests(data.filter(item => item.relationship.status === 'pending'));
      }
    } catch (error) {
      console.error('Error fetching my physicians:', error);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedPhysician) return;

    try {
      setSendingRequest(true);
      const response = await api.sendPhysicianRequest(
        selectedPhysician.id,
        requestReason,
        requestUrgency
      );

      if (response.success) {
        toast.success('Request sent successfully!');
        setRequestModalVisible(false);
        setRequestReason('');
        setRequestUrgency('low');
        setSelectedPhysician(null);
        await loadData();
      }
    } catch (error) {
      console.error('Error sending request:', error);
      toast.error(error.response?.data?.error || 'Failed to send request');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      const response = await api.cancelPhysicianRequest(requestId);
      if (response.success) {
        toast.success('Request cancelled');
        await loadData();
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel request');
    }
  };

  const handleDisconnect = async (relationshipId) => {
    try {
      const response = await api.disconnectPhysician(relationshipId);
      if (response.success) {
        toast.success('Disconnected from physician');
        await loadData();
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    }
  };

  // Consultation request functions
  const openConsultationModal = (item) => {
    setConsultationPhysician(item);
    setConsultationDate(new Date());
    setConsultationTime('09:00');
    setConsultationReason('');
    setConsultationModalVisible(true);
  };

  const handleSendConsultationRequest = async () => {
    if (!consultationReason.trim()) {
      toast.error('Please enter a reason for appointment');
      return;
    }

    try {
      setSendingConsultation(true);
      // Use 'id' instead of '_id' - the API returns 'id' from to_safe_dict
      const physicianId = consultationPhysician?.physician?.id || consultationPhysician?.physician?._id;

      console.log('=== CONSULTATION DEBUG ===');
      console.log('consultationPhysician:', JSON.stringify(consultationPhysician, null, 2));
      console.log('physicianId:', physicianId);
      console.log('=== END DEBUG ===');

      if (!physicianId) {
        toast.error('Unable to find physician ID');
        return;
      }

      await api.createConsultation(
        physicianId,
        consultationDate.toISOString(),
        consultationTime,
        'video',
        30,
        consultationReason.trim(),
        ''
      );

      toast.success('Consultation request sent!');
      setConsultationModalVisible(false);
      setConsultationReason('');
      setConsultationPhysician(null);
    } catch (error) {
      console.error('Error sending consultation request:', error);
      toast.error(error.response?.data?.message || 'Failed to send consultation request');
    } finally {
      setSendingConsultation(false);
    }
  };

  const openRequestModal = (physician) => {
    setSelectedPhysician(physician);
    setRequestModalVisible(true);
  };

  const getFilteredPhysicians = () => {
    if (!searchQuery) return allPhysicians;

    const query = searchQuery.toLowerCase();
    return allPhysicians.filter(physician => {
      const fullName = `${physician.user.first_name} ${physician.user.last_name}`.toLowerCase();
      const specialization = physician.specialization?.toLowerCase() || '';
      return fullName.includes(query) || specialization.includes(query);
    });
  };

  const renderPhysicianCard = (physician) => {
    // Check if this physician is in myPhysicians or pendingRequests
    const relationshipItem = myPhysicians.find(p =>
      p.physician.id === physician.id ||
      p.physician._id === physician.id ||
      p.physician.id === physician._id ||
      p.physician._id === physician._id
    );
    const pendingItem = pendingRequests.find(p =>
      p.physician.id === physician.id ||
      p.physician._id === physician.id ||
      p.physician.id === physician._id ||
      p.physician._id === physician._id
    );

    const isActive = !!relationshipItem;
    const isPending = !!pendingItem;
    const hasRelationship = isActive || isPending;

    return (
      <View key={physician.id || physician._id} style={[styles.physicianCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.physicianHeader}>
          <View style={styles.avatarContainer}>
            {physician.user.avatar?.url ? (
              <Image source={{ uri: physician.user.avatar.url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>
                  {physician.user.first_name[0]}{physician.user.last_name[0]}
                </Text>
              </View>
            )}
            {physician.is_active && (
              <View style={[styles.activeBadge, { backgroundColor: '#27AE60' }]}>
                <Icon name="check" size={10} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.physicianInfo}>
            <Text style={[styles.physicianName, { color: theme.text }]}>
              Dr. {physician.user.first_name} {physician.user.last_name}
            </Text>
            <Text style={[styles.physicianSpecialization, { color: theme.secondary }]}>
              {physician.specialization}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Icon name="star" size={14} color="#F39C12" />
                <Text style={[styles.statText, { color: theme.secondary }]}>
                  {physician.rating.toFixed(1)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="account-group" size={14} color={theme.secondary} />
                <Text style={[styles.statText, { color: theme.secondary }]}>
                  {physician.total_patients} patients
                </Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="calendar-check" size={14} color={theme.secondary} />
                <Text style={[styles.statText, { color: theme.secondary }]}>
                  {physician.years_of_experience} years
                </Text>
              </View>
            </View>

            {physician.bio && (
              <Text style={[styles.bio, { color: theme.secondary }]} numberOfLines={2}>
                {physician.bio}
              </Text>
            )}

            {physician.languages && physician.languages.length > 0 && (
              <View style={styles.languagesContainer}>
                {physician.languages.slice(0, 3).map((lang, index) => (
                  <View key={index} style={[styles.languageTag, { backgroundColor: theme.background }]}>
                    <Text style={[styles.languageText, { color: theme.secondary }]}>{lang}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionContainer}>
          {!hasRelationship && (
            <TouchableOpacity
              style={[styles.requestButton, { backgroundColor: theme.primary }]}
              onPress={() => openRequestModal(physician)}
            >
              <Icon name="send" size={18} color="#FFFFFF" />
              <Text style={styles.requestButtonText}>Send Request</Text>
            </TouchableOpacity>
          )}

          {isPending && (
            <View style={[styles.statusBadge, { backgroundColor: '#F39C12' }]}>
              <Icon name="clock-outline" size={16} color="#FFFFFF" />
              <Text style={styles.statusText}>Request Pending</Text>
            </View>
          )}

          {isActive && (
            <>
              <View style={[styles.statusBadge, { backgroundColor: '#27AE60', marginBottom: 10 }]}>
                <Icon name="check-circle" size={16} color="#FFFFFF" />
                <Text style={styles.statusText}>Connected</Text>
              </View>
              <View style={styles.quickActionsRow}>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    if (relationshipItem) {
                      navigation.navigate('PhysicianMessages', { relationship: relationshipItem });
                    }
                  }}
                >
                  <Icon name="chat" size={18} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: '#27AE60' }]}
                  onPress={() => {
                    if (relationshipItem) {
                      openConsultationModal(relationshipItem);
                    }
                  }}
                >
                  <Icon name="video-plus" size={18} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Request Appointment</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderMyPhysicianCard = (item) => {
    const physician = item.physician;
    const relationship = item.relationship;

    return (
      <TouchableOpacity
        key={relationship.id}
        style={[styles.physicianCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => navigation.navigate('PhysicianCommunication', { relationship: item })}
        activeOpacity={0.7}
      >
        <View style={styles.physicianHeader}>
          <View style={styles.avatarContainer}>
            {physician.user.avatar?.url ? (
              <Image source={{ uri: physician.user.avatar.url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>
                  {physician.user.first_name[0]}{physician.user.last_name[0]}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.physicianInfo}>
            <Text style={[styles.physicianName, { color: theme.text }]}>
              Dr. {physician.user.first_name} {physician.user.last_name}
            </Text>
            <Text style={[styles.physicianSpecialization, { color: theme.secondary }]}>
              {physician.specialization}
            </Text>
            <Text style={[styles.connectedSince, { color: theme.secondary }]}>
              Connected since {new Date(relationship.acceptance_date).toLocaleDateString()}
            </Text>
          </View>

          <Icon name="chevron-right" size={24} color={theme.secondary} />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.primary }]}
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate('PhysicianMessages', { relationship: item });
            }}
          >
            <Icon name="chat" size={18} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: '#27AE60' }]}
            onPress={(e) => {
              e.stopPropagation();
              openConsultationModal(item);
            }}
          >
            <Icon name="video-plus" size={18} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Request Appointment</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.disconnectButton, { borderColor: '#E74C3C' }]}
          onPress={(e) => {
            e.stopPropagation();
            handleDisconnect(relationship.id);
          }}
        >
          <Icon name="link-off" size={18} color="#E74C3C" />
          <Text style={[styles.disconnectButtonText, { color: '#E74C3C' }]}>Disconnect</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderPendingRequestCard = (item) => {
    const physician = item.physician;
    const relationship = item.relationship;

    return (
      <View key={relationship.id} style={[styles.physicianCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.physicianHeader}>
          <View style={styles.avatarContainer}>
            {physician.user.avatar?.url ? (
              <Image source={{ uri: physician.user.avatar.url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>
                  {physician.user.first_name[0]}{physician.user.last_name[0]}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.physicianInfo}>
            <Text style={[styles.physicianName, { color: theme.text }]}>
              Dr. {physician.user.first_name} {physician.user.last_name}
            </Text>
            <Text style={[styles.physicianSpecialization, { color: theme.secondary }]}>
              {physician.specialization}
            </Text>
            <Text style={[styles.requestDate, { color: theme.secondary }]}>
              Requested on {new Date(relationship.request_date).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: '#E74C3C' }]}
          onPress={() => handleCancelRequest(relationship.id)}
        >
          <Icon name="close" size={18} color="#E74C3C" />
          <Text style={[styles.cancelButtonText, { color: '#E74C3C' }]}>Cancel Request</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const filteredPhysicians = getFilteredPhysicians();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Find Physician</Text>
        <Text style={[styles.subtitle, { color: theme.secondary }]}>
          Connect with healthcare professionals
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'all' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setSelectedTab('all')}
        >
          <Text style={[styles.tabText, { color: selectedTab === 'all' ? theme.primary : theme.secondary }]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'my-physician' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setSelectedTab('my-physician')}
        >
          <Text style={[styles.tabText, { color: selectedTab === 'my-physician' ? theme.primary : theme.secondary }]}>
            My Physician {myPhysicians.length > 0 && `(${myPhysicians.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'pending' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setSelectedTab('pending')}
        >
          <Text style={[styles.tabText, { color: selectedTab === 'pending' ? theme.primary : theme.secondary }]}>
            Pending {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar - Only show in 'all' tab */}
      {selectedTab === 'all' && (
        <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Icon name="magnify" size={20} color={theme.secondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name or specialization..."
            placeholderTextColor={theme.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={20} color={theme.secondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
      >
        {selectedTab === 'all' && (
          <>
            {filteredPhysicians.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="doctor" size={80} color={theme.secondary} />
                <Text style={[styles.emptyText, { color: theme.secondary }]}>
                  {searchQuery ? 'No physicians found matching your search' : 'No physicians available'}
                </Text>
              </View>
            ) : (
              filteredPhysicians.map(physician => renderPhysicianCard(physician))
            )}
          </>
        )}

        {selectedTab === 'my-physician' && (
          <>
            {myPhysicians.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="account-heart" size={80} color={theme.secondary} />
                <Text style={[styles.emptyText, { color: theme.secondary }]}>
                  You don't have a physician yet
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.secondary }]}>
                  Browse available physicians and send a request
                </Text>
              </View>
            ) : (
              myPhysicians.map(item => renderMyPhysicianCard(item))
            )}
          </>
        )}

        {selectedTab === 'pending' && (
          <>
            {pendingRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="clock-outline" size={80} color={theme.secondary} />
                <Text style={[styles.emptyText, { color: theme.secondary }]}>
                  No pending requests
                </Text>
              </View>
            ) : (
              pendingRequests.map(item => renderPendingRequestCard(item))
            )}
          </>
        )}
      </ScrollView>

      {/* Request Modal */}
      <Modal
        visible={requestModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRequestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Send Request</Text>
              <TouchableOpacity onPress={() => setRequestModalVisible(false)}>
                <Icon name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedPhysician && (
              <View style={styles.modalPhysicianInfo}>
                <Text style={[styles.modalPhysicianName, { color: theme.text }]}>
                  Dr. {selectedPhysician.user.first_name} {selectedPhysician.user.last_name}
                </Text>
                <Text style={[styles.modalPhysicianSpec, { color: theme.secondary }]}>
                  {selectedPhysician.specialization}
                </Text>
              </View>
            )}

            <View style={styles.modalForm}>
              <Text style={[styles.label, { color: theme.text }]}>Reason for Request (Optional)</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="Why do you want to connect with this physician?"
                placeholderTextColor={theme.secondary}
                multiline
                numberOfLines={4}
                value={requestReason}
                onChangeText={setRequestReason}
              />

              <Text style={[styles.label, { color: theme.text }]}>Urgency</Text>
              <View style={styles.urgencyContainer}>
                {['low', 'medium', 'high'].map(level => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.urgencyButton,
                      { borderColor: theme.border },
                      requestUrgency === level && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setRequestUrgency(level)}
                  >
                    <Text style={[
                      styles.urgencyText,
                      { color: requestUrgency === level ? '#FFFFFF' : theme.text }
                    ]}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.primary }]}
                onPress={handleSendRequest}
                disabled={sendingRequest}
              >
                {sendingRequest ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>Send Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Consultation Request Modal */}
      <Modal
        visible={consultationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConsultationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Request Appointment</Text>
              <TouchableOpacity onPress={() => setConsultationModalVisible(false)}>
                <Icon name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {consultationPhysician && (
              <View style={styles.modalPhysicianInfo}>
                <Text style={[styles.modalPhysicianName, { color: theme.text }]}>
                  Dr. {consultationPhysician.physician.user.first_name} {consultationPhysician.physician.user.last_name}
                </Text>
                <Text style={[styles.modalPhysicianSpec, { color: theme.secondary }]}>
                  {consultationPhysician.physician.specialization}
                </Text>
              </View>
            )}

            <ScrollView style={styles.modalForm}>
              <Text style={[styles.label, { color: theme.text }]}>Preferred Date *</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="calendar" size={20} color={theme.primary} />
                <Text style={[styles.datePickerText, { color: theme.text }]}>
                  {consultationDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>Preferred Time *</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Icon name="clock-outline" size={20} color={theme.primary} />
                <Text style={[styles.datePickerText, { color: theme.text }]}>
                  {consultationTime}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>Reason for Appointment *</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="Describe the reason for your appointment..."
                placeholderTextColor={theme.secondary}
                multiline
                numberOfLines={4}
                value={consultationReason}
                onChangeText={setConsultationReason}
              />

              <View style={[styles.infoBox, { backgroundColor: theme.info + '15' }]}>
                <Icon name="information" size={20} color={theme.info || '#3498DB'} />
                <Text style={[styles.infoText, { color: theme.info || '#3498DB' }]}>
                  Your physician will review your request.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: '#27AE60' }]}
                onPress={handleSendConsultationRequest}
                disabled={sendingConsultation}
              >
                {sendingConsultation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="video-plus" size={20} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Date</Text>
            <ScrollView style={styles.pickerScroll}>
              {Array.from({ length: 30 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.pickerItem,
                      consultationDate.toDateString() === date.toDateString() && { backgroundColor: theme.primary + '20' }
                    ]}
                    onPress={() => {
                      setConsultationDate(date);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      { color: consultationDate.toDateString() === date.toDateString() ? theme.primary : theme.text }
                    ]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.pickerCloseButton, { borderColor: theme.border }]}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={[styles.pickerCloseText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Time</Text>
            <ScrollView style={styles.pickerScroll}>
              {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
                '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
                '16:00', '16:30', '17:00', '17:30', '18:00'].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.pickerItem,
                      consultationTime === time && { backgroundColor: theme.primary + '20' }
                    ]}
                    onPress={() => {
                      setConsultationTime(time);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      { color: consultationTime === time ? theme.primary : theme.text }
                    ]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.pickerCloseButton, { borderColor: theme.border }]}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={[styles.pickerCloseText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  physicianCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  physicianHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  physicianInfo: {
    flex: 1,
  },
  physicianName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  physicianSpecialization: {
    fontSize: 14,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 12,
    marginLeft: 4,
  },
  bio: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  languagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  languageTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginTop: 4,
  },
  languageText: {
    fontSize: 11,
  },
  actionContainer: {
    marginTop: 8,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  connectedSince: {
    fontSize: 12,
    marginTop: 4,
  },
  requestDate: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalPhysicianInfo: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalPhysicianName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalPhysicianSpec: {
    fontSize: 14,
  },
  modalForm: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  urgencyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  urgencyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Quick actions for my physician cards
  quickActionsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Date picker styles
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  datePickerText: {
    fontSize: 15,
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // Picker modal styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContent: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 16,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerScroll: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  pickerCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default FindPhysicianScreen;
