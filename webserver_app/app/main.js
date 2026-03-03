/*
 * gc global variable provides access to GUI Composer infrastructure components and project information.
 * For more information, please see the Working with Javascript guide in the online help.
 */
var gc = gc || {};
gc.services = gc.services || {};

/*
 *  Boilerplate code for creating computed data bindings
 */
document.addEventListener('gc-databind-ready', function() {
    /*
     *   Add custom computed value databindings here, using the following method:
     *
     *   function gc.databind.registry.bind(targetBinding, modelBinding, [getter], [setter]);
     *
     *
     */
});

/*
 *  Boilerplate code for creating custom actions
 */
document.addEventListener('gc-nav-ready', function() {
    /*
     *   Add custom actions for menu items using the following api:
     *
     *   function gc.nav.registryAction(id, runable, [isAvailable], [isVisible]);
     *
     *
     */

    gc.nav.registerAction('open_log_pane', function() {
        if ((templateObj) && (templateObj.$)) {
            templateObj.$.ti_widget_eventlog_view.openView();
        }
    }, function() {
        return true;
    }, function() {
        return true;
    });

    gc.nav.registerAction('open_scripting_window', function() {
        window.open('app/scripting.html', '_evm_scripting');
    }, function() {
        return true;
    }, function() {
        return true;
    });
});

/*
 *  Boilerplate code for working with components in the application gist
 */


var initComplete = false;
var templateObj;
var platformConfig = null;

// Initialize the modular demo system
async function initializeModularDemos() {
    console.log("[ModularDemos] Initializing modular demo system");

    try {
        // Load demo registry system
        if (!window.demoRegistry) {
            console.log("[ModularDemos] Loading demo registry...");
            await loadScript('./demos/demo-registry.js');
        }

        // Wait for platform configuration to be available
        let attempts = 0;
        while (!platformConfig && attempts < 50) { // Wait up to 5 seconds
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!platformConfig) {
            console.warn("[ModularDemos] Platform configuration not available, using default behavior");
            return;
        }

        // Register demo modules (they will load dynamically)
        console.log("[ModularDemos] Registering demos for platform:", platformConfig.platform.name);

        // Initialize demo registry with platform configuration
        if (window.demoRegistry) {
            await window.demoRegistry.init(platformConfig);
        } else {
            console.error("[ModularDemos] Demo registry not available");
        }

        console.log("[ModularDemos] Modular demo system initialized successfully");

    } catch (error) {
        console.error("[ModularDemos] Error initializing modular demo system:", error);
        console.log("[ModularDemos] Falling back to legacy behavior");
    }
}

// Helper function to dynamically load scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if script is already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.type = 'module'; // Support ES6 modules
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Load platform configuration from backend
function loadPlatformConfiguration() {
    console.log("[Platform] Loading platform configuration...");

    fetch('/api/platform/config')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(config => {
            platformConfig = config;
            console.log("[Platform] Loaded configuration for:", config.platform.name);
            console.log("[Platform] Configuration:", config);

            // Update dynamic platform elements
            updatePlatformElements(config);

            // Log platform info
            if (templateObj && templateObj.$ && templateObj.$.ti_widget_eventlog_view) {
                templateObj.$.ti_widget_eventlog_view.log("info", `Platform: ${config.platform.name} (${config.platform.title})`);
            }
        })
        .catch(error => {
            console.error("[Platform] Failed to load configuration:", error);
            // Continue with default behavior
            if (templateObj && templateObj.$ && templateObj.$.ti_widget_eventlog_view) {
                templateObj.$.ti_widget_eventlog_view.log("warning", "Using default platform configuration");
            }
        });
}

// Update platform-specific UI elements
function updatePlatformElements(config) {
    console.log("[Platform] Updating UI elements with platform configuration");

    try {
        // Update page title dynamically
        if (config.platform && config.platform.title) {
            document.title = config.platform.title;
        }

        // Update any platform-specific labels or content
        // (For now, we keep this minimal and don't change major UI structure)

        // Log enabled demos
        if (config.demos && config.demos.enabled) {
            console.log("[Platform] Enabled demos:", config.demos.enabled.join(", "));
        }

    } catch (error) {
        console.error("[Platform] Error updating platform elements:", error);
    }
}

// Wait for DOMContentLoaded event before trying to access the application template
var init = async function() {
    console.log("init() function called.");
    templateObj = document.querySelector('#template_obj');
    console.log("templateObj after querySelector:", templateObj);

    // Wait for the template to fire a dom-change event to indicate that it has been 'stamped'
    templateObj.addEventListener('dom-change', function() {
        console.log("Template stamped successfully.");

        // Check for completion
        setTimeout(async function() {
            if (!initComplete) {
                initComplete = true;
                console.log("Initialization starting...");
            } else {
                console.log("Initialization already completed.");
                return;
            }

            // Load platform configuration
            loadPlatformConfiguration();

            // Expand vtabcontainer nav bar when user clicks on menu icon or 'Menu' label
            templateObj.toggleMenu = function(event){
                console.log("toggleMenu called. Current isExpanded:", templateObj.$.ti_widget_vtabcontainer.isExpanded);
                templateObj.$.ti_widget_vtabcontainer.isExpanded = !templateObj.$.ti_widget_vtabcontainer.isExpanded;
                console.log("New isExpanded:", templateObj.$.ti_widget_vtabcontainer.isExpanded);
            };
            templateObj.$.ti_widget_icon_button_menu.addEventListener('click',templateObj.toggleMenu);
            templateObj.$.ti_widget_label_menu.addEventListener('click',templateObj.toggleMenu);

            // =========================
            // MODULAR DEMO SYSTEM
            // =========================

            // Load demo registry and initialize demos based on platform configuration
            try {
                await initializeModularDemos();
                console.log("[Main] All demos initialized successfully via modular system");
            } catch (error) {
                console.error("[Main] Error initializing modular demo system:", error);
            }

            console.log("Initialization completed successfully!");

        }, 1);

    });
};

// Initialize the application
templateObj = document.querySelector('#template_obj');
if (templateObj) {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}