import { prisma } from '../middleware/auth.js';

/**
 * Enregistrer une action dans le journal d'activité
 * IMPORTANT: Toujours appeler APRÈS que l'opération a réussi, jamais avant.
 * Ne jamais laisser une erreur de journalisation remonter au client.
 */
export async function logActivity({ associationId, userId, userName, action, targetType, targetId, details }) {
  try {
    await prisma.activityLog.create({
      data: { 
        associationId, 
        userId, 
        userName, 
        action, 
        targetType, 
        targetId, 
        details 
      }
    });
  } catch (error) {
    // Erreur non bloquante - on log mais on ne fait pas échouer l'action principale
    console.error('Activity log error (non bloquant):', error);
  }
}

export default { logActivity };
