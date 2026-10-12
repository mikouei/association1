import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api, { triggerUnauthorized } from './api';

// Télécharge un PDF authentifié puis propose le partage (mobile).
// Sur web, ouvre l'URL dans un nouvel onglet.
export async function downloadPdf(path, filename, title, options = {}) {
  try {
    const ext = options.ext || 'pdf';
    const mimeType = options.mimeType || 'application/pdf';
    const uti = options.uti || 'com.adobe.pdf';
    if (Platform.OS !== 'web') {
      const safeName = (filename || 'document').replace(/[^a-zA-Z0-9]/g, '_');
      const finalName = `${safeName}_${Date.now()}.${ext}`;
      const fileUri = FileSystem.documentDirectory + finalName;

      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        Alert.alert('Erreur', 'Session expirée, veuillez vous reconnecter');
        return;
      }

      const downloadResult = await FileSystem.downloadAsync(
        `${api.defaults.baseURL}${path}`,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (downloadResult.status === 401) {
        // Hors intercepteur axios : déclencher le même traitement de session expirée
        triggerUnauthorized('user');
        return;
      }

      if (downloadResult.status !== 200) {
        throw new Error('Erreur lors du téléchargement');
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType,
          dialogTitle: title || 'Document',
          UTI: uti,
        });
      } else {
        Alert.alert('Info', 'Le partage n\'est pas disponible sur cet appareil.');
      }
      return;
    }

    const url = `${api.defaults.baseURL}${path}`;
    window.open(url, '_blank');
  } catch (error) {
    console.error('downloadPdf error:', error);
    Alert.alert('Erreur', error?.message || 'Erreur lors de la génération du PDF');
  }
}
