/*
 * System Info Demo Module
 * Displays system information using uname command
 */

class SystemInfoDemo {
    constructor() {
        this.initialized = false;
        this.elements = {};
    }

    // Initialize the demo
    async initialize(demoConfig, platformConfig) {
        console.log("[SystemInfoDemo] Initializing system info demo");

        try {
            // Get UI elements
            this.elements = this.getUIElements();

            // Check if required elements exist
            if (!this.elements.runButton) {
                console.log("[SystemInfoDemo] System info demo UI elements not found, skipping initialization");
                return;
            }

            // Set up event listeners
            this.setupEventListeners();

            this.initialized = true;
            console.log("[SystemInfoDemo] System info demo initialized successfully");

        } catch (error) {
            console.error("[SystemInfoDemo] Error initializing:", error);
        }
    }

    // Get UI elements using multiple fallback methods
    getUIElements() {
        const elements = {};

        try {
            // Try templateObj first (GUI Composer style)
            if (window.templateObj && window.templateObj.$) {
                elements.runButton = window.templateObj.$.run_uname_button;
                elements.sysname = window.templateObj.$.uname_sysname;
                elements.nodename = window.templateObj.$.uname_nodename;
                elements.release = window.templateObj.$.uname_release;
                elements.version = window.templateObj.$.uname_version;
                elements.machine = window.templateObj.$.uname_machine;
                elements.processor = window.templateObj.$.uname_processor;
                elements.os = window.templateObj.$.uname_os;
            }

            // Fallback to getElementById if templateObj doesn't work
            if (!elements.runButton) {
                elements.runButton = document.getElementById('run_uname_button');
                elements.sysname = document.getElementById('uname_sysname');
                elements.nodename = document.getElementById('uname_nodename');
                elements.release = document.getElementById('uname_release');
                elements.version = document.getElementById('uname_version');
                elements.machine = document.getElementById('uname_machine');
                elements.processor = document.getElementById('uname_processor');
                elements.os = document.getElementById('uname_os');
            }

        } catch (error) {
            console.error("[SystemInfoDemo] Error getting UI elements:", error);
        }

        return elements;
    }

    // Set up event listeners
    setupEventListeners() {
        if (this.elements.runButton) {
            this.elements.runButton.addEventListener('click', () => {
                this.runSystemInfo();
            });
        }
    }

    // Execute the system info command
    async runSystemInfo() {
        console.log("[SystemInfoDemo] Running system info command");

        try {
            // Set loading state
            this.setLoadingState();

            // Make API call
            const response = await fetch('/run-uname');
            const data = await response.text();

            // Parse and display results
            this.displaySystemInfo(data);

        } catch (error) {
            console.error("[SystemInfoDemo] Error running system info:", error);
            this.displayError("Failed to get system information");
        }
    }

    // Set all elements to loading state
    setLoadingState() {
        const loadingText = "Loading...";

        if (this.elements.sysname) this.setElementText(this.elements.sysname, loadingText);
        if (this.elements.nodename) this.setElementText(this.elements.nodename, loadingText);
        if (this.elements.release) this.setElementText(this.elements.release, loadingText);
        if (this.elements.version) this.setElementText(this.elements.version, loadingText);
        if (this.elements.machine) this.setElementText(this.elements.machine, loadingText);
        if (this.elements.processor) this.setElementText(this.elements.processor, loadingText);
        if (this.elements.os) this.setElementText(this.elements.os, loadingText);
    }

    // Display system information
    displaySystemInfo(data) {
        const unameParts = data.trim().split(/\s+/);

        if (unameParts.length >= 7) {
            // Full uname output
            if (this.elements.sysname) this.setElementText(this.elements.sysname, unameParts[0]);
            if (this.elements.nodename) this.setElementText(this.elements.nodename, unameParts[1]);
            if (this.elements.release) this.setElementText(this.elements.release, unameParts[2]);
            if (this.elements.version) this.setElementText(this.elements.version, unameParts[3]);
            if (this.elements.machine) this.setElementText(this.elements.machine, unameParts[4]);
            if (this.elements.processor) this.setElementText(this.elements.processor, unameParts[5]);
            if (this.elements.os) this.setElementText(this.elements.os, unameParts[6]);
        } else if (unameParts.length >= 6) {
            // Handle cases where OS might be missing
            if (this.elements.sysname) this.setElementText(this.elements.sysname, unameParts[0]);
            if (this.elements.nodename) this.setElementText(this.elements.nodename, unameParts[1]);
            if (this.elements.release) this.setElementText(this.elements.release, unameParts[2]);
            if (this.elements.version) this.setElementText(this.elements.version, unameParts[3]);
            if (this.elements.machine) this.setElementText(this.elements.machine, unameParts[4]);
            if (this.elements.processor) this.setElementText(this.elements.processor, unameParts[5]);
            if (this.elements.os) this.setElementText(this.elements.os, "N/A");
        } else {
            this.displayError("Invalid uname output");
        }
    }

    // Display error message
    displayError(errorMessage) {
        if (this.elements.sysname) this.setElementText(this.elements.sysname, errorMessage);
        if (this.elements.nodename) this.setElementText(this.elements.nodename, errorMessage);
        if (this.elements.release) this.setElementText(this.elements.release, errorMessage);
        if (this.elements.version) this.setElementText(this.elements.version, errorMessage);
        if (this.elements.machine) this.setElementText(this.elements.machine, errorMessage);
        if (this.elements.processor) this.setElementText(this.elements.processor, errorMessage);
        if (this.elements.os) this.setElementText(this.elements.os, errorMessage);
    }

    // Helper to set element text (handles both .label and .textContent)
    setElementText(element, text) {
        if (!element) return;

        // GUI Composer elements use .label
        if (typeof element.label !== 'undefined') {
            element.label = text;
        }
        // Standard DOM elements use .textContent
        else if (element.textContent !== undefined) {
            element.textContent = text;
        }
        // Fallback to .innerHTML
        else {
            element.innerHTML = text;
        }
    }

    // Cleanup method
    cleanup() {
        console.log("[SystemInfoDemo] Cleaning up system info demo");
        // Remove event listeners if needed
        if (this.elements.runButton && this.runSystemInfo) {
            this.elements.runButton.removeEventListener('click', this.runSystemInfo);
        }
        this.initialized = false;
    }
}

// Export the demo
export default SystemInfoDemo;

// Also make it available globally for non-module environments
window.SystemInfoDemo = SystemInfoDemo;