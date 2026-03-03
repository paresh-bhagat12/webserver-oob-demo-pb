/*
 * Demo Registry System
 * Manages loading and initialization of platform-specific demos
 */

class DemoRegistry {
    constructor() {
        this.demos = new Map();
        this.initialized = false;
        this.platformConfig = null;
    }

    // Register a demo module
    register(demoId, demoModule) {
        console.log(`[DemoRegistry] Registering demo: ${demoId}`);
        this.demos.set(demoId, demoModule);
    }

    // Initialize the registry with platform configuration
    async init(platformConfig) {
        console.log("[DemoRegistry] Initializing with platform config:", platformConfig);
        this.platformConfig = platformConfig;
        this.initialized = true;

        // Load enabled demos based on platform configuration
        await this.loadEnabledDemos();
    }

    // Load only the demos enabled for the current platform
    async loadEnabledDemos() {
        if (!this.platformConfig || !this.platformConfig.demos) {
            console.warn("[DemoRegistry] No platform configuration or demo config found");
            return;
        }

        const enabledDemos = this.platformConfig.demos.enabled || [];
        console.log("[DemoRegistry] Loading enabled demos:", enabledDemos);

        for (const demoId of enabledDemos) {
            await this.loadDemo(demoId);
        }
    }

    // Load and initialize a specific demo
    async loadDemo(demoId) {
        // Skip if demo is not enabled for this platform
        const enabledDemos = this.platformConfig.demos.enabled || [];
        if (!enabledDemos.includes(demoId)) {
            console.log(`[DemoRegistry] Skipping demo '${demoId}' - not enabled for this platform`);
            return;
        }

        try {
            // Check if demo is already registered
            if (this.demos.has(demoId)) {
                const demoModule = this.demos.get(demoId);
                await this.initializeDemo(demoId, demoModule);
                return;
            }

            // Dynamically load demo module
            console.log(`[DemoRegistry] Dynamically loading demo: ${demoId}`);
            const demoModule = await this.loadDemoModule(demoId);

            if (demoModule) {
                this.register(demoId, demoModule);
                await this.initializeDemo(demoId, demoModule);
            } else {
                console.error(`[DemoRegistry] Failed to load demo module: ${demoId}`);
            }
        } catch (error) {
            console.error(`[DemoRegistry] Error loading demo '${demoId}':`, error);
        }
    }

    // Dynamically load demo module file
    async loadDemoModule(demoId) {
        try {
            // Import demo module dynamically
            const modulePath = `./demos/${demoId}-demo.js`;
            const module = await import(modulePath);
            return module.default || module;
        } catch (error) {
            console.error(`[DemoRegistry] Failed to load demo module '${demoId}':`, error);
            return null;
        }
    }

    // Initialize a demo with its platform-specific configuration
    async initializeDemo(demoId, demoModule) {
        try {
            console.log(`[DemoRegistry] Initializing demo: ${demoId}`);

            // Get demo-specific configuration
            const demoConfig = this.getDemoConfig(demoId);

            // Initialize the demo
            if (typeof demoModule.initialize === 'function') {
                await demoModule.initialize(demoConfig, this.platformConfig);
                console.log(`[DemoRegistry] Successfully initialized demo: ${demoId}`);
            } else if (typeof demoModule === 'function') {
                // Handle demos that are functions themselves
                await demoModule(demoConfig, this.platformConfig);
                console.log(`[DemoRegistry] Successfully executed demo function: ${demoId}`);
            } else {
                console.warn(`[DemoRegistry] Demo '${demoId}' has no initialize function`);
            }
        } catch (error) {
            console.error(`[DemoRegistry] Error initializing demo '${demoId}':`, error);
        }
    }

    // Get configuration for a specific demo
    getDemoConfig(demoId) {
        if (!this.platformConfig || !this.platformConfig.demos || !this.platformConfig.demos.configurations) {
            return {};
        }
        return this.platformConfig.demos.configurations[demoId] || {};
    }

    // Check if a demo is enabled for the current platform
    isDemoEnabled(demoId) {
        const enabledDemos = this.platformConfig?.demos?.enabled || [];
        return enabledDemos.includes(demoId);
    }

    // Get all enabled demos
    getEnabledDemos() {
        return this.platformConfig?.demos?.enabled || [];
    }

    // Cleanup method to stop all demos
    cleanup() {
        console.log("[DemoRegistry] Cleaning up demos");
        for (const [demoId, demoModule] of this.demos.entries()) {
            try {
                if (typeof demoModule.cleanup === 'function') {
                    demoModule.cleanup();
                }
            } catch (error) {
                console.error(`[DemoRegistry] Error cleaning up demo '${demoId}':`, error);
            }
        }
        this.demos.clear();
    }
}

// Global demo registry instance
window.demoRegistry = new DemoRegistry();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DemoRegistry;
}