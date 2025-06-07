import { CONFIG } from './config.js';
import { debug } from './debug.js';

// Gestionnaire des notifications
class NotificationManager {
    constructor() {
        this.isSupported = 'Notification' in window;
        this.permission = this.isSupported ? Notification.permission : 'denied';
        this.activeNotifications = new Map();
        this.notificationQueue = [];
        this.settings = {
            enabled: true,
            sound: CONFIG.NOTIFICATION_SOUND,
            duration: CONFIG.NOTIFICATION_DURATION,
            persistent: false
        };
        
        this.init();
    }

    async init() {
        await this.requestPermission();
        this.setupServiceWorker();
        debug.info(`Notifications ${this.isEnabled() ? 'activées' : 'désactivées'}`);
    }

    // Demande de permission pour les notifications
    async requestPermission() {
        if (!this.isSupported) {
            debug.warning('Notifications non supportées par ce navigateur');
            return false;
        }

        if (this.permission === 'default') {
            try {
                this.permission = await Notification.requestPermission();
                debug.info(`Permission notifications: ${this.permission}`);
            } catch (error) {
                debug.error(`Erreur demande permission notifications: ${error.message}`);
                this.permission = 'denied';
            }
        }

        return this.permission === 'granted';
    }

    // Configuration du service worker pour les notifications persistantes
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Pour une version complète, on pourrait enregistrer un service worker
            // navigator.serviceWorker.register('/sw.js')
            debug.info('Service Worker supporté pour notifications persistantes');
        }
    }

    // Vérification si les notifications sont activées
    isEnabled() {
        return this.isSupported && 
               this.permission === 'granted' && 
               this.settings.enabled;
    }

    // Notification de signal de trading
    showTradeSignal(recommendation) {
        if (!this.isEnabled()) {
            debug.warning('Notifications désactivées - signal non affiché');
            return false;
        }

        const title = '🚨 SIGNAL DE TRADE DÉTECTÉ !';
        const message = `${recommendation.fromETF} → ${recommendation.toETF}\nDelta: +${recommendation.delta.toFixed(2)}%\nGain estimé: +${recommendation.netGain.toFixed(0)}€`;
        
        const options = {
            body: message,
            icon: this.getTradeIcon(),
            badge: this.getTradeBadge(),
            tag: 'trade-signal',
            requireInteraction: true,
            vibrate: [200, 100, 200],
            actions: [
                {
                    action: 'view',
                    title: 'Voir Détails',
                    icon: '/icons/view.png'
                },
                {
                    action: 'dismiss',
                    title: 'Ignorer',
                    icon: '/icons/dismiss.png'
                }
            ],
            data: {
                type: 'trade-signal',
                recommendation: recommendation,
                timestamp: Date.now()
            }
        };

        return this.createNotification(title, options);
    }

    // Notification d'erreur de connexion
    showConnectionError(error) {
        if (!this.isEnabled()) return false;

        const title = '❌ Erreur de Connexion';
        const message = `Impossible de récupérer les données ETF.\nErreur: ${error.message.substring(0, 100)}`;
        
        const options = {
            body: message,
            icon: this.getErrorIcon(),
            tag: 'connection-error',
            requireInteraction: false,
            data: {
                type: 'error',
                error: error.message,
                timestamp: Date.now()
            }
        };

        return this.createNotification(title, options);
    }

    // Notification de mise à jour des données
    showDataUpdate(successCount, totalCount) {
        if (!this.isEnabled() || !this.settings.showDataUpdates) return false;

        const title = '📊 Données Mises à Jour';
        const message = `${successCount}/${totalCount} ETFs mis à jour avec succès`;
        
        const options = {
            body: message,
            icon: this.getUpdateIcon(),
            tag: 'data-update',
            requireInteraction: false,
            silent: true,
            data: {
                type: 'data-update',
                successCount,
                totalCount,
                timestamp: Date.now()
            }
        };

        return this.createNotification(title, options);
    }

    // Notification générique
    showNotification(title, message, type = 'info', options = {}) {
        if (!this.isEnabled()) {
            // Fallback vers notification en page
            return this.showInPageNotification(title, message, type);
        }

        const defaultOptions = {
            body: message,
            icon: this.getIconForType(type),
            tag: `notification-${type}-${Date.now()}`,
            requireInteraction: type === 'error' || type === 'trade',
            data: {
                type,
                timestamp: Date.now()
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        return this.createNotification(title, finalOptions);
    }

    // Création effective de la notification
    createNotification(title, options) {
        try {
            // Fermer les notifications existantes du même type si nécessaire
            if (options.tag && this.activeNotifications.has(options.tag)) {
                this.activeNotifications.get(options.tag).close();
            }

            const notification = new Notification(title, options);
            
            // Enregistrer la notification active
            if (options.tag) {
                this.activeNotifications.set(options.tag, notification);
            }

            // Gérer les événements
            this.setupNotificationEvents(notification, options);

            // Auto-fermeture si configurée
            if (!options.requireInteraction && this.settings.duration > 0) {
                setTimeout(() => {
                    notification.close();
                }, this.settings.duration);
            }

            // Son si activé
            if (this.settings.sound && options.data?.type === 'trade-signal') {
                this.playNotificationSound();
            }

            debug.success(`Notification affichée: ${title}`);
            return notification;

        } catch (error) {
            debug.error(`Erreur création notification: ${error.message}`);
            return this.showInPageNotification(title, options.body, options.data?.type);
        }
    }

    // Configuration des événements de notification
    setupNotificationEvents(notification, options) {
        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            
            if (options.data?.type === 'trade-signal') {
                this.handleTradeSignalClick(options.data.recommendation);
            }
            
            notification.close();
            debug.info('Notification cliquée');
        };

        notification.onclose = () => {
            if (options.tag && this.activeNotifications.has(options.tag)) {
                this.activeNotifications.delete(options.tag);
            }
        };

        notification.onerror = (error) => {
            debug.error(`Erreur notification: ${error}`);
        };

        // Gestion des actions (pour navigateurs supportés)
        if ('actions' in notification && options.actions) {
            notification.addEventListener('notificationclick', (event) => {
                if (event.action === 'view') {
                    this.handleTradeSignalClick(options.data?.recommendation);
                } else if (event.action === 'dismiss') {
                    notification.close();
                }
            });
        }
    }

    // Gestion du clic sur signal de trade
    handleTradeSignalClick(recommendation) {
        if (!recommendation) return;

        // Scroll vers la section de recommandations
        const recSection = document.getElementById('recommendation-section');
        if (recSection) {
            recSection.scrollIntoView({ behavior: 'smooth' });
            recSection.classList.add('animate-pulse');
            setTimeout(() => {
                recSection.classList.remove('animate-pulse');
            }, 2000);
        }

        debug.info(`Clic sur signal de trade: ${recommendation.fromETF} → ${recommendation.toETF}`);
    }

    // Notification en page (fallback)
    showInPageNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `trading-notification ${type}`;
        
        notification.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        ${this.getInPageIcon(type)}
                    </div>
                    <div class="ml-3">
                        <h4 class="text-white font-semibold">${title}</h4>
                        <p class="text-white text-sm mt-1">${message}</p>
                    </div>
                </div>
                <button class="flex-shrink-0 ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-suppression
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, this.settings.duration);

        debug.info(`Notification en page affichée: ${title}`);
        return notification;
    }

    // Lecture du son de notification
    playNotificationSound() {
        try {
            // Son simple avec l'API Web Audio
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            
        } catch (error) {
            debug.warning(`Impossible de jouer le son: ${error.message}`);
        }
    }

    // Icônes pour les différents types
    getIconForType(type) {
        const icons = {
            'trade': this.getTradeIcon(),
            'error': this.getErrorIcon(),
            'warning': this.getWarningIcon(),
            'info': this.getInfoIcon(),
            'success': this.getSuccessIcon()
        };
        return icons[type] || icons.info;
    }

    getTradeIcon() {
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
            </svg>
        `);
    }

    getErrorIcon() {
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
        `);
    }

    getWarningIcon() {
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        `);
    }

    getInfoIcon() {
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
        `);
    }

    getSuccessIcon() {
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
        `);
    }

    getUpdateIcon() {
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
        `);
    }

    getTradeBadge() {
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#10b981">
                <circle cx="12" cy="12" r="10"></circle>
                <text x="12" y="16" text-anchor="middle" fill="white" font-size="14" font-weight="bold">🚀</text>
            </svg>
        `);
    }

    // Icônes en page
    getInPageIcon(type) {
        const icons = {
            'trade': '🚀',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'success': '✅'
        };
        return `<span class="text-2xl">${icons[type] || icons.info}</span>`;
    }

    // Fermeture de toutes les notifications actives
    closeAll() {
        this.activeNotifications.forEach(notification => {
            notification.close();
        });
        this.activeNotifications.clear();
        debug.info('Toutes les notifications fermées');
    }

    // Fermeture des notifications par type
    closeByType(type) {
        this.activeNotifications.forEach((notification, tag) => {
            if (tag.includes(type)) {
                notification.close();
                this.activeNotifications.delete(tag);
            }
        });
    }

    // Configuration des paramètres
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        debug.info('Paramètres notifications mis à jour:', this.settings);
    }

    // Test des notifications
    async testNotification() {
        if (!await this.requestPermission()) {
            this.showInPageNotification(
                'Test de Notification', 
                'Les notifications navigateur ne sont pas disponibles. Fallback vers notifications en page.', 
                'warning'
            );
            return false;
        }

        this.showNotification(
            '🧪 Test de Notification',
            'Les notifications fonctionnent correctement ! Vous recevrez des alertes pour les signaux de trading.',
            'success',
            { tag: 'test-notification' }
        );
        
        return true;
    }

    // Statistiques des notifications
    getStats() {
        return {
            isSupported: this.isSupported,
            permission: this.permission,
            isEnabled: this.isEnabled(),
            settings: { ...this.settings },
            activeCount: this.activeNotifications.size,
            queueLength: this.notificationQueue.length
        };
    }

    // Vérification du support des fonctionnalités avancées
    checkAdvancedFeatures() {
        return {
            basicNotifications: this.isSupported,
            actions: 'actions' in Notification.prototype,
            vibrate: 'vibrate' in navigator,
            serviceWorker: 'serviceWorker' in navigator,
            persistent: 'showNotification' in ServiceWorkerRegistration.prototype,
            sound: 'AudioContext' in window || 'webkitAudioContext' in window
        };
    }
}

// Instance globale du gestionnaire de notifications
export const notificationManager = new NotificationManager();

// Fonctions de notifications exportées pour faciliter l'utilisation
export const notifications = {
    show: (title, message, type, options) => notificationManager.showNotification(title, message, type, options),
    showTradeSignal: (recommendation) => notificationManager.showTradeSignal(recommendation),
    showError: (error) => notificationManager.showConnectionError(error),
    showUpdate: (success, total) => notificationManager.showDataUpdate(success, total),
    test: () => notificationManager.testNotification(),
    requestPermission: () => notificationManager.requestPermission(),
    isEnabled: () => notificationManager.isEnabled(),
    closeAll: () => notificationManager.closeAll(),
    closeByType: (type) => notificationManager.closeByType(type),
    updateSettings: (settings) => notificationManager.updateSettings(settings),
    getStats: () => notificationManager.getStats(),
    checkFeatures: () => notificationManager.checkAdvancedFeatures()
};