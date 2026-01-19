import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { loadUserFromStorage, logoutUser, setUser } from '../store/authSlice';
import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isLoading, isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Load user on mount
  useEffect(() => {
    if (!user && isLoading) {
      dispatch(loadUserFromStorage());
    }
  }, []);

  // 1. Check User Logic
  const checkUserExists = async (phone: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/profile/${phone}`);
      return res.data.success;
    } catch (e: any) {
      return false;
    }
  };

  // 2. Login Logic
  const login = async (phone: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/profile/${phone}`);
      if (res.data.success) {
        dispatch(setUser(res.data.data)); // Update Redux
        return true;
      }
    } catch (e) { console.error(e); }
    return false;
  };

  // 3. Logout Logic
  const logout = () => {
    dispatch(logoutUser()); // Wipe Redux & Storage
  };

  return {
    user,
    loading: isLoading,
    isAuthenticated,
    checkUserExists,
    login,
    logout,
    loadUser: () => dispatch(loadUserFromStorage()),
    updateUser: (data: any) => dispatch(setUser({ ...user, ...data })), // Helper for edit-profile
  };
};