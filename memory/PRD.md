# AssocManager - Product Requirements Document

## Aperçu du projet
AssocManager est une application de gestion d'associations qui permet de gérer les membres, les cotisations mensuelles et exceptionnelles, et les véhicules des membres.

## Architecture

### Backend
- **Technologie** : Node.js, Express.js
- **Base de données** : PostgreSQL (migré depuis SQLite)
- **ORM** : Prisma
- **Architecture** : Multi-tenant avec isolation par `associationId`

### Frontend
- **Mobile** : React Native (Expo)
- **Web** : Next.js (scaffold en cours)

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
