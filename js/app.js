import { CONFIG, ETF_DATA, ETF_LIST } from './config.js';
import { debug } from './debug.js';
import { api } from './api.js';
import { ui } from './ui.js';
import { trading } from './trading.js';
import { notifications } from './notifications.js';

// Application principale
class TradingApp {
    constructor() {
        this.state = {
            isInitialized: false,
            isRefreshing: false,
            autoRefreshInterval: null,
            lastAnalysis: null,
            errorCount: 0,
            successfulRefreshes: 0
        };
        
        this.init();
    }

    async init() {
        try {
            debug.startSection('INITIALISATION APPLICATION');
            
            // Initialisation des modules
            await this.initializeModules();
            
            // Configuration des écouteurs d'événements
            this.setupEventListeners();
            
            // Configuration du trading
            this.setupTradingCallbacks();
            
            // Test initial des notifications
            await this.initializeNotifications();
            
            // Interface utilisateur initiale
            this.initializeUI();
            
            this.state.isInitialized = true;
            debug.success('✅ Application initialisée avec succès');
            debug.endSection('INITIALISATION APPLICATION');
            
            // Message de bienvenue
            this.showWelcomeMessage();
            
        } catch (error) {
            debug.error(`Erreur d'initialisation: ${error.message}`);
            this.handleCriticalError(error);
        }
    }

    // Initialisation des modules
    async initializeModules() {
        debug.info('Initialisation des modules...');
        
        // Tous les modules sont déjà initialisés via leurs imports
        // Vérifier leur état
        const moduleStats = {
            debug: debug.stats(),
            api: api.stats(),
            ui: ui.getState(),
            trading: trading.getStats(),
            notifications: notifications.getStats()
        };
        
        debug.info('État des modules:', JSON.stringify(moduleStats, null, 2));
    }

    // Configuration des écouteurs d'événements
    setupEventListeners() {
        debug.info('Configuration des écouteurs d\'événements...');
        
        // Événements UI
        document.addEventListener('refresh-requested', () => {
            this.handleRefreshRequest();
        });
        
        document.addEventListener('test-connection-requested', () => {
            this.handleConnectionTest();
        });
        
        document.addEventListener('stock-changed', (event) => {
            this.handleStockChange(event.detail.newStock);
        });
        
        document.addEventListener('portfolio-changed', (event) => {
            this.handlePortfolioChange(event.detail.newValue);
        });

        // Événements navigateur
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        window.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        // Événements réseau
        window.addEventListener('online', () => {
            this.handleNetworkChange(true);
        });

        window.addEventListener('offline', () => {
            this.handleNetworkChange(false);
        });
    }

    // Configuration des callbacks de trading
    setupTradingCallbacks() {
        debug.info('Configuration des callbacks de trading...');
        
        // Callback pour les nouveaux signaux de trade
        trading.onSignal((recommendation) => {
            this.handleTradeSignal(recommendation);
        });
    }

    // Initialisation des notifications
    async initializeNotifications() {
        debug.info('Initialisation des notifications...');
        
        try {
            const hasPermission = await notifications.requestPermission();
            if (hasPermission) {
                debug.success('Permissions notifications accordées');
            } else {
                debug.warning('Permissions notifications refusées - utilisation fallback');
            }
        } catch (error) {
            debug.warning(`Erreur initialisation notifications: ${error.message}`);
        }
    }

    // Initialisation de l'interface utilisateur
    initializeUI() {
        debug.info('Initialisation de l\'interface utilisateur...');
        ui.render();
    }

    // Message de bienvenue
    showWelcomeMessage() {
        const features = notifications.checkFeatures();
        const hasAdvancedFeatures = features.actions && features.vibrate;
        
        let message = '🎉 Trading App initialisée !\n\n';
        message += '✅ API Börse Frankfurt configurée\n';
        message += `✅ ${ETF_LIST.length} ETFs disponibles\n`;
        message += `✅ Seuil de trading: ${CONFIG.TRADING_THRESHOLD}%\n`;
        message += `✅ Notifications ${notifications.isEnabled() ? 'activées' : 'disponibles'}\n`;
        
        if (hasAdvancedFeatures) {
            message += '✅ Fonctionnalités avancées disponibles\n';
        }
        
        message += '\n💡 Cliquez "Test Connexion" pour commencer !';
        
        setTimeout(() => {
            notifications.show(
                '🚀 Börse Trading Ready!',
                message,
                'success',
                { requireInteraction: true }
            );
        }, 1000);
    }

    // Gestion de la demande de rafraîchissement
    async handleRefreshRequest() {
        if (this.state.isRefreshing) {
            debug.warning('Rafraîchissement déjà en cours - ignoré');
            return;
        }

        debug.startSection('RAFRAÎCHISSEMENT DEMANDÉ');
        this.state.isRefreshing = true;
        ui.updateRefreshButton(true);

        try {
            // Récupération des données
            const result = await api.fetchAll(ETF_LIST);
            
            // Mise à jour des données ETF
            Object.keys(result.results).forEach(etf => {
                Object.assign(ETF_DATA[etf], result.results[etf]);
            });

            // Mise à jour de l'interface
            ui.render();
            ui.updateLastRefresh();

            // Analyse de trading
            const analysis = trading.analyze(ui.getCurrentStock(), ui.getPortfolioValue());
            this.state.lastAnalysis = analysis;

            // Affichage des recommandations
            if (analysis.recommendation) {
                ui.showRecommendations(analysis.recommendation, analysis.deltas);
            } else {
                ui.hideRecommendations();
            }

            // Statistiques
            this.state.successfulRefreshes++;
            this.state.errorCount = 0;

            // Notification de succès
            if (result.successCount === result.totalCount) {
                notifications.showUpdate(result.successCount, result.totalCount);
                debug.success(`✅ Rafraîchissement complet: ${result.successCount}/${result.totalCount} ETFs`);
                
                // Démarrer l'auto-refresh si tous les ETFs sont récupérés
                this.setupAutoRefresh();
            } else {
                debug.warning(`⚠️ Rafraîchissement partiel: ${result.successCount}/${result.totalCount} ETFs`);
            }

        } catch (error) {
            debug.error(`Erreur lors du rafraîchissement: ${error.message}`);
            this.handleRefreshError(error);
        } finally {
            this.state.isRefreshing = false;
            ui.updateRefreshButton(false);
            debug.endSection('RAFRAÎCHISSEMENT');
        }
    }

    // Gestion du test de connexion
    async handleConnectionTest() {
        debug.startSection('TEST DE CONNEXION');
        
        try {
            const testResult = await api.test();
            
            if (testResult.success) {
                ui.showMessage(testResult.message, 'success');
                notifications.show(
                    '✅ Connexion Réussie',
                    'API Börse Frankfurt accessible - prêt pour le trading !',
                    'success'
                );
            } else {
                ui.showMessage(testResult.message, 'error');
                notifications.showError(new Error(testResult.error));
            }
            
        } catch (error) {
            debug.error(`Erreur test de connexion: ${error.message}`);
            ui.showMessage(`Erreur test: ${error.message}`, 'error');
        } finally {
            debug.endSection('TEST DE CONNEXION');
        }
    }

    // Gestion du changement d'ETF
    handleStockChange(newStock) {
        debug.info(`Changement d'ETF vers: ${newStock}`);
        
        // Réanalyse immédiate si on a des données
        if (this.hasValidData()) {
            this.performTradingAnalysis();
        }
    }

    // Gestion du changement de valeur du portefeuille
    handlePortfolioChange(newValue) {
        debug.info(`Changement valeur portefeuille: ${newValue}€`);
        
        // Réanalyse immédiate si on a des données
        if (this.hasValidData()) {
            this.performTradingAnalysis();
        }
    }

    // Gestion des signaux de trading
    handleTradeSignal(recommendation) {
        debug.success(`🚨 NOUVEAU SIGNAL DE TRADE: ${recommendation.fromETF} → ${recommendation.toETF}`);
        
        // Notification push
        notifications.showTradeSignal(recommendation);
        
        // Log détaillé
        debug.info(`Delta: +${recommendation.delta.toFixed(2)}%`);
        debug.info(`Gain potentiel: +${recommendation.potentialGain.toFixed(0)}€`);
        debug.info(`Gain net: +${recommendation.netGain.toFixed(0)}€`);
        debug.info(`Confiance: ${recommendation.confidence.toFixed(1)}%`);
        
        // Mise à jour UI avec animation
        const recSection = document.getElementById('recommendation-section');
        if (recSection) {
            recSection.classList.add('animate-pulse');
            setTimeout(() => {
                recSection.classList.remove('animate-pulse');
            }, 3000);
        }
    }

    // Analyse de trading
    performTradingAnalysis() {
        if (!this.hasValidData()) {
            debug.warning('Analyse trading impossible - données insuffisantes');
            return;
        }

        const analysis = trading.analyze(ui.getCurrentStock(), ui.getPortfolioValue());
        this.state.lastAnalysis = analysis;

        // Mise à jour de l'interface
        if (analysis.recommendation) {
            ui.showRecommendations(analysis.recommendation, analysis.deltas);
        } else {
            ui.hideRecommendations();
        }

        debug.info('Analyse de trading terminée');
    }

    // Vérification de la validité des données
    hasValidData() {
        const currentStock = ui.getCurrentStock();
        const stockData = ETF_DATA[currentStock];
        
        return stockData && 
               stockData.price !== null && 
               stockData.changePercent !== null;
    }

    // Configuration de l'auto-refresh
    setupAutoRefresh() {
        // Annuler l'ancien interval s'il existe
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
        }

        // Nouveau interval
        this.state.autoRefreshInterval = setInterval(() => {
            if (!this.state.isRefreshing && document.visibilityState === 'visible') {
                debug.info('Auto-refresh déclenché');
                this.handleRefreshRequest();
            }
        }, CONFIG.AUTO_REFRESH_INTERVAL);

        debug.success(`Auto-refresh configuré (${CONFIG.AUTO_REFRESH_INTERVAL / 60000} minutes)`);
    }

    // Gestion des erreurs de rafraîchissement
    handleRefreshError(error) {
        this.state.errorCount++;
        
        if (error.message.includes('CORS')) {
            notifications.show(
                '⚠️ Problème CORS',
                'Utilisez une extension CORS ou Chrome en mode développeur',
                'warning'
            );
        } else if (error.message.includes('Failed to fetch')) {
            notifications.show(
                '❌ Erreur Réseau',
                'Vérifiez votre connexion internet',
                'error'
            );
        } else {
            notifications.showError(error);
        }

        // Arrêter l'auto-refresh après trop d'erreurs
        if (this.state.errorCount >= 3) {
            this.stopAutoRefresh();
            debug.warning('Auto-refresh arrêté après 3 erreurs consécutives');
        }
    }

    // Gestion des erreurs critiques
    handleCriticalError(error) {
        debug.error(`ERREUR CRITIQUE: ${error.message}`);
        
        notifications.show(
            '💥 Erreur Critique',
            `L'application a rencontré une erreur: ${error.message}`,
            'error',
            { requireInteraction: true }
        );

        // Tenter une réinitialisation
        setTimeout(() => {
            this.attemptRecovery();
        }, 5000);
    }

    // Tentative de récupération
    attemptRecovery() {
        debug.info('Tentative de récupération...');
        
        try {
            // Reset des modules
            trading.reset();
            api.reset();
            
            // Nettoyage de l'état
            this.state.errorCount = 0;
            this.state.isRefreshing = false;
            
            // Réinitialisation UI
            ui.forceUpdate();
            
            debug.success('Récupération réussie');
            notifications.show(
                '🔄 Récupération',
                'L\'application a été réinitialisée avec succès',
                'success'
            );
            
        } catch (recoveryError) {
            debug.error(`Échec de la récupération: ${recoveryError.message}`);
        }
    }

    // Gestion du changement de visibilité
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            debug.info('Application redevenue visible');
            // Optionnel: refresh si absent longtemps
        } else {
            debug.info('Application masquée');
        }
    }

    // Gestion du changement de réseau
    handleNetworkChange(isOnline) {
        if (isOnline) {
            debug.success('Connexion internet rétablie');
            notifications.show(
                '🌐 Connexion Rétablie',
                'Vous pouvez reprendre les mises à jour',
                'success'
            );
            
            // Redémarrer l'auto-refresh si arrêté
            if (!this.state.autoRefreshInterval && this.state.successfulRefreshes > 0) {
                this.setupAutoRefresh();
            }
        } else {
            debug.warning('Connexion internet perdue');
            notifications.show(
                '🔌 Hors Ligne',
                'Les mises à jour sont temporairement indisponibles',
                'warning'
            );
            this.stopAutoRefresh();
        }
    }

    // Arrêt de l'auto-refresh
    stopAutoRefresh() {
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
            this.state.autoRefreshInterval = null;
            debug.info('Auto-refresh arrêté');
        }
    }

    // Nettoyage avant fermeture
    cleanup() {
        debug.info('Nettoyage de l\'application...');
        
        this.stopAutoRefresh();
        notifications.closeAll();
        
        // Sauvegarder les données de performance
        try {
            const performanceData = trading.export();
            localStorage.setItem('trading-performance', JSON.stringify(performanceData));
        } catch (error) {
            debug.warning('Impossible de sauvegarder les données de performance');
        }
    }

    // Statistiques de l'application
    getAppStats() {
        return {
            state: { ...this.state },
            modules: {
                debug: debug.stats(),
                api: api.stats(),
                ui: ui.getState(),
                trading: trading.getStats(),
                notifications: notifications.getStats()
            },
            performance: trading.getPerformance(),
            uptime: Date.now() - (this.state.initTimestamp || Date.now())
        };
    }

    // Export des données pour analyse
    exportAppData() {
        const appData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            stats: this.getAppStats(),
            config: CONFIG,
            etfData: ETF_DATA,
            logs: debug.export ? debug.export() : 'Non disponible'
        };

        const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-app-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        debug.success('Données de l\'application exportées');
    }
}

// Initialisation de l'application au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    // Créer l'instance globale de l'application
    window.tradingApp = new TradingApp();
    
    // Fonctions globales pour le débogage (disponibles dans la console)
    window.debugApp = {
        stats: () => window.tradingApp.getAppStats(),
        export: () => window.tradingApp.exportAppData(),
        refresh: () => window.tradingApp.handleRefreshRequest(),
        test: () => window.tradingApp.handleConnectionTest(),
        recovery: () => window.tradingApp.attemptRecovery(),
        notifications: notifications,
        debug: debug,
        api: api,
        ui: ui,
        trading: trading
    };
    
    console.log('🚀 Trading App chargée ! Utilisez window.debugApp pour le débogage.');
});

export default TradingApp;