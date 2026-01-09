import * as Contacts from 'expo-contacts';

// 🟢 CONFIGURATION
// Replace this with your actual backend IP later.
// For now, we use a dummy URL to prevent crashes.
const API_BASE_URL = "http://192.168.1.10:3000/api"; 

// 1. CACHE STORAGE: Kept in memory for instant access (O(1) Lookup)
let localContactCache: Map<string, any> | null = null;
let isPreloading = false; 

// Helper: Standardize numbers to last 10 digits for clean matching
const normalize = (num: string) => {
  if (!num) return '';
  const cleaned = num.replace(/[^0-9]/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};

export const CallService = {

  /**
   * 🚀 PRE-LOADER: Loads device contacts into memory Map.
   * Call this in your app/_layout.tsx useEffect.
   */
  preloadContacts: async () => {
    if (isPreloading) return;
    isPreloading = true;

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log("🚫 Contact permissions not granted.");
        isPreloading = false;
        return;
      }

      console.log("📥 Syncing contacts to Qcall Cache...");
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.ImageAvailable],
      });

      const tempCache = new Map();
      data.forEach(contact => {
        contact.phoneNumbers?.forEach(p => {
          if (p.number) {
            const norm = normalize(p.number);
            if (norm) tempCache.set(norm, contact);
          }
        });
      });

      localContactCache = tempCache;
      console.log(`✅ Qcall Cache Ready: ${localContactCache.size} numbers stored.`);
    } catch (e) {
      console.error("⚠️ Preload failed:", e);
    } finally {
      isPreloading = false;
    }
  },

  /**
   * 📞 MAIN IDENTIFIER: Used by IncomingCallScreen
   */
  identifyNumber: async (incomingNumber: string) => {
    if (!incomingNumber) return null;
    const target = normalize(incomingNumber);

    // 🟢 PHASE 1: DEVICE CONTACTS (Instant)
    if (!localContactCache) {
      await CallService.preloadContacts();
    }

    const localMatch = localContactCache?.get(target);

    if (localMatch) {
      return {
        name: localMatch.name || 'Unknown',
        imageUri: localMatch.imageAvailable ? localMatch.image?.uri : null,
        isSpam: false,
        source: 'Device'
      };
    }

    // 🟢 PHASE 2: CLOUD DATABASE (3-second timeout)
    console.log(`📡 Searching Qcall Cloud for: ${target}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_BASE_URL}/contacts/search/${target}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.found) {
          return {
            name: data.name,
            imageUri: data.imageUri || null,
            isSpam: data.isSpam || false,
            spamScore: data.spamScore || 0,
            source: 'Qcall'
          };
        }
      }
    } catch (error) {
      console.log("⏳ Cloud lookup skipped (Timeout or Network).");
    }

    // 🟢 PHASE 3: FALLBACK
    return {
      name: 'Unknown Number',
      number: incomingNumber,
      imageUri: null,
      isSpam: false,
      source: 'Unknown'
    };
  },

  /**
   * 🔄 FORCE REFRESH: Use this when the user adds a new contact
   */
  refreshContacts: async () => {
    localContactCache = null;
    await CallService.preloadContacts();
  }
};