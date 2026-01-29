# AssocManager - Application Mobile de Gestion de Cotisations

## 📱 Description

AssocManager est une application mobile pour la gestion de cotisations pour les associations (syndic, tontine, coopérative, ONG, église, association culturelle).

**Version actuelle:** Phase 1 - Authentification & Gestion des Membres

## 🏗️ Architecture

### Backend
- **Framework:** Node.js + Express
- **Base de données:** SQLite + Prisma ORM
- **Authentification:** JWT (jsonwebtoken + bcryptjs)
- **Port:** 8001

### Frontend
- **Framework:** React Native + Expo
- **Routeur:** Expo Router (file-based routing)
- **État:** React Context + AsyncStorage
- **HTTP Client:** Axios
- **Port:** 3000

## 🎯 Fonctionnalités Phase 1

### ✅ Authentification
- Login ADMIN: email/téléphone + mot de passe
- Login MEMBRE: email/téléphone + mot de passe OU token d'accès
- JWT avec expiration 30 jours
- Cache local avec AsyncStorage

### ✅ Gestion Multi-ADMIN
- Créer des administrateurs
- Désactiver/Réactiver un administrateur
- Réinitialiser le mot de passe
- Tous les ADMIN ont les mêmes droits (V1)

### ✅ Gestion des Membres
- Créer un membre (nom, champ personnalisé, email, téléphone)
- Modifier un membre
- Activer/Désactiver un membre
- Recherche par nom ou champ personnalisé
- Réinitialiser mot de passe
- Régénérer token d'accès
- Auto-génération de credentials

### ✅ Configuration Association
- Nom de l'association
- Type d'association (optionnel)
- Libellé du champ personnalisé (Villa, Groupe, Section, etc.)
- Configuration éditable par les ADMIN

### ✅ Interface Mobile
- **Dashboard:** Statistiques, bienvenue, configuration
- **Membres:** Liste, recherche, filtres
- **Admin:** Gestion des administrateurs
- **Paramètres:** Profil, configuration, déconnexion
- Navigation par tabs
- Pull-to-refresh
- Design mobile-first en français

## 🚀 Installation et Démarrage

### Prérequis
- Node.js (v18+)
- npm ou yarn
- Expo Go app (pour tester sur mobile)

### Backend

```bash
cd /app/backend

# Installer les dépendances
npm install

# Générer le client Prisma
npx prisma generate

# Créer/Migrer la base de données
npx prisma migrate dev --name init

# Initialiser la base de données (créer ADMIN par défaut)
npm run init-db

# Démarrer le serveur
npm start
```

Le serveur démarre sur `http://0.0.0.0:8001`

### Frontend

```bash
cd /app/frontend

# Installer les dépendances
yarn install

# Démarrer Expo
yarn start
```

Le serveur Expo démarre sur `http://localhost:3000`

### Accès à l'application

**Administrateur par défaut:**
- Email: `admin@assocmanager.local`
- Mot de passe: `admin`

⚠️ **Important:** Changez le mot de passe après la première connexion!

## 📡 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Informations utilisateur

### Admin (Protégé: ADMIN uniquement)
- `GET /api/admin/list` - Liste des admins
- `POST /api/admin/create` - Créer un admin
- `PUT /api/admin/:id/activate` - Activer un admin
- `PUT /api/admin/:id/deactivate` - Désactiver un admin
- `POST /api/admin/:id/reset-password` - Reset password

### Membres (Protégé: Authentification requise)
- `GET /api/members` - Liste des membres (avec recherche)
- `GET /api/members/:id` - Détail d'un membre
- `POST /api/members` - Créer un membre (ADMIN)
- `PUT /api/members/:id` - Modifier un membre (ADMIN)
- `PUT /api/members/:id/activate` - Activer (ADMIN)
- `PUT /api/members/:id/deactivate` - Désactiver (ADMIN)
- `POST /api/members/:id/reset-password` - Reset password (ADMIN)
- `POST /api/members/:id/regenerate-token` - Régénérer token (ADMIN)

### Configuration
- `GET /api/config` - Récupérer la configuration
- `POST /api/config` - Créer/Modifier la configuration (ADMIN)

## 🔐 Sécurité

- ✅ Mots de passe hashés avec bcrypt (10 rounds)
- ✅ JWT avec expiration
- ✅ Routes protégées par middleware
- ✅ Validation des rôles (ADMIN/MEMBER)
- ✅ Tokens d'accès uniques pour les membres

## 🌍 Internationalisation

- **Langue:** Français uniquement (V1)
- **Devise:** FCFA
- **Format de date:** Français (jj/mm/aaaa)

## 🧪 Tests

### Backend Tests (curl)

```bash
# Login admin
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@assocmanager.local", "password": "admin"}'

# Créer un membre
TOKEN="<votre_token>"
curl -X POST http://localhost:8001/api/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test User", "customFieldValue": "Villa 1", "email": "test@test.com"}'
```

## 🚧 Prochaines Phases

### Phase 2 - Cotisations Mensuelles
- Gestion des années
- Suivi mensuel (Janvier → Décembre)
- Calculs: dû, payé, reste, pourcentage
- Paiements partiels
- Modification des montants

### Phase 3 - Import/Export & Cotisations Exceptionnelles
- Import CSV/TXT de membres
- Export statistiques
- Cotisations exceptionnelles (événements)
- Montants variables

## 📝 Notes Importantes

1. **SQLite** est utilisé en V1 pour simplicité. Migration vers PostgreSQL/MySQL possible en V2.
2. **Un seul ADMIN** est créé par défaut. Créez-en d'autres via l'interface.
3. **Synchronisation** V1 = simple refresh. Sync bidirectionnelle en V2.
4. **Offline** = lecture du cache uniquement en V1.

---

**Version:** 1.0.0  
**Date:** Janvier 2026  
**Statut:** Phase 1 - Production Ready ✅
