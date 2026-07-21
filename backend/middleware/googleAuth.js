// Middleware de vérification des tokens Google OAuth
import { OAuth2Client } from 'google-auth-library';

// GOOGLE_CLIENT_ID est optionnel - logger un avertissement si absent
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
  console.warn('⚠️ AVERTISSEMENT: GOOGLE_CLIENT_ID non défini. L\'authentification Google ne fonctionnera pas.');
}

// Client OAuth2 (initialisé seulement si GOOGLE_CLIENT_ID est défini)
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

/**
 * Vérifie un ID token Google et retourne les informations du payload
 * @param {string} idToken - Le token ID retourné par Google Sign-In
 * @returns {Promise<{googleId: string, email: string, name: string}>}
 * @throws {Error} Si la vérification échoue ou si l'email n'est pas vérifié
 */
export async function verifyGoogleIdToken(idToken) {
  if (!googleClient) {
    throw new Error('GOOGLE_NOT_CONFIGURED');
  }

  if (!idToken) {
    throw new Error('TOKEN_MISSING');
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('INVALID_PAYLOAD');
    }
    
    if (!payload.email_verified) {
      throw new Error('EMAIL_NOT_VERIFIED');
    }
    
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || '',
    };
  } catch (error) {
    // Re-throw nos erreurs custom
    if (error.message === 'EMAIL_NOT_VERIFIED' || 
        error.message === 'GOOGLE_NOT_CONFIGURED' ||
        error.message === 'TOKEN_MISSING' ||
        error.message === 'INVALID_PAYLOAD') {
      throw error;
    }
    
    // Erreurs de vérification Google (token expiré, signature invalide, etc.)
    console.error('Google token verification error:', error.message);
    throw new Error('INVALID_TOKEN');
  }
}

/**
 * Vérifie si l'authentification Google est configurée
 * @returns {boolean}
 */
export function isGoogleAuthConfigured() {
  return !!GOOGLE_CLIENT_ID;
}

export default {
  verifyGoogleIdToken,
  isGoogleAuthConfigured
};
