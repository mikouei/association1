/**
 * Utilitaire de formatage des montants selon la devise
 */

// Configurations des devises supportées
const CURRENCY_CONFIG: Record<string, {
  code: string;
  symbol: string;
  symbolPosition: 'before' | 'after';
  locale: string;
  decimals: number;
  name: string;
}> = {
  XOF: {
    code: 'XOF',
    symbol: 'FCFA',
    symbolPosition: 'after',
    locale: 'fr-FR',
    decimals: 0,
    name: 'Franc CFA (FCFA)'
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    symbolPosition: 'after',
    locale: 'fr-FR',
    decimals: 2,
    name: 'Euro (€)'
  },
  USD: {
    code: 'USD',
    symbol: '$',
    symbolPosition: 'before',
    locale: 'en-US',
    decimals: 2,
    name: 'Dollar US ($)'
  }
};

const DEFAULT_CURRENCY = 'XOF';

export type CurrencyCode = 'XOF' | 'EUR' | 'USD';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

/**
 * Récupère la configuration d'une devise
 */
export function getCurrencyConfig(currencyCode: string) {
  return CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG[DEFAULT_CURRENCY];
}

/**
 * Liste toutes les devises supportées
 */
export function getSupportedCurrencies(): CurrencyInfo[] {
  return Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
    code,
    name: config.name,
    symbol: config.symbol
  }));
}

/**
 * Formate un montant selon la devise
 */
export function formatAmount(
  amount: number, 
  currencyCode: string = DEFAULT_CURRENCY, 
  options: { showSymbol?: boolean; compact?: boolean } = {}
): string {
  const config = getCurrencyConfig(currencyCode);
  const { showSymbol = true, compact = false } = options;

  let formattedNumber: string;
  
  if (compact && Math.abs(amount) >= 1000000) {
    const millions = amount / 1000000;
    formattedNumber = millions.toLocaleString(config.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }) + 'M';
  } else if (compact && Math.abs(amount) >= 10000) {
    const thousands = amount / 1000;
    formattedNumber = Math.round(thousands).toLocaleString(config.locale) + 'k';
  } else {
    formattedNumber = amount.toLocaleString(config.locale, {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    });
  }

  if (!showSymbol) {
    return formattedNumber;
  }

  if (config.symbolPosition === 'before') {
    return `${config.symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber} ${config.symbol}`;
  }
}

/**
 * Parse un montant depuis une chaîne formatée
 */
export function parseAmount(formattedAmount: string | number, currencyCode: string = DEFAULT_CURRENCY): number {
  if (typeof formattedAmount === 'number') return formattedAmount;
  
  const config = getCurrencyConfig(currencyCode);
  
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
