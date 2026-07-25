/**
 * Utilitaire pour le modèle freemium
 * Gère les limites de membres selon le plan de l'association
 */

const DEFAULT_LAUNCH_PERIOD_MONTHS = 8;

/**
 * Calcule le plan effectif d'une association
 * @param {Object} association - L'association avec ses champs plan, createdAt, launchPeriodMonths
 * @returns {string} - Le plan effectif: 'LAUNCH', 'FREE', ou 'PAID'
 */
export function getEffectivePlan(association) {
  const { plan, createdAt, launchPeriodMonths } = association;

  // Si le plan est explicitement FREE ou PAID, le retourner directement
  if (plan === 'FREE' || plan === 'PAID') {
    return plan;
  }

  // Pour LAUNCH, vérifier si la période d'essai est expirée
  const launchMonths = launchPeriodMonths ?? DEFAULT_LAUNCH_PERIOD_MONTHS;
  const createdDate = new Date(createdAt);
  const expirationDate = new Date(createdDate);
  expirationDate.setMonth(expirationDate.getMonth() + launchMonths);

  const now = new Date();
  if (now > expirationDate) {
    // Période d'essai expirée → passe automatiquement en FREE
    return 'FREE';
  }

  return 'LAUNCH';
}

/**
 * Retourne la limite de membres selon le plan effectif
 * @param {string} effectivePlan - Le plan effectif ('LAUNCH', 'FREE', 'PAID')
 * @returns {number} - La limite de membres
 */
export function getMemberLimit(effectivePlan) {
  switch (effectivePlan) {
    case 'FREE':
      return 10;
    case 'LAUNCH':
    case 'PAID':
    default:
      return 250;
  }
}

/**
 * Vérifie si une association peut ajouter des membres
 * @param {Object} association - L'association avec ses champs plan, createdAt, launchPeriodMonths
 * @param {number} currentMemberCount - Le nombre actuel de membres
 * @param {number} membersToAdd - Le nombre de membres à ajouter (défaut: 1)
 * @returns {{ canAdd: boolean, limit: number, effectivePlan: string, message?: string }}
 */
export function checkMemberLimit(association, currentMemberCount, membersToAdd = 1) {
  const effectivePlan = getEffectivePlan(association);
  const limit = getMemberLimit(effectivePlan);

  if (currentMemberCount + membersToAdd > limit) {
    const message = effectivePlan === 'FREE'
      ? `Vous avez atteint la limite de ${limit} membres du palier gratuit. Contactez-nous pour passer à la version payante (jusqu'à 250 membres).`
      : `Limite de ${limit} membres atteinte pour cette association`;
    
    return { canAdd: false, limit, effectivePlan, message };
  }

  return { canAdd: true, limit, effectivePlan };
}

export default {
  getEffectivePlan,
  getMemberLimit,
  checkMemberLimit,
  DEFAULT_LAUNCH_PERIOD_MONTHS
};
