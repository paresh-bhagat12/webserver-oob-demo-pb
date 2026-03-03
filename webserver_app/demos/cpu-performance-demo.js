/*
 * CPU Performance Demo Module
 * Displays real-time CPU usage with gauge visualization
 */

class CpuPerformanceDemo {
    constructor() {
        this.initialized = false;
        this.updateInterval = null;
        this.gaugeElement = null;
        this.refreshInterval = 1000; // Default 1 second
    }

    // Initialize the demo
    async initialize(demoConfig, platformConfig) {
        console.log("[CpuPerformanceDemo] Initializing CPU performance demo");

        try {
            // Use demo-specific configuration if available
            if (demoConfig.refreshInterval) {
                this.refreshInterval = demoConfig.refreshInterval;
            }

            // Get UI elements
            this.gaugeElement = this.getGaugeElement();

            if (!this.gaugeElement) {
                console.log("[CpuPerformanceDemo] CPU gauge element not found, skipping initialization");
                return;
            }

            // Start periodic updates
            this.startPeriodicUpdates();

            // Do initial update
            await this.updateCpuLoad();

            this.initialized = true;
            console.log(`[CpuPerformanceDemo] CPU performance demo initialized with ${this.refreshInterval}ms refresh`);

        } catch (error) {
            console.error("[CpuPerformanceDemo] Error initializing:", error);
        }
    }

    // Get the CPU gauge element
    getGaugeElement() {
        try {
            // Try templateObj first (GUI Composer style)
            if (window.templateObj && window.templateObj.$ && window.templateObj.$.gauge1) {
                return window.templateObj.$.gauge1;
            }

            // Fallback to getElementById
            return document.getElementById('gauge1') ||
                   document.getElementById('cpu_usage_gauge') ||
                   document.querySelector('[id*="gauge"]') ||
                   document.querySelector('[class*="gauge"]');

        } catch (error) {
            console.error("[CpuPerformanceDemo] Error getting gauge element:", error);
            return null;
        }
    }

    // Start periodic CPU load updates
    startPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.updateCpuLoad();
        }, this.refreshInterval);

        console.log(`[CpuPerformanceDemo] Started periodic updates every ${this.refreshInterval}ms`);
    }

    // Update CPU load from server
    async updateCpuLoad() {
        try {
            const response = await fetch('/cpu-load');
            const cpuLoad = await response.json();

            this.displayCpuLoad(cpuLoad);

        } catch (error) {
            console.error("[CpuPerformanceDemo] Error fetching CPU load:", error);

            // Fallback: try jQuery if fetch fails (for compatibility)
            if (window.$ && typeof window.$.get === 'function') {
                window.$.get('/cpu-load', (data) => {
                    this.displayCpuLoad(data);
                }).fail((error) => {
                    console.error("[CpuPerformanceDemo] jQuery fallback also failed:", error);
                });
            }
        }
    }

    // Display CPU load on the gauge
    displayCpuLoad(cpuLoad) {
        if (!this.gaugeElement) {
            return;
        }

        try {
            // Handle different data formats
            let loadValue = cpuLoad;
            if (typeof cpuLoad === 'object') {
                loadValue = cpuLoad.usage || cpuLoad.value || cpuLoad.cpu || 0;
            }

            // Ensure it's a number
            loadValue = parseFloat(loadValue) || 0;

            // Clamp between 0 and 100
            loadValue = Math.max(0, Math.min(100, loadValue));

            // Update gauge element
            if (typeof this.gaugeElement.value !== 'undefined') {
                // GUI Composer gauge element
                this.gaugeElement.value = loadValue;
            } else if (typeof this.gaugeElement.setAttribute === 'function') {
                // Standard HTML element
                this.gaugeElement.setAttribute('value', loadValue);
            }

            // Also update any text content
            if (this.gaugeElement.textContent !== undefined) {
                this.gaugeElement.textContent = `${loadValue.toFixed(1)}%`;
            }

            console.log(`[CpuPerformanceDemo] Updated CPU load: ${loadValue.toFixed(1)}%`);

        } catch (error) {
            console.error("[CpuPerformanceDemo] Error displaying CPU load:", error);
        }
    }

    // Stop periodic updates
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log("[CpuPerformanceDemo] Stopped periodic updates");
        }
    }

    // Check if the demo is currently running
    isRunning() {
        return this.initialized && this.updateInterval !== null;
    }

    // Restart with new configuration
    async restart(demoConfig) {
        console.log("[CpuPerformanceDemo] Restarting with new config");

        this.stopPeriodicUpdates();

        if (demoConfig.refreshInterval) {
            this.refreshInterval = demoConfig.refreshInterval;
        }

        this.startPeriodicUpdates();
        await this.updateCpuLoad();
    }

    // Cleanup method
    cleanup() {
        console.log("[CpuPerformanceDemo] Cleaning up CPU performance demo");
        this.stopPeriodicUpdates();
        this.initialized = false;
        this.gaugeElement = null;
    }
}

// Export the demo
export default CpuPerformanceDemo;

// Also make it available globally for non-module environments
window.CpuPerformanceDemo = CpuPerformanceDemo;