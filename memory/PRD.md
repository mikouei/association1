# AssocManager / Kotiz - Product Requirements Document

## Aperçu du projet
Kotiz (anciennement AssocManager) est une application de gestion d'associations qui permet de gérer les membres, les cotisations mensuelles et exceptionnelles, et les véhicules des membres.

## Architecture

### Backend
- **Technologie** : Node.js, Express.js
- **Base de données** : PostgreSQL (Render)
- **ORM** : Prisma
- **Architecture** : Multi-tenant avec isolation par `associationId`

### Frontend
- **Mobile** : React Native (Expo) + Phosphor Icons
- **Web** : Next.js + Phosphor Icons + Tailwind CSS

### Design System - 19 Juillet 2026 ✅
- **Couleur primaire** : #F5A623 (Gold)
- **Couleur secondaire** : #1F4E79 (Navy)
- **Texte** : #1F2937 (foncé) / #6B7280 (muted)
- **Rayons** : 16px (cards), 10px (buttons/inputs), 12px (badges)
- **Espacements** : 4/8/12/16/24/32px
- **Polices** : Poppins (titres), Inter (corps)
- **WCAG** : Texte foncé (#1F2937) sur fond Gold pour contraste
- **Icônes** : Phosphor Icons (mobile: phosphor-react-native, web: @phosphor-icons/react)

## Création d'association en libre-service - 20 Juillet 2026 ✅

### Objectif
Permettre à n'importe qui de créer lui-même son association sans intervention du Super Admin.

### Routes Backend ajoutées
- `GET /api/public/associations/check-code/:code` - Vérifier disponibilité d'un code (temps réel)
- `POST /api/public/associations/register` - Créer une association + admin
- `GET /api/public/associations/:code/info` - Infos publiques d'une association (pour liens d'invitation)
- `GET /api/activity-log` - Journal d'activité (ADMIN only)

### Schéma Prisma
- Nouveau champ `source` sur `Association` : "manual" (Super Admin) ou "self_service"
- Nouveau modèle `ActivityLog` pour traçabilité des actions admin

### Limites de sécurité
- `MAX_SELF_SERVICE_PER_USER` (env, défaut 5) : limite par email/téléphone
- Rate limiters : 5/h pour register, 30/h pour check-code et info

### Frontend ajouté
- **Web** : `/creer-association` (formulaire), `/join/[code]` (page d'atterrissage), manifeste dynamique, `/dashboard/activity` (journal)
- **Mobile** : `register-association.js`, `join/[code].js`, `activity-log.js`, carte "Premiers pas" sur dashboard

### Intégrations UI
- Badge "Libre-service" dans console Platform
- Carte QR code "Inviter des membres" dans paramètres (mobile + web à venir)
- Bouton WhatsApp d'aide sur toutes les pages publiques
- Lien "Créer mon association" sur login
- Journal d'activité dans les paramètres admin

## Journal d'activité (Phase 5) - 20 Juillet 2026 ✅

### Actions tracées
- **Membres** : create, update, deactivate, activate, reset_password
- **Paiements mensuels** : create, update, delete
- **Paiements exceptionnels** : create, update, delete
- **Années** : create, update, activate, delete
- **Admins** : create, deactivate, activate, reset_password
- **Cotisations exceptionnelles** : create, update, delete

### Affichage
- **Web** : `/dashboard/activity` avec pagination
- **Mobile** : `/activity-log` accessible depuis Paramètres

### Notes techniques
- Non-bloquant : le log n'échoue jamais l'action principale
- Pagination par curseur sur `createdAt`
- Visible uniquement par les admins de l'association

## Play Install Referrer - 20 Juillet 2026 ✅

### Fonctionnement
1. Lien Play Store avec referrer : `https://play.google.com/store/apps/details?id=com.kotiz.ci&referrer=assoc_code%3D{code}`
2. Au premier lancement, `expo-application.getInstallReferrerAsync()` lit le referrer
3. Si `assoc_code=XXX` trouvé, stocké dans AsyncStorage
4. Au login, l'association est pré-sélectionnée automatiquement

### Fichiers modifiés
- `/app/frontend/app/_layout.js` : détection referrer
- `/app/frontend/app/login.js` : lecture code pré-sélectionné

## Toast Notifications Web - 20 Juillet 2026 ✅

### Configuration
- Librairie : sonner
- Composant : `/app/web/src/components/ui/Toaster.tsx`
- Ajouté au layout principal

### Utilisation
```tsx
import { toast } from '@/components/ui';
toast.success('Action réussie');
toast.error('Erreur');
```

## Migration PostgreSQL - COMPLÉTÉE ✅

### Date : 15 Mars 2026

### Changements effectués :
1. **Schéma unifié** : Toutes les données dans une seule base PostgreSQL
2. **Multi-tenancy** : Isolation par `associationId` au lieu de fichiers SQLite séparés
3. **Nouvelles tables** :
   - `SuperAdmin` : Administrateurs de la plateforme
   - `Association` : Tenants avec configuration (enableVehiclePlates, memberFieldLabel)
   - `User` : Utilisateurs liés à une association
   - `Member` : Données membres liées à une association
   - `Year` : Années de cotisation par association
   - `MonthlyPayment` : Paiements mensuels
   - `ExceptionalContribution` : Cotisations exceptionnelles par association
   - `ExceptionalPayment` : Paiements exceptionnels
   - `VehiclePlate` : Matricules de véhicules
   - `AssociationConfig` : Configuration additionnelle
   - `PlatformConfig` : Configuration de la plateforme

### Authentification :
- Token JWT avec `userId`, `associationId`, `role`
- SuperAdmin : token avec `role: SUPER_ADMIN`
- Admin/Member : token avec association context

## Credentials de test

### SuperAdmin
- Email: `superadmin@platform.local`
- Password: `superadmin`

### Admin SYNDIC BNI
- Association Code: `SYNDIC-BNI`
- Email: `drigo@drigo.local`
- Password: `drigo`

## API Endpoints

### Auth (`/api/auth`)
- `GET /associations` - Liste des associations actives
- `POST /login` - Login avec associationCode
- `GET /me` - Profil utilisateur
- `GET /association-settings` - Paramètres de l'association

### Platform (`/api/platform`) - SuperAdmin
- `POST /login` - Login SuperAdmin
- `GET /me` - Profil SuperAdmin
- `GET /associations` - Liste toutes les associations
- `POST /associations` - Créer une association
- `PUT /associations/:id` - Modifier une association
- `DELETE /associations/:id` - Supprimer une association
- `GET /stats` - Statistiques de la plateforme

### Members (`/api/members`)
- CRUD complet avec isolation par association

### Years (`/api/years`)
- CRUD complet avec isolation par association

### Payments (`/api/payments`)
- `POST /` - Enregistrer un paiement
- `GET /year/:yearId` - Paiements d'une année
- `GET /stats/year/:yearId` - Statistiques

### Vehicles (`/api/vehicles`)
- CRUD pour les matricules de véhicules

### Exceptional (`/api/exceptional`)
- CRUD pour les cotisations exceptionnelles

## Tâches à venir

### P1 - Dashboard Web Next.js
- Implémenter le login
- Tables de données pour associations/membres
- Formulaires CRUD
- Intégration API

### P2 - Améliorations
- Script de migration des données SQLite existantes
- Clarifier fonctionnalité "Labels"

## Corrections UX Mobile (15 Mars 2026)

### Issue 1 - Formulaire création membre ✅
- **Problème** : Le clavier cachait les champs de saisie en bas du formulaire
- **Solution** : Ajout de `KeyboardAvoidingView` avec `keyboardVerticalOffset` + `ScrollView` avec `keyboardShouldPersistTaps="handled"` et `contentContainerStyle` approprié

### Issue 2 - Export PDF ✅
- **Problème** : L'export PDF ouvrait une vue d'impression au lieu de télécharger le fichier
- **Solution** : Utilisation de `Print.printToFileAsync()` pour générer le PDF + `Sharing.shareAsync()` pour permettre le téléchargement/partage

### Issue 3 - Export CSV ✅
- **Problème** : L'export CSV ne fonctionnait pas
- **Solution** : Génération du CSV côté client avec les données de l'API `/payments/year/:yearId` + `FileSystem.writeAsStringAsync()` + `Sharing.shareAsync()`

## Nouvelles fonctionnalités (15 Mars 2026)

### 1. Export statistiques amélioré ✅
- **GET /api/export/stats/csv** : Export en fichier TXT avec séparateurs de milliers
- **GET /api/export/stats/pdf** : Export HTML pour génération PDF

### 2. Format des montants avec séparateurs ✅
- Tous les montants utilisent `Intl.NumberFormat('fr-FR')`
- Exemple : 15000 → "15 000", 2500000 → "2 500 000"
- Utilitaire créé : `/app/frontend/utils/format.js`

### 3. Suppression multiple de membres ✅
- **DELETE /api/members/bulk-delete** : Supprime plusieurs membres
- Body: `{ ids: ["id1", "id2", "id3"] }`
- Utilise Prisma `deleteMany` en transaction

### 4. Statistiques événements exceptionnels ✅
- **GET /api/exceptional/stats** : Statistiques des cotisations exceptionnelles
- Réponse: `{ events: [{ eventName, participants, totalAmount }], summary: { totalEvents, totalCollected, totalParticipations } }`

### 5. Sélection multiple de membres ✅ (UI)
- Bouton "Sélection multiple" dans la liste des membres
- Checkboxes pour sélectionner/désélectionner des membres
- Bouton "Tout sélectionner"
- Bouton "Supprimer" pour suppression groupée
- Appui long sur un membre active le mode sélection

### 6. formatNumber appliqué partout ✅
- **Dashboard (index.js)** : Montants formatés avec séparateurs de milliers
- **Cotisations (cotisations.js)** : Montant mensuel, montants dans les modals
- **Paramètres (parametres.js)** : Montants des années affichés avec formatage
- **Exceptionnelles (exceptionnelles.js)** : Montants collectés et paiements
- Utilitaire centralisé : `/app/frontend/utils/format.js`

### 7. Export PDF pour événements exceptionnels ✅
- **GET /api/exceptional/:eventId/stats/pdf** : Génère un PDF avec :
  - Nom de l'événement, type, date de création
  - Total collecté, nombre de participants
  - Liste des paiements (nom membre, date, montant)
- **Frontend** : Bouton "Télécharger statistiques (PDF)" dans le détail de chaque événement
- Téléchargement via dialogue de partage Android/iOS

## Corrections du 15 Décembre 2025

### Bug #1 - Clavier cache inputs "Nouvelle année" ✅
- **Problème** : Le clavier cachait les champs de saisie dans le modal de création d'année
- **Solution** : Refonte du modal avec un design centré + `KeyboardAvoidingView` optimisé

### Bug #2 - Formatage des nombres ✅
- **Statut** : Vérifié - le formatage `formatNumber()` est correctement appliqué partout
- Les cellules de cotisations utilisent intentionnellement une notation `k` (ex: `30k`) pour l'espace

### Bug #3 - Téléchargements PDF/CSV ✅
- **Amélioration** : Utilisation de `Sharing.shareAsync()` avec meilleure gestion des erreurs
- **Note** : Sur Android moderne, le dialogue de partage est la méthode standard et la plus fiable
- L'utilisateur doit choisir "Enregistrer dans les fichiers" depuis le dialogue

## Configuration PostgreSQL

### Production (Render) ✅
```env
DATABASE_URL="postgresql://assocmanager:***@dpg-d6r057dm5p6s73eb2uug-a.oregon-postgres.render.com/assocmanagerdb"
```

**Base configurée et opérationnelle :**
- Host : `dpg-d6r057dm5p6s73eb2uug-a.oregon-postgres.render.com`
- Database : `assocmanagerdb`
- Migration appliquée
- Données initiales créées (SuperAdmin + SYNDIC-BNI)

## Correctifs Sécurité & Maintenance - 16 Décembre 2025

### Correctif 1 - Faille d'isolation multi-tenant (HAUTE PRIORITÉ) ✅
- **Problème** : Les routes PUT/DELETE sur MonthlyPayment et ExceptionalPayment ne vérifiaient pas l'appartenance à l'association
- **Fichiers corrigés** : 
  - `/app/backend/routes/payments.js` (PUT /:id, DELETE /:id)
  - `/app/backend/routes/exceptional.js` (PUT /payments/:paymentId, DELETE /payments/:paymentId)
- **Solution** : Ajout de vérification via jointure sur member/year/contribution avant update/delete
- **Amélioration** : Utilisation de `||` (OU) au lieu de `&&` (ET) pour la défense en profondeur

### Correctif 2 - Fichier .env dans Git (HAUTE PRIORITÉ) ✅
- **Problème** : backend/.env avec vraies credentials était suivi par Git
- **Solution** : 
  - `git rm --cached backend/.env` exécuté
  - `.gitignore` nettoyé et complet
  - `backend/.env.example` avec valeurs factices
  - Note : L'utilisateur doit régénérer DATABASE_URL chez l'hébergeur

### Correctif 3 - Script init-platform.js obsolète (MOYENNE) ✅
- **Problème** : Utilisait un client Prisma séparé et le champ `dbName` inexistant
- **Solution** : Réécrit pour utiliser `@prisma/client` unifié

### Correctif 4 - Export CSV mobile (MOYENNE) ✅
- **Problème** : expo-file-system v19 API dépréciée
- **Solution** : Import depuis `expo-file-system/legacy` (déjà appliqué)

### Correctif 5 - Nettoyage fichiers SQLite (BASSE) ✅
- **Supprimé** : 8 fichiers .db dans /app/backend/prisma/
- **Supprimé** : Dépendance `better-sqlite3` de package.json

### Correctif 6 - Secret JWT par défaut (BASSE) ✅
- **Problème** : Valeur par défaut faible si JWT_SECRET non défini
- **Solution** : Le serveur refuse de démarrer sans JWT_SECRET défini
- **Fichiers** : middleware/auth.js, routes/platform.js

## Nouvelles Fonctionnalités - 16 Décembre 2025

### Changement mot de passe Super Admin ✅
- Route `PUT /api/platform/me/password`
- Page `/platform/settings` avec formulaire

### Gestion des Super Admins multiples ✅
- Route `GET /api/platform/superadmins` - Liste des Super Admins
- Route `POST /api/platform/superadmins` - Créer un Super Admin
- Route `DELETE /api/platform/superadmins/:id` - Supprimer (sauf dernier et soi-même)
- Interface dans `/platform/settings` avec liste et formulaire de création

## Suppression de Compte (Conformité Google Play) - 19 Juillet 2026 ✅

### PARTIE 1 - Suppression depuis l'app ✅
- **Route** : `DELETE /api/auth/me` (authentification requise)
- **Validation** : Mot de passe requis pour confirmer
- **Protection** : Bloque si dernier admin de l'association
- **Anonymisation** : 
  - Email → `compte-supprime-<id>@deleted.local`
  - Phone → null
  - PasswordHash → valeur aléatoire invalide
  - Active → false
  - Nom du membre → `Membre supprimé (<id>)`
- **Historique conservé** : Les paiements (MonthlyPayment, ExceptionalPayment) restent intacts
- **Mobile** : Bouton "Supprimer mon compte" dans Paramètres avec modal de confirmation

### PARTIE 2 - Demande web sans l'app ✅
- **Page publique** : `/delete-account`
- **Route** : `POST /api/public/deletion-request` (sans authentification)
- **Champs** : email ou téléphone, code association, message optionnel
- **Stockage** : Table `DeletionRequest` avec statut pending/processed/rejected
- **Gestion Super Admin** :
  - `GET /api/platform/deletion-requests` - Liste des demandes
  - `PUT /api/platform/deletion-requests/:id` - Traiter une demande
- **Délai** : 30 jours max
- **Contact** : mikouei2@gmail.com

## Fonctionnalités Admin Self-Service - 19 Juillet 2026 ✅

### Libellé champ personnalisé ✅
- **Défaut intelligent à la création** :
  - Type `amicale` ou `association` → `Fonction`
  - Type `syndicat` ou `syndic` → `Villa`
- **Modifiable par l'admin** :
  - Route `PUT /api/auth/association-settings` (ADMIN uniquement)
  - Champ texte libre (Villa, Fonction, Matricule, Poste, etc.)
  - Validation : rejet si vide
  - Mobile : champ éditable dans Paramètres
  - Web : `/settings` avec bouton Modifier

### Correction numéro d'année ✅
- **Route** : `PUT /api/years/:id` accepte maintenant `year` en plus de `monthlyAmount`
- **Validation** :
  - Vérification unicité (associationId + year)
  - Plage valide : 2000-2100
  - Erreur claire si doublon : "Cette année existe déjà pour cette association"
- **Paiements conservés** : yearId (UUID) reste stable, seul le numéro change
- **Mobile** : Champ année éditable dans le modal de modification
- **Web** : Modal édition avec les deux champs

### Interface Super Admin - Gestion demandes suppression ✅
- **Page** : `/platform/deletion-requests`
- **Fonctionnalités** :
  - Liste des demandes avec filtres (toutes, en attente, traitées, rejetées)
  - Compteur de demandes en attente
  - Boutons pour traiter ou rejeter chaque demande
  - Instructions de traitement manuel
- **Navigation** : Lien "Suppressions" dans la sidebar Platform


## Harmonisation Design System - 19 Juillet 2026 ✅

### Mobile React Native
Tous les écrans ont été mis à jour avec le Design System :
- `/app/frontend/app/login.js` ✅
- `/app/frontend/app/(tabs)/index.js` ✅
- `/app/frontend/app/(tabs)/membres.js` ✅
- `/app/frontend/app/(tabs)/cotisations.js` ✅
- `/app/frontend/app/(tabs)/admin.js` ✅
- `/app/frontend/app/(tabs)/exceptionnelles.js` ✅
- `/app/frontend/app/(tabs)/parametres.js` ✅
- `/app/frontend/app/platform/index.js` ✅
- `/app/frontend/app/platform/dashboard.js` ✅

### Web Next.js
- `/app/web/src/app/globals.css` - Variables CSS du Design System
- `/app/web/src/app/dashboard/page.tsx` - Dashboard avec Phosphor Icons + Stats Events
- `/app/web/src/app/login/page.tsx` - Login harmonisé avec couleurs DS
- `/app/web/src/components/ui/Card.tsx` - Utilise variables CSS
- `/app/web/src/components/ui/Badge.tsx` - Utilise variables CSS
- `/app/web/src/components/layout/Sidebar.tsx` - Phosphor Icons + Navy/Gold

### Fichiers de thème
- `/app/frontend/utils/theme.js` - Tokens mobile (colors, spacing, borderRadius, typography)
- `/app/web/src/app/globals.css` - Variables CSS web (--color-*, --radius-*, --spacing-*)

## Rebranding AssocManager → Kotiz - 19 Juillet 2026 ✅

### Fichiers mis à jour
- `/app/frontend/app/login.js` - Titre "Kotiz"
- `/app/frontend/app/(tabs)/parametres.js` - Footer "Kotiz v1.0.0"
- `/app/web/src/app/layout.tsx` - Metadata title
- `/app/web/src/app/privacy/page.tsx` - Politique de confidentialité
- `/app/web/src/app/data-safety/page.tsx` - Data Safety
- `/app/web/src/app/delete-account/page.tsx` - Formulaire suppression
- `/app/web/src/types/index.ts` - Commentaire
- `/app/web/src/components/layout/Sidebar.tsx` - Logo "Kotiz"

## Stats Événements Exceptionnels UI - 19 Juillet 2026 ✅

### Dashboard Web
- Section "Événements exceptionnels" ajoutée au dashboard
- Affiche le résumé global (total événements, collecté, participations)
- Liste les 5 événements récents avec icônes par type
- API utilisée : `GET /api/exceptional/stats`

## Bug Fix: Bouton Modifier Associations - 19 Juillet 2026 ✅

### Problème
Le bouton crayon (Modifier) sur /platform/associations faisait un toggle silencieux du statut au lieu d'ouvrir un formulaire d'édition. Bug de sécurité : un clic accidentel pouvait désactiver une association active.

### Solution
- **Bouton Modifier (Pencil)** : Redirige vers `/platform/associations/[id]` pour édition
- **Bouton Toggle (Power/PowerOff)** : Ouvre une modale de confirmation avant d'activer/désactiver
- **Nouvelle page** `/platform/associations/[id]` : Formulaire d'édition + gestion des admins

### Fonctionnalités ajoutées
- Modifier nom, type, libellé du champ personnalisé
- Voir la liste des admins de l'association
- Ajouter un nouvel admin (email, mot de passe, téléphone)
- Réinitialiser le mot de passe d'un admin
- Supprimer un admin (avec protection : impossible de supprimer le dernier)

### Fichiers modifiés/créés
- `/app/web/src/app/platform/associations/page.tsx` - Séparation Modifier/Toggle
- `/app/web/src/app/platform/associations/[id]/page.tsx` - Nouvelle page d'édition

### Vérification
- ASCB reste au statut Active ✅
- Build TypeScript passe ✅
- Tests: 7/7 critères d'acceptation validés

## Audit Icônes Phosphor - 19 Juillet 2026 ✅

Toutes les icônes utilisées ont été vérifiées et sont valides :
- ArrowClockwise, ArrowLeft, CalendarDots, CaretDown, CaretRight
- Download, Envelope, Eye, EyeSlash, File, FileText, FolderOpen
- GearSix, Gift, HandHeart, Heart, House, Key, Lock, MagnifyingGlass
- Pencil, Phone, Plus, Prohibit, ShieldCheck, SignIn, SignOut
- SmileyMeh, Star, Trash, User, UserCircle, Users, Wallet
- Warning, WarningCircle, X

**Fix appliqué** : `CaretForward` → `CaretRight` (corrigé, causait le crash Paramètres)

## Sentry Crash Reporting - 19 Juillet 2026 ✅

### Installation
- Package `@sentry/react-native` installé
- Module `/app/frontend/utils/sentry.js` créé
- ErrorBoundary global ajouté dans `_layout.js`

### Activation (pour builds natifs)
Le guide complet est dans `/app/frontend/SENTRY_SETUP.md`

**Note** : Sentry ne fonctionne pas avec Expo Web preview, uniquement avec les builds natifs (APK/IPA).

### Étapes pour activer :
1. Créer compte/projet sur sentry.io (free tier)
2. Configurer `EXPO_PUBLIC_SENTRY_DSN` dans EAS Secrets
3. Ajouter `"@sentry/react-native"` dans plugins de app.json
4. Build avec `eas build --platform android`

## Parité Web/Mobile "Modifier membre" - 19 Juillet 2026 ✅

### Corrections appliquées

1. **Bouton "Réinitialiser le mot de passe" ajouté au Web**
   - `/app/web/src/app/members/page.tsx` - Bouton identique au mobile
   - Modale dédiée avec confirmation du membre
   - Appelle `PUT /api/members/:id/password`

2. **Ordre des champs harmonisé (Web & Mobile)**
   - Ordre standard : Nom complet → Fonction/Villa → Téléphone → Email
   - Mobile corrigé dans `/app/frontend/app/(tabs)/membres.js`

### Optimisation sélection d'association - 19 Juillet 2026 ✅

1. **Auto-sélection si une seule association** ✅
   - Si `associations.length === 1`, sélection automatique sans afficher le picker

2. **Tri par dernière utilisée** ✅
   - Stockage dans AsyncStorage (`@kotiz_last_association`)
   - La dernière association utilisée apparaît en premier dans la liste

3. **Recherche par code ET nom** ✅
   - Filtrage en direct pendant la frappe
   - Fonctionne avec "ASCB", "amicale", etc.

### Fichiers modifiés
- `/app/web/src/app/members/page.tsx` - Reset password + ordre champs
- `/app/frontend/app/(tabs)/membres.js` - Ordre champs harmonisé
- `/app/frontend/app/login.js` - Auto-select + tri par dernière utilisée

## Tâches à venir

### P2 - Clarifier fonctionnalité "Labels"
- Comprendre les besoins pour activer/désactiver les labels Superadmin

### Pages publiques Play Store ✅
- **Politique de confidentialité** : `/privacy`
  - Données collectées, utilisation, sécurité
  - Procédure de suppression de compte
  - Contact et droits RGPD
- **Data Safety** : `/data-safety`
  - Résumé structuré pour formulaire Play Console
  - Tableau récapitulatif des réponses Play Store
  - Liens vers les pages de suppression et confidentialité

## 10 Correctifs de Sécurité - Audit 20 Juillet 2026 ✅

### CORRECTIF 0 - Export PDF/CSV bloqué par navigateur ✅
- Frontend: `handleExportStatsPDF`, `handleExportMembers`, `handleExportStats` modifiés pour ouvrir la fenêtre de façon synchrone dans le clic utilisateur (évite blocage popup)
- Fichiers: `/app/frontend/app/(tabs)/parametres.js`

### CORRECTIF 1 - Injection HTML dans exports ✅
- Ajout helper `escapeHtml()` pour échapper les caractères dangereux (<, >, &, ", ')
- Appliqué dans `/api/export/stats/pdf` et `/api/exceptional/:eventId/stats/pdf`
- Fichiers: `/app/backend/routes/export.js`, `/app/backend/routes/exceptional.js`

### CORRECTIF 2 - Injection CSV ✅
- Ajout helper `escapeCsv()` pour protéger contre les formules Excel (=, +, -, @, \t, \r)
- Appliqué dans `/api/export/members` et `/api/export/statistics/:yearId`
- Fichiers: `/app/backend/routes/export.js`

### CORRECTIF 3 - Messages d'erreur techniques exposés ✅
- Import membres: message d'erreur générique au lieu de `error.message`
- JSON parse errors: middleware global retourne `{ error: 'JSON invalide' }` sans stack trace
- Fichiers: `/app/backend/routes/import.js`, `/app/backend/server.js`

### CORRECTIF 4 - Tokens prévisibles ✅
- Remplacement `Math.random()` par `crypto.randomBytes(24).toString('base64url')` pour tokens d'accès
- Mots de passe générés avec `crypto.randomBytes(6).toString('base64url')`
- Fichiers: `/app/backend/middleware/auth.js`, `/app/backend/routes/members.js`, `/app/backend/routes/import.js`

### CORRECTIF 5 - Validation création année ✅
- Validation stricte: année 2000-2100, montant > 0 et < 100,000,000
- Fichiers: `/app/backend/routes/years.js`

### CORRECTIF 6 - Doublon téléphone ✅
- Vérification unicité téléphone dans l'association (POST et PUT membre)
- Fichiers: `/app/backend/routes/members.js`

### CORRECTIF 7 - Rate limit endpoint public ✅
- `deletionLimiter`: 5 requêtes / heure / IP sur `/api/public/deletion-request`
- Fichiers: `/app/backend/routes/public.js`

### CORRECTIF 8 - CORS résidu domaine aperçu ✅
- Suppression du domaine Emergent preview de la liste CORS
- Fichiers: `/app/backend/server.js`

### CORRECTIF 9 - Headers de sécurité HTTP ✅
- Ajout middleware `helmet()` (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
- Fichiers: `/app/backend/server.js`

### CORRECTIF 10 - Validation format email ✅
- Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` appliqué sur tous les endpoints de création:
  - POST /api/members
  - POST /api/admin/create
  - POST /api/platform/associations/:id/admins
  - POST /api/platform/superadmins
- Fichiers: `/app/backend/routes/members.js`, `/app/backend/routes/admin.js`, `/app/backend/routes/platform.js`

### Tests automatisés
- 22 tests pytest dans `/app/backend/tests/test_security_fixes.py`
- Rapport: `/app/test_reports/iteration_9.json` (20/22 PASS avant corrections finales)



## Corrections et améliorations - 21 Juillet 2026 ✅

### Bug fix: Import AuthContext mobile
- **Problème** : `Unable to resolve module ../../context/AuthContext from /app/frontend/app/activity-log.js`
- **Cause racine** : Chemin d'import incorrect (deux niveaux au lieu d'un)
- **Fix** : Changé de `../../context/AuthContext` vers `../context/AuthContext`
- **Vérifié** : Testing agent iteration 11 - 100% pass

### Carte QR "Inviter des membres" - Web Settings
- **Fichier** : `/app/web/src/app/settings/page.tsx`
- **Fonctionnalités** :
  - Affichage QR code (qrcode.react)
  - Lien d'invitation copiable
  - Téléchargement QR en PNG
  - Toast de confirmation (sonner)
- **data-testid** : `invite-members-card`, `copy-invite-link-btn`, `download-qr-btn`, `invite-link-input`
- **Vérifié** : Testing agent iteration 12 - 100% pass

### Migration alert() vers Toast (sonner)
- **Fichiers modifiés** :
  - `/app/web/src/app/settings/page.tsx`
  - `/app/web/src/app/members/page.tsx`
  - `/app/web/src/app/platform/associations/[id]/page.tsx`
  - `/app/web/src/app/platform/deletion-requests/page.tsx`
- **Résultat** : Tous les `alert()` remplacés par `toast.success()` / `toast.error()`

### Configuration assetlinks.json
- **Fichier** : `/app/web/public/.well-known/assetlinks.json`
- **Status** : Préparé avec placeholder `VOTRE_SHA256_ICI`
- **Action utilisateur requise** : Exécuter `eas credentials -p android` après build signé pour obtenir l'empreinte SHA256


## Export PDF - 21 Juillet 2026 ✅

### Backend
- **Route** : `GET /api/members/:id/export-pdf`
- **Query params** : `?year=YYYY` (optionnel)
- **Sécurité** : Admin requis (401/403)
- **Librairie** : pdfkit
- **Contenu** : Nom membre, infos, cotisations mensuelles par année, cotisations exceptionnelles, total général

### Frontend Web
- **Fichier** : `/app/web/src/app/members/page.tsx`
- **Bouton** : Icône FileText (vert) sur chaque membre
- **data-testid** : `export-pdf-{memberId}`
- **Toast** : "PDF téléchargé avec succès"

### Frontend Mobile
- **Fichier** : `/app/frontend/app/(tabs)/membres.js`
- **Icône** : FilePdf (Phosphor)
- **Partage** : expo-sharing pour partager/enregistrer le PDF

## Mode Hors-Ligne - 21 Juillet 2026 ✅

### Architecture
- **Contexte** : `/app/frontend/context/OfflineContext.js`
- **Provider** : Ajouté dans `_layout.js`
- **Détection réseau** : `@react-native-community/netinfo`
- **Stockage** : AsyncStorage

### Fonctionnalités
- Cache automatique des paiements après chargement
- Lecture du cache quand hors-ligne ou en cas d'erreur réseau
- Bannière "Mode hors-ligne" / "Données en cache" visible
- Timestamp de dernière synchronisation

### Fichiers intégrés
- `/app/frontend/app/(tabs)/cotisations.js` : Utilise useOffline pour cache/lecture
- `/app/frontend/components/OfflineIndicator.js` : Composant réutilisable


## Comptes Liés (Multi-Association) - Décembre 2025 ✅

### Fonctionnalité
Permet à un utilisateur de se connecter à plusieurs associations et de basculer entre elles sans se déconnecter (similaire au sélecteur de comptes Gmail).

### Architecture
- **Stockage** : `linkedAccounts` (localStorage web / AsyncStorage mobile)
- **Format** : `[{ token, user, association }, ...]`
- **Compatibilité** : Sessions existantes auto-migrées au premier chargement

### Mobile (`/app/frontend/`)
- **AuthContext.js** : `linkedAccounts`, `switchAccount()`, `removeLinkedAccount()`, `upsertLinkedAccount()`
- **parametres.js** : Section "Comptes liés" avec bouton "Ajouter un compte" + liste (si > 1 compte)

### Web (`/app/web/src/`)
- **AuthContext.tsx** : Mêmes fonctions que mobile + TypeScript
- **settings/page.tsx** : Carte "Comptes liés" avec UI de bascule et suppression
- **api.ts** : Nettoyage automatique du compte mort en cas de 401

### Tests
- Testing agent iteration 14 : 100% (5/5)
- data-testid : `linked-accounts-card`, `add-account-btn`, `switch-account-{id}`, `remove-account-{id}`

## Authentification Google OAuth - 21 Juillet 2026 ✅ (Code prêt, config manuelle requise)

### Objectif
Ajouter "Se connecter avec Google" comme méthode d'authentification alternative, en plus de l'email/téléphone + mot de passe.

### Cas d'usage couverts
1. **Créer une association via Google** : `/creer-association` (web) et `/register-association` (mobile)
2. **Se connecter à un compte existant via Google** : `/login` (web et mobile)
3. **Rejoindre une association en tant que MEMBRE via Google** : `/join/[code]` (web et mobile) - Nouveau bouton "Créer mon compte avec Google"

### Backend
- **Dépendance** : `google-auth-library`
- **Variable d'env** : `GOOGLE_CLIENT_ID` (optionnel, warning si absent)
- **Schéma Prisma** :
  - `User.googleId` (String?, unique par association : `@@unique([associationId, googleId])`)
  - `Member.source` ("manual" ou "self_service")
- **Routes ajoutées** :
  - `POST /api/auth/google` - Connexion via Google
  - `POST /api/public/associations/register-google` - Créer association via Google
  - `POST /api/public/associations/:code/join-google` - Rejoindre en tant que membre via Google

### Web (Next.js)
- **Script Google GIS** : Chargé dans `layout.tsx` via `next/script`
- **Composant** : `GoogleSignInButton.tsx` (réutilisable)
- **Pages modifiées** : `login/page.tsx`, `creer-association/page.tsx`, `join/[code]/page.tsx`
- **Variable d'env** : `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

### Mobile (Expo/React Native)
- **Package** : `@react-native-google-signin/google-signin`
- **Config** : Plugin ajouté dans `app.json`
- **Composant** : `GoogleSignInButton.js`
- **Fichiers modifiés** : `_layout.js`, `login.js`, `register-association.js`, `join/[code].js`
- **Variable d'env** : `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- **Note** : Nécessite un development build EAS (pas testable dans Expo Go)

### Règles métier
- **Liaison automatique** : Si un compte existe avec le même email, il est lié au googleId dès que Google confirme `email_verified: true`
- **Multi-tenant** : Un même googleId peut être associé à plusieurs associations (contrainte `@@unique([associationId, googleId])`)
- **Mot de passe** : Les comptes créés via Google ont un hash aléatoire (connexion par mot de passe impossible)

### Configuration requise (manuelle)
1. Créer projet Google Cloud Console
2. Configurer écran de consentement OAuth (type "Externe", scopes: email, profile, openid)
3. Créer Client ID "Web application" → Utiliser partout (backend, web, mobile)
4. Créer Client ID "Android" avec SHA-1 du keystore EAS
5. Définir les variables d'environnement : `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

## Multi-Devises - 21 Juillet 2026 ✅

### Objectif
Permettre aux associations de choisir leur devise (FCFA, EUR, USD) avec formatage adapté.

### Backend
- **Schéma Prisma** : `Association.currency` (String, défaut "XOF")
- **Routes modifiées** :
  - `POST /api/public/associations/register` : Accepte `currency`
  - `POST /api/public/associations/register-google` : Accepte `currency`
  - `GET /api/auth/association-settings` : Retourne `currency`
  - `PUT /api/auth/association-settings` : Accepte `currency`
  - `GET /api/public/currencies` : Liste les devises supportées

### Utilitaires
- **Backend** : `/app/backend/utils/currency.js`
- **Web** : `/app/web/src/utils/currency.ts`
- **Mobile** : `/app/frontend/utils/currency.js`

### Devises supportées
| Code | Symbole | Position | Décimales | Nom |
|------|---------|----------|-----------|-----|
| XOF | FCFA | Après | 0 | Franc CFA |
| EUR | € | Après | 2 | Euro |
| USD | $ | Avant | 2 | Dollar US |

### API Formatage
```javascript
import { formatAmount } from '@/utils/currency';
formatAmount(15000, 'XOF'); // "15 000 FCFA"
formatAmount(150.50, 'EUR'); // "150,50 €"
formatAmount(150.50, 'USD'); // "$150.50"
```

### UI (à implémenter)
- Sélecteur de devise dans formulaire de création d'association
- Option de changement de devise dans les paramètres admin

## Correctifs Batch - 21 Juillet 2026 ✅

### Partie A - Routes "mes données" pour MEMBRE
**Objectif** : Permettre à un membre de voir SES propres cotisations sans accéder aux données des autres.

**Routes ajoutées** :
- `GET /api/payments/my/year/:yearId` - Mes paiements pour une année (MEMBRE)
- `GET /api/exceptional/mine` - Mes cotisations exceptionnelles (MEMBRE)

**Logique** : Filtrage côté serveur sur `userId: req.user.id` - impossible de voir les données des autres.

### Partie B - Mobile : Accès membre aux cotisations
- `cotisations.js` : Appelle `/payments/my/year/:yearId` si non-admin
- `exceptionnelles.js` : Appelle `/exceptional/mine` si non-admin
- `index.js` (Accueil) : Nouvelle carte "Mes cotisations" avec barre de progression pour les MEMBRES

### Partie C - Web : Fix crash payments/page.tsx
**Cause** : Interface TypeScript incorrecte (`memberId`/`memberName`/`months[]` vs `id`/`name`/`paymentsByMonth{}`)
**Fix** : Aligné l'interface et le code de rendu avec la forme réelle renvoyée par le backend.

### Partie D - Mobile UX : Transparence register-association.js
**Cause** : `colors.surface` n'existe pas dans theme.js
**Fix** : Remplacé par `colors.backgroundWhite`

### Partie E - Mobile UX : Sélecteur d'association (login.js)
**Changement** : Remplacé le bouton + modal par un TextInput de recherche inline avec suggestions (2+ caractères)

### Partie F - Mobile UX : Popup "Sélectionner une année" (cotisations.js)
**Changement** : `animationType="slide"` → `animationType="fade"`, popup centrée

### Partie G - Mobile : Barre d'onglets (_layout.js)
**Cause** : Hauteur fixe (64px) sans tenir compte de la zone de sécurité Android
**Fix** : Utilisation de `useSafeAreaInsets()` pour adapter `paddingBottom` et `height` dynamiquement

### Partie H - Verrouillage compte après 5 tentatives
**Schéma Prisma** : `User.failedLoginAttempts` (Int), `User.lockedUntil` (DateTime?)
**Logique** :
- Mot de passe incorrect → incrémenter compteur
- 5ème échec → `lockedUntil = now + 30 min`
- Connexion réussie (mot de passe ou Google) → reset compteur
- Reset mot de passe par admin → reset verrouillage
**Message** : "Compte temporairement bloqué suite à plusieurs tentatives échouées. Réessayez dans X minute(s)."

### Partie K - Fix crash login mobile (setShowAssociationPicker)
**Cause** : La fonction `setShowAssociationPicker` était référencée mais n'existait plus après refactoring du sélecteur d'association
**Fix** : Suppression des références obsolètes dans login.js

### Partie L & M - Événements sans collecte (Backend + Mobile) - 21 Juillet 2026 ✅
**Objectif** : Permettre de créer des événements informatifs (réunions, etc.) qui n'impliquent pas de collecte d'argent.

**Schéma Prisma (ExceptionalContribution)** :
- `eventDate DateTime?` - Date de l'événement (optionnel)
- `hasCollection Boolean @default(true)` - true = cotisation, false = annonce informative
- `recurrence String @default("once")` - "once" (ponctuel) | "monthly" (mensuel)

**Backend (/api/exceptional)** :
- Type "réunion" ajouté à la liste des types autorisés
- POST / et PUT /:id acceptent `hasCollection`, `eventDate`, `recurrence`
- GET /mine retourne ces nouveaux champs

**Frontend Mobile (exceptionnelles.js)** :
- Formulaire : Toggle "Collecte d'argent Oui/Non", champ date, toggle "Ponctuel/Mensuel"
- Carte liste : Badge "Mensuel" si recurrence=monthly, date + "Événement informatif" si hasCollection=false
- Modal détail : Stats de paiement masquées si hasCollection=false, boutons Modifier/Supprimer toujours visibles

**Fix syntaxe JSX** : Correction d'une erreur de fermeture de balise fragment (<></>) dans la modale de détail qui causait un crash au démarrage de l'app.

---

## Module Tontines - 21 Juillet 2026 ✅

### Objectif
Un groupe de membres verse un montant fixe à chaque tour. À chaque tour, un seul participant reçoit la totalité collectée. L'ordre tourne jusqu'à ce que tous aient reçu une fois.

### Principes
- L'ordre de passage est fixé par l'admin à la création (ordre de sélection ou tirage au sort côté client)
- La clôture d'un tour est manuelle (pas de calcul automatique basé sur dates ou 100% payés)
- La fréquence (mensuel/hebdomadaire) est informative uniquement (pas de cron/rappel automatique)
- Un membre voit uniquement sa propre participation (jamais le détail des paiements des autres)

### Schéma Prisma (PARTIE N)
```prisma
model Tontine {
  id, associationId, name, amount, frequency, status, currentRound, timestamps
  association -> Association
  participants -> TontineParticipant[]
  rounds -> TontineRound[]
}

model TontineParticipant {
  id, tontineId, memberId, order, hasReceived, receivedRound, receivedAt, timestamps
  @@unique([tontineId, memberId])
  @@unique([tontineId, order])
}

model TontineRound {
  id, tontineId, roundNumber, beneficiaryMemberId, status, closedAt, timestamps
  @@unique([tontineId, roundNumber])
}

model TontinePayment {
  id, roundId, memberId, amount, isPaid, paidAt, notes, timestamps
  @@unique([roundId, memberId])
}
```

### Routes Backend (PARTIE O) - `/api/tontines`
| Méthode | Route | Accès | Description |
|---------|-------|-------|-------------|
| POST | / | ADMIN | Créer une tontine (name, amount, frequency, memberIds) |
| GET | / | ADMIN | Lister les tontines de l'association |
| GET | /:id | ADMIN | Détail d'une tontine (participants, rounds, paiements) |
| PUT | /:id | ADMIN | Modifier name, amount, status |
| DELETE | /:id | ADMIN | Supprimer une tontine |
| POST | /:id/payments | ADMIN | Enregistrer un paiement (memberId, amount) |
| DELETE | /payments/:paymentId | ADMIN | Annuler un paiement |
| POST | /:id/close-round | ADMIN | Clôturer le tour et passer au suivant |
| GET | /mine | MEMBRE | Mes tontines (données personnelles uniquement) |

### Logique close-round
1. Clôturer le round actuel (status: closed, closedAt)
2. Marquer le bénéficiaire comme hasReceived = true
3. Si reste des participants sans hasReceived → créer nouveau round
4. Sinon → passer tontine en status: completed

### Interface Web (PARTIE P) - `/tontines/page.tsx`
- Liste des tontines en cartes (nom, montant, fréquence, statut, tour actuel, bénéficiaire)
- Modal création avec sélection des membres et bouton "Tirer au sort"
- Modal détail avec ordre de passage, paiements du tour, boutons de gestion
- Navigation : Sidebar avec lien "Tontines" (icône UsersThree)

### Mobile (PARTIE Q) - Carte "Mes Tontines"
- Sur l'écran Accueil pour les membres participants
- Affiche : nom, tour actuel, statut payé/à payer, "C'est votre tour" si bénéficiaire
- Si cycle terminé : "Cycle terminé — tout le monde a reçu."
- Si déjà reçu : "Vous avez déjà reçu au tour X."

### Fichiers créés/modifiés
- `/app/backend/routes/tontines.js` (nouveau)
- `/app/backend/server.js` (import tontineRoutes)
- `/app/backend/prisma/schema.prisma` (modèles Tontine*)
- `/app/web/src/app/tontines/page.tsx` (nouveau)
- `/app/web/src/components/layout/Sidebar.tsx` (lien Tontines)
- `/app/frontend/app/(tabs)/index.js` (carte Mes Tontines)

---

## Module Notifications Push - 21 Juillet 2026 ✅

### Objectif
Permettre aux admins d'envoyer des annonces ciblées aux membres via notifications push, avec rappels de cotisation automatiques.

### Fonctionnalités
1. **Annonces générales** : Message à tous les membres
2. **Annonces ciblées** : Message à des membres sélectionnés
3. **Rappels de cotisation** : Notification aux membres en retard pour un mois donné
4. **Notifications automatiques** : Lors de la création d'une cotisation exceptionnelle

### Schéma Prisma
```prisma
model PushToken {
  id, userId, token (ExponentPushToken[...]), platform, timestamps
  @@unique([userId, token])
}

model Announcement {
  id, associationId, senderId, title, body, type, targetType, targetIds, sentCount, timestamps
}
```

### Routes Backend `/api/notifications`
| Méthode | Route | Accès | Description |
|---------|-------|-------|-------------|
| POST | /register | AUTH | Enregistrer un token push |
| DELETE | /unregister | AUTH | Supprimer un token push |
| GET | /announcements | ADMIN | Historique des annonces |
| POST | /announcements | ADMIN | Envoyer une annonce |
| POST | /reminder | ADMIN | Envoyer un rappel de cotisation |
| GET | /stats | ADMIN | Statistiques des notifications |

### Frontend Mobile
- **Nouvel onglet "Annonces"** (admin uniquement)
- Statistiques : appareils connectés, couverture, annonces récentes
- Formulaire création avec sélection des destinataires
- Modal rappel cotisation avec sélection mois/année
- Historique des annonces envoyées

### Intégration automatique
- Enregistrement du token push au login
- Désenregistrement au logout
- Notification auto lors de la création d'une cotisation exceptionnelle (hasCollection: true)

### Note technique
Les notifications push nécessitent un build EAS (pas Expo Go). Le test en preview est limité à l'envoi backend et l'interface d'envoi.

### Fichiers créés/modifiés
- `/app/backend/utils/pushNotifications.js` (nouveau)
- `/app/backend/routes/notifications.js` (nouveau)
- `/app/backend/routes/exceptional.js` (notification auto)
- `/app/frontend/utils/notifications.js` (nouveau)
- `/app/frontend/app/(tabs)/annonces.js` (nouveau)
- `/app/frontend/app/(tabs)/_layout.js` (onglet Annonces)
- `/app/frontend/context/AuthContext.js` (register/unregister push)

---

## Corrections et améliorations - 21 Juillet 2026 ✅

### Export PDF Mobile - CORRIGÉ
**Problème** : Le code utilisait `FileReader` et blob incompatibles avec React Native.
**Solution** : 
- Utilisation de `FileSystem.downloadAsync` avec token d'authentification depuis AsyncStorage
- Téléchargement direct du PDF dans `documentDirectory`
- Partage via `expo-sharing`

**Fichiers modifiés** :
- `/app/frontend/app/(tabs)/membres.js` (handleExportPDF)

### Rappels automatiques de cotisation
**Fonctionnalité** : Service pour envoyer des rappels aux membres en retard de paiement.
- Route `/api/platform/send-reminders` pour déclenchement manuel (Super Admin)
- Service `reminderService.js` prêt pour intégration cron externe
- Programmation possible le 5 de chaque mois à 9h00

**Fichiers créés** :
- `/app/backend/utils/reminderService.js`
- `/app/backend/routes/platform.js` (route send-reminders)

### Badge notification sur l'icône
**Fonctionnalité** : Badge sur l'icône de l'app pour les notifications non lues.
- `shouldSetBadge: true` dans le handler de notifications
- Fonctions `setBadgeCount`, `getBadgeCount`, `incrementBadge`, `clearBadge`
- Badge incrémenté à la réception d'une notification
- Badge effacé quand l'utilisateur clique sur une notification ou ouvre l'app

**Fichiers modifiés** :
- `/app/frontend/utils/notifications.js` (fonctions badge)
- `/app/frontend/context/AuthContext.js` (listener AppState pour effacer badge)



---

## Audit de Sécurité Batch 2 - 21 Juillet 2026 ✅

### PARTIE R - Fix IDOR Notifications Push ✅
**Problème** : La route POST `/api/notifications/announcements` avec `targetType: 'selected'` ne validait pas l'appartenance des `targetIds` à l'association.
**Solution** : 
- Filtrage strict des `targetIds` par `associationId` dans `notifications.js`
- Seuls les IDs validés (appartenant à l'association) sont utilisés
- Retourne erreur 400 si aucun membre valide trouvé
- Mise à jour de `sendToSpecificMembers()` dans `pushNotifications.js` pour accepter un paramètre `associationId` optionnel

### PARTIE S - Confirmation mot de passe admin pour reset ✅
**Problème** : Un admin pouvait réinitialiser le mot de passe d'un autre admin sans prouver son identité.
**Solution** : 
- Route POST `/api/admin/:id/reset-password` exige maintenant `currentPassword`
- Vérification du mot de passe actuel de l'admin connecté avant d'autoriser le reset
- Erreur 401 si mot de passe incorrect

### PARTIE T - Réduction durée JWT ✅
**Problème** : JWT avec `expiresIn: '30d'` trop long en cas de vol de token.
**Solution** : Réduit à `expiresIn: '7d'` dans `middleware/auth.js`

### PARTIE U - Trust Proxy ✅
**Problème** : Rate limiters ne fonctionnaient pas correctement derrière reverse proxy.
**Solution** : 
- Ajout `app.set('trust proxy', 1)` dans `server.js`
- Ajout `validate: { xForwardedForHeader: false }` à tous les rate limiters pour compatibilité express-rate-limit v7+

### PARTIE V - Injection CSV dans /api/export/stats/csv ✅
**Problème** : Les champs `name` et `customFieldValue` n'étaient pas échappés dans l'export TXT.
**Solution** : Application de `escapeCsv()` aux champs texte dans la boucle d'export

### PARTIE W - Vérification association membre dans /api/payments/member/:memberId/year/:yearId ✅
**Problème** : Pas de vérification que le membre appartient à l'association de l'admin.
**Solution** : 
- Ajout d'une requête `prisma.member.findFirst()` avec filtre `associationId`
- Retourne 404 si le membre n'existe pas ou n'appartient pas à l'association

### PARTIE X - Verrouillage optimiste Tontine close-round ✅
**Problème** : Race condition possible si deux admins clôturent le même tour simultanément.
**Solution** :
- Vérification fraîche du statut du round au début de la transaction
- Erreur `ROUND_ALREADY_CLOSED` si le round a déjà été clôturé
- Réponse 409 Conflict avec message explicite

### PARTIE Y - Rate limiters routes publiques ✅
**Problème** : Routes `GET /api/public/associations` et `GET /api/auth/associations` sans rate limit permettaient l'énumération.
**Solution** :
- Ajout `associationsListLimiter` (30 req/h) sur `/api/public/associations`
- Ajout `associationsLimiter` (30 req/h) sur `/api/auth/associations`

### PARTIE Z - npm audit fix ✅
**Exécuté** : `npm audit fix --force` sur backend, web, et frontend
- Backend : 0 vulnerabilities, uuid mis à jour
- Web : 2 moderate (postcss, next) - nécessite breaking change pour fix complet
- Frontend : eslint peer deps warnings (non-critique)

### Fichiers modifiés
- `/app/backend/routes/notifications.js` (R)
- `/app/backend/utils/pushNotifications.js` (R)
- `/app/backend/routes/admin.js` (S)
- `/app/backend/middleware/auth.js` (T, Y)
- `/app/backend/server.js` (U)
- `/app/backend/routes/export.js` (V)
- `/app/backend/routes/payments.js` (W)
- `/app/backend/routes/tontines.js` (X)
- `/app/backend/routes/public.js` (Y)
- `/app/backend/routes/auth.js` (Y)



---

## Fix Notifications Push & Clavier Annonces - 21 Juillet 2026 ✅

### Problème A - Notifications push jamais enregistrées ✅
**Symptôme** : "Appareils connectés: 0", toutes les annonces affichent "0 envoyé(s)".

**Cause** : `registerForPushNotifications()` n'était appelé QUE lors d'une connexion classique par mot de passe (`login()`). Elle n'était PAS appelée :
- Au démarrage de l'app avec session existante (`loadUser()`)
- Dans `loginWithToken()` (Google, token membre, inscription)
- Dans `switchAccount()`

**Solution** : Déplacé l'appel dans le `useEffect` qui dépend de `[token]`, couvrant ainsi TOUS les cas où une session devient active.

**Note Expo SDK 54** : Depuis le SDK 53, Expo Go ne supporte plus les notifications push. Un **development build** (via EAS Build) est nécessaire pour tester les notifications.

### Problème B - Clavier cache le formulaire "Nouvelle annonce" ✅
**Symptôme** : Le clavier recouvre les champs Message/Destinataires/Envoyer.

**Cause** : La modale "Nouvelle annonce" était la seule de l'app à ne pas utiliser `KeyboardAvoidingView`.

**Solution** : Ajout de `KeyboardAvoidingView` avec `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` autour du contenu de la modale.

### Fichiers modifiés
- `/app/frontend/context/AuthContext.js` (Problème A)
- `/app/frontend/app/(tabs)/annonces.js` (Problème B)



### Fix Page Cotisations Web - Cache React Query - 21 Juillet 2026 ✅
**Symptôme** : Page /payments affiche "0 FCFA/mois" et "0 membre(s)" de façon intermittente, alors que le sélecteur d'année montre bien "2026 - 1000 FCFA/mois".

**Cause** : `setSelectedYear()` était appelé dans `queryFn` de la requête `years`. Or avec `staleTime: 60s` (dans providers.tsx), React Query sert les données depuis le cache sans réexécuter `queryFn`. Résultat : `selectedYear` reste `null`, la requête `payments` ne se déclenche pas.

**Solution** : Déplacé la sélection automatique de l'année dans un `useEffect` séparé qui dépend de `[years, selectedYear]` — s'exécute même quand `years` vient du cache.

**Fichier modifié** : `/app/web/src/app/payments/page.tsx`



---

## Mise à jour Finalisation v2 - 21 Juillet 2026 ✅

### Partie 1 - Fix clavier (2 modales parametres.js) ✅
- Modal "Importer membres" : ajout KeyboardAvoidingView
- Modal "Supprimer mon compte" : ajout KeyboardAvoidingView

### Partie 2 - Modèle freemium ✅
- Schéma Prisma : ajouté `plan` (LAUNCH/FREE/PAID), `launchPeriodMonths`
- Utilitaire `planLimits.js` : calcul dynamique du plan effectif et limites
- Routes members.js, import.js, public.js : utilisation de `checkMemberLimit()`
- Interface Super Admin : sélecteur de plan + durée personnalisable

**Limites de membres:**
- LAUNCH (période d'essai 8 mois par défaut): 250 membres
- FREE (après expiration ou manuel): 10 membres  
- PAID: 250 membres

### Partie 3 - Interrupteur tontinesEnabled ✅
- Schéma Prisma : `tontinesEnabled` (défaut false)
- auth.js : exposé en lecture seule dans /association-settings
- tontines.js : routes POST bloquées si désactivé (403)
- Interface Super Admin : badge + checkbox

### Partie 4 - Gestion tontines sur mobile ✅
- Sélecteur de segment "Événements" / "Tontines" dans exceptionnelles.js
- Segment visible uniquement si admin ET tontinesEnabled=true
- CRUD complet : création, liste, détail, paiements, clôture de tour
- Modales avec KeyboardAvoidingView intégré

### Fichiers modifiés/créés
- Backend: schema.prisma, planLimits.js (NEW), members.js, import.js, public.js, auth.js, tontines.js, platform.js
- Web: platform/associations/[id]/page.tsx
- Mobile: parametres.js, exceptionnelles.js

### Tests validés
- ✅ Tontines bloquées quand désactivées (403)
- ✅ Activation via Super Admin fonctionne
- ✅ Plan LAUNCH visible dans interface Super Admin



## Système de rôles ADMIN/SCANNER/AUDITEUR - 5 Août 2026 ✅

### Objectif
Permettre de créer des comptes avec des accès limités au sein d'une association.

### Rôles disponibles
- **ADMIN** : Accès complet à toutes les fonctionnalités (max 3 par association)
- **SCANNER** : Peut uniquement scanner les QR codes pour vérifier l'identité/statut des membres (max 10)
- **AUDITEUR** : Consultation en lecture seule des paiements, cotisations et stats (max 3)
- **MEMBER** : Membre standard (comportement inchangé)

### Backend modifié
- `middleware/auth.js` : Nouveau middleware `requireRole(allowedRoles)` 
- `routes/admin.js` : 
  - `GET /api/admin/quotas` : Récupère les quotas par rôle
  - `GET /api/admin/list` : Liste ADMIN + SCANNER + AUDITEUR
  - `POST /api/admin/create` : Accepte `role` en paramètre avec validation de quota
- `routes/members.js` : `POST /api/members/verify-qr` accessible à ADMIN + SCANNER
- `routes/payments.js` : `GET /api/payments/audit-view` accessible à ADMIN + AUDITEUR

### Frontend Web modifié
- `/app/admins/page.tsx` : Sélecteur de rôle, affichage quotas, badges de rôle
- `/app/audit/page.tsx` (NEW) : Page de consultation pour les auditeurs
- `Sidebar.tsx` : Navigation filtrée par rôle

### Frontend Mobile modifié
- `(tabs)/_layout.js` : Tabs filtrées selon le rôle (SCANNER/AUDITEUR ont accès limité)
- `(tabs)/admin.js` : Interface de création avec sélecteur de rôle et quotas visuels

### Tests validés
- ✅ SCANNER peut appeler verify-qr mais pas admin/list
- ✅ AUDITEUR peut appeler audit-view mais pas POST payments
- ✅ Quotas respectés par rôle
- ✅ Création de comptes SCANNER et AUDITEUR fonctionnelle

## Migration Prisma - 5 Août 2026 ✅

### Migration 20260722000001_add_wave_qrcode_cascade
Regroupe 3 changements de schéma précédemment appliqués via `db push` :
1. `onDelete: Cascade` sur `ActivityLog → Association`
2. Champs Wave sur `Association` (`waveApiKey`, `waveMerchantId`, `mobilePaymentEnabled`) + modèle `WaveTransaction`
3. Champs QR Code sur `Member` (`qrCode`, `qrGeneratedAt`)

Status: Appliquée avec succès via `prisma migrate resolve --applied`

