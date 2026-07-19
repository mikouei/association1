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
