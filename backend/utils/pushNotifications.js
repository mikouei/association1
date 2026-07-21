/**
 * Utilitaire pour envoyer des notifications push via Expo Push API
 * Documentation: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envoie une notification push à un ou plusieurs tokens Expo
 * @param {Array<string>} pushTokens - Liste des tokens Expo (ExponentPushToken[...])
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {object} data - Données supplémentaires (optionnel)
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
export async function sendPushNotifications(pushTokens, title, body, data = {}) {
  if (!pushTokens || pushTokens.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  // Filtrer les tokens valides (format ExponentPushToken[...])
  const validTokens = pushTokens.filter(token => 
    token && typeof token === 'string' && token.startsWith('ExponentPushToken[')
  );

  if (validTokens.length === 0) {
    return { success: 0, failed: pushTokens.length, errors: ['Aucun token valide'] };
  }

  // Construire les messages (un par token)
  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'default',
  }));

  // Envoyer par lots de 100 (limite Expo)
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  const errors = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();

      if (result.data) {
        for (const ticket of result.data) {
          if (ticket.status === 'ok') {
            totalSuccess++;
          } else {
            totalFailed++;
            if (ticket.message) {
              errors.push(ticket.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Erreur envoi push:', error);
      totalFailed += chunk.length;
      errors.push(error.message);
    }
  }

  return {
    success: totalSuccess,
    failed: totalFailed,
    errors: [...new Set(errors)], // Dédupliquer les erreurs
  };
}

/**
 * Envoie une notification à tous les membres d'une association
 * @param {PrismaClient} prisma - Instance Prisma
 * @param {string} associationId - ID de l'association
 * @param {string} title - Titre
 * @param {string} body - Corps
 * @param {object} data - Données supplémentaires
 * @param {Array<string>} excludeUserIds - IDs d'utilisateurs à exclure (optionnel)
 */
export async function sendToAssociationMembers(prisma, associationId, title, body, data = {}, excludeUserIds = []) {
  // Récupérer tous les tokens des utilisateurs actifs de l'association
  const tokens = await prisma.pushToken.findMany({
    where: {
      user: {
        associationId,
        active: true,
        id: excludeUserIds.length > 0 ? { notIn: excludeUserIds } : undefined,
      },
    },
    select: { token: true },
  });

  const pushTokens = tokens.map(t => t.token);
  return sendPushNotifications(pushTokens, title, body, data);
}

/**
 * Envoie une notification à des membres spécifiques
 * @param {PrismaClient} prisma - Instance Prisma
 * @param {Array<string>} userIds - IDs des utilisateurs cibles
 * @param {string} title - Titre
 * @param {string} body - Corps
 * @param {object} data - Données supplémentaires
 */
export async function sendToSpecificMembers(prisma, userIds, title, body, data = {}) {
  const tokens = await prisma.pushToken.findMany({
    where: {
      userId: { in: userIds },
      user: { active: true },
    },
    select: { token: true },
  });

  const pushTokens = tokens.map(t => t.token);
  return sendPushNotifications(pushTokens, title, body, data);
}

/**
 * Envoie un rappel de cotisation aux membres en retard
 * @param {PrismaClient} prisma - Instance Prisma
 * @param {string} associationId - ID de l'association
 * @param {number} month - Mois concerné (1-12)
 * @param {number} year - Année concernée
 */
export async function sendPaymentReminder(prisma, associationId, month, year) {
  const monthNames = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  // Trouver l'année active
  const yearRecord = await prisma.year.findFirst({
    where: { associationId, year, active: true },
  });

  if (!yearRecord) {
    return { success: 0, failed: 0, errors: ['Année non trouvée ou inactive'] };
  }

  // Trouver les membres qui n'ont pas payé ce mois
  const membersWithPayments = await prisma.member.findMany({
    where: {
      associationId,
      active: true,
    },
    include: {
      payments: {
        where: {
          yearId: yearRecord.id,
          month,
        },
      },
      user: {
        include: {
          pushTokens: true,
        },
      },
    },
  });

  // Filtrer ceux qui n'ont pas payé (ou partiellement)
  const unpaidMembers = membersWithPayments.filter(m => {
    const payment = m.payments[0];
    return !payment || payment.amountPaid < yearRecord.monthlyAmount;
  });

  if (unpaidMembers.length === 0) {
    return { success: 0, failed: 0, errors: [], message: 'Tous les membres ont payé' };
  }

  // Collecter les tokens
  const pushTokens = [];
  for (const member of unpaidMembers) {
    for (const pt of member.user?.pushTokens || []) {
      pushTokens.push(pt.token);
    }
  }

  const title = 'Rappel de cotisation';
  const body = `Votre cotisation du mois de ${monthNames[month - 1]} ${year} est en attente.`;

  const result = await sendPushNotifications(pushTokens, title, body, {
    type: 'payment_reminder',
    month,
    year,
  });

  return {
    ...result,
    targetedMembers: unpaidMembers.length,
  };
}

export default {
  sendPushNotifications,
  sendToAssociationMembers,
  sendToSpecificMembers,
  sendPaymentReminder,
};
