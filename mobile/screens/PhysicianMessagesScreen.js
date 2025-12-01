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
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';

const PhysicianMessagesScreen = ({ route, navigation }) => {
  const { relationship } = route.params;
  const { colors } = useTheme();
  const flatListRef = useRef(null);
  
  const [messageText, setMessageText] = useState('');
  
  // Example messages (template for later implementation)
  const [messages] = useState([
    {
      id: '1',
      text: 'Hello! How can I help you today?',
      sender: 'physician',
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      read: true,
    },
    {
      id: '2',
      text: 'Hi Dr. ' + relationship.physician.user.last_name + ', I wanted to discuss my recent test results.',
      sender: 'patient',
      timestamp: new Date(Date.now() - 3600000 * 23).toISOString(),
      read: true,
    },
    {
      id: '3',
      text: 'Of course! Your glucose levels have improved significantly since our last visit. Your HbA1c is now at 6.8%, which is a great improvement from 7.4%.',
      sender: 'physician',
      timestamp: new Date(Date.now() - 3600000 * 22).toISOString(),
      read: true,
    },
    {
      id: '4',
      text: 'That\'s wonderful news! What should I continue doing?',
      sender: 'patient',
      timestamp: new Date(Date.now() - 3600000 * 22).toISOString(),
      read: true,
    },
    {
      id: '5',
      text: 'Keep up with your current meal plan and exercise routine. I\'d like to see you maintain regular blood sugar monitoring. Also, make sure to take your medications as prescribed.',
      sender: 'physician',
      timestamp: new Date(Date.now() - 3600000 * 21).toISOString(),
      read: true,
    },
    {
      id: '6',
      text: 'I have been tracking my meals using the GlycoFit app. Should I continue with the same carbohydrate intake?',
      sender: 'patient',
      timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
      read: true,
    },
    {
      id: '7',
      text: 'Yes, that\'s perfect! The app\'s meal tracking has been very helpful in monitoring your progress. Continue with 45-60g of carbs per meal. I can see your compliance has been excellent.',
      sender: 'physician',
      timestamp: new Date(Date.now() - 3600000 * 19).toISOString(),
      read: true,
    },
    {
      id: '8',
      text: 'Thank you so much! When should I schedule my next appointment?',
      sender: 'patient',
      timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
      read: true,
    },
    {
      id: '9',
      text: 'Let\'s schedule a follow-up in 3 months. Please book through the appointments tab. If you experience any unusual symptoms before then, don\'t hesitate to reach out.',
      sender: 'physician',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      read: true,
    },
    {
      id: '10',
      text: 'Will do! Thanks for your continued support.',
      sender: 'patient',
      timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
      read: true,
    },
  ]);

  useEffect(() => {
    // Scroll to bottom when component mounts
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = () => {
    if (messageText.trim()) {
      // TODO: Implement actual message sending
      console.log('Sending message:', messageText);
      setMessageText('');
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
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
    const isPhysician = item.sender === 'physician';
    
    return (
      <View style={[
        styles.messageContainer,
        isPhysician ? styles.physicianMessageContainer : styles.patientMessageContainer
      ]}>
        {isPhysician && (
          <View style={styles.physicianAvatarContainer}>
            {relationship.physician.user.avatar?.url ? (
              <Image 
                source={{ uri: relationship.physician.user.avatar.url }} 
                style={styles.messageAvatar} 
              />
            ) : (
              <View style={[styles.messageAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.messageAvatarText}>
                  {relationship.physician.user.first_name[0]}
                  {relationship.physician.user.last_name[0]}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          {
            backgroundColor: isPhysician ? colors.card : colors.primary,
            borderColor: isPhysician ? colors.border : colors.primary,
          }
        ]}>
          {isPhysician && (
            <Text style={[styles.senderName, { color: colors.primary }]}>
              Dr. {relationship.physician.user.first_name} {relationship.physician.user.last_name}
            </Text>
          )}
          <Text style={[
            styles.messageText,
            { color: isPhysician ? colors.text : '#FFFFFF' }
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.timestamp,
            { color: isPhysician ? colors.secondary : '#FFFFFF', opacity: 0.7 }
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
        
        {!isPhysician && <View style={styles.spacer} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerPhysicianInfo}>
          {relationship.physician.user.avatar?.url ? (
            <Image 
              source={{ uri: relationship.physician.user.avatar.url }} 
              style={styles.headerAvatar} 
            />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.headerAvatarText}>
                {relationship.physician.user.first_name[0]}
                {relationship.physician.user.last_name[0]}
              </Text>
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerName, { color: colors.text }]}>
              Dr. {relationship.physician.user.first_name} {relationship.physician.user.last_name}
            </Text>
            <Text style={[styles.headerSpec, { color: colors.secondary }]}>
              {relationship.physician.specialization}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton}>
          <Icon name="dots-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.attachButton}>
            <Icon name="paperclip" size={24} color={colors.secondary} />
          </TouchableOpacity>
          
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              }
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.secondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: messageText.trim() ? colors.primary : colors.border }
            ]}
            onPress={handleSend}
            disabled={!messageText.trim()}
          >
            <Icon name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Note about example messages */}
      <View style={[styles.exampleNote, { backgroundColor: colors.warning + '20' }]}>
        <Icon name="information" size={16} color={colors.warning} />
        <Text style={[styles.exampleNoteText, { color: colors.warning }]}>
          These are example messages for UI preview. Real messaging feature coming soon!
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerPhysicianInfo: {
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
  headerSpec: {
    fontSize: 12,
  },
  moreButton: {
    padding: 4,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 60,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  physicianMessageContainer: {
    justifyContent: 'flex-start',
  },
  patientMessageContainer: {
    justifyContent: 'flex-end',
  },
  physicianAvatarContainer: {
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
  timestamp: {
    fontSize: 11,
    alignSelf: 'flex-end',
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
  exampleNote: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  exampleNoteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
});

export default PhysicianMessagesScreen;
