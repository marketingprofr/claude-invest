import { CONFIG, ETF_DATA, SIMULATION_DATA, getAPIUrl, getProxyUrl } from './config.js';
import { debug } from './debug.js';

// Gestionnaire des appels API Börse Frankfurt
class APIManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.rateLimitDelay = CONFIG.API_REQUEST_DELAY;
        
        // Surveillance du statut réseau
        this.setupNetworkMonitoring();
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            debug.success('Connexion internet rétablie');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            debug.warning('Connexion internet perdue');
        });
    }

    // Fonction principale pour récupérer les données ETF
    async fetchETFData(etfSymbol) {
        if (!this.isOnline) {
            throw new Error('Pas de connexion internet');
        }

        const etfInfo = ETF_DATA[etfSymbol];
        if (!etfInfo) {
            throw new Error(`ETF ${etfSymbol} non trouvé dans la configuration`);
        }

        // Rate limiting
        await this.waitForRateLimit();

        debug.api(`Récupération de ${etfSymbol} depuis Börse Frankfurt API...`);
        debug.info(`ISIN: ${etfInfo.isin} | WKN: ${etfInfo.wkn} | Symbol: ${etfInfo.symbol}`);

        try {
            // Essayer d'abord l'API directe
            const result = await this.fetchDirectAPI(etfInfo);
            debug.success(`Succès API directe pour ${etfSymbol}: ${result.price}€ (${result.changePercent}%)`);
            return result;
        } catch (directError) {
            debug.warning(`API directe échouée pour ${etfSymbol}: ${directError.message}`);
            
            // Si CORS, essayer les proxies
            if (this.isCORSError(directError)) {
                debug.info('Tentative de contournement CORS...');
                try {
                    const result = await this.fetchWithCORSProxy(etfInfo);
                    debug.success(`Succès via proxy CORS pour ${etfSymbol}: ${result.price}€`);
                    return result;
                } catch (proxyError) {
                    debug.error(`Tous les proxies CORS ont échoué: ${proxyError.message}`);
                    throw new Error('CORS bloqué. Utilisez Chrome avec --disable-web-security ou une extension CORS');
                }
            } else {
                throw directError;
            }
        }
    }

    // Appel API direct
    async fetchDirectAPI(etfInfo) {
        const apiUrl = getAPIUrl(etfInfo.isin);
        debug.api(`URL API: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            mode: 'cors',
            cache: 'no-cache'
        });

        debug.info(`Réponse HTTP: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        debug.info(`Données reçues: ${JSON.stringify(data).substring(0, 200)}...`);

        return this.parseAPIResponse(data);
    }

    // Appel via proxy CORS
    async fetchWithCORSProxy(etfInfo) {
        const originalUrl = getAPIUrl(etfInfo.isin);
        
        for (let i = 0; i < CONFIG.CORS_PROXIES.length; i++) {
            const proxyUrl = getProxyUrl(originalUrl, i);
            if (!proxyUrl) continue;

            try {
                debug.info(`Tentative proxy ${i + 1}/${CONFIG.CORS_PROXIES.length}: ${proxyUrl.substring(0, 80)}...`);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    debug.warning(`Proxy ${i + 1} - HTTP ${response.status}`);
                    continue;
                }

                const proxyData = await response.json();
                
                // AllOrigins retourne les données dans .contents
                const actualData = proxyData.contents ? JSON.parse(proxyData.contents) : proxyData;
                
                debug.success(`Proxy ${i + 1} réussi`);
                return this.parseAPIResponse(actualData);

            } catch (error) {
                debug.warning(`Proxy ${i + 1} échoué: ${error.message}`);
                continue;
            }
        }

        throw new Error('Tous les proxies CORS ont échoué');
    }

    // Parser la réponse de l'API Börse Frankfurt
    parseAPIResponse(data) {
        if (!data || data.lastPrice === undefined) {
            debug.error(`Structure de données inattendue: lastPrice manquant`);
            debug.info(`Données reçues: ${JSON.stringify(data)}`);
            throw new Error('Champ lastPrice non trouvé dans la réponse API');
        }

        return {
            price: parseFloat(data.lastPrice),
            change: parseFloat(data.changeToPrevDayAbsolute || 0),
            changePercent: parseFloat(data.changeToPrevDayInPercent || 0),
            openPrice: parseFloat(data.open || 0),
            lastUpdate: new Date().toLocaleTimeString('fr-FR'),
            timestamp: data.timestampLastPrice || data.timestamp,
            tradingStatus: data.tradingStatus,
            instrumentStatus: data.instrumentStatus,
            volume: data.turnoverInPieces || null,
            bid: data.bid || null,
            ask: data.ask || null
        };
    }

    // Vérifier si c'est une erreur CORS
    isCORSError(error) {
        return error.message.includes('Failed to fetch') || 
               error.message.includes('CORS') ||
               error.name === 'TypeError';
    }

    // Gestion du rate limiting
    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            debug.info(`Rate limiting: attente de ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    // Test de connexion API
    async testConnection(etfSymbol = 'VWCE') {
        debug.startSection('TEST DE CONNEXION BÖRSE FRANKFURT API');
        
        try {
            const etfInfo = ETF_DATA[etfSymbol];
            const testUrl = getAPIUrl(etfInfo.isin);
            debug.api(`URL test: ${testUrl}`);
            debug.info(`Test de l'API avec ${etfSymbol} (${etfInfo.isin})...`);

            const testData = await this.fetchETFData(etfSymbol);
            
            debug.success(`API Test réussi: ${testData.price}€ (${testData.changePercent}%)`);
            debug.info(`Status: ${testData.instrumentStatus}, Timestamp: ${testData.timestamp}`);
            
            return {
                success: true,
                data: testData,
                message: `🎉 CONNEXION API RÉUSSIE !\n\n✅ Börse Frankfurt API fonctionnelle\n✅ ${etfSymbol}: ${testData.price}€ (${testData.changePercent}%)\n✅ Prix ouverture: ${testData.openPrice}€\n✅ Status: ${testData.instrumentStatus}\n\nVous pouvez maintenant actualiser tous les cours.`
            };

        } catch (error) {
            debug.error(`Erreur de connexion API: ${error.message}`);
            
            let errorMessage;
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                errorMessage = `❌ Problème CORS détecté !\n\nL'API Börse Frankfurt fonctionne (testée manuellement) mais le navigateur bloque les requêtes cross-origin.\n\n🔧 SOLUTIONS IMMÉDIATES:\n\n1️⃣ Chrome avec CORS désactivé:\n   chrome --disable-web-security --user-data-dir=/tmp/chrome_dev\n\n2️⃣ Extension navigateur:\n   - "CORS Unblock" (Chrome)\n   - "CORS Everywhere" (Firefox)\n\n3️⃣ Firefox:\n   about:config → security.tls.insecure_fallback_hosts\n\nL'outil va maintenant essayer les proxies CORS automatiquement.`;
            } else {
                errorMessage = `❌ Erreur API !\n\nErreur: ${error.message}\n\nVérifiez:\n• Votre connexion internet\n• La disponibilité de l'API Börse Frankfurt\n• Les logs de débogage pour plus de détails\n\nAPI testée: ${getAPIUrl(ETF_DATA[etfSymbol].isin)}`;
            }

            return {
                success: false,
                error: error.message,
                message: errorMessage
            };
        } finally {
            debug.endSection('TEST DE CONNEXION');
        }
    }

    // Récupération de toutes les données ETF
    async fetchAllETFData(etfList) {
        debug.startSection('REFRESH COMPLET');
        
        const results = {};
        let successCount = 0;
        let errors = [];

        for (const etf of etfList) {
            try {
                debug.info(`\n--- Traitement de ${etf} ---`);
                const data = await this.fetchETFData(etf);
                results[etf] = data;
                successCount++;
                debug.success(`${etf} récupéré avec succès`);
                
                // Délai entre les requêtes sauf pour le dernier
                if (etf !== etfList[etfList.length - 1]) {
                    await new Promise(resolve => setTimeout(resolve, CONFIG.API_REQUEST_DELAY));
                }
            } catch (error) {
                debug.error(`Erreur pour ${etf}: ${error.message}`);
                errors.push({ etf, error: error.message });
            }
        }

        debug.info(`\n=== RÉSULTATS ===`);
        debug.info(`ETFs réussis: ${successCount}/${etfList.length}`);
        
        if (successCount === etfList.length) {
            debug.success('✅ Tous les ETFs mis à jour !');
        } else if (successCount > 0) {
            debug.warning('⚠️ Mise à jour partielle');
        } else {
            debug.error('❌ Aucun ETF mis à jour');
        }

        debug.endSection('REFRESH COMPLET');

        return {
            results,
            successCount,
            totalCount: etfList.length,
            errors,
            timestamp: new Date().toLocaleTimeString('fr-FR')
        };
    }

    // Simulation des données pour les tests (fallback)
    async simulateETFData(etfSymbol) {
        const baseData = SIMULATION_DATA[etfSymbol];
        if (!baseData) {
            throw new Error(`Pas de données de simulation pour ${etfSymbol}`);
        }

        // Simulation avec variation aléatoire
        const randomVariation = (Math.random() - 0.5) * baseData.volatility * 2;
        const currentPrice = baseData.basePrice * (1 + randomVariation / 100);
        const changeAbsolute = currentPrice - baseData.basePrice;
        const changePercent = (changeAbsolute / baseData.basePrice) * 100;

        // Délai pour simuler l'appel réseau
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        return {
            price: parseFloat(currentPrice.toFixed(2)),
            change: parseFloat(changeAbsolute.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            lastUpdate: new Date().toLocaleTimeString('fr-FR'),
            openPrice: baseData.basePrice,
            simulated: true
        };
    }

    // Obtenir les statistiques d'API
    getStats() {
        return {
            requestCount: this.requestCount,
            isOnline: this.isOnline,
            lastRequestTime: this.lastRequestTime,
            rateLimitDelay: this.rateLimitDelay
        };
    }

    // Reset des statistiques
    resetStats() {
        this.requestCount = 0;
        this.lastRequestTime = 0;
        debug.info('Statistiques API réinitialisées');
    }
}

// Instance globale du gestionnaire API
export const apiManager = new APIManager();

// Fonctions d'API exportées pour faciliter l'utilisation
export const api = {
    fetchETF: (symbol) => apiManager.fetchETFData(symbol),
    fetchAll: (etfList) => apiManager.fetchAllETFData(etfList),
    test: (symbol) => apiManager.testConnection(symbol),
    simulate: (symbol) => apiManager.simulateETFData(symbol),
    stats: () => apiManager.getStats(),
    reset: () => apiManager.resetStats()
};