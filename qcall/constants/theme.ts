/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// ------------------------------------------------------------
// 1. YOUR CUSTOM PALETTE
// ------------------------------------------------------------
const palette = {
  cream: '#FFF5E9',      // Background
  peach: '#FFD7A8',      // User Bubble / Secondary
  white: '#FFFFFF',      // Bot Bubble / Cards
  orange: '#D66F2C',     // Primary Brand Text
  green: '#00A34A',      // Success
  black: '#000000',      // Primary Action
  darkGrey: '#2D2D2D',   // Main Text
  red: '#FF4B4B',        // Error / Hang up
  
  // Dark mode specific (Optional, for better contrast)
  darkBackground: '#1A1A1A',
  darkCard: '#2C2C2C',
};

const tintColorLight = palette.orange;
const tintColorDark = palette.orange; // Keep brand color in dark mode too

// ------------------------------------------------------------
// 2. UPDATED COLORS OBJECT
// ------------------------------------------------------------
export const Colors = {
  light: {
    text: palette.darkGrey,
    background: palette.cream, // The creamy warm white you wanted
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    
    // Custom Brand Colors
    primary: palette.orange,
    secondary: palette.peach,
    card: palette.white,
    success: palette.green,
    error: palette.red,
    border: palette.peach, 
  },
  dark: {
    text: '#ECEDEE',
    background: palette.darkBackground, // Dark grey for night mode
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // Custom Brand Colors (Dark Mode variations)
    primary: palette.orange, // Orange still pops nicely on black
    secondary: '#4A3B32',    // Darker version of peach
    card: palette.darkCard,
    success: palette.green,
    error: palette.red,
    border: '#444',
  },
};

// ------------------------------------------------------------
// 3. FONTS (KEPT EXACTLY AS IS)
// ------------------------------------------------------------
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});