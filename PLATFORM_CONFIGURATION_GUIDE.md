# Platform Configuration System - Implementation Guide

## Overview

This document describes the transformation of the `webserver-oob-demo-pb` repository from an AM335x-specific implementation to a generic, configurable platform system that supports multiple TI processors (AM335x, AM62D, and future platforms).

## Key Changes Summary

- **Configurable Demo System**: Demos can be enabled/disabled per platform
- **JSON-Based Configuration**: Platform-specific settings managed via JSON files
- **Build-Time Package Generation**: Platform-specific packages built from generic templates
- **Runtime Configuration Loading**: Backend loads platform config and serves to frontend
- **Backward Compatibility**: Existing AM335x functionality preserved by default

---

## Repository Structure Changes

### New Files Created

```
webserver-oob-demo-pb/
├── platforms/                                    # ⭐ NEW: Platform configurations
│   ├── am335x.json                              # AM335x platform config
│   └── am62d.json                               # AM62D platform config
├── build.js                                     # ⭐ NEW: Build system
├── webserver_app/
│   ├── webserver/
│   │   └── config-loader.js                     # ⭐ NEW: Configuration loader
│   └── demos/                                   # ⭐ NEW: Demo components (structure only)
│       ├── audio-classification/
│       ├── cpu-performance/
│       └── system-info/
└── dist/                                        # ⭐ NEW: Generated platform packages
    ├── am335x/                                  # Built AM335x package
    └── am62d/                                   # Built AM62D package
```

### Modified Files

```
webserver_app/
├── webserver/
│   └── webserver-oob.js                         # ✏️ MODIFIED: Added config loading & API endpoints
└── app/
    └── main.js                                  # ✏️ MODIFIED: Added platform config fetching
```

---

## 1. Platform Configuration System

### 1.1 Configuration Files Structure

**Location**: `platforms/{platform}.json`

**AM335x Configuration** (`platforms/am335x.json`):
```json
{
  "platform": {
    "name": "AM335x",
    "displayName": "AM335X",
    "family": "Sitara AM335x",
    "title": "AM335x Demo",
    "description": "Analyze system performance, review documentation, and run demos"
  },
  "branding": {
    "applicationName": "AM335x Demo",
    "projectName": "AM335x_Demo",
    "serviceDescription": "AM335x OOB Demo Webserver",
    "packageDescription": "Webserver for the AM335x OOB Demo"
  },
  "boards": [
    {
      "name": "BeagleBone Green Eco",
      "description": "A low-cost, industrial-grade open-source hardware platform",
      "image": "images/beagl-bone-grn-eco-angled.png"
    }
  ],
  "demos": {
    "enabled": ["home", "audio-classification", "cpu-performance", "documentation"],
    "configurations": {
      "audio-classification": {
        "modelPath": "/usr/share/oob-demo-assets/models/yamnet_audio_classification.tflite",
        "enableGpuAcceleration": false,
        "useAiAccelerator": false
      }
    }
  },
  "documentation": {
    "sections": [...],  // Platform-specific docs
    "quickLinks": [...]
  }
}
```

**AM62D Configuration** (`platforms/am62d.json`):
```json
{
  "platform": {
    "name": "AM62D",
    "title": "AM62D Demo",
    "description": "Explore edge AI capabilities, system performance, and documentation"
  },
  "demos": {
    "enabled": ["home", "audio-classification", "cpu-performance", "custom-demo", "documentation"],
    "configurations": {
      "audio-classification": {
        "modelPath": "/usr/share/oob-demo-assets/models/yamnet_optimized_am62d.tflite",
        "enableGpuAcceleration": true,
        "useAiAccelerator": true
      },
      "custom-demo": {
        "type": "placeholder-for-your-custom-demo",
        "description": "Custom demo specific to AM62D"
      }
    }
  }
  // ... rest similar to AM335x but with AM62D-specific values
}
```

### 1.2 Configuration Loading Priority

1. **Environment variables** (highest priority)
2. **Custom platform config** (`/etc/webserver-oob/platform.json`)
3. **Default platform config** (`platforms/{PLATFORM_NAME}.json`)
4. **Fallback defaults** (hardcoded AM335x values)

---

## 2. Backend Implementation

### 2.1 Configuration Loader Module

**File**: `webserver_app/webserver/config-loader.js`

**Key Functions**:
- `loadConfiguration()` - Loads and merges configuration from multiple sources
- `getDemoConfig(demoId)` - Gets demo-specific configuration
- `isDemoEnabled(demoId)` - Checks if demo is enabled for platform
- Environment variable support for runtime overrides

**Environment Variables Supported**:
```bash
PLATFORM_NAME=am62d                    # Platform selection
PLATFORM_TITLE="Custom Title"          # Override title
AUDIO_MODEL_PATH="/path/to/model"       # Override model path
AUDIO_LABELS_PATH="/path/to/labels"     # Override labels path
PLATFORM_CONFIG="/custom/config.json"   # Custom config file path
```

### 2.2 Backend API Changes

**File**: `webserver_app/webserver/webserver-oob.js`

**New API Endpoints**:
```javascript
GET /api/platform/config    // Returns complete platform configuration
GET /api/platform/info      // Returns platform summary information
```

**Modified Audio Classification**:
- Now uses platform-specific model paths from configuration
- Supports GPU acceleration flags based on platform
- Passes configuration via environment variables to native utilities

**Changes Made**:
```javascript
// Added at startup
const configManager = require('./config-loader');
let platformConfig = configManager.loadConfiguration();

// New endpoints
app.get('/api/platform/config', (req, res) => {
    res.json(configManager.getConfig());
});

// Modified audio classification to use platform config
const audioConfig = configManager.getDemoConfig('audio-classification');
if (audioConfig.modelPath) {
    process.env.AUDIO_MODEL_PATH = audioConfig.modelPath;
}
```

---

## 3. Frontend Implementation

### 3.1 Platform Configuration Loading

**File**: `webserver_app/app/main.js`

**Changes Made**:
```javascript
// Added global platform config variable
var platformConfig = null;

// Added configuration loading function
function loadPlatformConfiguration() {
    fetch('/api/platform/config')
        .then(response => response.json())
        .then(config => {
            platformConfig = config;
            updatePlatformElements(config);
        });
}

// Added during initialization
loadPlatformConfiguration();

// Utility function for other components
function getPlatformConfig() {
    return platformConfig;
}
```

**Current Frontend Capabilities**:
- Dynamically updates page title based on platform
- Logs platform information and enabled demos
- Provides configuration access to other components
- Maintains backward compatibility

---

## 4. Build System

### 4.1 Build Script

**File**: `build.js`

**Capabilities**:
- Lists available platforms
- Builds platform-specific packages
- Updates platform-specific files (package.json, service files, project.json)
- Creates deployable packages in `dist/` directory

**Usage**:
```bash
node build.js --list              # List available platforms
node build.js am335x              # Build AM335x package
node build.js am62d               # Build AM62D package
node build.js --all               # Build all platforms
```

**Build Process**:
1. Load platform configuration from `platforms/{platform}.json`
2. Copy source files to `dist/{platform}/`
3. Update platform-specific files:
   - `package.json`: Update description and name
   - `webserver-oob.service`: Update service description
   - `project.json`: Update GUI Composer metadata
4. Create platform config file in output package

### 4.2 Generated Package Structure

```
dist/am62d/
├── webserver_app/
│   ├── webserver/
│   │   ├── webserver-oob.js
│   │   ├── config-loader.js
│   │   ├── package.json              # ✏️ Updated with AM62D description
│   │   └── webserver-oob.service     # ✏️ Updated with AM62D service description
│   ├── app/
│   │   ├── index.html
│   │   ├── main.js
│   │   └── project.json              # ✏️ Updated with AM62D project metadata
│   └── config/
│       └── platform.json             # ⭐ NEW: Platform configuration
├── README.md
└── LICENSE
```

---

## 5. Yocto Recipe Integration

### 5.1 Required Changes to `webserver-oob_git.bb`

**Add Platform Selection**:
```bitbake
# Platform selection variable
WEBSERVER_PLATFORM ??= "am335x"
```

**Install Configuration Files**:
```bitbake
do_install_append() {
    # Install platform configurations
    install -d ${D}${datadir}/webserver-oob/platforms
    install -m 0644 ${S}/platforms/*.json ${D}${datadir}/webserver-oob/platforms/

    # Install config loader
    install -m 0644 ${S}/webserver_app/webserver/config-loader.js \
        ${D}${bindir}/webserver_app/webserver/

    # Create platform environment file
    install -d ${D}${sysconfdir}/webserver-oob
    echo "PLATFORM_NAME=${WEBSERVER_PLATFORM}" > \
        ${D}${sysconfdir}/webserver-oob/platform.env
}
```

**Update systemd Service**:
```bitbake
# Add environment file to service
sed -i '/\[Service\]/a EnvironmentFile=-/etc/webserver-oob/platform.env' \
    ${D}${systemd_system_unitdir}/webserver-oob.service
```

**Alternative: Use Build System**:
```bitbake
do_compile() {
    # Use the build system instead of manual file copying
    export PLATFORM_NAME="${WEBSERVER_PLATFORM}"
    node ${S}/build.js ${WEBSERVER_PLATFORM}
    cp -r ${S}/dist/${WEBSERVER_PLATFORM}/* ${B}/
}
```

### 5.2 Machine-Specific Configuration

**In machine configuration files**:
```bitbake
# conf/machine/am335x-evm.conf
WEBSERVER_PLATFORM = "am335x"

# conf/machine/am62d-evm.conf
WEBSERVER_PLATFORM = "am62d"
```

### 5.3 Package Variants (Optional)

```bitbake
# Create platform-specific packages
PACKAGES += "${PN}-am335x ${PN}-am62d"

# Platform-specific runtime selection
WEBSERVER_PLATFORM_am335x = "am335x"
WEBSERVER_PLATFORM_am62d = "am62d"
```

---

## 6. Usage Instructions

### 6.1 Development Usage

**Running with Different Platforms**:
```bash
# Run with AM335x configuration (default)
cd webserver_app/webserver
node webserver-oob.js

# Run with AM62D configuration
PLATFORM_NAME=am62d node webserver-oob.js

# Run with custom configuration file
PLATFORM_CONFIG=/path/to/custom.json node webserver-oob.js

# Override specific settings
PLATFORM_TITLE="My Custom Demo" \
AUDIO_MODEL_PATH="/custom/model.tflite" \
node webserver-oob.js
```

**Building Platform Packages**:
```bash
# Build specific platform
node build.js am62d

# Build all platforms
node build.js --all

# List available platforms
node build.js --list
```

### 6.2 Production Deployment

**Option 1: Environment Variable**
```bash
# Set platform in systemd environment
echo "PLATFORM_NAME=am62d" > /etc/webserver-oob/platform.env
systemctl restart webserver-oob
```

**Option 2: Custom Configuration File**
```bash
# Place custom config
cp platforms/am62d.json /etc/webserver-oob/platform.json
systemctl restart webserver-oob
```

---

## 7. Adding New Platforms

### 7.1 Create Platform Configuration

```bash
# Copy existing platform as template
cp platforms/am335x.json platforms/am64x.json

# Edit platform-specific values
{
  "platform": {
    "name": "AM64X",
    "title": "AM64X Demo",
    "description": "High-performance processing and edge AI capabilities"
  },
  "demos": {
    "enabled": ["home", "audio-classification", "cpu-performance", "documentation"],
    "configurations": {
      "audio-classification": {
        "modelPath": "/usr/share/oob-demo-assets/models/yamnet_am64x.tflite",
        "enableGpuAcceleration": true
      }
    }
  }
  // ... update other sections
}
```

### 7.2 Add Platform Assets

```bash
# Create platform-specific image directory
mkdir -p webserver_app/app/images/am64x/

# Add board images
cp board-images/*.png webserver_app/app/images/am64x/

# Update image paths in configuration
"boards": [
  {
    "image": "images/am64x/am64x-evm-angled.png"
  }
]
```

### 7.3 Build New Platform

```bash
node build.js am64x
```

---

## 8. Adding Custom Demos

### 8.1 Define Demo in Platform Configuration

```json
{
  "demos": {
    "enabled": ["home", "audio-classification", "my-custom-demo", "documentation"],
    "configurations": {
      "my-custom-demo": {
        "title": "Custom Processing Demo",
        "description": "Demonstrates custom processing capabilities",
        "modelPath": "/usr/share/models/custom-model.tflite",
        "enabled": true,
        "customSetting": "value"
      }
    }
  }
}
```

### 8.2 Backend Demo Support

```javascript
// Check if demo is enabled
if (configManager.isDemoEnabled('my-custom-demo')) {
    // Add demo-specific routes
    app.get('/start-custom-demo', (req, res) => {
        const demoConfig = configManager.getDemoConfig('my-custom-demo');
        // Use demoConfig.customSetting, demoConfig.modelPath, etc.
    });
}
```

### 8.3 Frontend Demo Integration

```javascript
// Check if demo should be displayed
const config = getPlatformConfig();
if (config.demos.enabled.includes('my-custom-demo')) {
    // Show demo tab/component
    // Use config.demos.configurations['my-custom-demo'] for settings
}
```

---

## 9. Testing and Validation

### 9.1 Configuration Validation

```bash
# Test configuration loading
cd webserver_app/webserver
PLATFORM_NAME=am335x node -e "
const cfg = require('./config-loader');
console.log('✅ Config loaded:', cfg.getConfigSummary());
"

# Test AM62D configuration
PLATFORM_NAME=am62d node -e "
const cfg = require('./config-loader');
console.log('✅ Config loaded:', cfg.getConfigSummary());
"
```

### 9.2 Build System Testing

```bash
# Test build for all platforms
node build.js --all

# Verify generated packages
ls -la dist/
ls -la dist/am335x/webserver_app/config/
ls -la dist/am62d/webserver_app/config/
```

### 9.3 Runtime Testing

```bash
# Test AM335x (default behavior)
cd webserver_app/webserver && node webserver-oob.js

# Test AM62D
PLATFORM_NAME=am62d node webserver-oob.js

# Check platform API endpoints
curl http://localhost:3000/api/platform/info
curl http://localhost:3000/api/platform/config
```

---

## 10. Backward Compatibility

### 10.1 Default Behavior

- **No environment variables set**: Defaults to AM335x configuration
- **Configuration load failure**: Falls back to original hardcoded AM335x behavior
- **Missing configuration files**: Uses built-in defaults

### 10.2 Migration Path

**Existing Deployments**:
1. Continue working without changes (defaults to AM335x)
2. Gradually adopt platform configuration by setting `PLATFORM_NAME`
3. Eventually migrate to platform-specific packages

**File Compatibility**:
- All existing files remain unchanged in functionality
- New files added alongside existing ones
- No breaking changes to API endpoints or WebSocket protocols

---

## 11. Future Enhancements

### 11.1 Planned Features

- **Template-based HTML generation**: Replace hardcoded HTML with dynamic templates
- **Theme customization**: Platform-specific CSS themes and colors
- **Localization support**: Multi-language configuration
- **Hot-reload configuration**: Update config without restart
- **Web-based configuration editor**: GUI for editing platform configs

### 11.2 Extension Points

- **Demo plugin system**: Loadable demo modules
- **Custom themes**: CSS/styling per platform
- **Platform detection**: Auto-detect platform from hardware
- **Configuration validation**: JSON schema validation
- **Monitoring integration**: Platform-specific metrics

---

## Summary

This transformation successfully converts the webserver-oob-demo-pb from a hardcoded AM335x implementation to a flexible, configurable platform system. The changes maintain full backward compatibility while enabling:

- **Easy platform switching** via environment variables
- **JSON-based configuration** for all platform-specific settings
- **Build-time package generation** for deployment optimization
- **Runtime configuration loading** for dynamic behavior
- **Simple extension** for new platforms and demos

The system is ready for production use and can easily accommodate future TI processors and custom demonstration requirements.