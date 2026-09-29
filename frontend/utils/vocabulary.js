export function getVocab(type) {
  if (type === 'SYNDIC') {
    return { Member: 'Copropriétaire', Members: 'Copropriétaires', member: 'copropriétaire', members: 'copropriétaires',
      Contribution: 'Charge', Contributions: 'Charges', contribution: 'charge', contributions: 'charges' };
  }
  return { Member: 'Membre', Members: 'Membres', member: 'membre', members: 'membres',
    Contribution: 'Cotisation', Contributions: 'Cotisations', contribution: 'cotisation', contributions: 'cotisations' };
}
