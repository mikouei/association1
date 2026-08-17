/**
 * Utilitaire pour gérer les notifications push côté mobile
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true, // Active les badges
  }),
});

/**
 * Demande la permission et enregistre le token push
 * @returns {Promise<string|null>} Token push ou null si échec
 */
export async function registerForPushNotifications() {
  let token = null;

  // Vérifier si c'est un appareil physique (pas simulateur)
  if (!Device.isDevice) {
    console.log('Les notifications push nécessitent un appareil physique');
    return null;
  }

  try {
    // Vérifier/demander les permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission de notification refusée');
      return null;
    }

    // Obtenir le token Expo Push
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    token = pushToken.data;
    console.log('Push token obtenu:', token);

    // Configuration spécifique Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E88E5',
      });
    }

    // Enregistrer le token sur le serveur
    try {
      await api.post('/notifications/register', {
        token,
        platform: Platform.OS,
      });
      console.log('Token enregistré sur le serveur');
    } catch (apiError) {
      console.log('Erreur enregistrement token (non-bloquant):', apiError.message);
    }

    return token;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement push:', error);
    return null;
  }
}

/**
 * Désenregistre le token push actuel
 */
export async function unregisterPushNotifications() {
  try {
    const pushToken = await Notifications.getExpoPushTokenAsync();
    
    await api.delete('/notifications/unregister', {
      data: { token: pushToken.data },
    });
    
    // Réinitialiser le badge à 0
    await setBadgeCount(0);
    
    console.log('Token désenregistré');
  } catch (error) {
    console.log('Erreur désenregistrement token:', error.message);
  }
}

/**
 * Définit le nombre du badge sur l'icône de l'app
 * @param {number} count - Nombre à afficher (0 pour effacer)
 */
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.log('Erreur mise à jour badge:', error.message);
  }
}

/**
 * Récupère le nombre actuel du badge
 * @returns {Promise<number>}
 */
export async function getBadgeCount() {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.log('Erreur lecture badge:', error.message);
    return 0;
  }
}

/**
 * Incrémente le badge de 1
 */
export async function incrementBadge() {
  const current = await getBadgeCount();
  await setBadgeCount(current + 1);
}

/**
 * Efface le badge (met à 0)
 */
export async function clearBadge() {
  await setBadgeCount(0);
}

/**
 * Ajoute un listener pour les notifications reçues (app au premier plan)
 * @param {function} callback - Fonction appelée avec la notification
 * @returns {function} Fonction pour supprimer le listener
 */
export function addNotificationReceivedListener(callback) {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    // Incrémenter le badge quand une notification est reçue
    incrementBadge();
    callback(notification);
  });
  return () => subscription.remove();
}

/**
 * Ajoute un listener pour les notifications cliquées
 * @param {function} callback - Fonction appelée avec la réponse
 * @returns {function} Fonction pour supprimer le listener
 */
export function addNotificationResponseListener(callback) {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    // Effacer le badge quand l'utilisateur clique sur une notification
    clearBadge();
    callback(response);
  });
  return () => subscription.remove();
}

/**
 * Envoie une notification locale (pour test)
 */
export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      badge: 1, // Afficher un badge
    },
    trigger: null, // Immédiat
  });
}

export default {
  registerForPushNotifications,
  unregisterPushNotifications,
  setBadgeCount,
  getBadgeCount,
  incrementBadge,
  clearBadge,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  sendLocalNotification,
};
