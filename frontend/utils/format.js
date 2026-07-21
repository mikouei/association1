// Utilitaires de formatage pour AssocManager

/**
 * Formate un nombre avec séparateur de milliers (format français)
 * @param {number} num - Le nombre à formater
 * @returns {string} - Le nombre formaté (ex: "15 000")
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('fr-FR').format(Math.round(num));
};

/**
 * Formate un montant (alias de formatNumber pour compatibilité)
 * @param {number} amount - Le montant à formater
 * @returns {string} - Le montant formaté (ex: "15 000")
 */
export const formatAmount = (amount) => {
  return formatNumber(amount);
};

/**
 * Formate un montant en FCFA
 * @param {number} amount - Le montant à formater
 * @returns {string} - Le montant formaté (ex: "15 000 FCFA")
 */
export const formatCurrency = (amount) => {
  return `${formatNumber(amount)} FCFA`;
};

/**
 * Formate un pourcentage
 * @param {number} percentage - Le pourcentage à formater
 * @returns {string} - Le pourcentage formaté (ex: "75%")
 */
export const formatPercentage = (percentage) => {
  if (percentage === null || percentage === undefined || isNaN(percentage)) return '0%';
  return `${Math.round(percentage)}%`;
};

export default {
  formatNumber,
  formatAmount,
  formatCurrency,
  formatPercentage
};
