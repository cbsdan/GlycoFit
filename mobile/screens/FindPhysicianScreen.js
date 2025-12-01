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
    const hasRelationship = physician.relationship_status;
    const isPending = physician.relationship_status === 'pending';
    const isActive = physician.relationship_status === 'active';

    return (
      <View key={physician.id} style={[styles.physicianCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
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
            <View style={[styles.statusBadge, { backgroundColor: '#27AE60' }]}>
              <Icon name="check-circle" size={16} color="#FFFFFF" />
              <Text style={styles.statusText}>Connected</Text>
            </View>
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
    fontSize: 14,
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
});

export default FindPhysicianScreen;
