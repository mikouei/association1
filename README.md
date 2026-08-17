# AssocManager

Application mobile de gestion des cotisations pour associations, syndicats et amicales.

## 🚀 Fonctionnalités

### Authentification
- Connexion par email/téléphone + mot de passe
- Connexion par token d'accès (pour les membres)
- Deux rôles : **ADMIN** et **MEMBRE**

### Gestion des Membres (Admin)
- Ajouter, modifier, désactiver des membres
- Réinitialiser le mot de passe d'un membre
- Recherche par nom, villa ou téléphone
- Import de membres depuis fichier TXT/CSV
- Export de la liste des membres en CSV

### Cotisations Mensuelles
- Grille interactive des paiements par membre et par mois
- Sélecteur d'année pour consulter l'historique
- Support des paiements partiels
- Code couleur : 🟢 Payé | 🟠 Partiel | 🔴 Non payé
- Filtrage par nom, villa ou téléphone
- Les membres ne voient que leur propre ligne

### Cotisations Exceptionnelles
- Créer des événements (décès, mariage, anniversaire, solidarité, autre)
- Modifier et supprimer des événements
- Enregistrer des paiements par membre
- Statistiques : montant collecté, nombre de participants

### Gestion des Années (Admin)
- Créer des années avec montant mensuel personnalisé
- Activer/désactiver des années
- Consulter les cotisations de n'importe quelle année

### Configuration (Admin)
- Personnaliser le nom de l'association
- Définir le type (syndicat, amicale, association)
- Personnaliser le libellé du champ membre (Villa, Appartement, etc.)

### Export (Admin)
- Export des membres en CSV
- Export des statistiques de cotisations en CSV
- Export des statistiques en PDF (rapport formaté)

## 🛠 Stack Technique

### Frontend
- **React Native** avec **Expo**
- **Expo Router** (navigation par fichiers)
- **Axios** pour les appels API
- **AsyncStorage** pour le stockage local

### Backend
- **Node.js** avec **Express**
- **Prisma ORM**
- **SQLite** (base de données)
- **JWT** pour l'authentification

## 📱 Installation

### Prérequis
- Node.js 18+
- Yarn ou npm
- Expo CLI

### Backend
```bash
cd backend
yarn install
npx prisma generate
npx prisma db push
node scripts/init-db.js
yarn start
```

### Frontend
```bash
cd frontend
yarn install
npx expo start
```

## 🔐 Identifiants par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@assocmanager.local | admin |

## 📂 Structure du projet

```
/app
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── routes/
│   │   ├── auth.js
│   │   ├── members.js
│   │   ├── payments.js
│   │   ├── exceptional.js
│   │   ├── years.js
│   │   ├── config.js
│   │   ├── export.js
│   │   └── import.js
│   ├── middleware/
│   │   └── auth.js
│   └── server.js
│
└── frontend/
    ├── app/
    │   ├── (tabs)/
    │   │   ├── index.js          # Accueil
    │   │   ├── cotisations.js    # Grille des cotisations
    │   │   ├── exceptionnelles.js # Cotisations exceptionnelles
    │   │   ├── membres.js        # Gestion des membres
    │   │   ├── admin.js          # Gestion des administrateurs
    │   │   └── parametres.js     # Paramètres et configuration
    │   ├── login.js
    │   └── _layout.js
    ├── context/
    │   └── AuthContext.js
    └── utils/
        └── api.js
```

## 📊 Format d'import des membres

Format TXT/CSV avec séparateur point-virgule (;) :
```
Nom du membre;Villa XX;+237 6XX XX XX XX
Jean Dupont;Villa 12;+237 699 12 34 56
Marie Martin;Villa 15;+237 677 98 76 54
```

## 🎨 Captures d'écran

### Vue Admin
- Dashboard avec statistiques
- Grille des cotisations complète
- Gestion des membres
- Configuration de l'association

### Vue Membre
- Dashboard personnel
- Sa ligne de cotisation uniquement
- Cotisations exceptionnelles (lecture seule)
- Paramètres (profil + déconnexion)

## 📝 API Endpoints

### Auth
- `POST /api/auth/login` - Connexion
- `POST /api/auth/token-login` - Connexion par token

### Members
- `GET /api/members` - Liste des membres
- `POST /api/members` - Créer un membre
- `PUT /api/members/:id` - Modifier un membre
- `POST /api/members/:id/reset-password` - Réinitialiser mot de passe

### Payments
- `GET /api/payments/year/:yearId` - Paiements par année
- `POST /api/payments` - Enregistrer un paiement

### Exceptional
- `GET /api/exceptional` - Liste des cotisations exceptionnelles
- `POST /api/exceptional` - Créer une cotisation
- `PUT /api/exceptional/:id` - Modifier
- `DELETE /api/exceptional/:id` - Supprimer
- `POST /api/exceptional/:id/payments` - Ajouter un paiement

### Export
- `GET /api/export/members` - Export membres CSV
- `GET /api/export/statistics/:yearId` - Export stats CSV

## 📄 Licence

Projet privé - Tous droits réservés

---

Développé avec ❤️ pour la gestion des associations
