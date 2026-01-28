// File: app/edit-profile.tsx
import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle } from 'react-native-svg';

// 🟢 IMPORTS
import { useAuth } from '../hooks/useAuth'; 
import { useCustomAlert } from '../context/AlertContext';

const SUGGESTED_SKILLS = [
  "UI/UX Design", "React Native", "Marketing", "Project Management", 
  "Sales", "Python", "Photography", "Leadership", "Public Speaking", "Data Analysis"
];

// Helper Components
const InputGroup = ({ label, value, onChangeText, keyboardType='default', multiline=false }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      value={value || ''} 
      onChangeText={onChangeText} 
      placeholder={`Enter ${label}`}
      placeholderTextColor="#CCC"
      keyboardType={keyboardType as any}
      multiline={multiline}
    />
  </View>
);

const ProfileProgress = ({ percentage, imageUri, onEdit }: any) => {
  const radius = 55;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={styles.avatarSection}>
      <View style={styles.avatarWrapper}>
        <Svg height="120" width="120" style={{ position: 'absolute' }}>
          <Circle stroke="#E0E0E0" cx="60" cy="60" r={radius} strokeWidth={stroke} />
          <Circle
            stroke="#0056D2" cx="60" cy="60" r={radius}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin="60, 60"
          />
        </Svg>
        <Image source={{ uri: imageUri || 'https://i.pravatar.cc/150?img=12' }} style={styles.avatar} />
        <TouchableOpacity style={styles.cameraBtn} onPress={onEdit}>
          <Ionicons name="camera" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.progressText}>{Math.round(percentage)}% Profile Complete</Text>
    </View>
  );
};

export default function EditProfileScreen() {
  const router = useRouter();
  
  // 🟢 USE THE NEW HOOK (Includes saveProfile)
  const { user, updateUser, saveProfile } = useAuth(); 
  const { showAlert } = useCustomAlert();

  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const calculateProgress = () => {
    if (!user) return 0;
    const textFields = [
      user.firstName, user.lastName, user.email, user.phoneNumber,
      user.secondPhoneNumber, user.birthday, user.gender, user.aboutMe, user.profilePhoto,
      user.address?.street, user.address?.city, user.address?.zipCode, user.address?.country,
      user.company?.title, user.company?.website
    ];
    let filledCount = textFields.filter(f => f && f.toString().trim().length > 0).length;
    if (user.tags && user.tags.length > 0) filledCount += 1;
    return (filledCount / (textFields.length + 1)) * 100;
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      updateUser({ profilePhoto: base64Img }); 
    }
  };

  const handleChange = (key: string, value: string) => updateUser({ [key]: value });
  
  const handleNestedChange = (parent: string, key: string, value: string) => {
    const currentObj = (user as any)[parent] || {};
    updateUser({ [parent]: { ...currentObj, [key]: value } });
  };

  const addTag = (tagToAdd: string) => {
    const cleanTag = tagToAdd.trim();
    if (cleanTag && !user?.tags?.includes(cleanTag)) {
      updateUser({ tags: [...(user?.tags || []), cleanTag] });
    }
    setTagInput(''); 
  };

  const removeTag = (index: number) => {
    const newTags = user?.tags?.filter((_:any, i:number) => i !== index);
    updateUser({ tags: newTags });
  };

  // 🟢 UPDATED SAVE FUNCTION
  const handleManualSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
        // Use the hook to save to DB
        await saveProfile(user);
        
        showAlert("Success", "Profile updated successfully!", "success", () => {
            router.back(); 
        });
            
    } catch (error) {
        console.error(error);
        showAlert("Error", "Could not save profile.", "error");
    } finally {
        setIsSaving(false);
    }
  };

  if (!user) return (<View style={styles.center}><ActivityIndicator size="large" color="#0056D2" /></View>);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleManualSave} disabled={isSaving} style={styles.saveBtnContainer}>
          {isSaving ? <ActivityIndicator size="small" color="#0056D2" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <ProfileProgress percentage={calculateProgress()} imageUri={user.profilePhoto} onEdit={pickImage} />

          <Text style={styles.sectionHeader}>Personal Info</Text>
          <View style={styles.card}>
            <View style={styles.row}>
                <View style={{flex: 1, marginRight: 10}}>
                  <InputGroup label="First Name" value={user.firstName} onChangeText={(t: string) => handleChange('firstName', t)} />
                </View>
                <View style={{flex: 1}}>
                  <InputGroup label="Last Name" value={user.lastName} onChangeText={(t: string) => handleChange('lastName', t)} />
                </View>
            </View>

            <View style={styles.readOnlyField}>
               <Text style={styles.label}>Phone Number</Text>
               <Text style={styles.readOnlyText}>{user.phoneNumber}</Text>
               <Ionicons name="lock-closed" size={14} color="#999" style={{position:'absolute', right: 10, top: 35}} />
            </View>
            <InputGroup label="Second Phone" value={user.secondPhoneNumber} onChangeText={(t: string) => handleChange('secondPhoneNumber', t)} keyboardType="phone-pad" />
            <InputGroup label="Email" value={user.email} onChangeText={(t: string) => handleChange('email', t)} keyboardType="email-address" />
            <View style={styles.row}>
               <View style={{flex: 1, marginRight: 10}}>
                 <InputGroup label="Birthday" value={user.birthday} onChangeText={(t: string) => handleChange('birthday', t)} placeholder="DD/MM/YYYY" />
               </View>
               <View style={{flex: 1}}>
                 <InputGroup label="Gender" value={user.gender} onChangeText={(t: string) => handleChange('gender', t)} placeholder="M/F" />
               </View>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Location</Text>
          <View style={styles.card}>
            <InputGroup label="Street Address" value={user.address?.street} onChangeText={(t: string) => handleNestedChange('address', 'street', t)} />
            <View style={styles.row}>
               <View style={{flex: 1, marginRight: 10}}>
                 <InputGroup label="City" value={user.address?.city} onChangeText={(t: string) => handleNestedChange('address', 'city', t)} />
               </View>
               <View style={{flex: 1}}>
                 <InputGroup label="Zip Code" value={user.address?.zipCode} onChangeText={(t: string) => handleNestedChange('address', 'zipCode', t)} keyboardType="number-pad" />
               </View>
            </View>
            <InputGroup label="Country" value={user.address?.country} onChangeText={(t: string) => handleNestedChange('address', 'country', t)} />
          </View>

          <Text style={styles.sectionHeader}>Professional & Skills</Text>
          <View style={styles.card}>
            <InputGroup label="Job Title" value={user.company?.title} onChangeText={(t: string) => handleNestedChange('company', 'title', t)} />
            <InputGroup label="Website" value={user.company?.website} onChangeText={(t: string) => handleNestedChange('company', 'website', t)} keyboardType="url" />
            <InputGroup label="About Me" value={user.aboutMe} onChangeText={(t: string) => handleChange('aboutMe', t)} multiline={true} />

            <Text style={styles.label}>Your Skills</Text>
            <View style={styles.tagRow}>
              {user.tags && user.tags.length > 0 ? user.tags.map((tag:string, i:number) => (
                <TouchableOpacity key={i} style={styles.tagPillSelected} onPress={() => removeTag(i)}>
                   <Text style={styles.tagTextSelected}>{tag}</Text>
                   <Ionicons name="close-circle" size={16} color="#FFF" style={{marginLeft:4}} />
                </TouchableOpacity>
              )) : (
                <Text style={styles.placeholderText}>No skills selected yet.</Text>
              )}
            </View>

            <View style={[styles.tagInputContainer, { marginTop: 15 }]}>
               <TextInput 
                 style={{flex:1, fontSize:15}} 
                 placeholder="Type a custom skill..." 
                 value={tagInput}
                 onChangeText={setTagInput}
                 onSubmitEditing={() => addTag(tagInput)}
               />
               <TouchableOpacity onPress={() => addTag(tagInput)}>
                 <Ionicons name="add-circle" size={30} color="#0056D2" />
               </TouchableOpacity>
            </View>

            <Text style={[styles.label, {marginTop: 15}]}>Suggestions</Text>
            <View style={styles.tagRow}>
              {SUGGESTED_SKILLS.map((skill, index) => {
                if (user.tags?.includes(skill)) return null;
                return (
                  <TouchableOpacity key={index} style={styles.tagPillSuggestion} onPress={() => addTag(skill)}>
                    <Ionicons name="add" size={14} color="#666" style={{marginRight: 2}} />
                    <Text style={styles.tagTextSuggestion}>{skill}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{height: 350}} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#EEE' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  saveBtnContainer: { minWidth: 50, alignItems: 'flex-end', padding: 5 },
  saveText: { fontSize: 16, fontWeight: 'bold', color: '#0056D2' },
  content: { padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 25 },
  avatarWrapper: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  cameraBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#0056D2', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  progressText: { color: '#0056D2', fontWeight: '600', fontSize: 14 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#555', marginTop: 15, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { backgroundColor: '#F5F7FA', borderRadius: 10, padding: 12, fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#E1E8ED' },
  textArea: { height: 100, textAlignVertical: 'top' },
  readOnlyField: { marginBottom: 15 },
  readOnlyText: { backgroundColor: '#EFEFEF', borderRadius: 10, padding: 12, fontSize: 16, color: '#888', borderWidth: 1, borderColor: '#DDD' },
  row: { flexDirection: 'row' },
  tagInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 10, padding: 8, paddingLeft: 12, borderWidth: 1, borderColor: '#E1E8ED' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPillSelected: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0056D2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  tagTextSelected: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  tagPillSuggestion: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E1E8ED' },
  tagTextSuggestion: { color: '#444', fontWeight: '500', fontSize: 13 },
  placeholderText: { fontStyle: 'italic', color: '#999', fontSize: 13 }
});