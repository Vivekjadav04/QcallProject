/**
 * Modern "Trust Standard" Palette
 * Vibe: Professional, Clean, High-Trust (Royal Blue & Slate)
 */

import { Platform } from 'react-native';

// ------------------------------------------------------------
// 1. THEME DEFINITION
// ------------------------------------------------------------
export const THEME = {
  colors: {
    // Brand Colors
    primary: '#2563EB',      // Royal Blue (Active Tabs, Buttons)
    primaryLight: '#EFF6FF', // Very Light Blue (Active Backgrounds)
    secondary: '#64748B',    // Slate Gray (Secondary Text/Icons)
    
    // Backgrounds
    bg: '#F8FAFC',
    background: '#F8FAFC',   // Cool Gray 50 (App Background)
    card: '#FFFFFF',         // Pure White (Cards, Lists, Modals)
    
    // Text
    textMain: '#1E293B',     // Slate 800 (Headings, Names)
    textSub: '#64748B',      // Slate 500 (Phone numbers, timestamps)
    textInverse: '#FFFFFF',  // Text on Blue buttons
    
    // States
    border: '#E2E8F0',       // Light Divider
    success: '#10B981',      // Green (Call Answered)
    danger: '#EF4444',       // Red (Call Missed/Ended)
    warning: '#F59E0B',      // Amber
  },
  
  // ------------------------------------------------------------
  // 2. SHADOW SYSTEM (Depth)
  // ------------------------------------------------------------
  shadows: {
    // Soft, expensive-looking shadow for cards
    medium: {
      shadowColor: "#2563EB", 
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4, // Android
    },
    // Stronger shadow for floating elements (Tab Bar, FAB)
    floating: {
      shadowColor: "#0F172A", 
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10, // Android
    }
  },
  
  // ------------------------------------------------------------
  // 3. LAYOUT CONSTANTS
  // ------------------------------------------------------------
  layout: {
    borderRadius: 16, // Modern "Squircle" radius
    padding: 20,
    iconSize: 24,
  }
};

// ------------------------------------------------------------
// 4. COMPATIBILITY EXPORT (For any old code using Colors.light)
// ------------------------------------------------------------
export const Colors = {
  light: {
    text: THEME.colors.textMain,
    background: THEME.colors.background,
    tint: THEME.colors.primary,
    tabIconDefault: THEME.colors.textSub,
    tabIconSelected: THEME.colors.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#111827',
    tint: THEME.colors.primary,
    tabIconDefault: '#9BA1A6',
    tabIconSelected: THEME.colors.primary,
  },
};