/**
 * Service de rappels automatiques de cotisation
 * Peut être déclenché manuellement ou via un cron job externe
 */

import { PrismaClient } from '@prisma/client';
import { sendPaymentReminder, sendToAssociationMembers } from './pushNotifications.js';

const prisma = new PrismaClient();

/**
 * Envoie des rappels à toutes les associations pour le mois en cours
 * À appeler en début de mois (ex: le 5 de chaque mois)
 */
export async function sendMonthlyReminders() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  console.log(`[Reminder Service] Démarrage des rappels pour ${currentMonth}/${currentYear}`);

  try {
    // Récupérer toutes les associations actives
    const associations = await prisma.association.findMany({
      where: { active: true },
      select: { id: true, name: true },
    });

    const results = [];

    for (const association of associations) {
      try {
        const result = await sendPaymentReminder(
          prisma,
          association.id,
          currentMonth,
          currentYear
        );

        results.push({
          associationId: association.id,
          associationName: association.name,
          success: result.success,
          failed: result.failed,
          targetedMembers: result.targetedMembers || 0,
        });

        // Sauvegarder l'annonce
        if (result.targetedMembers > 0) {
          // Trouver un admin de l'association pour l'associer comme sender
          const admin = await prisma.user.findFirst({
            where: { associationId: association.id, role: 'ADMIN' },
          });

          if (admin) {
            await prisma.announcement.create({
              data: {
                associationId: association.id,
                senderId: admin.id,
                title: 'Rappel automatique de cotisation',
                body: `Rappel pour le mois ${currentMonth}/${currentYear}`,
                type: 'reminder',
                targetType: 'selected',
                sentCount: result.success,
              },
            });
          }
        }

        console.log(`[Reminder Service] ${association.name}: ${result.targetedMembers || 0} membres ciblés, ${result.success} envoyés`);
      } catch (error) {
        console.error(`[Reminder Service] Erreur pour ${association.name}:`, error.message);
        results.push({
          associationId: association.id,
          associationName: association.name,
          error: error.message,
        });
      }
    }

    console.log(`[Reminder Service] Terminé. ${associations.length} associations traitées.`);
    return results;
  } catch (error) {
    console.error('[Reminder Service] Erreur globale:', error);
    throw error;
  }
}

/**
 * Envoie un rappel pour une association spécifique
 * @param {string} associationId 
 * @param {number} month 
 * @param {number} year 
 */
export async function sendReminderForAssociation(associationId, month, year) {
  return sendPaymentReminder(prisma, associationId, month, year);
}

/**
 * Programme les rappels automatiques (à intégrer avec node-cron si nécessaire)
 * Note: Dans un environnement serverless, utiliser un service externe (Vercel Cron, Railway Cron, etc.)
 */
export function scheduleReminders() {
  // Import dynamique pour éviter les erreurs si node-cron n'est pas installé
  import('node-cron').then((cron) => {
    // Exécuter le 5 de chaque mois à 9h00
    cron.schedule('0 9 5 * *', async () => {
      console.log('[Cron] Déclenchement des rappels mensuels');
      try {
        await sendMonthlyReminders();
      } catch (error) {
        console.error('[Cron] Erreur lors des rappels:', error);
      }
    });

    console.log('[Cron] Rappels automatiques programmés (5 de chaque mois à 9h00)');
  }).catch(() => {
    console.log('[Cron] node-cron non disponible, rappels manuels uniquement');
  });
}

export default {
  sendMonthlyReminders,
  sendReminderForAssociation,
  scheduleReminders,
};
