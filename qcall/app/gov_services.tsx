import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, NativeModules, Platform, Linking, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { CallManagerModule } = NativeModules;

const THEME = {
  bg: '#F8FAFC',
  primary: '#1E3A8A', // Official Navy Blue
  accent: '#E53E3E', // Emergency Red
  textMain: '#0F172A',
  textSub: '#64748B',
  card: '#FFFFFF',
  border: '#E2E8F0'
};

// 🟢 UPDATED: Now securely pointing to your Ngrok tunnel!
const API_URL = 'https://unintegrable-adalynn-uninvokable.ngrok-free.dev/api/gov-services'; 
const STORAGE_KEY = '@qcall_gov_services';

export default function GovServicesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    // 1. Instantly load offline cached data first
    try {
      const cachedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (cachedData) {
        setServices(JSON.parse(cachedData));
        setLoading(false); // Stop loading spinner immediately if we have offline data
      }
    } catch (e) {
      console.log("Failed to load cached services");
    }

    // 2. Silently fetch the latest data from the Node.js server
    try {
      const response = await fetch(API_URL);
      const json = await response.json();
      
      if (json.success && json.data) {
        setServices(json.data);
        // Save the fresh data for the next time they open the app offline
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(json.data));
      }
    } catch (error) {
      console.log("Could not fetch latest gov services (User might be offline)");
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (number: string) => {
    // Triggers our custom Kotlin dialer directly
    if (Platform.OS === 'android') {
      try {
        CallManagerModule.startCall(number);
      } catch (e) {
        Linking.openURL(`tel:${number}`);
      }
    } else {
      Linking.openURL(`tel:${number}`);
    }
  };

  // Filter data based on search query
  const filteredServices = services.map(section => ({
    ...section,
    data: section.data.filter((item: any) => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.number.includes(searchQuery)
    )
  })).filter(section => section.data.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* HEADER */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#FFF" />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Government Services</Text>
         <View style={{width: 40}} /> 
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Feather name="search" size={20} color={THEME.textSub} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search services or numbers..."
            placeholderTextColor={THEME.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={20} color={THEME.textSub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LIST */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && services.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={THEME.primary} />
            <Text style={styles.emptyText}>Loading helplines...</Text>
          </View>
        ) : filteredServices.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>No services found for "{searchQuery}"</Text>
          </View>
        ) : (
          filteredServices.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.category}</Text>
              
              <View style={styles.card}>
                {section.data.map((item: any, idx: number) => (
                  <View key={item.id}>
                    <View style={styles.row}>
                      
                      <View style={styles.iconContainer}>
                        <MaterialIcons name={item.icon as any} size={24} color={THEME.primary} />
                      </View>
                      
                      <View style={styles.textContainer}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemNumber}>{item.number}</Text>
                        {item.desc ? <Text style={styles.itemDesc}>{item.desc}</Text> : null}
                      </View>

                      <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item.number)}>
                        <Ionicons name="call" size={20} color="#FFF" />
                      </TouchableOpacity>

                    </View>
                    {/* Don't show divider on the last item */}
                    {idx < section.data.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: THEME.primary,
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },

  searchContainer: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: THEME.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: THEME.textMain,
  },

  scrollContent: { padding: 20 },

  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textSub,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 5,
  },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: THEME.border,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EFF6FF', 
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  textContainer: { flex: 1, paddingRight: 10 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: THEME.textMain, marginBottom: 2 },
  itemNumber: { fontSize: 15, fontWeight: '800', color: THEME.accent, marginBottom: 2 },
  itemDesc: { fontSize: 12, color: THEME.textSub },

  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 75, 
  },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 15, fontSize: 16, color: THEME.textSub, fontWeight: '500' }
});