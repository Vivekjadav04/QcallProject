import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function HomeHeader() {
  return (
    <View style={styles.headerContainer}>
      
      {/* 1. Profile Avatar (Left) */}
      <TouchableOpacity>
        <Image 
          source={{ uri: 'https://i.pravatar.cc/150?img=12' }} // Replace with real user image later
          style={styles.avatar}
        />
      </TouchableOpacity>

      {/* 2. Search Bar (Middle) */}
      <View style={styles.searchContainer}>
        <Text style={styles.logoText}>Qcall</Text>
        <View style={styles.searchIconContainer}>
             <Ionicons name="search" size={20} color="#000" />
        </View>
      </View>

      {/* 3. Right Icons (QR & Plus) */}
      <View style={styles.rightIcons}>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialCommunityIcons name="qrcode-scan" size={24} color="#000" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="add" size={30} color="#000" />
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    height: 70, // Fixed height for consistency
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  searchContainer: {
    flex: 1, // Takes up remaining space
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5', // Light grey background
    borderRadius: 30,
    marginHorizontal: 15,
    paddingHorizontal: 20,
    height: 45,
    justifyContent: 'space-between'
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900', // Extra Bold/Italic look
    fontStyle: 'italic',
    color: '#000',
  },
  searchIconContainer: {
    marginLeft: 10,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15, // Space between QR and Plus
  },
  iconButton: {
    padding: 5,
  }
});