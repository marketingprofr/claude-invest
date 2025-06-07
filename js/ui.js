import { ETF_DATA, ETF_LIST, CONFIG } from './config.js';
import { debug } from './debug.js';

// Gestionnaire de l'interface utilisateur
class UIManager {
    constructor() {
        this.elements = {};
        this.state = {
            currentStock: 'VWCE',
            portfolioValue: 100000,
            isLoading: false,
            lastRefresh: null
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.updateCurrentDate();
        this.initializeUI();
    }

    // Cache des éléments DOM fréquemment utilisés
    cacheElements() {
        this.elements = {
            currentDate: document.getElementById('current-date'),
            currentStock: document.getElementById('current-stock'),
            portfolioValue: document.getElementById('portfolio-value'),
            refreshBtn: document.getElementById('refresh-btn'),
            testConnectionBtn: document.getElementById('test-connection-btn'),
            lastRefresh: document.getElementById('last-refresh'),
            headerCurrentStock: document.getElementById('header-current-stock'),
            etfTableBody: document.getElementById('etf-table-body'),
            recommendationSection: document.getElementById('recommendation-section'),
            recommendationContent: document.getElementById('recommendation-content'),
            deltasSection: document.getElementById('deltas-section'),
            deltasTableBody: document.getElementById('deltas-table-body')
        };
    }

    // Configuration des écouteurs d'événements
    setupEventListeners() {
        // Changement de l'ETF actuel
        if (this.elements.currentStock) {
            this.elements.currentStock.addEventListener('change', (e) => {
                this.handleStockChange(e.target.value);
            });
        }

        // Changement de la valeur du portefeuille
        if (this.elements.portfolioValue) {
            this.elements.portfolioValue.addEventListener('input', (e) => {
                this.handlePortfolioValueChange(parseFloat(e.target.value) || 100000);
            });
        }

        // Boutons
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => {
                this.dispatchEvent('refresh-requested');
            });
        }

        if (this.elements.testConnectionBtn) {
            this.elements.testConnectionBtn.addEventListener('click', () => {
                this.dispatchEvent('test-connection-requested');
            });
        }

        // Écouteur délégué pour les boutons d'achat ETF
        document.addEventListener('click', (e) => {
            if (e.target.closest('.buy-etf-btn')) {
                const button = e.target.closest('.buy-etf-btn');
                const etf = button.dataset.etf;
                const price = parseFloat(button.dataset.price);
                this.handleBuyETF(etf, price);
            }
        });

        // Écouteurs pour les boutons de logs
        document.addEventListener('click', (e) => {
            if (e.target.closest('#show-logs-btn')) {
                this.showLogsModal();
            }
            if (e.target.closest('#export-logs-btn')) {
                this.handleExportLogs();
            }
            if (e.target.closest('#reset-portfolio-btn')) {
                this.handleResetPortfolio();
            }
        });
    }

    // Initialisation de l'interface
    initializeUI() {
        this.updateHeaderStock();
        this.renderETFTable();
        this.hideRecommendations();
        lucide.createIcons();
    }

    // Mise à jour de la date actuelle
    updateCurrentDate() {
        if (this.elements.currentDate) {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            this.elements.currentDate.textContent = now.toLocaleDateString('fr-FR', options);
        }
    }

    // Gestion du changement d'ETF
    handleStockChange(newStock) {
        this.state.currentStock = newStock;
        this.updateHeaderStock();
        this.renderETFTable();
        this.dispatchEvent('stock-changed', { newStock });
        debug.info(`ETF sélectionné changé vers: ${newStock}`);
    }

    // Gestion du changement de valeur du portefeuille
    handlePortfolioValueChange(newValue) {
        this.state.portfolioValue = newValue;
        this.dispatchEvent('portfolio-changed', { newValue });
        debug.info(`Valeur portefeuille changée: ${newValue}€`);
    }

    // Mise à jour de l'en-tête avec l'ETF actuel
    updateHeaderStock() {
        if (this.elements.headerCurrentStock) {
            this.elements.headerCurrentStock.textContent = this.state.currentStock;
        }
    }

    // Rendu du tableau des ETF
    renderETFTable() {
        if (!this.elements.etfTableBody) return;
        
        this.elements.etfTableBody.innerHTML = '';

        ETF_LIST.forEach((etf, index) => {
            const data = ETF_DATA[etf] || {};
            const row = this.createETFTableRow(etf, data, index);
            this.elements.etfTableBody.appendChild(row);
        });
    }

    // Création d'une ligne du tableau ETF
    createETFTableRow(etf, data, index) {
        // Calcul du delta
        let delta = null;
        if (this.state.currentStock !== etf && 
            data.changePercent !== null && data.changePercent !== undefined && 
            ETF_DATA[this.state.currentStock] && 
            ETF_DATA[this.state.currentStock].changePercent !== null && 
            ETF_DATA[this.state.currentStock].changePercent !== undefined) {
            delta = ETF_DATA[this.state.currentStock].changePercent - data.changePercent;
        }

        const row = document.createElement('tr');
        row.className = etf === this.state.currentStock ? 
            'bg-green-50' : 
            (index % 2 === 0 ? 'bg-gray-50' : 'bg-white');

        row.innerHTML = this.getETFRowHTML(etf, data, delta);
        return row;
    }

    // HTML pour une ligne ETF
    getETFRowHTML(etf, data, delta) {
        return `
            <td class="border border-gray-300 px-4 py-3">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-bold text-lg ${etf === this.state.currentStock ? 'text-green-600' : 'text-gray-800'}">${etf}</span>
                        <div class="text-xs text-gray-500">${data.name || 'ETF Européen'}</div>
                        <div class="text-xs text-gray-400">ISIN: ${data.isin || ''} | WKN: ${data.wkn || ''}</div>
                    </div>
                    ${etf === this.state.currentStock ? '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded-full">DÉTENU</span>' : ''}
                </div>
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center">
                <span class="font-bold text-lg">${data.price ? `${data.price.toFixed(2)}€` : '-'}</span>
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center">
                ${this.getChangeHTML(data)}
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center">
                ${this.getDeltaHTML(etf, delta)}
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center">
                ${this.getUpdateHTML(data)}
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center">
                ${this.getBuyButtonHTML(etf, data)}
            </td>
        `;
    }

    // HTML pour la variation de prix
    getChangeHTML(data) {
        if (data.changePercent !== null && data.changePercent !== undefined) {
            return `
                <span class="font-semibold ${data.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%
                </span>
                <div class="text-xs text-gray-500">
                    ${data.change ? `(${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}€)` : ''}
                </div>
            `;
        }
        return '<span class="text-gray-400">-</span>';
    }

    // HTML pour le delta
    getDeltaHTML(etf, delta) {
        if (etf === this.state.currentStock) {
            return '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">RÉFÉRENCE</span>';
        }
        
        if (delta !== null) {
            const isHighDelta = delta >= CONFIG.TRADING_THRESHOLD;
            return `
                <span class="font-bold text-xl ${isHighDelta ? 'text-green-600 animate-pulse' : 'text-gray-600'}">
                    ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%
                    ${isHighDelta ? '<span class="ml-1">🚀</span>' : ''}
                </span>
                <div class="text-xs text-gray-500">écart performances</div>
            `;
        }
        
        return '<span class="text-gray-400">-</span>';
    }

    // HTML pour la dernière mise à jour
    getUpdateHTML(data) {
        if (data.lastUpdate) {
            return `<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">✓ ${data.lastUpdate}</span>`;
        }
        return '<span class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">✗ Pas de données</span>';
    }

    // HTML pour le bouton d'achat
    getBuyButtonHTML(etf, data) {
        // Importer portfolio de manière dynamique pour éviter la dépendance circulaire
        const isCurrentETF = etf === this.state.currentStock;
        const hasPrice = data.price !== null && data.price !== undefined;
        
        if (isCurrentETF) {
            return `<button class="px-3 py-2 bg-gray-300 text-gray-500 rounded-lg text-sm font-semibold cursor-not-allowed" disabled>
                        Déjà détenu
                    </button>`;
        }
        
        if (!hasPrice) {
            return `<button class="px-3 py-2 bg-gray-300 text-gray-500 rounded-lg text-sm font-semibold cursor-not-allowed" disabled>
                        Prix indisponible
                    </button>`;
        }
        
        return `<button 
                    class="buy-etf-btn px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors duration-200 flex items-center gap-1" 
                    data-etf="${etf}"
                    data-price="${data.price}"
                >
                    <i data-lucide="shopping-cart" class="w-4 h-4"></i>
                    Acheter
                </button>`;
    }

    // Mise à jour du statut de l'API
    updateAPIStatus(status, details = {}) {
        // Cette fonction peut être étendue pour afficher un indicateur de statut
        const statusMessages = {
            connected: 'Börse Frankfurt OK',
            loading: 'Chargement...',
            partial: 'Données Partielles',
            error: 'Erreur Connexion',
            disconnected: 'Déconnecté'
        };

        debug.info(`Statut API: ${statusMessages[status] || status}`);
    }

    // Mise à jour du bouton de rafraîchissement
    updateRefreshButton(loading) {
        if (!this.elements.refreshBtn) return;
        
        const icon = this.elements.refreshBtn.querySelector('i');
        
        this.state.isLoading = loading;
        this.elements.refreshBtn.disabled = loading;
        
        if (loading) {
            if (icon) {
                icon.className = 'w-5 h-5 mr-2 animate-spin';
                icon.setAttribute('data-lucide', 'refresh-cw');
            }
            this.elements.refreshBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5 mr-2 animate-spin"></i>Chargement...';
        } else {
            this.elements.refreshBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5 mr-2"></i>Actualiser les Cours';
        }
        
        lucide.createIcons();
    }

    // Mise à jour de l'horodatage du dernier rafraîchissement
    updateLastRefresh() {
        if (this.elements.lastRefresh) {
            this.state.lastRefresh = new Date().toLocaleTimeString('fr-FR');
            this.elements.lastRefresh.textContent = `Mise à jour: ${this.state.lastRefresh}`;
        }
    }

    // Affichage des recommandations
    showRecommendations(recommendation, deltas) {
        if (this.elements.recommendationSection) {
            this.elements.recommendationSection.style.display = 'block';
            this.elements.recommendationSection.classList.add('fade-in');
        }
        
        if (this.elements.deltasSection) {
            this.elements.deltasSection.style.display = 'block';
            this.elements.deltasSection.classList.add('fade-in');
        }

        this.renderRecommendation(recommendation);
        this.renderDeltasTable(deltas);
    }

    // Masquage des recommandations
    hideRecommendations() {
        if (this.elements.recommendationSection) {
            this.elements.recommendationSection.style.display = 'none';
        }
        
        if (this.elements.deltasSection) {
            this.elements.deltasSection.style.display = 'none';
        }
    }

    // Rendu de la recommandation principale
    renderRecommendation(recommendation) {
        if (!this.elements.recommendationContent || !recommendation) return;

        if (recommendation.action === 'trade') {
            this.elements.recommendationContent.innerHTML = this.getTradeRecommendationHTML(recommendation);
        } else {
            this.elements.recommendationContent.innerHTML = this.getHoldRecommendationHTML(recommendation);
        }
        
        lucide.createIcons();
    }

    // HTML pour une recommandation de trade
    getTradeRecommendationHTML(rec) {
        return `
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6">
                <div class="flex items-center justify-center mb-4">
                    <div class="bg-green-600 text-white px-6 py-3 rounded-full text-xl font-bold animate-pulse">
                        🚨 SIGNAL DE TRADE DÉTECTÉ !
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white rounded-lg p-4 border border-green-200">
                        <h3 class="font-semibold text-green-800 mb-3">🏛️ Action Immédiate (Börse Frankfurt)</h3>
                        <div class="text-2xl font-bold text-green-700 mb-2">VENDRE ${rec.fromETF} et ACHETER ${rec.toETF}</div>
                        <div class="text-sm text-green-600 space-y-1">
                            <div>Delta de performance: <span class="font-semibold">${rec.delta.toFixed(2)}%</span> (&gt; ${CONFIG.TRADING_THRESHOLD}%)</div>
                            <div>${rec.fromETF}: <span class="font-semibold ${rec.currentVariation >= 0 ? 'text-green-600' : 'text-red-600'}">${rec.currentVariation >= 0 ? '+' : ''}${rec.currentVariation.toFixed(2)}%</span></div>
                            <div>${rec.toETF}: <span class="font-semibold ${rec.targetVariation >= 0 ? 'text-green-600' : 'text-red-600'}">${rec.targetVariation >= 0 ? '+' : ''}${rec.targetVariation.toFixed(2)}%</span></div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-green-200">
                        <h3 class="font-semibold text-green-800 mb-3">💰 Impact Financier</h3>
                        <div class="space-y-3">
                            <div class="bg-blue-50 p-3 rounded">
                                <div class="text-sm text-blue-700">Gain potentiel:</div>
                                <div class="text-lg font-bold text-blue-600">+${rec.potentialGain.toFixed(0)}€</div>
                            </div>
                            <div class="bg-red-50 p-3 rounded">
                                <div class="text-sm text-red-700">Frais de trading:</div>
                                <div class="text-lg font-bold text-red-600">-${CONFIG.TRADING_FEES}€</div>
                            </div>
                            <div class="bg-green-50 p-3 rounded">
                                <div class="text-sm text-green-700">Gain net estimé:</div>
                                <div class="text-xl font-bold text-green-600">+${rec.netGain.toFixed(0)}€</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // HTML pour une recommandation de conservation
    getHoldRecommendationHTML(rec) {
        return `
            <div class="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-6">
                <div class="flex items-center justify-center mb-4">
                    <div class="bg-yellow-600 text-white px-6 py-3 rounded-full text-xl font-bold flex items-center">
                        <i data-lucide="check-circle" class="w-6 h-6 mr-2"></i>
                        PATIENCE - CONSERVER
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-yellow-700 mb-2">CONSERVER ${rec.currentETF}</div>
                    <div class="text-yellow-600">Meilleur delta: ${rec.bestDelta ? rec.bestDelta.toFixed(2) : '0.00'}% (< ${CONFIG.TRADING_THRESHOLD}%)</div>
                    <div class="text-sm text-yellow-600 mt-2">Données via Börse Frankfurt</div>
                </div>
            </div>
        `;
    }

    // Rendu du tableau des deltas
    renderDeltasTable(deltas) {
        if (!this.elements.deltasTableBody || !deltas) return;
        
        this.elements.deltasTableBody.innerHTML = '';

        deltas.forEach((delta, index) => {
            const row = this.createDeltaTableRow(delta, index);
            this.elements.deltasTableBody.appendChild(row);
        });
    }

    // Création d'une ligne du tableau des deltas
    createDeltaTableRow(delta, index) {
        const potentialGain = (this.state.portfolioValue * delta.delta / 100) - CONFIG.TRADING_FEES;
        const row = document.createElement('tr');
        row.className = delta.delta > CONFIG.TRADING_THRESHOLD ? 
            'bg-green-50' : 
            (index % 2 === 0 ? 'bg-gray-50' : 'bg-white');

        row.innerHTML = `
            <td class="border border-gray-300 px-4 py-3 font-semibold">
                #${index + 1}
                ${delta.delta > CONFIG.TRADING_THRESHOLD ? '<span class="ml-2">🎯</span>' : ''}
            </td>
            <td class="border border-gray-300 px-4 py-3">
                <div>
                    <span class="font-semibold">${this.state.currentStock} → ${delta.targetEtf}</span>
                    <div class="text-xs text-gray-500">
                        ${this.state.currentStock}: ${delta.currentVariation >= 0 ? '+' : ''}${delta.currentVariation.toFixed(2)}% → 
                        ${delta.targetEtf}: ${delta.targetVariation >= 0 ? '+' : ''}${delta.targetVariation.toFixed(2)}%
                    </div>
                    <div class="text-xs text-blue-600">Via Börse Frankfurt</div>
                </div>
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center font-bold text-xl ${delta.delta > CONFIG.TRADING_THRESHOLD ? 'text-green-600' : 'text-gray-600'}">
                ${delta.delta >= 0 ? '+' : ''}${delta.delta.toFixed(2)}%
                <div class="text-xs text-gray-500 font-normal">écart performance</div>
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center">
                ${delta.delta > CONFIG.TRADING_THRESHOLD ? 
                    '<span class="px-3 py-2 bg-green-100 text-green-800 rounded-full font-bold animate-pulse">🚀 TRADER MAINTENANT</span>' :
                    '<span class="px-3 py-2 bg-gray-100 text-gray-600 rounded-full">⏳ Attendre</span>'
                }
            </td>
            <td class="border border-gray-300 px-4 py-3 text-center font-bold ${potentialGain > 0 ? 'text-green-600' : 'text-red-600'}">
                ${potentialGain > 0 ? '+' : ''}${potentialGain.toFixed(0)}€
            </td>
        `;

        return row;
    }

    // Affichage d'un message à l'utilisateur
    showMessage(message, type = 'info') {
        alert(message); // Simple pour l'instant, peut être amélioré avec des modales
    }

    // Gestion de l'achat d'ETF
    async handleBuyETF(etf, price) {
        try {
            // Import dynamique pour éviter la dépendance circulaire
            const { portfolio } = await import('./portfolio.js');
            
            // Confirmation de l'achat
            const confirmed = confirm(
                `Confirmer l'achat de ${etf} ?\n\n` +
                `Cette action va :\n` +
                `• Vendre toutes vos actions de ${portfolio.getStats().currentETF}\n` +
                `• Acheter ${etf} au prix de ${price}€\n` +
                `• Prélever 50€ de frais de courtage\n\n` +
                `Continuer ?`
            );

            if (!confirmed) return;

            debug.info(`Tentative d'achat de ${etf} au prix de ${price}€`);
            
            // Exécution du trade
            const tradeLog = await portfolio.executeTrade(etf);
            
            // Mise à jour de l'interface
            this.state.currentStock = etf;
            this.updateHeaderStock();
            this.renderETFTable();
            this.updatePortfolioDisplay();
            
            // Affichage du résultat
            this.showTradeResult(tradeLog);
            
            debug.success(`Achat de ${etf} réussi`);
            
        } catch (error) {
            debug.error(`Erreur lors de l'achat de ${etf}: ${error.message}`);
            alert(`Erreur: ${error.message}`);
        }
    }

    // Affichage du résultat d'un trade
    showTradeResult(tradeLog) {
        const resultMessage = `
            🎉 Trade Exécuté avec Succès !

            📊 Détails du trade :
            • Vendu: ${tradeLog.soldShares.toFixed(4)} actions de ${tradeLog.soldETF} à ${tradeLog.soldPrice.toFixed(2)}€
            • Valeur de vente: ${tradeLog.soldValue.toFixed(2)}€
            
            • Acheté: ${tradeLog.boughtShares.toFixed(4)} actions de ${tradeLog.boughtETF} à ${tradeLog.boughtPrice.toFixed(2)}€
            • Valeur d'achat: ${tradeLog.boughtValue.toFixed(2)}€
            
            💰 Résultat :
            • Frais de courtage: ${tradeLog.tradingFees}€
            • Différence de valeur: ${tradeLog.valueDifference > 0 ? '+' : ''}${tradeLog.valueDifference.toFixed(2)}€
            
            📈 Performance :
            ${tradeLog.reason}
        `;
        
        alert(resultMessage);
    }

    // Mise à jour de l'affichage du portefeuille
    async updatePortfolioDisplay() {
        try {
            const { portfolio } = await import('./portfolio.js');
            const stats = portfolio.getStats();
            
            // Mise à jour des informations de portefeuille dans l'en-tête
            const portfolioInfo = document.getElementById('portfolio-info');
            if (portfolioInfo) {
                portfolioInfo.innerHTML = this.getPortfolioInfoHTML(stats);
            }
            
        } catch (error) {
            debug.warning(`Erreur mise à jour portefeuille: ${error.message}`);
        }
    }

    // HTML pour les informations de portefeuille
    getPortfolioInfoHTML(stats) {
        return `
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <h3 class="font-semibold text-blue-800 mb-3">💼 Portefeuille Virtuel</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div class="text-blue-600 font-medium">ETF Détenu</div>
                        <div class="font-bold text-lg">${stats.currentETF}</div>
                        <div class="text-xs text-gray-500">
                            ${stats.shares > 0 ? `${stats.shares.toFixed(4)} actions` : 'En attente du prix...'}
                        </div>
                    </div>
                    <div>
                        <div class="text-blue-600 font-medium">Valeur Actuelle</div>
                        <div class="font-bold text-lg">
                            ${stats.shares > 0 ? `${stats.currentValue.toFixed(0)}€` : '100,000€'}
                        </div>
                        <div class="text-xs ${stats.performance >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${stats.shares > 0 ? 
                                `${stats.performance >= 0 ? '+' : ''}${stats.performance.toFixed(0)}€ (${stats.performancePercent.toFixed(1)}%)` : 
                                'Valeur initiale'
                            }
                        </div>
                    </div>
                    <div>
                        <div class="text-blue-600 font-medium">Trades</div>
                        <div class="font-bold text-lg">${stats.totalTrades}</div>
                        <div class="text-xs text-gray-500">
                            ${stats.totalTrades > 0 ? `${stats.successRate.toFixed(1)}% réussis` : 'Aucun trade'}
                        </div>
                    </div>
                    <div>
                        <div class="text-blue-600 font-medium">Frais Totaux</div>
                        <div class="font-bold text-lg text-red-600">${stats.totalFees}€</div>
                        <div class="text-xs text-gray-500">
                            ${stats.totalTrades} transaction${stats.totalTrades > 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
                <div class="mt-3 text-xs ${stats.shares > 0 ? 'text-green-700 bg-green-100' : 'text-blue-700 bg-blue-100'} p-2 rounded">
                    ${stats.shares > 0 ? 
                        `✅ <strong>Portefeuille actif:</strong> ${stats.shares.toFixed(4)} actions ${stats.currentETF} d'une valeur de ${stats.currentValue.toFixed(0)}€` :
                        `⏳ <strong>Initialisation:</strong> Portefeuille de 100,000€ en ${stats.currentETF}. Actualisez les cours pour calculer les actions.`
                    }
                </div>
                <div class="mt-3 flex gap-2">
                    <button id="show-logs-btn" class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1">
                        <i data-lucide="list" class="w-3 h-3"></i>
                        Voir Logs
                    </button>
                    <button id="export-logs-btn" class="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1">
                        <i data-lucide="download" class="w-3 h-3"></i>
                        Export
                    </button>
                    <button id="reset-portfolio-btn" class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center gap-1">
                        <i data-lucide="refresh-ccw" class="w-3 h-3"></i>
                        Reset
                    </button>
                </div>
            </div>
        `;
    }

    // Affichage de la modal des logs
    async showLogsModal() {
        try {
            const { portfolio } = await import('./portfolio.js');
            const logs = portfolio.getLogs(20); // 20 derniers trades
            
            this.createLogsModal(logs);
            
        } catch (error) {
            debug.error(`Erreur affichage logs: ${error.message}`);
            alert(`Erreur: ${error.message}`);
        }
    }

    // Création de la modal des logs
    createLogsModal(logs) {
        // Supprimer une modal existante
        const existingModal = document.getElementById('logs-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'logs-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b">
                    <h2 class="text-xl font-bold text-gray-800">📊 Historique des Trades</h2>
                    <button id="close-logs-modal" class="text-gray-500 hover:text-gray-700">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>
                <div class="p-4 overflow-y-auto max-h-[70vh]">
                    ${logs.length > 0 ? this.getLogsTableHTML(logs) : '<p class="text-center text-gray-500">Aucun trade effectué</p>'}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        lucide.createIcons();

        // Événements de la modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('#close-logs-modal')) {
                modal.remove();
            }
        });
    }

    // HTML pour le tableau des logs
    getLogsTableHTML(logs) {
        return `
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border border-gray-300 px-3 py-2 text-left">Date</th>
                            <th class="border border-gray-300 px-3 py-2 text-left">Trade</th>
                            <th class="border border-gray-300 px-3 py-2 text-center">ETF Vendu</th>
                            <th class="border border-gray-300 px-3 py-2 text-center">ETF Acheté</th>
                            <th class="border border-gray-300 px-3 py-2 text-center">Résultat</th>
                            <th class="border border-gray-300 px-3 py-2 text-center">Raison</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => this.getLogRowHTML(log)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // HTML pour une ligne de log
    getLogRowHTML(log) {
        return `
            <tr class="hover:bg-gray-50">
                <td class="border border-gray-300 px-3 py-2">
                    <div class="font-medium">${log.dateFormatted.split(' ')[0]}</div>
                    <div class="text-xs text-gray-500">${log.dateFormatted.split(' ')[1]}</div>
                </td>
                <td class="border border-gray-300 px-3 py-2">
                    <div class="font-bold">${log.soldETF} → ${log.boughtETF}</div>
                    <div class="text-xs text-gray-500">Trade #${log.id.split('_')[1]}</div>
                </td>
                <td class="border border-gray-300 px-3 py-2 text-center">
                    <div class="font-medium">${log.soldShares.toFixed(4)} actions</div>
                    <div class="text-xs">à ${log.soldPrice.toFixed(2)}€</div>
                    <div class="text-xs ${log.soldVariation >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${log.soldVariation >= 0 ? '+' : ''}${log.soldVariation.toFixed(2)}%
                    </div>
                    <div class="font-medium text-blue-600">${log.soldValue.toFixed(0)}€</div>
                </td>
                <td class="border border-gray-300 px-3 py-2 text-center">
                    <div class="font-medium">${log.boughtShares.toFixed(4)} actions</div>
                    <div class="text-xs">à ${log.boughtPrice.toFixed(2)}€</div>
                    <div class="text-xs ${log.boughtVariation >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${log.boughtVariation >= 0 ? '+' : ''}${log.boughtVariation.toFixed(2)}%
                    </div>
                    <div class="font-medium text-blue-600">${log.boughtValue.toFixed(0)}€</div>
                </td>
                <td class="border border-gray-300 px-3 py-2 text-center">
                    <div class="font-bold ${log.valueDifference >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${log.valueDifference >= 0 ? '+' : ''}${log.valueDifference.toFixed(0)}€
                    </div>
                    <div class="text-xs text-red-500">Frais: ${log.tradingFees}€</div>
                    <div class="text-xs font-medium ${(log.valueDifference - log.tradingFees) >= 0 ? 'text-green-600' : 'text-red-600'}">
                        Net: ${(log.valueDifference - log.tradingFees) >= 0 ? '+' : ''}${(log.valueDifference - log.tradingFees).toFixed(0)}€
                    </div>
                </td>
                <td class="border border-gray-300 px-3 py-2 text-xs">
                    ${log.reason}
                    <div class="mt-1 text-xs text-gray-500">
                        Gain espéré: ${log.expectedGain.toFixed(0)}€
                    </div>
                </td>
            </tr>
        `;
    }

    // Gestion de l'export des logs
    async handleExportLogs() {
        try {
            const { portfolio } = await import('./portfolio.js');
            portfolio.export();
            this.showMessage('Données de portefeuille exportées avec succès', 'success');
        } catch (error) {
            debug.error(`Erreur export: ${error.message}`);
            this.showMessage(`Erreur lors de l'export: ${error.message}`, 'error');
        }
    }

    // Gestion du reset du portefeuille
    async handleResetPortfolio() {
        const confirmed = confirm(
            'Confirmer la réinitialisation du portefeuille ?\n\n' +
            'Cette action va :\n' +
            '• Supprimer tous les logs de trading\n' +
            '• Remettre le portefeuille à 100,000€ en VWCE\n' +
            '• Effacer toutes les statistiques\n\n' +
            'Cette action est irréversible. Continuer ?'
        );

        if (!confirmed) return;

        try {
            const { portfolio } = await import('./portfolio.js');
            portfolio.reset();
            
            // Mise à jour de l'interface
            this.state.currentStock = 'VWCE';
            this.updateHeaderStock();
            this.renderETFTable();
            this.updatePortfolioDisplay();
            
            this.showMessage('Portefeuille réinitialisé avec succès', 'success');
            debug.success('Portefeuille réinitialisé');
            
        } catch (error) {
            debug.error(`Erreur reset: ${error.message}`);
            this.showMessage(`Erreur lors de la réinitialisation: ${error.message}`, 'error');
        }
    }

    // Dispatch d'événements personnalisés
    dispatchEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, { 
            detail: { ...data, ui: this } 
        });
        document.dispatchEvent(event);
    }

    // Getters pour l'état actuel
    getCurrentStock() {
        return this.state.currentStock;
    }

    getPortfolioValue() {
        return this.state.portfolioValue;
    }

    getState() {
        return { ...this.state };
    }

    // Setters pour l'état
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    // Mise à jour forcée de l'UI
    forceUpdate() {
        this.renderETFTable();
        this.updatePortfolioDisplay();
        lucide.createIcons();
    }
}

// Instance globale du gestionnaire UI
export const uiManager = new UIManager();

// Fonctions d'UI exportées pour faciliter l'utilisation
export const ui = {
    render: () => uiManager.renderETFTable(),
    showRecommendations: (rec, deltas) => uiManager.showRecommendations(rec, deltas),
    hideRecommendations: () => uiManager.hideRecommendations(),
    updateRefreshButton: (loading) => uiManager.updateRefreshButton(loading),
    updateLastRefresh: () => uiManager.updateLastRefresh(),
    showMessage: (msg, type) => uiManager.showMessage(msg, type),
    getCurrentStock: () => uiManager.getCurrentStock(),
    getPortfolioValue: () => uiManager.getPortfolioValue(),
    getState: () => uiManager.getState(),
    setState: (state) => uiManager.setState(state),
    forceUpdate: () => uiManager.forceUpdate(),
    updatePortfolioDisplay: () => uiManager.updatePortfolioDisplay()
};