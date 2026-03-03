#!/usr/bin/env node

/*
 * Build System for Platform-Specific Webserver OOB Demo Packages
 * Generates platform-specific deployable packages from configurations
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class PlatformBuilder {
    constructor() {
        this.sourceDir = __dirname;
        this.platformsDir = path.join(this.sourceDir, 'platforms');
        this.templatesDir = path.join(this.sourceDir, 'templates');
        this.distDir = path.join(this.sourceDir, 'dist');
    }

    // List available platforms
    listPlatforms() {
        try {
            const files = fs.readdirSync(this.platformsDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => path.basename(file, '.json'));
        } catch (error) {
            console.error('Error listing platforms:', error);
            return [];
        }
    }

    // Load platform configuration
    loadPlatformConfig(platformName) {
        const configPath = path.join(this.platformsDir, `${platformName}.json`);

        if (!fs.existsSync(configPath)) {
            throw new Error(`Platform configuration not found: ${configPath}`);
        }

        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to parse platform configuration: ${error.message}`);
        }
    }

    // Create output directory for platform
    createOutputDir(platformConfig) {
        const outputDir = path.join(this.distDir, platformConfig.platform.name.toLowerCase());

        if (fs.existsSync(outputDir)) {
            // Clean existing directory
            fs.rmSync(outputDir, { recursive: true, force: true });
        }

        fs.mkdirSync(outputDir, { recursive: true });
        return outputDir;
    }

    // Copy source files to output directory
    copySourceFiles(outputDir) {
        console.log('Copying source files...');

        // Copy webserver_app directory
        const sourceWebserverApp = path.join(this.sourceDir, 'webserver_app');
        const targetWebserverApp = path.join(outputDir, 'webserver_app');

        this.copyDirectory(sourceWebserverApp, targetWebserverApp);

        // Copy any additional files (README, LICENSE, etc.)
        const additionalFiles = ['README.md', 'LICENSE'];
        additionalFiles.forEach(file => {
            const sourcePath = path.join(this.sourceDir, file);
            const targetPath = path.join(outputDir, file);
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, targetPath);
            }
        });
    }

    // Copy directory recursively
    copyDirectory(source, target) {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }

        const items = fs.readdirSync(source);

        items.forEach(item => {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);

            if (fs.statSync(sourcePath).isDirectory()) {
                this.copyDirectory(sourcePath, targetPath);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        });
    }

    // Update platform-specific files
    updatePlatformFiles(outputDir, platformConfig) {
        console.log('Updating platform-specific files...');

        // Process HTML templates
        this.processHtmlTemplates(outputDir, platformConfig);

        // Update package.json
        this.updatePackageJson(outputDir, platformConfig);

        // Update service file
        this.updateServiceFile(outputDir, platformConfig);

        // Update project.json
        this.updateProjectJson(outputDir, platformConfig);

        // Create platform config file in output
        this.createPlatformConfigFile(outputDir, platformConfig);
    }

    // Process HTML template files
    processHtmlTemplates(outputDir, platformConfig) {
        console.log('Processing HTML templates...');

        const templatesDir = path.join(outputDir, 'webserver_app/templates');
        const appDir = path.join(outputDir, 'webserver_app/app');

        if (!fs.existsSync(templatesDir)) {
            console.log('No templates directory found, skipping template processing');
            return;
        }

        // Find all template files
        const templateFiles = this.findTemplateFiles(templatesDir);

        templateFiles.forEach(templateFile => {
            try {
                // Read template content
                const templatePath = path.join(templatesDir, templateFile);
                let content = fs.readFileSync(templatePath, 'utf8');

                // Replace placeholders with platform config values
                content = this.replacePlaceholders(content, platformConfig);

                // Write processed file to app directory (remove .template extension)
                const outputFile = templateFile.replace('.template', '');
                const outputPath = path.join(outputDir, 'webserver_app', outputFile);

                // Ensure output directory exists
                const outputFileDir = path.dirname(outputPath);
                fs.mkdirSync(outputFileDir, { recursive: true });

                fs.writeFileSync(outputPath, content);
                console.log(`Processed template: ${templateFile} -> ${outputFile}`);

            } catch (error) {
                console.error(`Error processing template ${templateFile}:`, error.message);
            }
        });
    }

    // Find all template files recursively
    findTemplateFiles(dir, prefix = '') {
        const files = [];
        const items = fs.readdirSync(dir);

        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const relativePath = prefix ? path.join(prefix, item) : item;

            if (fs.statSync(fullPath).isDirectory()) {
                files.push(...this.findTemplateFiles(fullPath, relativePath));
            } else if (item.endsWith('.template')) {
                files.push(relativePath);
            }
        });

        return files;
    }

    // Replace template placeholders with platform config values
    replacePlaceholders(content, platformConfig) {
        // Extract platform data for easy access
        const platform = platformConfig.platform;
        const branding = platformConfig.branding;
        const boards = platformConfig.boards || [];
        const docs = platformConfig.documentation?.sections || [];
        const quickLinks = platformConfig.documentation?.quickLinks || [];

        // Define placeholder mappings
        const replacements = {
            // Platform information
            'PLATFORM_TITLE': platform.title,
            'PLATFORM_DISPLAY_NAME': platform.displayName,
            'PLATFORM_HEADER_DESCRIPTION': branding.headerDescription,

            // Board information
            'BOARD_1_IMAGE': boards[0]?.image || '',
            'BOARD_1_NAME': boards[0]?.name || '',
            'BOARD_1_DESCRIPTION': boards[0]?.description || '',
            'BOARD_2_IMAGE': boards[1]?.image || '',
            'BOARD_2_NAME': boards[1]?.name || '',
            'BOARD_2_DESCRIPTION': boards[1]?.description || '',

            // Documentation links
            'DOC_PRODUCT_URL': docs.find(d => d.title === 'Product Page')?.url || '',
            'DOC_PRODUCT_DESCRIPTION': docs.find(d => d.title === 'Product Page')?.description || '',
            'DOC_TRM_URL': docs.find(d => d.title === 'Technical Reference Manual')?.url || '',
            'DOC_TRM_DESCRIPTION': docs.find(d => d.title === 'Technical Reference Manual')?.description || '',
            'DOC_SDK_URL': docs.find(d => d.title === 'Processor SDK')?.url || '',
            'DOC_GETTING_STARTED_URL': docs.find(d => d.title === 'Getting Started')?.url || '',

            // Quick links
            'QUICK_LINK_DATASHEET_URL': quickLinks.find(q => q.text === 'Datasheet')?.url || '',
            'QUICK_LINK_GITHUB_URL': quickLinks.find(q => q.text.includes('GitHub'))?.url || '',
            'QUICK_LINK_GITHUB_TEXT': quickLinks.find(q => q.text.includes('GitHub'))?.text || 'GitHub'
        };

        // Replace all placeholders
        let processedContent = content;
        Object.entries(replacements).forEach(([placeholder, value]) => {
            const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');
            processedContent = processedContent.replace(regex, value);
        });

        return processedContent;
    }

    // Update package.json with platform-specific information
    updatePackageJson(outputDir, platformConfig) {
        const packageJsonPath = path.join(outputDir, 'webserver_app/webserver/package.json');

        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

                // Update description
                packageJson.description = platformConfig.branding.packageDescription;

                // Update name if specified in build config
                if (platformConfig.build && platformConfig.build.packageName) {
                    packageJson.name = platformConfig.build.packageName;
                }

                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
                console.log(`Updated package.json for ${platformConfig.platform.name}`);
            } catch (error) {
                console.error('Error updating package.json:', error);
            }
        }
    }

    // Update systemd service file
    updateServiceFile(outputDir, platformConfig) {
        const servicePath = path.join(outputDir, 'webserver_app/webserver/webserver-oob.service');

        if (fs.existsSync(servicePath)) {
            try {
                let content = fs.readFileSync(servicePath, 'utf8');

                // Replace service description
                content = content.replace(
                    /Description=.*/,
                    `Description=${platformConfig.branding.serviceDescription}`
                );

                fs.writeFileSync(servicePath, content);
                console.log(`Updated service file for ${platformConfig.platform.name}`);
            } catch (error) {
                console.error('Error updating service file:', error);
            }
        }
    }

    // Update project.json for GUI Composer
    updateProjectJson(outputDir, platformConfig) {
        const projectJsonPath = path.join(outputDir, 'webserver_app/app/project.json');

        if (fs.existsSync(projectJsonPath)) {
            try {
                const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));

                // Update project metadata
                projectJson.template = platformConfig.branding.template;
                projectJson.projectName = platformConfig.branding.projectName;
                projectJson.applicationName = platformConfig.branding.applicationName;

                // Update theme if specified
                if (platformConfig.theme && platformConfig.theme.name) {
                    projectJson.theme = platformConfig.theme.name;
                }

                fs.writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2));
                console.log(`Updated project.json for ${platformConfig.platform.name}`);
            } catch (error) {
                console.error('Error updating project.json:', error);
            }
        }
    }

    // Create platform configuration file in the output package
    createPlatformConfigFile(outputDir, platformConfig) {
        const configDir = path.join(outputDir, 'webserver_app/config');
        fs.mkdirSync(configDir, { recursive: true });

        const configPath = path.join(configDir, 'platform.json');
        fs.writeFileSync(configPath, JSON.stringify(platformConfig, null, 2));

        console.log(`Created platform configuration file: ${configPath}`);
    }

    // Build platform package
    async buildPlatform(platformName) {
        console.log(`\n=== Building platform: ${platformName} ===`);

        try {
            // Load platform configuration
            const platformConfig = this.loadPlatformConfig(platformName);
            console.log(`Loaded configuration for: ${platformConfig.platform.name}`);

            // Create output directory
            const outputDir = this.createOutputDir(platformConfig);
            console.log(`Output directory: ${outputDir}`);

            // Copy source files
            this.copySourceFiles(outputDir);

            // Update platform-specific files
            this.updatePlatformFiles(outputDir, platformConfig);

            console.log(`\n✅ Successfully built platform: ${platformName}`);
            console.log(`📦 Package location: ${outputDir}`);

            return outputDir;

        } catch (error) {
            console.error(`\n❌ Failed to build platform ${platformName}:`, error.message);
            throw error;
        }
    }

    // Build all platforms
    async buildAll() {
        const platforms = this.listPlatforms();
        console.log(`Found platforms: ${platforms.join(', ')}`);

        const results = [];

        for (const platform of platforms) {
            try {
                const outputDir = await this.buildPlatform(platform);
                results.push({ platform, success: true, outputDir });
            } catch (error) {
                results.push({ platform, success: false, error: error.message });
            }
        }

        console.log('\n=== Build Summary ===');
        results.forEach(result => {
            if (result.success) {
                console.log(`✅ ${result.platform}: ${result.outputDir}`);
            } else {
                console.log(`❌ ${result.platform}: ${result.error}`);
            }
        });

        return results;
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const builder = new PlatformBuilder();

    if (args.length === 0) {
        console.log('Platform Build System');
        console.log('Usage:');
        console.log('  node build.js <platform>     # Build specific platform');
        console.log('  node build.js --all          # Build all platforms');
        console.log('  node build.js --list         # List available platforms');
        console.log('');
        console.log('Available platforms:', builder.listPlatforms().join(', '));
        return;
    }

    const command = args[0];

    try {
        if (command === '--list') {
            const platforms = builder.listPlatforms();
            console.log('Available platforms:');
            platforms.forEach(platform => console.log(`  - ${platform}`));
        } else if (command === '--all') {
            await builder.buildAll();
        } else {
            await builder.buildPlatform(command);
        }
    } catch (error) {
        console.error('Build failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = PlatformBuilder;