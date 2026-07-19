# Configuration Sentry pour Kotiz Mobile

## Prérequis
- Compte Sentry (gratuit : https://sentry.io/signup/)
- Projet créé pour React Native

## Configuration

### 1. Créer un projet Sentry
1. Aller sur https://sentry.io
2. Créer un nouveau projet : "React Native"
3. Copier le DSN (format: `https://xxx@xxx.ingest.sentry.io/xxx`)

### 2. Configurer EAS Secrets
```bash
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "votre-dsn-ici"
eas secret:create --name SENTRY_AUTH_TOKEN --value "votre-token-ici"
```

### 3. Activer le plugin Sentry (pour build natif)
Dans `app.json`, ajouter "@sentry/react-native" dans les plugins :
```json
"plugins": [
  "expo-router",
  "@sentry/react-native"
]
```

### 4. Configurer metro.config.js (pour source maps)
```javascript
const { withSentryConfig } = require("@sentry/react-native/metro");
// ... config existante
module.exports = withSentryConfig(config);
```

### 5. Initialiser dans _layout.js
```javascript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
  release: 'kotiz@2.0.0',
});
```

## Note Importante
Le plugin Sentry ne fonctionne PAS avec Expo Web preview.
Il est conçu pour les builds natifs (APK/IPA) via EAS Build.

## Fichiers préparés
- `/app/frontend/utils/sentry.js` - Module d'initialisation
- `@sentry/react-native` - Package installé

## Pour activer
1. Configurer les secrets EAS avec votre DSN
2. Décommenter le plugin dans app.json
3. Build natif : `eas build --platform android`
