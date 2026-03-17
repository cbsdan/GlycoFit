import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator, Linking, Dimensions, Image, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';

const { width } = Dimensions.get('window');

const BloodResultScreen = ({ navigation }) => {
  const { colors } = useTheme();
  
  const [fbs, setFbs] = useState('');
  const [ogtt, setOgtt] = useState('');
  const [hba1c, setHba1c] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);
  
  const fetchHistory = async () => {
    try {
      const res = await api.getVitals();
      if (res && res.success) {
        setHistory(res.data || []);
      }
    } catch (err) {
      console.log('Fetch vitals error:', err);
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled) {
        setImage(result.assets[0]);
      }
    } catch (err) {
      console.log('Image pick error:', err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const getGlucoseStatus = (value, type) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (type === 'fbs') {
      if (num < 100) return { status: 'Normal', color: '#10b981', desc: '< 100 mg/dL' };
      if (num < 126) return { status: 'Prediabetes', color: '#f59e0b', desc: '100-125 mg/dL' };
      return { status: 'Diabetes', color: '#ef4444', desc: '≥ 126 mg/dL' };
    } else if (type === 'ogtt') {
      if (num < 140) return { status: 'Normal', color: '#10b981', desc: '< 140 mg/dL' };
      if (num < 200) return { status: 'Prediabetes', color: '#f59e0b', desc: '140-199 mg/dL' };
      return { status: 'Diabetes', color: '#ef4444', desc: '≥ 200 mg/dL' };
    } else if (type === 'hba1c') {
      if (num < 5.7) return { status: 'Normal', color: '#10b981', desc: '< 5.7%' };
      if (num < 6.5) return { status: 'Prediabetes', color: '#f59e0b', desc: '5.7-6.4%' };
      return { status: 'Diabetes', color: '#ef4444', desc: '≥ 6.5%' };
    }
    return null;
  };

  const handleSave = async () => {
    if (!fbs && !ogtt && !hba1c) {
      Alert.alert('Validation', 'Please enter at least one blood result.');
      return;
    }
    
    setLoading(true);
    try {
      let isMultipart = false;
      if (image && !image.uri.startsWith('http')) {
        isMultipart = true;
        // Use FormData for multipart upload
        data = new FormData();
        data.append('fasting_blood_sugar', fbs);
        data.append('ogtt', ogtt);
        data.append('hba1c', hba1c);

        // Create file object for upload
        const fileName = image.uri.split('/').pop();
        const fileType = fileName.split('.').pop();
        data.append('image', {
          uri: image.uri,
          name: fileName,
          type: `image/${fileType}`,
        });
      } else {
        // JSON data
        data = {
          fasting_blood_sugar: fbs,
          ogtt: ogtt,
          hba1c: hba1c,
        };
      }

      let res;
      if (editingId) {
        res = await api.updateVital(editingId, data, isMultipart);
      } else {
        res = await api.logVitals(data, isMultipart);
      }
      if (res && res.success) {
        Alert.alert('Success', editingId ? 'Blood results updated successfully.' : 'Blood results saved successfully.');
        setFbs('');
        setOgtt('');
        setHba1c('');
        setImage(null);
        setEditingId(null);
        fetchHistory(); // Refresh history
      } else {
        Alert.alert('Error', res?.message || 'Failed to save results.');
      }
    } catch (err) {
      console.log('Error saving vitals', err);
      Alert.alert('Error', 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setFbs(item.soap_objective?.fasting_blood_sugar ? item.soap_objective.fasting_blood_sugar.toString() : '');
    setOgtt(item.soap_objective?.ogtt ? item.soap_objective.ogtt.toString() : '');
    setHba1c(item.soap_objective?.hba1c ? item.soap_objective.hba1c.toString() : '');
    setImage(item.soap_objective?.image_url ? { uri: item.soap_objective.image_url } : null);
    setEditingId(item.id || item._id);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleDelete = async (item) => {
    Alert.alert(
      'Delete Result',
      'Are you sure you want to delete this blood result?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', onPress: () => deleteResult(item.id || item._id) },
      ]
    );
  };

  const deleteResult = async (id) => {
    try {
      await api.deleteVital(id);
      Alert.alert('Success', 'Blood result deleted successfully.');
      setHistory(history.filter(h => h.id !== id && h._id !== id));
    } catch (err) {
      Alert.alert('Error', 'Failed to delete');
    }
  };

  const getChartData = () => {
    if (!history || history.length === 0) return null;

    const vitalsData = history.slice(-7); // Last 7 entries
    const labels = vitalsData.map((item, i) => {
      const date = new Date(item.created_at);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const fbsData = vitalsData.map(note => {
      const val = note.soap_objective?.fasting_blood_sugar;
      return val ? parseFloat(val) : 0;
    });

    const ogttData = vitalsData.map(note => {
      const val = note.soap_objective?.ogtt;
      return val ? parseFloat(val) : 0;
    });

    const hba1cData = vitalsData.map(note => {
      const val = note.soap_objective?.hba1c;
      return val ? parseFloat(val) : 0;
    });

    return { vitalsData, labels, fbsData, ogttData, hba1cData };
  };

  const renderManualChart = () => {
    const dataObj = getChartData();
    if (!dataObj) return null;

    const { vitalsData, labels, fbsData, ogttData, hba1cData } = dataObj;
    
    if (vitalsData.length === 0) return null;

    const CHART_H = 160;
    const CHART_W = width - 64; // Horizontal span for data points

    // Calculate independent bounds to maximize visible difference for each dataset
    const getBounds = (arr) => {
      const valid = arr.filter(v => v > 0);
      if (valid.length === 0) return { min: 0, max: 10, range: 10 };
      const minVal = Math.min(...valid);
      const maxVal = Math.max(...valid);
      if (minVal === maxVal) {
        return { min: Math.max(0, minVal - 5), max: maxVal + 5, range: 10 };
      }
      // Add a 15% vertical padding top and bottom
      const pad = (maxVal - minVal) * 0.15;
      const finalMin = Math.max(0, minVal - pad);
      const finalMax = maxVal + pad;
      return { min: finalMin, max: finalMax, range: finalMax - finalMin };
    };

    const fbsBounds = getBounds(fbsData);
    const ogttBounds = getBounds(ogttData);
    const hba1cBounds = getBounds(hba1cData);

    const getX = (index) => {
      if (vitalsData.length <= 1) return CHART_W / 2;
      return (index / (vitalsData.length - 1)) * CHART_W;
    };
    
    const getY = (val, bounds) => {
      if (!val) return CHART_H;
      return CHART_H - ((val - bounds.min) / bounds.range) * CHART_H;
    };

    const renderLine = (data, color, bounds) => {
      return data.map((val, i) => {
        if (i === data.length - 1 || !val || !data[i + 1]) return null;
        const x1 = getX(i);
        const y1 = getY(val, bounds);
        const x2 = getX(i + 1);
        const y2 = getY(data[i + 1], bounds);

        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

        return (
          <View
            key={`line-${i}`}
            style={{
              position: 'absolute',
              left: cx - length / 2,
              top: cy - 1,
              width: length,
              height: 2,
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }]
            }}
          />
        );
      });
    };

    const renderPoints = (data, color, labelColor, bounds, isDecimal = false, offset = { dx: -20, dy: -20 }) => {
      // Only show up to 5 point labels across the graph evenly distributed regardless of total size.
      const labelInterval = Math.max(1, Math.floor((data.length - 1) / 4));
      
      return data.map((val, i) => {
        const isLabelVisible = i % labelInterval === 0 || i === data.length - 1;
        
        return (
          <View key={`point-${i}`}>
            <View
              style={{
                position: 'absolute',
                left: getX(i) - 4,
                top: getY(val, bounds) - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
                borderWidth: 1.5,
                borderColor: colors.card,
                zIndex: 10
              }}
            />
            {isLabelVisible && val > 0 && (
              <Text 
                style={{
                  position: 'absolute',
                  left: getX(i) + offset.dx,
                  top: getY(val, bounds) + offset.dy,
                  fontSize: 10,
                  color: labelColor,
                  fontWeight: '600',
                  textAlign: 'center',
                  width: 40,
                  zIndex: 20
                }}
              >
                {isDecimal ? Number(val).toFixed(1) : Math.round(val)}
              </Text>
            )}
          </View>
        );
      });
    };

    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Vitals History Chart</Text>
        <View style={[styles.card, { backgroundColor: colors.card, paddingVertical: 20, paddingHorizontal: 16, alignItems: 'center' }]}>
          
          {/* Legend */}
          <View style={{ width: '100%', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, backgroundColor: colors.error || '#ef4444', borderRadius: 5, marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: colors.text }}>FBS</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, backgroundColor: colors.primary, borderRadius: 5, marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: colors.text }}>OGTT</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, backgroundColor: colors.success || '#10b981', borderRadius: 5, marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: colors.text }}>HbA1c</Text>
              </View>
            </View>
          </View>

          <View style={{ width: CHART_W, height: CHART_H, alignSelf: 'center', marginVertical: 10 }}>
            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((multiplier, i) => (
              <View
                key={`h-grid-${i}`}
                style={{
                  position: 'absolute',
                  top: CHART_H * multiplier,
                  width: '100%',
                  height: 1,
                  backgroundColor: colors.border,
                  opacity: 0.45
                }}
              />
            ))}

            {/* Vertical Grid lines */}
            {labels.map((_, i) => (
              <View
                key={`v-grid-${i}`}
                style={{
                  position: 'absolute',
                  left: getX(i),
                  top: 0,
                  width: 1,
                  height: '100%',
                  backgroundColor: colors.border,
                  opacity: 0.45
                }}
              />
            ))}
            
            {/* Lines */}
            {renderLine(fbsData, colors.error || '#ef4444', fbsBounds)}
            {renderLine(ogttData, colors.primary, ogttBounds)}
            {renderLine(hba1cData, colors.success || '#10b981', hba1cBounds)}

            {/* Points over lines - Stagger offsets to avoid overlapping */}
            {renderPoints(fbsData, colors.error || '#ef4444', colors.error || '#ef4444', fbsBounds, false, { dx: -20, dy: -22 })}
            {renderPoints(ogttData, colors.primary, colors.primary, ogttBounds, false, { dx: 6, dy: -6 })}
            {renderPoints(hba1cData, colors.success || '#10b981', colors.success || '#10b981', hba1cBounds, true, { dx: -20, dy: 8 })}
          </View>

          {/* X-Axis Labels */}
          <View style={{ position: 'relative', width: CHART_W, height: 20, marginTop: 12 }}>
            {labels.map((lbl, i) => {
              const isFirst = i === 0;
              const isLast = i === labels.length - 1;
              return (
                <Text 
                  key={`lbl-${i}`} 
                  style={{ 
                    position: 'absolute',
                    left: isLast ? undefined : getX(i) - (isFirst ? 0 : 20),
                    right: isLast ? 0 : undefined,
                    textAlign: isLast ? 'right' : (isFirst ? 'left' : 'center'),
                    width: 40,
                    fontSize: 10, 
                    color: colors.secondary 
                  }}>
                  {lbl}
                </Text>
              );
            })}
          </View>

        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backButton: {
      marginRight: 16,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      padding: 16,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
    },
    title: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    titleText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 8,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    imagePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: colors.background,
      marginTop: 8,
    },
    imagePickerText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    imagePreview: {
      marginTop: 12,
      position: 'relative',
    },
    previewImage: {
      width: '100%',
      height: 150,
      borderRadius: 8,
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      marginTop: 8,
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: colors.secondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    referenceButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    referenceButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    historyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 10,
      marginBottom: 16,
    },
    historyCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyDate: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    historyLabel: {
      fontSize: 14,
      color: colors.secondary,
    },
    historyVal: {
      fontSize: 14,
      color: colors.text,
      fontWeight: 'bold',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    source: {
        fontSize: 12,
        color: colors.secondary,
        fontStyle: 'italic',
        marginTop: 8
    },
    viewImageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    viewImageText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
      marginLeft: 6,
    },
    historyActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      gap: 8,
    },
    viewImageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 6,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 6,
      gap: 4,
    },
    viewImageText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    editButton: {
      padding: 6,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 6,
    },
    deleteButton: {
      padding: 6,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: 6,
    },
    imageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.background,
      gap: 8,
    },
    imageButtonText: {
      fontSize: 14,
      color: colors.text,
    },
    imageText: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeModalButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      zIndex: 1,
      padding: 10,
    },
    fullScreenImage: {
      width: '100%',
      height: '80%',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blood Results</Text>
      </View>
      
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.title}>
            <Icon name="test-tube" size={20} color={colors.primary} />
            <Text style={styles.titleText}>{editingId ? 'Edit Result Log' : 'Add New Log'}</Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Fasting Blood Sugar (FBS)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 90 mg/dL"
              placeholderTextColor={colors.border}
              value={fbs}
              onChangeText={setFbs}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Oral Glucose Tolerance Test (OGTT)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 140 mg/dL"
              placeholderTextColor={colors.border}
              value={ogtt}
              onChangeText={setOgtt}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Hemoglobin A1c (HbA1c)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5.5 %"
              placeholderTextColor={colors.border}
              value={hba1c}
              onChangeText={setHba1c}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Proof Image (Optional)</Text>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Icon name="camera" size={20} color={colors.primary} />
              <Text style={styles.imageButtonText}>{image ? 'Change Image' : 'Add Image'}</Text>
            </TouchableOpacity>
            {image && <Text style={styles.imageText}>{image.uri.split('/').pop()}</Text>}
          </View>
          
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{editingId ? 'Update Results' : 'Save Results'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Understanding Your Results</Text>
          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>Fasting Blood Sugar (FBS):</Text> Measures blood glucose after an overnight fast.
            {'\n'}• Normal: less than 100 mg/dL
            {'\n'}• Prediabetes: 100-125 mg/dL
            {'\n'}• Diabetes: 126 mg/dL or higher
            {'\n'}(ADA 2023)
          </Text>
          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>Oral Glucose Tolerance Test (OGTT):</Text> Measures blood glucose 2 hours after drinking a sugary solution.
            {'\n'}• Normal: less than 140 mg/dL
            {'\n'}• Prediabetes: 140-199 mg/dL
            {'\n'}• Diabetes: 200 mg/dL or higher
            {'\n'}(WHO 2006)
          </Text>
          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>Hemoglobin A1c (HbA1c):</Text> Reflects average blood glucose over 2-3 months.
            {'\n'}• Normal: less than 5.7%
            {'\n'}• Prediabetes: 5.7-6.4%
            {'\n'}• Diabetes: 6.5% or higher
            {'\n'}(ADA 2023)
          </Text>
          <TouchableOpacity 
            style={styles.referenceButton} 
            onPress={() => Linking.openURL('https://diabetes.org/about-diabetes/diagnosis')}
          >
            <Text style={styles.referenceButtonText}>View ADA Guidelines</Text>
          </TouchableOpacity>
        </View>

        {renderManualChart()}

        {history.length > 0 && (
          <View>
            <Text style={styles.historyTitle}>Recent Logs</Text>
            {history.map((item, index) => {
              const obj = item.soap_objective || {};
              const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown Date';
              return (
                <View key={index} style={styles.historyCard}>
                  <Text style={styles.historyDate}>{dateStr}</Text>
                  
                  {obj.fasting_blood_sugar && (
                    <View style={styles.historyRow}>
                      <Text style={styles.historyLabel}>FBS:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.historyVal}>{obj.fasting_blood_sugar}</Text>
                        {(() => {
                          const status = getGlucoseStatus(obj.fasting_blood_sugar, 'fbs');
                          return status ? (
                            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                              <Text style={[styles.statusText, { color: status.color }]}>{status.status}</Text>
                            </View>
                          ) : null;
                        })()}
                      </View>
                    </View>
                  )}
                  
                  {obj.ogtt && (
                    <View style={styles.historyRow}>
                      <Text style={styles.historyLabel}>OGTT:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.historyVal}>{obj.ogtt}</Text>
                        {(() => {
                          const status = getGlucoseStatus(obj.ogtt, 'ogtt');
                          return status ? (
                            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                              <Text style={[styles.statusText, { color: status.color }]}>{status.status}</Text>
                            </View>
                          ) : null;
                        })()}
                      </View>
                    </View>
                  )}
                  
                  {obj.hba1c && (
                    <View style={styles.historyRow}>
                      <Text style={styles.historyLabel}>HbA1c:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.historyVal}>{obj.hba1c}</Text>
                        {(() => {
                          const status = getGlucoseStatus(obj.hba1c, 'hba1c');
                          return status ? (
                            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                              <Text style={[styles.statusText, { color: status.color }]}>{status.status}</Text>
                            </View>
                          ) : null;
                        })()}
                      </View>
                    </View>
                  )}

                  <Text style={styles.source}>Logged by: {item.source_name || (item.source === 'user' ? 'You' : 'Physician')}</Text>
                  {obj.image_url && (
                    <TouchableOpacity 
                      style={styles.viewImageButton} 
                      onPress={() => setViewerImage(obj.image_url)}
                    >
                      <Icon name="image" size={16} color={colors.primary} />
                      <Text style={styles.viewImageText}>View Proof Image</Text>
                    </TouchableOpacity>
                  )}
                  
                  <View style={styles.historyActions}>
                    <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(item)}>
                      <Icon name="pencil" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
                      <Icon name="delete" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal visible={!!viewerImage} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.closeModalButton} 
            onPress={() => setViewerImage(null)}
          >
            <Icon name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {viewerImage && (
            <Image 
              source={{ uri: viewerImage }} 
              style={styles.fullScreenImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
};

export default BloodResultScreen;