import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Image, ActivityIndicator, Alert } from 'react-native';
import { CameraView, Camera, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { captureRef } from 'react-native-view-shot'; // 🟢 IMPORT FOR SNAPSHOT

import { useAuth } from '../hooks/useAuth';

const { width } = Dimensions.get('window');

const THEME = {
  primary: '#4C1D95', 
  accent: '#10B981', 
  bg: '#FAFAFA',
  textMain: '#1E293B',
  textSub: '#64748B',
};

export default function ScannerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [mode, setMode] = useState<'scan' | 'my_code'>('scan'); 
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  
  const [myName, setMyName] = useState('Qcall User');
  const [myPhone, setMyPhone] = useState('+910000000000');
  const [dynamicVCard, setDynamicVCard] = useState('');
  
  const qrRef = useRef<any>(null);
  const viewShotRef = useRef<View>(null); // 🟢 REFERENCE FOR THE UI SNAPSHOT
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        let fetchedFullName = '';
        if (user?.firstName || user?.lastName) {
            fetchedFullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
            setMyName(fetchedFullName);
        }

        if (user?.phoneNumber) {
            setMyPhone(user.phoneNumber.includes('+') ? user.phoneNumber : `+91${user.phoneNumber}`);
        }
        
        if (!fetchedFullName) {
            const jsonProfile = await AsyncStorage.getItem('user');
            if (jsonProfile) {
                const parsed = JSON.parse(jsonProfile);
                const parsedName = `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim();
                if (parsedName) setMyName(parsedName);
            } else {
                const nameData = await AsyncStorage.getItem('user_name');
                if (nameData) setMyName(nameData);
            }
        }

        if (!user?.phoneNumber) {
            const phoneData = await AsyncStorage.getItem('user_phone') || await AsyncStorage.getItem('phoneNumber');
            if (phoneData) setMyPhone(phoneData.includes('+') ? phoneData : `+91${phoneData}`);
        }
      } catch (e) {
          console.error("Error fetching user data for QR:", e);
      }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!myName || !myPhone) return;
    const timestamp = new Date().toISOString().replace(/[-:.]/g, ''); 
    const vCard = `BEGIN:VCARD\nVERSION:3.0\nFN:${myName}\nTEL;TYPE=CELL:${myPhone}\nREV:${timestamp}\nEND:VCARD`;
    setDynamicVCard(vCard);
  }, [myName, myPhone]);

  useEffect(() => {
    if (mode === 'scan') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 240, duration: 2500, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 2500, useNativeDriver: true })
        ])
      ).start();
    }
  }, [mode]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    let name = "Unknown", phone = "";
    
    if (data.includes("BEGIN:VCARD")) {
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('FN:')) name = line.replace('FN:', '').trim();
        if (line.startsWith('TEL')) phone = line.split(':')[1]?.trim() || '';
      }
    } else {
      phone = data; 
    }
    router.replace({ pathname: '/save_contact', params: { name, phone } });
  };

  const pickImageAndScan = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const scannedResults = await Camera.scanFromURLAsync(uri, ["qr"]);
        
        if (scannedResults && scannedResults.length > 0) {
          handleBarCodeScanned({ data: scannedResults[0].data });
        } else {
          Alert.alert("No QR Code Found", "We couldn't detect a valid QR code in this image.");
        }
      }
    } catch (e) {
      Alert.alert("Error", "Failed to scan the image.");
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(myPhone);
    Alert.alert("Copied!", "Phone number copied to clipboard.");
  };

  // 🟢 CAPTURE THE WHOLE CARD AS AN IMAGE
  const downloadQRCode = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Needed", "Please grant gallery permissions to save the QR code.");
      return;
    }

    try {
      // Takes a snapshot of the viewShotRef View
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
      });
      
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Success', 'Contact card saved to your gallery!');
    } catch (e) { 
      console.error(e);
      Alert.alert('Error', 'Could not save the image.');
    }
  };

  // 🟢 SHARE THE WHOLE CARD IMAGE
  const shareQRCode = async () => {
    try {
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share my contact' });
      } else {
          Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not share the image.');
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator size="large" color={THEME.accent} /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.headerContainer}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                <Feather name="arrow-left" size={26} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>QR Contact</Text>
            <View style={styles.iconBtn} />
        </View>

        <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tabBtn, mode === 'scan' && styles.activeTab]} onPress={() => { setMode('scan'); setScanned(false); }}>
                <Text style={[styles.tabText, mode === 'scan' && styles.activeTabText]}>Scan Code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, mode === 'my_code' && styles.activeTab]} onPress={() => setMode('my_code')}>
                <Text style={[styles.tabText, mode === 'my_code' && styles.activeTabText]}>My Code</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>

      {mode === 'my_code' && (
        <View style={styles.myCodeWrapper}>
            
            {/* 🟢 THE CONTAINER TO SNAPSHOT */}
            <View ref={viewShotRef} collapsable={false} style={styles.captureCard}>
                <View style={styles.userInfoRow}>
                    <View style={styles.avatarContainer}>
                        {user?.profilePhoto ? (
                            <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitial}>{myName.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                    
                    <View style={styles.userInfoText}>
                        <Text style={styles.userName}>{myName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.userMobile}>{myPhone}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.qrDisplayArea}>
                    {dynamicVCard ? (
                        <QRCode 
                            value={dynamicVCard}
                            size={220}
                            color={THEME.primary} 
                            backgroundColor="#FFFFFF" // MUST remain white
                            quietZone={15} // MUST remain for scannability
                            logoBackgroundColor="#FFF"
                            logoBorderRadius={25}
                            getRef={(c) => (qrRef.current = c)}
                        />
                    ) : (
                        <ActivityIndicator size="large" color={THEME.primary} />
                    )}
                    {dynamicVCard ? (
                        <View style={styles.centerLogoOverlay}>
                            <Text style={styles.centerLogoText}>Q</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={styles.brandingText}>Scan to save my contact</Text>
            </View>

            <View style={styles.bottomActionsRow}>
                <TouchableOpacity style={styles.actionPillBtn} onPress={downloadQRCode}>
                    <Feather name="download" size={20} color="#7F1D1D" />
                    <Text style={styles.actionPillText}>Download</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionPillBtn} onPress={shareQRCode}>
                    <Feather name="share-2" size={20} color="#7F1D1D" />
                    <Text style={styles.actionPillText}>Share</Text>
                </TouchableOpacity>
            </View>
        </View>
      )}

      {mode === 'scan' && permission?.granted && (
         <View style={styles.cameraWrapper}>
            <CameraView 
                style={StyleSheet.absoluteFillObject} 
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
            
            <View style={styles.overlayContainer}>
                <View style={styles.overlayDark} />
                <View style={{ flexDirection: 'row' }}>
                    <View style={styles.overlayDark} />
                    <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.tl]} />
                        <View style={[styles.corner, styles.tr]} />
                        <View style={[styles.corner, styles.bl]} />
                        <View style={[styles.corner, styles.br]} />
                        <Animated.View style={[styles.laser, { transform: [{ translateY: scanLineAnim }] }]} />
                    </View>
                    <View style={styles.overlayDark} />
                </View>
                
                <View style={[styles.overlayDark, { alignItems: 'center', paddingTop: 30 }]}>
                    <View style={styles.scanBadge}>
                        <MaterialCommunityIcons name="qrcode-scan" size={20} color="#FFF" />
                        <Text style={styles.scanBadgeText}>Point camera at a QR code</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.galleryFloatingBtn} onPress={pickImageAndScan}>
                    <View style={styles.galleryIconBox}>
                        <Feather name="image" size={26} color="#000" />
                    </View>
                </TouchableOpacity>
            </View>
         </View>
      )}

      {mode === 'scan' && !permission?.granted && (
        <View style={styles.center}>
            <MaterialCommunityIcons name="camera-off" size={60} color={THEME.textSub} />
            <Text style={{ marginTop: 15, fontSize: 16 }}>Camera permission required</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Grant Permission</Text>
            </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, zIndex: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10 },
  iconBtn: { padding: 10, width: 50, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 15, gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#F1F5F9' },
  activeTab: { backgroundColor: THEME.primary },
  tabText: { fontSize: 15, fontWeight: '700', color: THEME.textSub },
  activeTabText: { color: '#FFF' },
  myCodeWrapper: { flex: 1, alignItems: 'center', paddingTop: 20 },
  
  // 🟢 NEW STYLES FOR THE CAPTURED CARD
  captureCard: { backgroundColor: '#FFFFFF', padding: 25, borderRadius: 20, alignItems: 'center', width: width * 0.85, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8, marginBottom: 30 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 25, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 20 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarFallback: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: THEME.textSub },
  userInfoText: { flex: 1 },
  userName: { fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 2 },
  userMobile: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  brandingText: { fontSize: 14, fontWeight: '700', color: THEME.primary, marginTop: 15, letterSpacing: 0.5 },
  
  qrDisplayArea: { alignItems: 'center', justifyContent: 'center' },
  centerLogoOverlay: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.accent, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  centerLogoText: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  
  bottomActionsRow: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', paddingHorizontal: 20 },
  actionPillBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  actionPillText: { fontSize: 16, fontWeight: '700', color: '#000', marginLeft: 10 },
  cameraWrapper: { flex: 1, backgroundColor: '#000' },
  overlayContainer: { ...StyleSheet.absoluteFillObject },
  overlayDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanFrame: { width: 260, height: 260, backgroundColor: 'transparent', position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#FFF', borderWidth: 4 },
  tl: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 20 },
  tr: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 20 },
  bl: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 20 },
  br: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 20 },
  laser: { width: '100%', height: 3, backgroundColor: THEME.accent, shadowColor: THEME.accent, shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
  scanBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, gap: 10 },
  scanBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  permBtn: { marginTop: 20, backgroundColor: THEME.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  galleryFloatingBtn: { position: 'absolute', bottom: 50, right: 30 },
  galleryIconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 }
});