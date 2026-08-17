// Contexte pour la gestion du thème (clair/sombre)
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const THEME_STORAGE_KEY = '@kotiz_theme_preference';

// Couleurs pour le mode clair
export const lightColors = {
  // Couleurs principales
  primary: '#F5A623',
  primaryPressed: '#D9861F',
  secondary: '#1F4E79',
  secondaryPressed: '#2A5F94',
  
  // Couleurs d'accent
  accentTerracotta: '#D9784F',
  accentTeal: '#3A8F86',
  
  // Texte
  text: '#1F2937',
  textMuted: '#6B7280',
  textOnPrimary: '#1F2937',
  textOnSecondary: '#FFFFFF',
  
  // Fond
  background: '#FAFAFA',
  backgroundWhite: '#FFFFFF',
  
  // États
  success: '#2E7D32',
  successBg: '#EAF7EC',
  warning: '#B26A00',
  warningBg: '#FFF3E0',
  error: '#B00020',
  errorBg: '#FBEAEC',
  
  // Bordures et séparateurs
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
};

// Couleurs pour le mode sombre
export const darkColors = {
  // Couleurs principales (gardées identiques pour la marque)
  primary: '#F5A623',
  primaryPressed: '#D9861F',
  secondary: '#3A7AB8',
  secondaryPressed: '#4A8AC8',
  
  // Couleurs d'accent
  accentTerracotta: '#E8896A',
  accentTeal: '#4AA89F',
  
  // Texte (inversé)
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  textOnPrimary: '#1F2937',
  textOnSecondary: '#FFFFFF',
  
  // Fond (sombre)
  background: '#111827',
  backgroundWhite: '#1F2937',
  
  // États (légèrement ajustés pour le contraste)
  success: '#4ADE80',
  successBg: '#14532D',
  warning: '#FBBF24',
  warningBg: '#78350F',
  error: '#F87171',
  errorBg: '#7F1D1D',
  
  // Bordures (plus foncées)
  border: '#374151',
  borderLight: '#4B5563',
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('light'); // 'light', 'dark', 'system'
  const [isLoading, setIsLoading] = useState(true);

  // Charger la préférence sauvegardée
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        setThemeMode(savedTheme);
      }
    } catch (error) {
      console.error('Erreur chargement thème:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (mode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Erreur sauvegarde thème:', error);
    }
  };

  // Déterminer le thème effectif
  const effectiveTheme = themeMode === 'system' 
    ? (systemColorScheme || 'light')
    : themeMode;

  const isDark = effectiveTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{
      themeMode,
      setTheme,
      isDark,
      colors,
      isLoading,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
