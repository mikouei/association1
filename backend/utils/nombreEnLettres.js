export function nombreEnLettres(nombre) {
  const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
  function convertDizaine(n, noPluralBeforeNumber) {
    if (n < 20) return UNITES[n];
    const d = Math.floor(n / 10); const u = n % 10;
    if (d === 7 || d === 9) return DIZAINES[d - 1] + '-' + UNITES[10 + u];
    let mot = DIZAINES[d];
    if (u === 0) { if (d === 8 && !noPluralBeforeNumber) mot += 's'; return mot; }
    if (u === 1 && d !== 8) return mot + ' et un';
    return mot + '-' + UNITES[u];
  }
  function convertCentaine(n, noPluralBeforeNumber) {
    if (n < 100) return convertDizaine(n, noPluralBeforeNumber);
    const c = Math.floor(n / 100); const reste = n % 100;
    let mot = c === 1 ? 'cent' : UNITES[c] + ' cent';
    if (reste === 0) { if (c > 1 && !noPluralBeforeNumber) mot += 's'; return mot; }
    return mot + ' ' + convertDizaine(reste, noPluralBeforeNumber);
  }
  function convertGroupe(n, singulier, pluriel) {
    if (n === 0) return '';
    if (singulier === 'mille') { if (n === 1) return 'mille'; return convertCentaine(n, true) + ' mille'; }
    const mot = n === 1 ? singulier : pluriel;
    return convertCentaine(n, false) + ' ' + mot;
  }
  const n = Math.round(Math.abs(nombre));
  if (n === 0) return 'zéro';
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const unites = n % 1000;
  const parts = [];
  if (milliards > 0) parts.push(convertGroupe(milliards, 'milliard', 'milliards'));
  if (millions > 0) parts.push(convertGroupe(millions, 'million', 'millions'));
  if (milliers > 0) parts.push(convertGroupe(milliers, 'mille', 'mille'));
  if (unites > 0) parts.push(convertCentaine(unites));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
