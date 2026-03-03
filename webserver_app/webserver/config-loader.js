/*
 * Platform Configuration Loader
 * Handles loading, merging, and validation of platform-specific configurations
 */

const fs = require('fs');
const path = require('path');

class ConfigurationManager {
    constructor() {
        this.config = null;
        this.platformName = process.env.PLATFORM_NAME || 'am335x';

        // Configuration file paths
        this.defaultConfigPath = this.getConfigPath(this.platformName);
        this.customConfigPath = process.env.PLATFORM_CONFIG;
    }

    getConfigPath(platformName) {
        // Try multiple locations for platform config
        const locations = [
            path.join(__dirname, '../../platforms', `${platformName}.json`),
            path.join('/etc/webserver-oob', `${platformName}.json`),
            path.join('/usr/share/webserver-oob/platforms', `${platformName}.json`)
        ];

        for (const location of locations) {
            if (fs.existsSync(location)) {
                return location;
            }
        }

        // Default to the first location (development path)
        return locations[0];
    }

    loadConfiguration() {
        console.log(`[Config] Loading platform configuration for: ${this.platformName}`);

        // 1. Load default platform configuration
        let config = this.loadJsonFile(this.defaultConfigPath);
        if (!config || Object.keys(config).length === 0) {
            throw new Error(`Failed to load platform configuration from ${this.defaultConfigPath}`);
        }

        // 2. Merge with custom configuration if specified
        if (this.customConfigPath && fs.existsSync(this.customConfigPath)) {
            console.log(`[Config] Merging custom configuration from: ${this.customConfigPath}`);
            const customConfig = this.loadJsonFile(this.customConfigPath);
            config = this.deepMerge(config, customConfig);
        }

        // 3. Apply environment variable overrides
        this.applyEnvOverrides(config);

        // 4. Validate configuration
        this.validateConfig(config);

        console.log(`[Config] Successfully loaded configuration for platform: ${config.platform.name}`);

        this.config = config;
        return config;
    }

    loadJsonFile(filePath) {
        try {
            console.log(`[Config] Loading JSON from: ${filePath}`);
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error(`[Config] Failed to load config from ${filePath}:`, error.message);
            return {};
        }
    }

    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    applyEnvOverrides(config) {
        // Platform name override
        if (process.env.PLATFORM_NAME) {
            config.platform.name = process.env.PLATFORM_NAME;
        }

        // Display name override
        if (process.env.PLATFORM_DISPLAY_NAME) {
            config.platform.displayName = process.env.PLATFORM_DISPLAY_NAME;
        }

        // Title override
        if (process.env.PLATFORM_TITLE) {
            config.platform.title = process.env.PLATFORM_TITLE;
            config.branding.applicationName = process.env.PLATFORM_TITLE;
            config.branding.menubarProductName = process.env.PLATFORM_TITLE;
        }

        // Model path override for audio classification
        if (process.env.AUDIO_MODEL_PATH) {
            if (config.demos && config.demos.configurations && config.demos.configurations['audio-classification']) {
                config.demos.configurations['audio-classification'].modelPath = process.env.AUDIO_MODEL_PATH;
            }
        }

        // Labels path override for audio classification
        if (process.env.AUDIO_LABELS_PATH) {
            if (config.demos && config.demos.configurations && config.demos.configurations['audio-classification']) {
                config.demos.configurations['audio-classification'].labelsPath = process.env.AUDIO_LABELS_PATH;
            }
        }

        console.log(`[Config] Applied environment variable overrides`);
    }

    validateConfig(config) {
        // Validate required platform fields
        if (!config.platform) {
            throw new Error('Configuration missing required "platform" section');
        }

        if (!config.platform.name) {
            throw new Error('Configuration missing required "platform.name"');
        }

        if (!config.branding) {
            throw new Error('Configuration missing required "branding" section');
        }

        // Validate demos configuration
        if (config.demos && config.demos.enabled) {
            if (!Array.isArray(config.demos.enabled)) {
                throw new Error('Configuration "demos.enabled" must be an array');
            }
        }

        // Validate boards configuration
        if (config.boards && !Array.isArray(config.boards)) {
            throw new Error('Configuration "boards" must be an array');
        }

        console.log(`[Config] Configuration validation passed`);
    }

    getConfig() {
        if (!this.config) {
            this.loadConfiguration();
        }
        return this.config;
    }

    // Get platform-specific demo configuration
    getDemoConfig(demoId) {
        const config = this.getConfig();
        if (config.demos && config.demos.configurations && config.demos.configurations[demoId]) {
            return config.demos.configurations[demoId];
        }
        return {};
    }

    // Check if a demo is enabled
    isDemoEnabled(demoId) {
        const config = this.getConfig();
        if (config.demos && config.demos.enabled) {
            return config.demos.enabled.includes(demoId);
        }
        return false;
    }

    // Get platform name
    getPlatformName() {
        return this.getConfig().platform.name;
    }

    // Get branding information
    getBranding() {
        return this.getConfig().branding;
    }

    // Get board information
    getBoards() {
        return this.getConfig().boards || [];
    }

    // Get documentation configuration
    getDocumentation() {
        return this.getConfig().documentation || { sections: [], quickLinks: [] };
    }

    // Get theme configuration
    getTheme() {
        return this.getConfig().theme || { name: 'ti-analogevm-theme' };
    }

    // Reload configuration (useful for development)
    reloadConfiguration() {
        console.log('[Config] Reloading configuration...');
        this.config = null;
        return this.loadConfiguration();
    }

    // Get configuration summary for debugging
    getConfigSummary() {
        const config = this.getConfig();
        return {
            platform: config.platform.name,
            title: config.platform.title,
            enabledDemos: config.demos ? config.demos.enabled : [],
            boardCount: config.boards ? config.boards.length : 0,
            theme: config.theme ? config.theme.name : 'default'
        };
    }
}

// Export singleton instance
module.exports = new ConfigurationManager();