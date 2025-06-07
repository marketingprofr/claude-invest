import { ETF_DATA, CONFIG } from './config.js';
import { debug } from './debug.js';
import { notifications } from './notifications.js';

// Gestionnaire du portefeuille virtuel et des logs de trading
class PortfolioManager {
    constructor() {
        this.portfolio = {
            currentETF: 'VWCE',
            shares: 0,
            investedValue: 100000, // Valeur initiale
            currentValue: 0,
            totalFees: 0,
            performance: 0,
            performancePercent: 0
        };
        
        this.tradingLogs = [];
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        await this.loadPortfolio();
        this.calculateInitialShares();
        this.isInitialized = true;
        debug.success('Portfolio Manager initialisé');
    }

    // Calcul du nombre d'actions initial
    calculateInitialShares() {
        const etfData = ETF_DATA[this.portfolio.currentETF];
        if (etfData && etfData.price) {
            // Calculer le nombre d'actions qu'on peut acheter avec 100,000€
            this.portfolio.shares = this.portfolio.investedValue / etfData.price;
            this.updateCurrentValue();
            debug.info(`Portefeuille initialisé: ${this.portfolio.shares.toFixed(4)} actions ${this.portfolio.currentETF} à ${etfData.price}€ = ${this.portfolio.currentValue.toFixed(2)}€`);
        } else {
            // Si pas de prix disponible, on utilise un prix de référence pour VWCE
            const referencePrice = 108.50; // Prix de référence pour VWCE
            this.portfolio.shares = this.portfolio.investedValue / referencePrice;
            debug.warning(`Prix non disponible pour ${this.portfolio.currentETF}, utilisation du prix de référence: ${referencePrice}€`);
            debug.info(`Portefeuille initialisé (référence): ${this.portfolio.shares.toFixed(4)} actions ${this.portfolio.currentETF}`);
        }
    }

    // Mise à jour de la valeur actuelle du portefeuille
    updateCurrentValue() {
        const etfData = ETF_DATA[this.portfolio.currentETF];
        if (etfData && etfData.price && this.portfolio.shares > 0) {
            const oldValue = this.portfolio.currentValue;
            this.portfolio.currentValue = this.portfolio.shares * etfData.price;
            this.portfolio.performance = this.portfolio.currentValue - this.portfolio.investedValue;
            this.portfolio.performancePercent = (this.portfolio.performance / this.portfolio.investedValue) * 100;
            
            // Si c'était la première initialisation (currentValue était 0), recalculer
            if (oldValue === 0 && this.portfolio.shares === 0) {
                this.calculateInitialShares();
            }
        }
    }

    // Recalcul des actions avec les nouveaux prix (après refresh)
    recalculateIfNeeded() {
        const etfData = ETF_DATA[this.portfolio.currentETF];
        
        // Si on n'a pas d'actions mais qu'on devrait en avoir (valeur investie > 0)
        if (this.portfolio.shares === 0 && this.portfolio.investedValue > 0 && etfData && etfData.price) {
            debug.info('Recalcul des actions initiales avec les nouveaux prix...');
            this.calculateInitialShares();
            this.savePortfolio();
        } else if (etfData && etfData.price) {
            // Sinon, juste mettre à jour la valeur courante
            this.updateCurrentValue();
        }
    }

    // Exécution d'un trade (vente + achat)
    async executeTrade(targetETF) {
        if (!this.isInitialized) {
            throw new Error('Portfolio non initialisé');
        }

        if (targetETF === this.portfolio.currentETF) {
            throw new Error('Impossible d\'acheter l\'ETF déjà possédé');
        }

        const currentETFData = ETF_DATA[this.portfolio.currentETF];
        const targetETFData = ETF_DATA[targetETF];

        if (!currentETFData || !targetETFData || !currentETFData.price || !targetETFData.price) {
            throw new Error('Données de prix insuffisantes pour effectuer le trade');
        }

        debug.startSection(`TRADE: ${this.portfolio.currentETF} → ${targetETF}`);

        // Calcul de la vente
        const saleValue = this.portfolio.shares * currentETFData.price;
        const availableForPurchase = saleValue - CONFIG.TRADING_FEES;
        
        if (availableForPurchase <= 0) {
            throw new Error('Valeur insuffisante pour couvrir les frais de trading');
        }

        // Calcul de l'achat
        const newShares = availableForPurchase / targetETFData.price;
        const purchaseValue = newShares * targetETFData.price;

        // Création du log de trading
        const tradeLog = {
            id: this.generateTradeId(),
            timestamp: new Date(),
            dateFormatted: new Date().toLocaleString('fr-FR'),
            
            // ETF vendu
            soldETF: this.portfolio.currentETF,
            soldPrice: currentETFData.price,
            soldVariation: currentETFData.changePercent || 0,
            soldShares: this.portfolio.shares,
            soldValue: saleValue,
            
            // ETF acheté
            boughtETF: targetETF,
            boughtPrice: targetETFData.price,
            boughtVariation: targetETFData.changePercent || 0,
            boughtShares: newShares,
            boughtValue: purchaseValue,
            
            // Métadonnées
            tradingFees: CONFIG.TRADING_FEES,
            netValue: purchaseValue, // Valeur nette après l'achat
            previousValue: this.portfolio.currentValue || saleValue,
            valueDifference: purchaseValue - (this.portfolio.currentValue || saleValue),
            
            // Performance
            reason: this.calculateTradeReason(currentETFData, targetETFData),
            expectedGain: this.calculateExpectedGain(currentETFData, targetETFData, saleValue)
        };

        // Mise à jour du portefeuille
        this.portfolio.currentETF = targetETF;
        this.portfolio.shares = newShares;
        this.portfolio.currentValue = purchaseValue;
        this.portfolio.totalFees += CONFIG.TRADING_FEES;
        this.updateCurrentValue();

        // Ajout du log
        this.tradingLogs.push(tradeLog);
        this.savePortfolio();

        debug.success(`Trade exécuté: ${tradeLog.soldShares.toFixed(4)} ${tradeLog.soldETF} → ${tradeLog.boughtShares.toFixed(4)} ${tradeLog.boughtETF}`);
        debug.info(`Valeur: ${saleValue.toFixed(2)}€ → ${purchaseValue.toFixed(2)}€ (différence: ${tradeLog.valueDifference.toFixed(2)}€)`);
        debug.endSection('TRADE');

        // Notification
        notifications.show(
            '✅ Trade Exécuté',
            `${tradeLog.soldETF} → ${tradeLog.boughtETF}\nNouvelles actions: ${newShares.toFixed(4)}\nValeur: ${purchaseValue.toFixed(0)}€`,
            'success'
        );

        return tradeLog;
    }

    // Calcul de la raison du trade
    calculateTradeReason(currentETF, targetETF) {
        const currentVariation = currentETF.changePercent || 0;
        const targetVariation = targetETF.changePercent || 0;
        const delta = currentVariation - targetVariation;
        
        return `Delta: ${delta.toFixed(2)}% (${currentETF.symbol || 'ETF1'}: ${currentVariation.toFixed(2)}% → ${targetETF.symbol || 'ETF2'}: ${targetVariation.toFixed(2)}%)`;
    }

    // Calcul du gain espéré
    calculateExpectedGain(currentETF, targetETF, saleValue) {
        const delta = (currentETF.changePercent || 0) - (targetETF.changePercent || 0);
        const expectedGain = (saleValue * delta / 100) - CONFIG.TRADING_FEES;
        return expectedGain;
    }

    // Génération d'un ID unique pour le trade
    generateTradeId() {
        return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Vérification si un ETF peut être acheté
    canBuyETF(etf) {
        return etf !== this.portfolio.currentETF && 
               ETF_DATA[etf] && 
               ETF_DATA[etf].price !== null &&
               ETF_DATA[etf].price !== undefined;
    }

    // Calcul du gain potentiel d'un trade
    calculatePotentialTrade(targetETF) {
        if (!this.canBuyETF(targetETF)) {
            return null;
        }

        const currentETFData = ETF_DATA[this.portfolio.currentETF];
        const targetETFData = ETF_DATA[targetETF];
        
        if (!currentETFData || !targetETFData || !currentETFData.price || !targetETFData.price) {
            return null;
        }

        const saleValue = this.portfolio.shares * currentETFData.price;
        const availableForPurchase = saleValue - CONFIG.TRADING_FEES;
        const newShares = availableForPurchase / targetETFData.price;
        const newValue = newShares * targetETFData.price;
        const delta = (currentETFData.changePercent || 0) - (targetETFData.changePercent || 0);
        
        return {
            currentValue: saleValue,
            newValue: newValue,
            difference: newValue - saleValue,
            differencePercent: ((newValue - saleValue) / saleValue) * 100,
            newShares: newShares,
            delta: delta,
            fees: CONFIG.TRADING_FEES,
            netGain: newValue - saleValue - CONFIG.TRADING_FEES
        };
    }

    // Statistiques du portefeuille
    getPortfolioStats() {
        this.updateCurrentValue();
        
        const totalTrades = this.tradingLogs.length;
        const profitableTrades = this.tradingLogs.filter(log => log.valueDifference > 0).length;
        const totalVolume = this.tradingLogs.reduce((sum, log) => sum + log.soldValue, 0);
        
        return {
            currentETF: this.portfolio.currentETF,
            shares: this.portfolio.shares,
            currentValue: this.portfolio.currentValue,
            investedValue: this.portfolio.investedValue,
            performance: this.portfolio.performance,
            performancePercent: this.portfolio.performancePercent,
            totalFees: this.portfolio.totalFees,
            totalTrades: totalTrades,
            profitableTrades: profitableTrades,
            successRate: totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0,
            totalVolume: totalVolume,
            averageTradeValue: totalTrades > 0 ? totalVolume / totalTrades : 0
        };
    }

    // Récupération des logs de trading
    getTradingLogs(limit = null) {
        const logs = [...this.tradingLogs].reverse(); // Plus récents en premier
        return limit ? logs.slice(0, limit) : logs;
    }

    // Récupération d'un log spécifique
    getTradeLog(tradeId) {
        return this.tradingLogs.find(log => log.id === tradeId);
    }

    // Suppression d'un log (pour corrections)
    deleteTradeLog(tradeId) {
        const index = this.tradingLogs.findIndex(log => log.id === tradeId);
        if (index >= 0) {
            const deletedLog = this.tradingLogs.splice(index, 1)[0];
            this.savePortfolio();
            debug.info(`Log de trade supprimé: ${deletedLog.id}`);
            return deletedLog;
        }
        return null;
    }

    // Reset du portefeuille
    resetPortfolio() {
        this.portfolio = {
            currentETF: 'VWCE',
            shares: 0,
            investedValue: 100000,
            currentValue: 0,
            totalFees: 0,
            performance: 0,
            performancePercent: 0
        };
        this.tradingLogs = [];
        
        // Recalculer les actions initiales avec le prix actuel si disponible
        this.calculateInitialShares();
        
        this.savePortfolio();
        debug.success('Portefeuille réinitialisé à 100,000€ en VWCE');
    }

    // Sauvegarde du portefeuille en localStorage
    savePortfolio() {
        try {
            const portfolioData = {
                portfolio: this.portfolio,
                tradingLogs: this.tradingLogs,
                lastUpdate: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem('borse-trading-portfolio', JSON.stringify(portfolioData));
            debug.info('Portefeuille sauvegardé');
        } catch (error) {
            debug.warning(`Impossible de sauvegarder le portefeuille: ${error.message}`);
        }
    }

    // Chargement du portefeuille depuis localStorage
    async loadPortfolio() {
        try {
            const savedData = localStorage.getItem('borse-trading-portfolio');
            if (savedData) {
                const portfolioData = JSON.parse(savedData);
                
                if (portfolioData.portfolio) {
                    this.portfolio = { ...this.portfolio, ...portfolioData.portfolio };
                }
                
                if (portfolioData.tradingLogs) {
                    this.tradingLogs = portfolioData.tradingLogs;
                }
                
                debug.success(`Portefeuille chargé: ${this.tradingLogs.length} trades, ETF actuel: ${this.portfolio.currentETF}`);
            } else {
                debug.info('Aucun portefeuille sauvegardé trouvé');
            }
        } catch (error) {
            debug.warning(`Erreur chargement portefeuille: ${error.message}`);
        }
    }

    // Export des données de trading
    exportTradingData() {
        const data = {
            portfolio: this.getPortfolioStats(),
            tradingLogs: this.getTradingLogs(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        debug.success('Données de trading exportées');
        
        return data;
    }

    // Import des données de trading
    async importTradingData(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            if (data.portfolio && data.tradingLogs) {
                this.portfolio = { ...this.portfolio, ...data.portfolio };
                this.tradingLogs = data.tradingLogs;
                this.savePortfolio();
                debug.success(`Données importées: ${this.tradingLogs.length} trades`);
                return true;
            } else {
                throw new Error('Format de données invalide');
            }
        } catch (error) {
            debug.error(`Erreur import: ${error.message}`);
            return false;
        }
    }

    // Simulation de performance sur les trades passés
    simulatePerformance() {
        let simulatedValue = this.portfolio.investedValue;
        const performanceHistory = [];

        this.tradingLogs.forEach((log, index) => {
            const beforeValue = simulatedValue;
            simulatedValue = log.boughtValue;
            
            performanceHistory.push({
                tradeIndex: index + 1,
                date: log.dateFormatted,
                trade: `${log.soldETF} → ${log.boughtETF}`,
                beforeValue: beforeValue,
                afterValue: simulatedValue,
                change: simulatedValue - beforeValue,
                changePercent: ((simulatedValue - beforeValue) / beforeValue) * 100,
                cumulativeReturn: ((simulatedValue - this.portfolio.investedValue) / this.portfolio.investedValue) * 100
            });
        });

        return {
            initialValue: this.portfolio.investedValue,
            finalValue: simulatedValue,
            totalReturn: simulatedValue - this.portfolio.investedValue,
            totalReturnPercent: ((simulatedValue - this.portfolio.investedValue) / this.portfolio.investedValue) * 100,
            totalFees: this.portfolio.totalFees,
            netReturn: simulatedValue - this.portfolio.investedValue - this.portfolio.totalFees,
            history: performanceHistory
        };
    }
}

// Instance globale du gestionnaire de portefeuille
export const portfolioManager = new PortfolioManager();

// Fonctions exportées pour faciliter l'utilisation
export const portfolio = {
    executeTrade: (etf) => portfolioManager.executeTrade(etf),
    canBuy: (etf) => portfolioManager.canBuyETF(etf),
    calculatePotential: (etf) => portfolioManager.calculatePotentialTrade(etf),
    getStats: () => portfolioManager.getPortfolioStats(),
    getLogs: (limit) => portfolioManager.getTradingLogs(limit),
    getLog: (id) => portfolioManager.getTradeLog(id),
    deleteLog: (id) => portfolioManager.deleteTradeLog(id),
    reset: () => portfolioManager.resetPortfolio(),
    export: () => portfolioManager.exportTradingData(),
    import: (data) => portfolioManager.importTradingData(data),
    simulate: () => portfolioManager.simulatePerformance(),
    updateValues: () => portfolioManager.updateCurrentValue(),
    recalculate: () => portfolioManager.recalculateIfNeeded()
};