/**
 * Utilitaire de formatage des montants selon la devise
 */

// Configurations des devises supportées
const CURRENCY_CONFIG = {
  XOF: {
    code: 'XOF',
    symbol: 'FCFA',
    symbolPosition: 'after', // "1 000 FCFA"
    locale: 'fr-FR',
    decimals: 0, // Pas de centimes en FCFA
    name: 'Franc CFA (FCFA)'
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    symbolPosition: 'after', // "1 000 €"
    locale: 'fr-FR',
    decimals: 2,
    name: 'Euro (€)'
  },
  USD: {
    code: 'USD',
    symbol: '$',
    symbolPosition: 'before', // "$1,000"
    locale: 'en-US',
    decimals: 2,
    name: 'Dollar US ($)'
  }
};

// Devise par défaut
const DEFAULT_CURRENCY = 'XOF';

/**
 * Récupère la configuration d'une devise
 * @param {string} currencyCode - Code devise (XOF, EUR, USD)
 * @returns {object} Configuration de la devise
 */
export function getCurrencyConfig(currencyCode) {
  return CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG[DEFAULT_CURRENCY];
}

/**
 * Liste toutes les devises supportées
 * @returns {Array<{code: string, name: string, symbol: string}>}
 */
export function getSupportedCurrencies() {
  return Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
    code,
    name: config.name,
    symbol: config.symbol
  }));
}

/**
 * Formate un montant selon la devise
 * @param {number} amount - Montant à formater
 * @param {string} currencyCode - Code devise (XOF, EUR, USD)
 * @param {object} options - Options de formatage
 * @returns {string} Montant formaté
 */
export function formatAmount(amount, currencyCode = DEFAULT_CURRENCY, options = {}) {
  const config = getCurrencyConfig(currencyCode);
  const { showSymbol = true, compact = false } = options;

  // Formatage du nombre
  let formattedNumber;
  
  if (compact && Math.abs(amount) >= 1000000) {
    // Format compact pour les millions (ex: "1,2M")
    const millions = amount / 1000000;
    formattedNumber = millions.toLocaleString(config.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }) + 'M';
  } else if (compact && Math.abs(amount) >= 10000) {
    // Format compact pour les milliers (ex: "10k")
    const thousands = amount / 1000;
    formattedNumber = Math.round(thousands).toLocaleString(config.locale) + 'k';
  } else {
    // Format standard
    formattedNumber = amount.toLocaleString(config.locale, {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    });
  }

  if (!showSymbol) {
    return formattedNumber;
  }

  // Ajout du symbole selon la position
  if (config.symbolPosition === 'before') {
    return `${config.symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber} ${config.symbol}`;
  }
}

/**
 * Parse un montant depuis une chaîne formatée
 * @param {string} formattedAmount - Montant formaté
 * @param {string} currencyCode - Code devise
 * @returns {number} Montant en nombre
 */
export function parseAmount(formattedAmount, currencyCode = DEFAULT_CURRENCY) {
  if (typeof formattedAmount === 'number') return formattedAmount;
  
  const config = getCurrencyConfig(currencyCode);
  
  // Retirer le symbole et les espaces
  let cleaned = formattedAmount
    .replace(config.symbol, '')
    .replace(/\s/g, '')
    .replace(/,/g, config.locale.startsWith('fr') ? '' : '.')
    .replace(/\./g, config.locale.startsWith('fr') ? '.' : '');
    
  return parseFloat(cleaned) || 0;
}

export default {
  formatAmount,
  parseAmount,
  getCurrencyConfig,
  getSupportedCurrencies,
  DEFAULT_CURRENCY
};
