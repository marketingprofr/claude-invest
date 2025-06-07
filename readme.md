# 🚀 Börse Frankfurt Trading App

Une application web moderne pour le trading automatisé d'ETF avec l'API Börse Frankfurt.

## ✨ Fonctionnalités

- **Données en temps réel** : Récupération des cours ETF depuis l'API officielle Börse Frankfurt
- **Trading automatique** : Détection automatique des opportunités de trading (delta > 0.5%)
- **Notifications intelligentes** : Alertes navigateur + fallback en page pour les signaux de trade
- **Interface moderne** : Design responsive avec Tailwind CSS et animations fluides
- **Débogage avancé** : Système de logs détaillé avec export possible
- **Auto-refresh** : Mise à jour automatique toutes les 15 minutes
- **Gestion d'erreurs** : Récupération automatique et contournement CORS

## 📊 ETF Supportés

| ETF | Nom | ISIN | Description |
|-----|-----|------|-------------|
| **IWDA** | iShares Core MSCI World | IE00B4L5Y983 | ETF diversifié monde développé |
| **VWCE** | Vanguard FTSE All-World | IE00BK5BQT80 | ETF monde entier (développés + émergents) |
| **MEUD** | Amundi STOXX Europe 600 | LU0908500753 | ETF actions européennes large |
| **IMAE** | iShares Core MSCI Europe | IE00B4K48X80 | ETF actions européennes développées |

## 🛠️ Installation

### Prérequis
- Navigateur moderne (Chrome, Firefox, Safari, Edge)
- Connexion internet

### Déploiement local
```bash
# Cloner le repository
git clone https://github.com/votre-username/borse-trading-app.git
cd borse-trading-app

# Servir les fichiers (Python)
python -m http.server 8000

# Ou avec Node.js
npx serve .

# Ou simplement ouvrir index.html dans le navigateur
```

### Déploiement web
- **GitHub Pages** : Activez GitHub Pages dans les paramètres du repo
- **Netlify** : Glissez-déposez le dossier sur netlify.com
- **Vercel** : `vercel --prod`

## 🔧 Configuration CORS

L'API Börse Frankfurt est bloquée par CORS dans certains navigateurs :

### Solutions recommandées :

**Chrome (développement) :**
```bash
chrome --disable-web-security --user-data-dir=/tmp/chrome_dev
```

**Extensions navigateur :**
- Chrome : "CORS Unblock"
- Firefox : "CORS Everywhere"

**Proxies automatiques :**
L'app essaie automatiquement plusieurs proxies CORS publics.

## 🎯 Logique de Trading

### Algorithme
1. **Récupération** des variations journalières depuis l'ouverture
2. **Calcul des deltas** = différence entre les variations d'ETF
3. **Signal de trade** si delta > 0.5% (configurable)
4. **Notification immédiate** + calcul du gain potentiel

### Exemple
- VWCE : +1.2% depuis l'ouverture
- IWDA : +0.5% depuis l'ouverture
- **Delta = 1.2% - 0.5% = 0.7%** → 🚨 **SIGNAL DE TRADE !**

## 📱 Interface Utilisateur

### Tableau principal
- Prix en temps réel
- Variations journalières colorées
- Deltas calculés automatiquement
- Status des dernières mises à jour

### Recommandations
- Signaux de trade avec animation
- Calcul automatique des gains/frais
- Instructions claires d'action

### Notifications
- Alertes navigateur pour les signaux
- Sons et vibrations (si supportés)
- Fallback en page si permissions refusées

## 🔍 Débogage

### Console développeur
```javascript
// Statistiques de l'application
debugApp.stats()

// Forcer un refresh
debugApp.refresh()

// Tester la connexion API
debugApp.test()

// Exporter toutes les données
debugApp.export()

// Accès direct aux modules
debugApp.api.fetchETF('VWCE')
debugApp.trading.analyze('VWCE', 100000)
debugApp.notifications.test()
```

### Logs détaillés
- Interface de débogage intégrée
- Export des logs vers fichier
- Codes couleur par niveau (info, success, warning, error)

## 📁 Architecture

```
/
├── index.html              # Structure HTML principale
├── styles.css             # Styles CSS avec animations
├── js/
│   ├── config.js          # Configuration et données ETF
│   ├── debug.js           # Système de débogage
│   ├── api.js             # Gestion API Börse Frankfurt
│   ├── ui.js              # Interface utilisateur
│   ├── trading.js         # Logique de trading
│   ├── notifications.js   # Système de notifications
│   └── app.js             # Application principale
├── README.md              # Cette documentation
├── .gitignore            # Fichiers à ignorer par Git
└── package.json          # Métadonnées du projet
```

### Modules

**config.js** : Configuration centralisée, données ETF, constantes
**debug.js** : Logs colorés, export, interface de débogage
**api.js** : Appels API, gestion CORS, rate limiting
**ui.js** : Rendu interface, gestion événements DOM
**trading.js** : Calculs de deltas, recommandations, historique
**notifications.js** : Alertes navigateur, sons, fallbacks
**app.js** : Orchestration, auto-refresh, gestion d'erreurs

## ⚙️ Configuration

### Paramètres principaux (`config.js`)
```javascript
const CONFIG = {
    AUTO_REFRESH_INTERVAL: 15 * 60 * 1000,  // 15 minutes
    TRADING_THRESHOLD: 0.5,                  // 0.5% pour signal
    TRADING_FEES: 50,                        // 50€ de frais
    API_REQUEST_DELAY: 300                   // 300ms entre requêtes
};
```

### Ajouter un nouvel ETF
```javascript
// Dans config.js
ETF_DATA.NOUVEL_ETF = {
    isin: 'IE00XXXXXXXXX',
    wkn: 'XXXXXX',
    symbol: 'XXXX',
    name: 'Nom complet de l\'ETF',
    description: 'Description courte'
    // ... autres propriétés
};
```

## 🚀 Utilisation

1. **Ouvrir** l'application dans le navigateur
2. **Cliquer** "Test Connexion" pour vérifier l'API
3. **Sélectionner** votre ETF détenu et valeur du portefeuille
4. **Cliquer** "Actualiser les Cours" pour récupérer les données
5. **Surveiller** les recommandations et notifications automatiques

### Signaux de trading
- **🚀 TRADER MAINTENANT** : Delta > 0.5% détecté
- **⏳ Attendre** : Aucune opportunité immédiate
- **Notifications push** : Alertes automatiques en arrière-plan

## 📊 Performance

### Métriques suivies
- Nombre de signaux générés
- Taux de réussite estimé
- Gains/pertes potentiels
- Statistiques d'API (requêtes, erreurs)

### Optimisation
- Rate limiting des requêtes API
- Cache intelligent des données
- Auto-arrêt en cas d'erreurs répétées
- Récupération automatique après erreur

## 🔐 Sécurité

- **Aucune donnée sensible** stockée
- **API publique** sans authentification
- **Données temporaires** en mémoire uniquement
- **Pas de transmission** d'informations personnelles

## 🤝 Contribution

### Développement
```bash
# Fork le projet
git fork https://github.com/votre-username/borse-trading-app

# Créer une branche
git checkout -b feature/nouvelle-fonctionnalite

# Commiter les changements
git commit -m "Ajout nouvelle fonctionnalité"

# Pousser vers GitHub
git push origin feature/nouvelle-fonctionnalite

# Créer une Pull Request
```

### Idées d'améliorations
- [ ] Support d'autres APIs de données financières
- [ ] Backtesting historique des stratégies
- [ ] Graphiques de prix intégrés
- [ ] Export des données vers Excel
- [ ] Mode sombre / thèmes personnalisés
- [ ] Support d'autres types d'actifs (actions, crypto)
- [ ] Alertes par email/SMS
- [ ] Interface mobile dédiée

## 📄 Licence

MIT License - Voir le fichier `LICENSE` pour plus de détails.

## ⚠️ Avertissement

**Cette application est fournie à des fins éducatives et d'information uniquement.**

- Ne constitue pas un conseil financier
- Les données peuvent contenir des erreurs
- Tradez à vos propres risques
- Vérifiez toujours les données avant de trader
- Consultez un conseiller financier professionnel

## 📞 Support

- **Issues** : [GitHub Issues](https://github.com/votre-username/borse-trading-app/issues)
- **Documentation** : Ce README + commentaires dans le code
- **Débogage** : Interface `debugApp` dans la console

## 🙏 Remerciements

- **Börse Frankfurt** pour l'API publique
- **Tailwind CSS** pour le framework CSS
- **Lucide** pour les icônes
- **Communauté open source** pour les outils utilisés

---

**Happy Trading! 📈✨**