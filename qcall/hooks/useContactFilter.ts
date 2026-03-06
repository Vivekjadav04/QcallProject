import { useState, useEffect } from 'react';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { CallManagerModule } = NativeModules;

export interface AccountStat {
  name: string;
  type: string;
  count: number;
  isVisible: boolean;
}

export function useContactFilter() {
  const [accounts, setAccounts] = useState<AccountStat[]>([]);
  // 🟢 CHANGED: We now track what is VISIBLE, not what is hidden!
  const [visibleContactIds, setVisibleContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      
      if (!CallManagerModule || !CallManagerModule.getAccountStatistics) {
        setAccounts([]);
        setVisibleContactIds([]);
        return;
      }

      const stats = await CallManagerModule.getAccountStatistics();
      const hiddenJson = await AsyncStorage.getItem('@qcall_hidden_accounts');
      const hiddenAccounts: string[] = hiddenJson ? JSON.parse(hiddenJson) : [];

      const processed = (stats || []).map((acc: any) => ({
        ...acc,
        isVisible: !hiddenAccounts.includes(acc.name)
      }));
      
      setAccounts(processed);
      await fetchVisibleIds(processed);

    } catch (e) {
      console.error("Failed to load account stats", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisibleIds = async (currentAccounts: AccountStat[]) => {
    // Figure out which accounts the user actually wants to see
    const visibleNames = currentAccounts.filter(acc => acc.isVisible).map(acc => acc.name);

    // 🟢 FULL CONTROL: If nothing is checked, tell the UI to render absolutely nothing
    if (visibleNames.length === 0) {
      setVisibleContactIds(['HIDE_ALL']);
      return;
    }

    // Fetch the ALLOWED IDs from Native Kotlin and FORCE them to Strings
    if (CallManagerModule && CallManagerModule.getVisibleContactIds) {
      const ids = await CallManagerModule.getVisibleContactIds(visibleNames);
      setVisibleContactIds((ids || []).map(String));
    }
  };

  const toggleAccountVisibility = async (accountName: string) => {
    const updated = accounts.map(acc => 
      acc.name === accountName ? { ...acc, isVisible: !acc.isVisible } : acc
    );
    setAccounts(updated);
    
    const hidden = updated.filter(acc => !acc.isVisible).map(acc => acc.name);
    await AsyncStorage.setItem('@qcall_hidden_accounts', JSON.stringify(hidden));
    await fetchVisibleIds(updated);
  };

  const toggleAllAccounts = async (makeVisible: boolean) => {
    const updated = accounts.map(acc => ({ ...acc, isVisible: makeVisible }));
    setAccounts(updated);
    
    const hidden = updated.filter(acc => !acc.isVisible).map(acc => acc.name);
    await AsyncStorage.setItem('@qcall_hidden_accounts', JSON.stringify(hidden));
    await fetchVisibleIds(updated);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // 🟢 Outputting visibleContactIds instead of hiddenContactIds
  return { accounts, visibleContactIds, toggleAccountVisibility, toggleAllAccounts, loadAccounts, loading };
}