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
    forceUpdate: () => uiManager.forceUpdate()
};