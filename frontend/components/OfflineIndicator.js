// Composant d'indicateur de statut réseau
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiSlash, CloudCheck } from 'phosphor-react-native';
import { useOffline } from '../context/OfflineContext';
import { colors, spacing, typography } from '../utils/theme';

export default function OfflineIndicator({ showWhenOnline = false }) {
  const { isOnline, getLastSyncText } = useOffline();
  
  // Ne rien afficher si en ligne et showWhenOnline est false
  if (isOnline && !showWhenOnline) return null;
  
  const lastSync = getLastSyncText();

  return (
    <View style={[styles.container, isOnline ? styles.online : styles.offline]}>
      {isOnline ? (
        <>
          <CloudCheck size={16} color={colors.success} weight="fill" />
          <Text style={[styles.text, styles.textOnline]}>
            En ligne {lastSync && `• Sync ${lastSync}`}
          </Text>
        </>
      ) : (
        <>
          <WifiSlash size={16} color="#FFF" weight="fill" />
          <Text style={[styles.text, styles.textOffline]}>
            Hors ligne {lastSync && `• Données du ${lastSync}`}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  online: {
    backgroundColor: colors.successBg,
  },
  offline: {
    backgroundColor: colors.warning,
  },
  text: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  textOnline: {
    color: colors.success,
  },
  textOffline: {
    color: '#FFF',
  },
});
