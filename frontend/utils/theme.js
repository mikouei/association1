// Système de Design Kotiz
// Variables de couleurs, typographie et espacements
// Note: Pour le mode sombre, utiliser useTheme() depuis context/ThemeContext.js

export const colors = {
  // Couleurs principales
  primary: '#F5A623',           // Or — boutons d'action principale
  primaryPressed: '#D9861F',
  secondary: '#1F4E79',         // Bleu nuit — en-têtes, navigation
  secondaryPressed: '#2A5F94',
  
  // Couleurs d'accent
  accentTerracotta: '#D9784F',  // Illustrations, badges neutres
  accentTeal: '#3A8F86',        // Catégories secondaires
  
  // Texte
  text: '#1F2937',
  textMuted: '#6B7280',
  textOnPrimary: '#1F2937',     // Texte sur fond Or (jamais blanc!)
  textOnSecondary: '#FFFFFF',   // Texte sur fond Bleu nuit
  
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

// Couleurs mode sombre (exportées pour référence)
export const darkColors = {
  primary: '#F5A623',
  primaryPressed: '#D9861F',
  secondary: '#3A7AB8',
  secondaryPressed: '#4A8AC8',
  accentTerracotta: '#E8896A',
  accentTeal: '#4AA89F',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  textOnPrimary: '#1F2937',
  textOnSecondary: '#FFFFFF',
  background: '#111827',
  backgroundWhite: '#1F2937',
  success: '#4ADE80',
  successBg: '#14532D',
  warning: '#FBBF24',
  warningBg: '#78350F',
  error: '#F87171',
  errorBg: '#7F1D1D',
  border: '#374151',
  borderLight: '#4B5563',
};

export const typography = {
  // Poppins pour les titres
  fontFamilyHeading: 'Poppins',
  // Inter pour le corps de texte
  fontFamilyBody: 'Inter',
  
  // Tailles et poids
  h1: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Poppins',
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Poppins',
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: 'Inter',
  },
  button: {
    fontSize: 14.5,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  caption: {
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  card: 16,
  button: 10,
  input: 10,
  badge: 12,
  icon: 10,
  full: 999,
};

// Styles pour les badges de statut
export const statusBadge = {
  success: {
    backgroundColor: colors.successBg,
    color: colors.success,
  },
  warning: {
    backgroundColor: colors.warningBg,
    color: colors.warning,
  },
  error: {
    backgroundColor: colors.errorBg,
    color: colors.error,
  },
};

// Styles pour les boutons
export const buttonStyles = {
  primary: {
    backgroundColor: colors.primary,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
    color: colors.textOnPrimary,
  },
  secondary: {
    backgroundColor: colors.secondary,
    color: colors.textOnSecondary,
  },
  secondaryPressed: {
    backgroundColor: colors.secondaryPressed,
    color: colors.textOnSecondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.secondary,
    borderWidth: 1.5,
    color: colors.secondary,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: colors.textMuted,
  },
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  statusBadge,
  buttonStyles,
};
