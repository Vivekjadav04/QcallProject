import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, StatusBar as RNStatusBar } from 'react-native';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

// 🟢 CONFIG: Import your Backend URL
// import { BACKEND_URL } from '@/constants/Config'; 
// (For now, you can hardcode it or use the import if you created the file)
const BACKEND_URL = 'http://192.168.1.XX:5000/api/contacts'; // REPLACE THIS WITH YOUR IP

export default function CallEndedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const callerName = params.name || 'Unknown';
  const callerNumber = params.number || '';
  const callerPhoto = params.imageUri as string;
  // 🟢 Detect Spam Status
  const isSpam = params.isSpam === 'true';

  const handleClose = () => {
    router.dismissAll();
    router.replace('/(tabs)');
  };

  const handleAction = async (action: string) => {
    // 🟢 1. SPAM REPORT
    if (action === 'Spam' || action === 'Block') {
        try {
            await fetch(`${BACKEND_URL}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: callerNumber })
            });
            alert("Reported as Spam! Thank you.");
            handleClose();
        } catch (e) {
            alert("Failed to report. Check internet.");
        }
    }

    // 🟢 2. NOT SPAM (Fix False Alarm)
    else if (action === 'Not Spam') {
        try {
            await fetch(`${BACKEND_URL}/not-spam`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: callerNumber })
            });
            alert("Thanks! We will improve our records.");
            handleClose();
        } catch (e) {
            alert("Failed to update.");
        }
    }

    // 3. OTHER ACTIONS
    else {
        console.log(`${action} clicked`);
        // Add logic for Save/Call/Message here later
    }
  };

  return (
    <View style={styles.overlay}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <StatusBar style="light" />

      {/* 🟢 CONTAINER CARD */}
      <View style={styles.cardContainer}>
          
          {/* HEADER (Blue or Red) */}
          <View style={[styles.headerSection, isSpam ? styles.redHeader : styles.blueHeader]}>
              
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                  <MaterialIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>

              {/* Call Status Line */}
              <View style={styles.statusRow}>
                  <MaterialCommunityIcons name={isSpam ? "phone-missed" : "phone-hangup"} size={16} color="#FFF" />
                  <Text style={styles.statusText}>
                      {isSpam ? " Missed call less than 1 m ago" : " Call ended 1 minute ago"}
                  </Text>
              </View>

              {/* MAIN PROFILE AREA */}
              <View style={styles.profileRow}>
                  {isSpam ? (
                      // 🔴 SPAM LAYOUT: Shield Icon
                      <View style={styles.spamIconContainer}>
                          <MaterialCommunityIcons name="shield-alert" size={40} color="#D32F2F" />
                      </View>
                  ) : (
                      // 🔵 SAFE LAYOUT: Avatar
                      <View style={styles.avatarContainer}>
                           {callerPhoto ? (
                              <Image source={{ uri: callerPhoto }} style={styles.avatar} />
                           ) : (
                              <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatar} />
                           )}
                      </View>
                  )}

                  <View style={{marginLeft: 15, flex: 1}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Text style={styles.nameText}>{isSpam ? "Spam" : callerName}</Text>
                          {isSpam && (
                              <View style={styles.editBtn}>
                                  <MaterialIcons name="edit" size={12} color="#333" />
                                  <Text style={styles.editText}>CHANGE</Text>
                              </View>
                          )}
                      </View>
                      
                      {isSpam && (
                          <View style={styles.likelySpamBadge}>
                              <MaterialIcons name="error-outline" size={14} color="#333" />
                              <Text style={styles.likelyText}>Likely Spam</Text>
                          </View>
                      )}
                      
                      {!isSpam && (
                           <TouchableOpacity style={styles.editBtnBlue}>
                               <MaterialIcons name="edit" size={12} color="#0056D2" />
                               <Text style={styles.editTextBlue}>CHANGE</Text>
                           </TouchableOpacity>
                      )}
                  </View>
              </View>

              {/* VIEW PROFILE BUTTON */}
              <TouchableOpacity style={styles.viewProfileBtn}>
                  <FontAwesome5 name="user-circle" size={18} color="#FFF" />
                  <Text style={styles.viewProfileText}>
                      {isSpam ? "View profile • 10+ comments" : "View profile"}
                  </Text>
              </TouchableOpacity>
          </View>

          {/* BODY (White Section) */}
          <View style={styles.bodySection}>
              
              {/* Info Text */}
              {isSpam && (
                  <View style={styles.infoBlock}>
                      <Text style={styles.infoNumber}>Mobile: {callerNumber} - Airtel</Text>
                      <Text style={styles.infoLoc}>West Bengal, India</Text>
                      <View style={styles.divider} />
                  </View>
              )}

              {/* FEEDBACK SECTION */}
              <View style={styles.feedbackRow}>
                  <Text style={styles.questionText}>Was the name correct?</Text>
                  <View style={{flexDirection: 'row', gap: 15}}>
                      <TouchableOpacity>
                          <MaterialIcons name="thumb-up" size={26} color="#0056D2" />
                      </TouchableOpacity>
                      <TouchableOpacity>
                          <MaterialIcons name="thumb-down" size={26} color="#555" />
                      </TouchableOpacity>
                  </View>
              </View>

              {/* ACTION GRID */}
              <View style={styles.gridContainer}>
                  <GridItem icon="call" label="CALL" onPress={() => handleAction('Call')} />
                  <GridItem icon="message" label="MESSAGE" onPress={() => handleAction('Message')} />
                  
                  {isSpam ? (
                      <>
                        {/* If it's spam, show 'NOT SPAM' button */}
                        <GridItem icon="warning" label="NOT SPAM" color="#555" onPress={() => handleAction('Not Spam')} />
                        <GridItem icon="block" label="BLOCK" color="#D32F2F" onPress={() => handleAction('Block')} />
                      </>
                  ) : (
                      <>
                         {/* If it's safe, show 'SAVE' and 'SPAM' buttons */}
                        <GridItem icon="person-add" label="SAVE" onPress={() => handleAction('Save')} />
                        <GridItem icon="warning" label="SPAM" onPress={() => handleAction('Spam')} />
                        <GridItem icon="block" label="BLOCK" onPress={() => handleAction('Block')} />
                      </>
                  )}
              </View>

          </View>
      </View>
    </View>
  );
}

// 🟢 Helper Component for Icons
const GridItem = ({ icon, label, color = "#444", onPress }: any) => (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
        <MaterialIcons name={icon} size={28} color={color} />
        <Text style={[styles.gridLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 15 },
  
  cardContainer: { borderRadius: 15, overflow: 'hidden' },

  // --- HEADER ---
  headerSection: { padding: 20, paddingTop: 15 },
  blueHeader: { backgroundColor: '#0056D2' },
  redHeader: { backgroundColor: '#FF0000' },

  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 5, zIndex: 10 },

  statusRow: { flexDirection: 'row', alignItems: 'center', opacity: 0.9, marginBottom: 15 },
  statusText: { color: '#FFF', marginLeft: 8, fontSize: 13 },

  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  
  // Avatar / Icons
  avatarContainer: { width: 55, height: 55, borderRadius: 27.5, borderWidth: 2, borderColor: '#FFF', overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  
  spamIconContainer: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },

  // Text
  nameText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  
  editBtn: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 10, alignItems: 'center' },
  editText: { fontSize: 10, fontWeight: 'bold', marginLeft: 4, color: '#333' },

  editBtnBlue: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 5, alignSelf: 'flex-start', alignItems: 'center' },
  editTextBlue: { fontSize: 10, fontWeight: 'bold', marginLeft: 4, color: '#0056D2' },

  likelySpamBadge: { flexDirection: 'row', backgroundColor: '#FFF', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5, alignItems: 'center' },
  likelyText: { fontSize: 12, fontWeight: 'bold', color: '#333', marginLeft: 4 },

  // View Profile Button
  viewProfileBtn: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  viewProfileText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },

  // --- BODY ---
  bodySection: { backgroundColor: '#FFF', padding: 20 },

  infoBlock: { marginBottom: 10 },
  infoNumber: { color: '#555', fontSize: 13, marginBottom: 2 },
  infoLoc: { color: '#777', fontSize: 12, marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 10 },

  feedbackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  questionText: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  gridContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  gridItem: { alignItems: 'center', width: 60 },
  gridLabel: { fontSize: 10, fontWeight: 'bold', marginTop: 8, textAlign: 'center' }
});