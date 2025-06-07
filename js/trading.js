import { ETF_DATA, ETF_LIST, CONFIG } from './config.js';
import { debug } from './debug.js';

// Gestionnaire de la logique de trading
class TradingManager {
    constructor() {
        this.lastTradeSignal = null;
        this.tradingHistory = [];
        this.signalCallbacks = [];
    }

    // Calcul des deltas entre ETF
    calculateDeltas(currentStock, portfolioValue) {
        if (!ETF_DATA[currentStock] || 
            ETF_DATA[currentStock].changePercent === null || 
            ETF_DATA[currentStock].changePercent === undefined) {
            debug.warning(`Pas de données de variation pour ${currentStock}`);
            return [];
        }

        const currentVariation = ETF_DATA[currentStock].changePercent;
        const deltas = [];

        ETF_LIST.forEach(etf => {
            if (etf === currentStock) return;
            
            if (!ETF_DATA[etf] || 
                ETF_DATA[etf].changePercent === null || 
                ETF_DATA[etf].changePercent === undefined) {
                debug.warning(`Pas de données de variation pour ${etf}`);
                return;
            }

            const otherVariation = ETF_DATA[etf].changePercent;
            const delta = currentVariation - otherVariation;
            
            deltas.push({
                targetEtf: etf,
                delta,
                currentVariation,
                targetVariation: otherVariation,
                currentPrice: ETF_DATA[currentStock].price || 0,
                targetPrice: ETF_DATA[etf].price || 0,
                potentialGain: this.calculatePotentialGain(delta, portfolioValue),
                netGain: this.calculateNetGain(delta, portfolioValue),
                confidence: this.calculateConfidence(delta, currentVariation, otherVariation)
            });
        });

        // Trier par delta décroissant
        return deltas.sort((a, b) => b.delta - a.delta);
    }

    // Calcul du gain potentiel brut
    calculatePotentialGain(delta, portfolioValue) {
        return (portfolioValue * delta) / 100;
    }

    // Calcul du gain net (après frais)
    calculateNetGain(delta, portfolioValue) {
        return this.calculatePotentialGain(delta, portfolioValue) - CONFIG.TRADING_FEES;
    }

    // Calcul du niveau de confiance du signal
    calculateConfidence(delta, currentVar, targetVar) {
        // Plus le delta est élevé, plus la confiance est haute
        // Facteur supplémentaire si les variations sont dans des directions opposées
        let confidence = Math.min(Math.abs(delta) / 2, 100); // Base sur le delta
        
        // Bonus si les variations sont opposées (l'une monte, l'autre descend)
        if ((currentVar > 0 && targetVar < 0) || (currentVar < 0 && targetVar > 0)) {
            confidence += 20;
        }
        
        // Bonus pour des deltas très élevés
        if (Math.abs(delta) > 1.0) {
            confidence += 15;
        }
        
        return Math.min(confidence, 100);
    }

    // Génération de la recommandation principale
    generateRecommendation(currentStock, portfolioValue) {
        const deltas = this.calculateDeltas(currentStock, portfolioValue);
        
        if (deltas.length === 0) {
            debug.warning('Aucun delta calculable - données insuffisantes');
            return null;
        }

        const bestDelta = deltas.find(d => d.delta > CONFIG.TRADING_THRESHOLD);
        
        if (bestDelta) {
            debug.success(`Signal de trade détecté: ${currentStock} → ${bestDelta.targetEtf} (Delta: ${bestDelta.delta.toFixed(2)}%)`);
            
            return {
                action: 'trade',
                fromETF: currentStock,
                toETF: bestDelta.targetEtf,
                delta: bestDelta.delta,
                currentVariation: bestDelta.currentVariation,
                targetVariation: bestDelta.targetVariation,
                potentialGain: bestDelta.potentialGain,
                netGain: bestDelta.netGain,
                confidence: bestDelta.confidence,
                timestamp: new Date(),
                reason: `Delta de ${bestDelta.delta.toFixed(2)}% supérieur au seuil de ${CONFIG.TRADING_THRESHOLD}%`
            };
        } else {
            const topDelta = deltas[0];
            debug.info(`Pas de signal de trade - meilleur delta: ${topDelta.delta.toFixed(2)}% (< ${CONFIG.TRADING_THRESHOLD}%)`);
            
            return {
                action: 'hold',
                currentETF: currentStock,
                bestDelta: topDelta.delta,
                reason: `Meilleur delta de ${topDelta.delta.toFixed(2)}% inférieur au seuil de ${CONFIG.TRADING_THRESHOLD}%`,
                timestamp: new Date()
            };
        }
    }

    // Analyse complète du marché
    analyzeMarket(currentStock, portfolioValue) {
        debug.startSection('ANALYSE DE MARCHÉ');
        
        const deltas = this.calculateDeltas(currentStock, portfolioValue);
        const recommendation = this.generateRecommendation(currentStock, portfolioValue);
        
        // Vérifier si c'est un nouveau signal de trade
        this.checkForNewTradeSignal(recommendation);
        
        // Statistiques du marché
        const marketStats = this.calculateMarketStats(deltas);
        
        debug.info(`Nombre d'ETF analysés: ${deltas.length + 1}`);
        debug.info(`Delta moyen: ${marketStats.averageDelta.toFixed(2)}%`);
        debug.info(`Delta maximum: ${marketStats.maxDelta.toFixed(2)}%`);
        debug.info(`Opportunités de trade: ${marketStats.tradeOpportunities}`);
        
        debug.endSection('ANALYSE DE MARCHÉ');
        
        return {
            deltas,
            recommendation,
            marketStats,
            timestamp: new Date()
        };
    }

    // Calcul des statistiques de marché
    calculateMarketStats(deltas) {
        if (deltas.length === 0) {
            return {
                averageDelta: 0,
                maxDelta: 0,
                minDelta: 0,
                tradeOpportunities: 0,
                volatility: 0
            };
        }

        const deltaValues = deltas.map(d => d.delta);
        const sum = deltaValues.reduce((a, b) => a + b, 0);
        const average = sum / deltaValues.length;
        const max = Math.max(...deltaValues);
        const min = Math.min(...deltaValues);
        const tradeOpportunities = deltas.filter(d => d.delta > CONFIG.TRADING_THRESHOLD).length;
        
        // Calcul de la volatilité (écart-type)
        const variance = deltaValues.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / deltaValues.length;
        const volatility = Math.sqrt(variance);

        return {
            averageDelta: average,
            maxDelta: max,
            minDelta: min,
            tradeOpportunities,
            volatility,
            totalETFs: deltas.length + 1
        };
    }

    // Vérification d'un nouveau signal de trade
    checkForNewTradeSignal(recommendation) {
        if (!recommendation || recommendation.action !== 'trade') {
            if (this.lastTradeSignal) {
                debug.info('Signal de trade précédent expiré');
                this.lastTradeSignal = null;
            }
            return false;
        }

        const currentSignal = `${recommendation.fromETF}->${recommendation.toETF}`;
        
        if (currentSignal !== this.lastTradeSignal) {
            debug.success(`🚨 NOUVEAU SIGNAL DE TRADE: ${currentSignal}`);
            this.lastTradeSignal = currentSignal;
            
            // Enregistrer dans l'historique
            this.tradingHistory.push({
                ...recommendation,
                signalId: `${Date.now()}-${currentSignal}`,
                isNew: true
            });
            
            // Notifier les callbacks
            this.notifySignalCallbacks(recommendation);
            
            return true;
        }
        
        return false;
    }

    // Enregistrement d'un callback pour les signaux
    onTradeSignal(callback) {
        if (typeof callback === 'function') {
            this.signalCallbacks.push(callback);
        }
    }

    // Notification des callbacks de signaux
    notifySignalCallbacks(recommendation) {
        this.signalCallbacks.forEach(callback => {
            try {
                callback(recommendation);
            } catch (error) {
                debug.error(`Erreur dans callback de signal: ${error.message}`);
            }
        });
    }

    // Simulation d'un trade (pour analyse)
    simulateTrade(fromETF, toETF, portfolioValue) {
        const fromData = ETF_DATA[fromETF];
        const toData = ETF_DATA[toETF];
        
        if (!fromData || !toData || !fromData.price || !toData.price) {
            throw new Error('Données insuffisantes pour simuler le trade');
        }

        const sharesFrom = portfolioValue / fromData.price;
        const valueAfterSale = sharesFrom * fromData.price - CONFIG.TRADING_FEES / 2; // Frais de vente
        const sharesTo = valueAfterSale / toData.price;
        const finalValue = sharesTo * toData.price - CONFIG.TRADING_FEES / 2; // Frais d'achat
        
        const totalFees = CONFIG.TRADING_FEES;
        const netChange = finalValue - portfolioValue;
        
        return {
            fromETF,
            toETF,
            originalValue: portfolioValue,
            finalValue,
            netChange,
            totalFees,
            sharesFrom,
            sharesTo,
            fromPrice: fromData.price,
            toPrice: toData.price,
            profitPercent: (netChange / portfolioValue) * 100
        };
    }

    // Analyse de performance historique
    getPerformanceAnalysis() {
        if (this.tradingHistory.length === 0) {
            return {
                totalSignals: 0,
                successfulTrades: 0,
                averageGain: 0,
                bestTrade: null,
                worstTrade: null
            };
        }

        const tradeSignals = this.tradingHistory.filter(h => h.action === 'trade');
        const totalSignals = tradeSignals.length;
        const successfulTrades = tradeSignals.filter(t => t.netGain > 0).length;
        
        const gains = tradeSignals.map(t => t.netGain);
        const averageGain = gains.reduce((a, b) => a + b, 0) / gains.length;
        
        const bestTrade = tradeSignals.reduce((best, current) => 
            current.netGain > (best?.netGain || -Infinity) ? current : best, null);
        
        const worstTrade = tradeSignals.reduce((worst, current) => 
            current.netGain < (worst?.netGain || Infinity) ? current : worst, null);

        return {
            totalSignals,
            successfulTrades,
            successRate: (successfulTrades / totalSignals) * 100,
            averageGain,
            bestTrade,
            worstTrade,
            totalProfit: gains.reduce((a, b) => a + b, 0)
        };
    }

    // Optimisation des seuils de trading
    optimizeThreshold(testPeriodData) {
        const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
        const results = [];

        thresholds.forEach(threshold => {
            let totalProfit = 0;
            let tradeCount = 0;

            testPeriodData.forEach(dataPoint => {
                const deltas = this.calculateDeltas(dataPoint.currentStock, dataPoint.portfolioValue);
                const signals = deltas.filter(d => d.delta > threshold);
                
                signals.forEach(signal => {
                    totalProfit += signal.netGain;
                    tradeCount++;
                });
            });

            results.push({
                threshold,
                totalProfit,
                tradeCount,
                averageProfit: tradeCount > 0 ? totalProfit / tradeCount : 0,
                profitPerTrade: totalProfit / Math.max(tradeCount, 1)
            });
        });

        // Trier par profit total
        results.sort((a, b) => b.totalProfit - a.totalProfit);
        
        debug.info('Optimisation des seuils de trading:');
        results.slice(0, 3).forEach((result, index) => {
            debug.info(`${index + 1}. Seuil ${result.threshold}%: ${result.totalProfit.toFixed(0)}€ (${result.tradeCount} trades)`);
        });

        return results[0]; // Meilleur seuil
    }

    // Reset de l'état de trading
    reset() {
        this.lastTradeSignal = null;
        this.tradingHistory = [];
        debug.info('État de trading réinitialisé');
    }

    // Obtenir les statistiques actuelles
    getStats() {
        return {
            lastTradeSignal: this.lastTradeSignal,
            tradingHistoryLength: this.tradingHistory.length,
            signalCallbacksCount: this.signalCallbacks.length,
            currentThreshold: CONFIG.TRADING_THRESHOLD,
            tradingFees: CONFIG.TRADING_FEES
        };
    }

    // Export des données pour analyse
    exportTradingData() {
        return {
            history: [...this.tradingHistory],
            stats: this.getStats(),
            performance: this.getPerformanceAnalysis(),
            config: {
                threshold: CONFIG.TRADING_THRESHOLD,
                fees: CONFIG.TRADING_FEES
            },
            exportTimestamp: new Date().toISOString()
        };
    }
}

// Instance globale du gestionnaire de trading
export const tradingManager = new TradingManager();

// Fonctions de trading exportées pour faciliter l'utilisation
export const trading = {
    analyze: (currentStock, portfolioValue) => tradingManager.analyzeMarket(currentStock, portfolioValue),
    calculateDeltas: (currentStock, portfolioValue) => tradingManager.calculateDeltas(currentStock, portfolioValue),
    generateRecommendation: (currentStock, portfolioValue) => tradingManager.generateRecommendation(currentStock, portfolioValue),
    simulateTrade: (from, to, value) => tradingManager.simulateTrade(from, to, value),
    onSignal: (callback) => tradingManager.onTradeSignal(callback),
    getPerformance: () => tradingManager.getPerformanceAnalysis(),
    getStats: () => tradingManager.getStats(),
    reset: () => tradingManager.reset(),
    export: () => tradingManager.exportTradingData(),
    optimize: (testData) => tradingManager.optimizeThreshold(testData)
};