// Configuration globale de l'application
export const CONFIG = {
    // Intervalles de rafraîchissement
    AUTO_REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes
    API_REQUEST_DELAY: 300, // 300ms entre les requêtes
    
    // Seuils de trading
    TRADING_THRESHOLD: 0.5, // 0.5% de delta pour déclencher un signal
    TRADING_FEES: 50, // 50€ de frais par transaction
    
    // API Configuration
    API_BASE_URL: 'https://api.boerse-frankfurt.de/v1/data/quote_box/single',
    CORS_PROXIES: [
        'https://api.allorigins.win/get?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://api.codetabs.com/v1/proxy?quest='
    ],
    
    // Paramètres de notification
    NOTIFICATION_DURATION: 8000, // 8 secondes
    NOTIFICATION_SOUND: true
};

// Données des ETF avec leurs identifiants
export const ETF_DATA = {
    IWDA: { 
        isin: 'IE00B4L5Y983', 
        wkn: 'A0RPWH',
        symbol: 'EUNL',
        name: 'iShares Core MSCI World UCITS ETF',
        description: 'ETF diversifié monde développé',
        currency: 'EUR',
        price: null, 
        change: null, 
        changePercent: null, 
        lastUpdate: null,
        openPrice: null,
        tradingStatus: null,
        instrumentStatus: null
    },
    VWCE: { 
        isin: 'IE00BK5BQT80', 
        wkn: 'A2PKXG',
        symbol: 'VWCE',
        name: 'Vanguard FTSE All-World UCITS ETF (USD) Acc',
        description: 'ETF monde entier (développés + émergents)',
        currency: 'EUR',
        price: null, 
        change: null, 
        changePercent: null, 
        lastUpdate: null,
        openPrice: null,
        tradingStatus: null,
        instrumentStatus: null
    },
    MEUD: { 
        isin: 'LU0908500753', 
        wkn: 'LYX0Q0',
        symbol: 'LYP6',
        name: 'Amundi STOXX Europe 600 UCITS ETF Acc',
        description: 'ETF actions européennes large',
        currency: 'EUR',
        price: null, 
        change: null, 
        changePercent: null, 
        lastUpdate: null,
        openPrice: null,
        tradingStatus: null,
        instrumentStatus: null
    },
    IMAE: { 
        isin: 'IE00B4K48X80', 
        wkn: 'A0RPWG',
        symbol: 'EUNK',
        name: 'iShares Core MSCI Europe UCITS ETF EUR (Acc)',
        description: 'ETF actions européennes développées',
        currency: 'EUR',
        price: null, 
        change: null, 
        changePercent: null, 
        lastUpdate: null,
        openPrice: null,
        tradingStatus: null,
        instrumentStatus: null
    }
};

// Liste des ETF disponibles
export const ETF_LIST = Object.keys(ETF_DATA);

// Configuration par défaut de l'application
export const DEFAULT_SETTINGS = {
    currentStock: 'VWCE',
    portfolioValue: 100000,
    autoRefresh: true,
    notifications: true,
    debugMode: false
};

// Données de simulation pour les tests (si l'API n'est pas disponible)
export const SIMULATION_DATA = {
    IWDA: { basePrice: 75.30, volatility: 0.7 },
    VWCE: { basePrice: 108.50, volatility: 0.8 },
    MEUD: { basePrice: 52.80, volatility: 0.9 },
    IMAE: { basePrice: 41.20, volatility: 1.0 }
};

// Messages d'information pour l'utilisateur
export const MESSAGES = {
    API_INFO: {
        title: '🏛️ API Börse Frankfurt',
        content: [
            'API publique gratuite - pas de clé requise',
            'Cours ETF en temps réel pendant les heures de marché',
            'Mise à jour automatique toutes les 15 minutes',
            'URL API: https://api.boerse-frankfurt.de/v1/data/quote_box/single?isin=...'
        ]
    },
    CORS_INFO: {
        title: '⚠️ Solutions CORS',
        content: [
            'L\'API fonctionne mais les navigateurs bloquent les requêtes cross-origin.',
            'Chrome: chrome --disable-web-security --user-data-dir=/tmp/chrome_dev',
            'Extensions: "CORS Unblock" (Chrome) ou "CORS Everywhere" (Firefox)',
            'Auto: L\'outil essaie automatiquement des proxies CORS publics'
        ]
    },
    TRADING_LOGIC: {
        title: '🎯 Logique de Trading',
        content: [
            'Variations depuis l\'ouverture du jour',
            'Delta = différence entre variations',
            'Signal d\'achat si delta > +0.5%',
            'Calcul automatique des gains potentiels'
        ]
    },
    INSTRUCTIONS: [
        'Aucune clé API requise - utilise l\'API publique de Börse Frankfurt',
        'Cliquez "Test Connexion" pour vérifier l\'accès à l\'API',
        'Si le test échoue (CORS), utilisez Firefox ou une extension CORS',
        'Cliquez "Actualiser les Cours" pour récupérer les prix réels',
        '🔔 Notifications activées - vous serez alerté automatiquement des opportunités !',
        'Suivez les signaux 🚀 : Delta > 0.5% = TRADER IMMÉDIATEMENT !'
    ]
};

// Fonctions utilitaires pour la configuration
export function getETFBySymbol(symbol) {
    return ETF_DATA[symbol] || null;
}

export function getAllETFs() {
    return { ...ETF_DATA };
}

export function getETFList() {
    return [...ETF_LIST];
}

export function isValidETF(symbol) {
    return ETF_LIST.includes(symbol);
}

export function getAPIUrl(isin) {
    return `${CONFIG.API_BASE_URL}?isin=${isin}`;
}

export function getProxyUrl(originalUrl, proxyIndex = 0) {
    if (proxyIndex >= CONFIG.CORS_PROXIES.length) return null;
    return `${CONFIG.CORS_PROXIES[proxyIndex]}${encodeURIComponent(originalUrl)}`;
}