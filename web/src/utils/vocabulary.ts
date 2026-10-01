export function getVocab(type?: string | null) {
  if (type === 'SYNDIC') {
    return { Member: 'Copropriétaire', Members: 'Copropriétaires', Contribution: 'Charge', Contributions: 'Charges' };
  }
  return { Member: 'Membre', Members: 'Membres', Contribution: 'Cotisation', Contributions: 'Cotisations' };
}
