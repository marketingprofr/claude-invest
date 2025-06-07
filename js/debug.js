// Système de débogage centralisé
class DebugManager {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.isVisible = false;
        this.logLevels = {
            INFO: 'INFO',
            SUCCESS: 'SUCCESS',
            WARNING: 'WARNING',
            ERROR: 'ERROR',
            API: 'API'
        };
        this.init();
    }

    init() {
        this.setupToggleHandler();
        this.addInitialLogs();
    }

    setupToggleHandler() {
        const toggleBtn = document.getElementById('toggle-debug');
        const debugContent = document.getElementById('debug-content');
        
        if (toggleBtn && debugContent) {
            toggleBtn.addEventListener('click', () => {
                this.toggle();
            });
            
            // Masquer par défaut
            debugContent.style.display = 'none';
        }
    }

    addInitialLogs() {
        this.log('=== INITIALISATION BÖRSE FRANKFURT ===', this.logLevels.INFO);
        this.log('Application chargée avec l\'API réelle Börse Frankfurt:', this.logLevels.INFO);
        this.log('• IWDA: IE00B4L5Y983 (iShares Core MSCI World)', this.logLevels.INFO);
        this.log('• VWCE: IE00BK5BQT80 (Vanguard FTSE All-World)', this.logLevels.INFO);
        this.log('• MEUD: LU0908500753 (Amundi STOXX Europe 600)', this.logLevels.INFO);
        this.log('• IMAE: IE00B4K48X80 (iShares Core MSCI Europe)', this.logLevels.INFO);
        this.log('API: https://api.boerse-frankfurt.de/v1/data/quote_box/single?isin=...', this.logLevels.API);
        this.log('', this.logLevels.INFO);
        this.log('🎯 LOGIQUE DE TRADING:', this.logLevels.INFO);
        this.log('• Variations depuis l\'ouverture du jour', this.logLevels.INFO);
        this.log('• Delta = différence entre variations', this.logLevels.INFO);
        this.log('• Signal d\'achat si delta > +0.5%', this.logLevels.INFO);
        this.log('', this.logLevels.INFO);
        this.log('Prêt ! Testez "Test Connexion" pour vérifier l\'accès.', this.logLevels.SUCCESS);
    }

    log(message, level = this.logLevels.INFO) {
        const timestamp = new Date().toLocaleTimeString('fr-FR');
        const logEntry = {
            timestamp,
            message,
            level,
            fullMessage: `[${timestamp}] ${this.getLevelPrefix(level)}${message}`
        };

        this.logs.push(logEntry);
        
        // Limiter le nombre de logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        this.updateDisplay();
        
        // Aussi logger dans la console du navigateur
        this.logToConsole(logEntry);
    }

    getLevelPrefix(level) {
        const prefixes = {
            [this.logLevels.INFO]: '',
            [this.logLevels.SUCCESS]: '✅ ',
            [this.logLevels.WARNING]: '⚠️ ',
            [this.logLevels.ERROR]: '❌ ',
            [this.logLevels.API]: '🔗 '
        };
        return prefixes[level] || '';
    }

    logToConsole(logEntry) {
        const consoleMethod = {
            [this.logLevels.INFO]: 'log',
            [this.logLevels.SUCCESS]: 'log',
            [this.logLevels.WARNING]: 'warn',
            [this.logLevels.ERROR]: 'error',
            [this.logLevels.API]: 'log'
        };

        console[consoleMethod[logEntry.level] || 'log'](
            `[Börse Trading] ${logEntry.fullMessage}`
        );
    }

    updateDisplay() {
        const debugContent = document.getElementById('debug-content');
        if (debugContent) {
            const formattedLogs = this.logs.map(log => {
                const className = this.getLevelClass(log.level);
                return `<span class="${className}">${log.fullMessage}</span>`;
            }).join('<br>');
            
            debugContent.innerHTML = formattedLogs;
            
            // Auto-scroll vers le bas
            debugContent.scrollTop = debugContent.scrollHeight;
        }
    }

    getLevelClass(level) {
        const classes = {
            [this.logLevels.INFO]: 'text-gray-700',
            [this.logLevels.SUCCESS]: 'text-green-600 font-semibold',
            [this.logLevels.WARNING]: 'text-yellow-600 font-semibold',
            [this.logLevels.ERROR]: 'text-red-600 font-semibold',
            [this.logLevels.API]: 'text-blue-600 font-semibold'
        };
        return classes[level] || 'text-gray-700';
    }

    toggle() {
        const debugContent = document.getElementById('debug-content');
        if (debugContent) {
            this.isVisible = !this.isVisible;
            debugContent.style.display = this.isVisible ? 'block' : 'none';
            
            const toggleBtn = document.getElementById('toggle-debug');
            if (toggleBtn) {
                toggleBtn.textContent = this.isVisible ? 'Masquer logs' : 'Afficher logs';
            }
        }
    }

    show() {
        const debugContent = document.getElementById('debug-content');
        if (debugContent) {
            this.isVisible = true;
            debugContent.style.display = 'block';
            
            const toggleBtn = document.getElementById('toggle-debug');
            if (toggleBtn) {
                toggleBtn.textContent = 'Masquer logs';
            }
        }
    }

    hide() {
        const debugContent = document.getElementById('debug-content');
        if (debugContent) {
            this.isVisible = false;
            debugContent.style.display = 'none';
            
            const toggleBtn = document.getElementById('toggle-debug');
            if (toggleBtn) {
                toggleBtn.textContent = 'Afficher logs';
            }
        }
    }

    clear() {
        this.logs = [];
        this.updateDisplay();
        this.log('Logs effacés', this.logLevels.INFO);
    }

    // Méthodes de convenance
    info(message) {
        this.log(message, this.logLevels.INFO);
    }

    success(message) {
        this.log(message, this.logLevels.SUCCESS);
    }

    warning(message) {
        this.log(message, this.logLevels.WARNING);
    }

    error(message) {
        this.log(message, this.logLevels.ERROR);
    }

    api(message) {
        this.log(message, this.logLevels.API);
    }

    // Méthodes pour les sections de logs
    startSection(title) {
        this.log(`=== ${title.toUpperCase()} ===`, this.logLevels.INFO);
    }

    endSection(title = null) {
        if (title) {
            this.log(`=== FIN ${title.toUpperCase()} ===`, this.logLevels.INFO);
        } else {
            this.log('===================', this.logLevels.INFO);
        }
    }

    logETFData(etf, data) {
        this.log(`${etf}: ${data.price}€, variation: ${data.changePercent}%`, this.logLevels.SUCCESS);
        if (data.openPrice) {
            this.log(`   Prix ouverture: ${data.openPrice}€, Status: ${data.instrumentStatus}`, this.logLevels.INFO);
        }
    }

    logAPICall(etf, url) {
        this.log(`Récupération de ${etf} depuis Börse Frankfurt API...`, this.logLevels.API);
        this.log(`ISIN: ${etf} | URL: ${url}`, this.logLevels.API);
    }

    logAPIResponse(etf, status, data = null) {
        if (status === 'success') {
            this.success(`API Success pour ${etf}`);
            if (data) {
                this.logETFData(etf, data);
            }
        } else {
            this.error(`API Error pour ${etf}`);
        }
    }

    // Export des logs pour débogage
    exportLogs() {
        const logsText = this.logs.map(log => log.fullMessage).join('\n');
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-logs-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.success('Logs exportés vers fichier');
    }

    // Obtenir les statistiques de debug
    getStats() {
        const levelCounts = {};
        Object.values(this.logLevels).forEach(level => {
            levelCounts[level] = this.logs.filter(log => log.level === level).length;
        });

        return {
            totalLogs: this.logs.length,
            levelCounts,
            isVisible: this.isVisible,
            oldestLog: this.logs[0]?.timestamp,
            newestLog: this.logs[this.logs.length - 1]?.timestamp
        };
    }
}

// Instance globale du gestionnaire de debug
export const debugManager = new DebugManager();

// Fonctions de convenance exportées
export const debug = {
    log: (message) => debugManager.info(message),
    info: (message) => debugManager.info(message),
    success: (message) => debugManager.success(message),
    warning: (message) => debugManager.warning(message),
    error: (message) => debugManager.error(message),
    api: (message) => debugManager.api(message),
    startSection: (title) => debugManager.startSection(title),
    endSection: (title) => debugManager.endSection(title),
    clear: () => debugManager.clear(),
    show: () => debugManager.show(),
    hide: () => debugManager.hide(),
    toggle: () => debugManager.toggle(),
    export: () => debugManager.exportLogs(),
    stats: () => debugManager.getStats()
};