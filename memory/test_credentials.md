# Test Credentials - Kotiz / AssocManager

> Environnement de test LOCAL dans ce conteneur (PostgreSQL local + backend Express sur port 8001).
> Base seedée via `backend/scripts/seed-test.js`.

## Admin Association ASCB (compte de test principal)
- **Association**: ASCB (code: `ASCB`)
- **Téléphone**: +2250708510832
- **Mot de passe**: admin123
- **Rôle**: ADMIN
- **Email interne**: admin@ascb.local

## Super Admin Platform (référence problème — non seedé en local)
- **Email**: drigo@drigo.local
- **URL**: /platform/login

## Fonctionnalité "Inscription en attente" — flux de test
1. Public: `POST /api/public/associations/ASCB/join-request` avec `{ name, phone, password (>=8) }`
   → crée un compte `MEMBER` avec `approvalStatus: PENDING` (pas de token JWT retourné).
2. Le membre PENDING ne peut PAS se connecter → 403 `{ code: "PENDING_APPROVAL" }`.
3. Admin (ASCB) → écran Paramètres → section "Demandes d'inscription" → sélectionner → Approuver / Refuser.
   - Approuver → `POST /api/admin/pending-members/approve { ids }`
   - Refuser  → `POST /api/admin/pending-members/reject  { ids }` (supprime member + user)
4. Après approbation, le membre peut se connecter normalement.

### Membre de test à créer via le formulaire mobile (/join/ASCB)
- Nom: Jean Kouassi
- Téléphone: +2250700000010 (utiliser un numéro non déjà utilisé)
- Mot de passe: motdepasse123
