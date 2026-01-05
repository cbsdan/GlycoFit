import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/api';
import {
  initializeSocket,
  joinConversation,
  leaveConversation,
  sendMessage as sendSocketMessage,
  sendTypingIndicator,
  markMessagesRead,
  onNewMessage,
  onTyping,
  onMessagesRead,
  removeAllListeners,
} from '../services/chatService';

export default function PatientChatScreen({ route, navigation }) {
  const { patient, relationship } = route.params;
  const { colors: theme } = useTheme();
  const { user } = useAuth();
  const flatListRef = useRef(null);
  
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const typingTimeoutRef = useRef(null);

  // Get patient info
  const patientInfo = patient || relationship?.patient;
  const patientFirstName = patientInfo?.first_name || 'Patient';
  const patientLastName = patientInfo?.last_name || '';
  const patientAvatar = patientInfo?.avatar?.url;
  const patientId = patientInfo?._id || patientInfo?.id;
  // relationship can be the full object with 'id' or nested with '_id'
  const relationshipId = relationship?.id || relationship?._id || relationship?.relationship?.id;

  // Get physician user_id from the user object
  const physicianUserId = user?.physician?._id || user?._id || user?.id;

  useEffect(() => {
    initializeChat();
    
    return () => {
      if (conversationId) {
        leaveConversation(conversationId);
      }
      removeAllListeners();
    };
  }, []);

  const initializeChat = async () => {
    try {
      setLoading(true);
      
      // Initialize socket connection
      await initializeSocket();
      
      console.log('Chat init - patientId:', patientId);
      console.log('Chat init - physicianUserId:', physicianUserId);
      console.log('Chat init - relationshipId:', relationshipId);
      console.log('Chat init - patient:', JSON.stringify(patient, null, 2));
      console.log('Chat init - relationship:', JSON.stringify(relationship, null, 2));
      console.log('Chat init - user:', JSON.stringify(user, null, 2));
      
      if (!patientId || !physicianUserId || !relationshipId) {
        console.error('Missing required IDs:', { patientId, physicianUserId, relationshipId });
        setLoading(false);
        return;
      }
      
      const response = await chatService.getOrCreateConversation(
        patientId,
        physicianUserId,
        relationshipId
      );
      
      if (response.success && response.conversation) {
        const convId = response.conversation._id;
        setConversationId(convId);
        
        // Join conversation room
        joinConversation(convId, 'physician');
        
        // Load messages
        await loadMessages(convId);
        
        // Setup socket listeners
        setupSocketListeners();
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId, loadMore = false) => {
    try {
      const skip = loadMore ? messages.length : 0;
      const response = await chatService.getMessages(convId, 50, skip);
      
      if (response.success && response.messages) {
        const formattedMessages = response.messages.map(msg => ({
          id: msg._id,
          text: msg.content,
          sender: msg.sender_role,
          timestamp: msg.created_at,
          read: msg.read,
          messageType: msg.message_type,
          image_url: msg.message_type === 'image' ? msg.content : null,
        }));
        
        if (loadMore) {
          // Prepend older messages to the top
          setMessages(prev => [...formattedMessages, ...prev]);
        } else {
          setMessages(formattedMessages);
          // Trigger scroll to bottom on initial load
          setShouldScrollToEnd(true);
          // Mark messages as read after initial load
          if (formattedMessages.length > 0) {
            setTimeout(() => {
              console.log('📨 Marking messages as read for conversation:', convId);
              markMessagesRead(convId, 'physician');
            }, 500);
          }
        }
        
        // Check if there are more messages
        setHasMore(response.messages.length === 50);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const setupSocketListeners = () => {
    // Listen for new messages
    onNewMessage((data) => {
      const newMessage = {
        id: data._id,
        text: data.content,
        sender: data.sender_role,
        timestamp: data.created_at,
        read: data.read,
        messageType: data.message_type,
        image_url: data.message_type === 'image' ? data.content : null,
      };
      
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
      
      // Auto scroll to bottom for own messages or if user is near bottom
      if (data.sender_role === 'physician') {
        setShouldScrollToEnd(true);
        setShowScrollButton(false);
        setNewMessageCount(0);
      } else if (isNearBottom) {
        // Auto-scroll for received messages only if near bottom
        setShouldScrollToEnd(true);
        setNewMessageCount(0);
      } else {
        // User scrolled up, increment new message count
        setNewMessageCount(prev => prev + 1);
      }
      
      // Mark as read if from patient
      if (data.sender_role === 'patient' && conversationId) {
        console.log('📨 New message from patient, marking as read');
        markMessagesRead(conversationId, 'physician');
      }
    });

    // Listen for typing indicator
    onTyping((data) => {
      if (data.user_role === 'patient') {
        setOtherUserTyping(data.is_typing);
      }
    });

    // Listen for messages read
    onMessagesRead((data) => {
      console.log('📖 Messages read event received:', data);
      console.log('Current conversation:', conversationId);
      console.log('Event conversation:', data.conversation_id);
      
      // Only update if it's for this conversation and patient read physician's messages
      if (data.conversation_id === conversationId && data.reader_role === 'patient') {
        console.log('✅ Marking physician messages as read');
        setMessages(prev => {
          const updated = prev.map(msg => {
            if (msg.sender === 'physician') {
              console.log('Updating message:', msg.id, 'from read:', msg.read, 'to true');
              return { ...msg, read: true };
            }
            return msg;
          });
          return updated;
        });
      } else {
        console.log('❌ Not updating - wrong conversation or reader role');
      }
    });
  };

  const handlePickImage = async (source = 'library') => {
    try {
      setShowImageOptions(false);
      
      let result;
      if (source === 'library') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        await handleSendImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleSendImage = async (imageUri) => {
    if (!conversationId || sendingImage) return;

    setSendingImage(true);
    
    // Create temporary message ID for optimistic UI
    const tempId = `temp_${Date.now()}`;
    const tempMessage = {
      id: tempId,
      text: imageUri,
      sender: 'physician',
      timestamp: new Date().toISOString(),
      read: false,
      messageType: 'image',
      image_url: imageUri,
      isUploading: true,
    };
    
    // Add temporary message immediately
    setMessages(prev => [...prev, tempMessage]);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    try {
      const response = await chatService.sendImageMessage(conversationId, imageUri);
      
      if (response.success && response.message) {
        // Replace temporary message with actual message
        const newMessage = {
          id: response.message._id,
          text: response.message.content,
          sender: response.message.sender_role,
          timestamp: response.message.created_at,
          read: response.message.read,
          messageType: response.message.message_type,
          image_url: response.message.image_url || response.message.content,
        };
        
        setMessages(prev => {
          // Remove temp message and add real message
          const filtered = prev.filter(m => m.id !== tempId);
          // Check if real message already exists (from socket)
          if (filtered.some(m => m.id === newMessage.id)) {
            return filtered;
          }
          return [...filtered, newMessage];
        });
        
        setSelectedImage(null);
      }
    } catch (error) {
      console.error('Error sending image:', error);
      // Remove temporary message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSendingImage(false);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !conversationId || sending) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      // Try to send via socket first
      const socketSent = sendSocketMessage(
        conversationId,
        physicianUserId,
        'physician',
        content
      );

      // If socket failed, use HTTP fallback
      if (!socketSent) {
        await chatService.sendMessage(conversationId, content);
      }
      
      // Stop typing indicator
      if (isTyping) {
        sendTypingIndicator(conversationId, 'physician', false);
        setIsTyping(false);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text) => {
    setMessageText(text);
    
    if (!conversationId) return;
    
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      sendTypingIndicator(conversationId, 'physician', true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        sendTypingIndicator(conversationId, 'physician', false);
      }
    }, 2000);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !conversationId) return;
    
    setLoadingMore(true);
    await loadMessages(conversationId, true);
    setLoadingMore(false);
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    
    // Show button if scrolled up more than 200 pixels from bottom
    setShowScrollButton(distanceFromBottom > 200);
    
    // Track if user is near bottom (within 100 pixels)
    setIsNearBottom(distanceFromBottom < 100);
    
    // Clear new message count if scrolled near bottom
    if (distanceFromBottom < 100) {
      setNewMessageCount(0);
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 999999, animated: true });
    setShowScrollButton(false);
    setNewMessageCount(0);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item }) => {
    const isPatient = item.sender === 'patient';
    const isImageMessage = item.messageType === 'image' || item.image_url;
    
    return (
      <View style={[
        styles.messageContainer,
        isPatient ? styles.patientMessageContainer : styles.physicianMessageContainer,
        isImageMessage && { width: '100%' },
      ]}>
        {isPatient && (
          <View style={styles.avatarContainer}>
            {patientAvatar ? (
              <Image 
                source={{ uri: patientAvatar }} 
                style={styles.messageAvatar} 
              />
            ) : (
              <View style={[styles.messageAvatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.messageAvatarText}>
                  {patientFirstName[0]}{patientLastName[0] || ''}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          {
            backgroundColor: isPatient ? theme.card : theme.primary,
            borderColor: isPatient ? theme.border : theme.primary,
            maxWidth: isImageMessage ? '75%' : '75%',
            width: isImageMessage ? '65%' : 'auto',
          }
        ]}>
          {isPatient && (
            <Text style={[styles.senderName, { color: theme.primary }]}>
              {patientFirstName} {patientLastName}
            </Text>
          )}
          {isImageMessage ? (
            <TouchableOpacity onPress={() => !item.isUploading && setPreviewImage(item.image_url || item.text)}>
              <Image 
                source={{ uri: item.image_url || item.text }} 
                style={styles.messageImage} 
                resizeMode="cover"
              />
              {item.isUploading && (
                <View style={styles.imageUploadingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={[
              styles.messageText,
              { color: isPatient ? theme.text : '#FFFFFF' }
            ]}>
              {item.text}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[
              styles.timestamp,
              { color: isPatient ? theme.secondary : '#FFFFFF', opacity: 0.7 }
            ]}>
              {formatTime(item.timestamp)}
            </Text>
            {!isPatient && (
              <Ionicons 
                name={item.read ? 'checkmark-done' : 'checkmark'} 
                size={14} 
                color={item.read ? '#34D399' : '#FFFFFF'} 
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.secondary }]}>
            Loading conversation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: theme.background }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        enabled={true}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <View style={styles.headerPatientInfo}>
            {patientAvatar ? (
              <Image 
                source={{ uri: patientAvatar }} 
                style={styles.headerAvatar} 
              />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.headerAvatarText}>
                  {patientFirstName[0]}{patientLastName[0] || ''}
                </Text>
              </View>
            )}
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerName, { color: theme.text }]}>
                {patientFirstName} {patientLastName}
              </Text>
              <Text style={[styles.headerStatus, { color: otherUserTyping ? theme.primary : theme.secondary }]}>
                {otherUserTyping ? 'Typing...' : 'Patient'}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.emptyList
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          onContentSizeChange={() => {
            if (shouldScrollToEnd) {
              setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 999999, animated: true });
                setShouldScrollToEnd(false);
              }, 100);
            }
          }}
          onLayout={() => {
            if (shouldScrollToEnd && messages.length > 0) {
              setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 999999, animated: false });
                setShouldScrollToEnd(false);
              }, 200);
            }
          }}
          ListHeaderComponent={loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : null}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={64} color={theme.secondary} />
              <Text style={[styles.emptyText, { color: theme.secondary }]}>
                No messages yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.secondary }]}>
                Start the conversation with your patient
              </Text>
            </View>
          )}
        />

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <TouchableOpacity
            style={[styles.scrollToBottomButton, { backgroundColor: theme.primary }]}
            onPress={scrollToBottom}
          >
            {newMessageCount > 0 && (
              <View style={styles.newMessageBadge}>
                <Text style={styles.newMessageBadgeText}>{newMessageCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
            {newMessageCount > 0 && (
              <Text style={styles.newMessageText}>New</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={() => setShowImageOptions(true)}
          >
            <Ionicons name="attach" size={24} color={theme.secondary} />
          </TouchableOpacity>
          
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border,
              }
            ]}
            placeholder="Type a message..."
            placeholderTextColor={theme.secondary}
            value={messageText}
            onChangeText={handleTyping}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: messageText.trim() && !sending ? theme.primary : theme.border }
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Image Options Modal */}
      <Modal
        visible={showImageOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImageOptions(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Send Image</Text>
            
            <TouchableOpacity 
              style={[styles.modalOption, { borderBottomColor: theme.border }]}
              onPress={() => handlePickImage('camera')}
            >
              <Ionicons name="camera" size={24} color={theme.primary} />
              <Text style={[styles.modalOptionText, { color: theme.text }]}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalOption]}
              onPress={() => handlePickImage('library')}
            >
              <Ionicons name="image" size={24} color={theme.primary} />
              <Text style={[styles.modalOptionText, { color: theme.text }]}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalCancel}
              onPress={() => setShowImageOptions(false)}
            >
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity 
            style={styles.imagePreviewClose}
            onPress={() => setPreviewImage(null)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <Image 
            source={{ uri: previewImage }} 
            style={styles.imagePreviewFull}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 4,
  },
  headerPatientInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerStatus: {
    fontSize: 12,
  },
  moreButton: {
    padding: 4,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  emptyList: {
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  patientMessageContainer: {
    justifyContent: 'flex-start',
  },
  physicianMessageContainer: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    marginRight: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  timestamp: {
    fontSize: 11,
  },
  readIcon: {
    marginLeft: 4,
  },
  spacer: {
    width: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  attachButton: {
    padding: 8,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 16,
  },
  modalCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  imagePreviewFull: {
    width: '100%',
    height: '100%',
  },
  imageUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  uploadingText: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  newMessageBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  newMessageBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  newMessageText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});
