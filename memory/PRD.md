# PRD — Kotiz (Gestion d'Associations)

## Contexte
Application de gestion d'associations. Stack: Backend **Express.js + Prisma + PostgreSQL** (hébergé sur Render), Frontend **mobile React Native Expo (SDK 54)**, Frontend **web Next.js**. Auth JWT + Google Sign-In.

Code importé depuis GitHub: `mikouei/association1` (branche `feature/multi-association`).

## Architecture
- `backend/` : API Express (routes/, middleware/, prisma/, utils/). Prisma + PostgreSQL.
- `frontend/` : app mobile Expo (expo-router, dossier `app/`).
- `web/` : app Next.js (App Router).
- Backend actif = `backend/` (le dossier `backend-v2/` est obsolète).

## Environnement de test local (dans ce conteneur)
- PostgreSQL 15 local, DB `kotiz`, seedée par `backend/scripts/seed-test.js`.
- Backend Express lancé via supervisor programme **`kotiz-backend`** sur le port **8001** (le programme `backend` uvicorn/FastAPI du template Emergent est volontairement stoppé).
- Mobile: preview Expo → EXPO_PUBLIC_BACKEND_URL → ingress /api → port 8001.

## Comptes de test
Voir `/app/memory/test_credentials.md`. Admin ASCB: tél `+2250708510832` / `admin123`.

## Fonctionnalités déjà présentes (avant reprise)
- RBAC (ADMIN, SCANNER, AUDITEUR, MEMBER)
- Reconnexion rapide par accessToken (membres)
- Import CSV tolérant
- Auto-service profil (email/phone/password)
- Carte membre QR code, écran audit (AUDITEUR)

## Implémenté dans cette session (2026-08-19) — Système d'inscription en attente
- **Prisma**: ajout `User.approvalStatus String @default("APPROVED")` + `@@index([approvalStatus])`.
- **Backend**:
  - `POST /api/public/associations/:code/join-request` — crée User+Member `PENDING` (pas de JWT), plafond membres filtré sur `approvalStatus: 'APPROVED'`, dédoublonnage tél/email (409 ALREADY_MEMBER), password >=8.
  - Route `join-google` : plafond membres filtré sur `approvalStatus: 'APPROVED'`.
  - `POST /api/auth/login` : contrôle `approvalStatus` AVANT vérif mot de passe → 403 `PENDING_APPROVAL` / `REJECTED`.
  - `GET /api/admin/pending-members` (requireAdmin) : liste id/name/email/phone/requestedAt.
  - `POST /api/admin/pending-members/approve {ids}` : updateMany → APPROVED + logActivity.
  - `POST /api/admin/pending-members/reject {ids}` : suppression member+user (transaction) + logActivity.
- **Mobile** (`app/join/[code].js`): bouton "Demander à rejoindre manuellement" + formulaire (nom, tél, mdp + confirmation avec eye toggle, validation 8 car.), écran succès "Demande envoyée".
- **Mobile** (`app/(tabs)/parametres.js`): section admin "Demandes d'inscription" avec badge, liste cochable, boutons Approuver/Refuser.
- **Web** (`web/src/app/settings/page.tsx`): carte "Demandes d'inscription" (React Query + mutations approve/reject, sélection multiple + Tout sélectionner).

### Validation
- Backend: 14/14 tests (pytest) OK + curl e2e OK.
- Mobile: flux join-request (succès) + flux admin approuver OK (agent de test).
- Web: `tsc --noEmit` OK.

## Déploiement (stack Render du user)
1. Appliquer le schéma sur la DB Render: `npx prisma db push --accept-data-loss` (ou migration).
2. Déployer backend + web sur Render (pipeline git du user / `deploy.sh`).
3. Build mobile: EXPO_PUBLIC_BACKEND_URL → `https://association1.onrender.com` en prod.

## Backlog / Améliorations possibles
- P2: testIDs sur l'écran `login.js` (robustesse tests).
- P2: rendre `joinLimiter` (5/h/IP) configurable via env (NAT partagé).
- P2: notifier l'admin (in-app) quand une nouvelle demande arrive.
