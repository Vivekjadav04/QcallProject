import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

// 🟢 FIX: Expand the User interface to include ALL profile fields
interface User {
  phoneNumber: string;
  name?: string;
  email?: string;
  profilePhoto?: string;
  // New fields needed for Edit Profile
  firstName?: string;
  lastName?: string;
  secondPhoneNumber?: string;
  birthday?: string;
  gender?: string;
  aboutMe?: string;
  tags?: string[];
  address?: {
    street?: string;
    city?: string;
    zipCode?: string;
    country?: string;
  };
  company?: {
    title?: string;
    website?: string;
  };
  // Allow dynamic access for handleNestedChange
  [key: string]: any; 
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

export const loadUserFromStorage = createAsyncThunk('auth/loadUser', async () => {
  try {
    const phone = await AsyncStorage.getItem('user_phone');
    if (!phone) return null;

    try {
        const res = await axios.get(`${API_BASE_URL}/profile/${phone}`);
        if (res.data.success) return res.data.data;
    } catch (e) {
        return { phoneNumber: phone };
    }
    return { phoneNumber: phone };
  } catch (error) {
    return null;
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.clear();
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
      AsyncStorage.setItem('user_phone', action.payload.phoneNumber);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadUserFromStorage.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(loadUserFromStorage.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.isLoading = false;
    });
    builder.addCase(loadUserFromStorage.rejected, (state) => {
      state.isLoading = false;
    });
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
    });
  },
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;