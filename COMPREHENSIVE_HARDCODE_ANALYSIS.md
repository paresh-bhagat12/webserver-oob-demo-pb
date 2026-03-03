# 🔍 Comprehensive Hardcoded Content Analysis & Genericization Plan

## Overview
After systematically analyzing **ALL** files in the repository, here is the complete inventory of hardcoded platform-specific content and the plan to make everything generic.

---

## 🔴 **CRITICAL FINDING: Most Files Are Still Hardcoded!**

### Current Genericization Status:
- ✅ **Backend Configuration Loading**: Generic (config-loader.js, API endpoints)
- ✅ **CSS Styling**: Generic (no platform references)
- ✅ **README & Documentation**: Generic
- ❌ **Frontend HTML**: MASSIVELY hardcoded (10+ platform references)
- ❌ **Frontend JavaScript**: EXTENSIVELY hardcoded (700+ lines of demo logic)
- ❌ **Native C Utilities**: Hardcoded paths throughout
- ❌ **GUI Composer Config**: Hardcoded project metadata
- ❌ **Service Files**: Hardcoded descriptions

**RESULT: Only ~20% of the codebase is actually generic!**

---

## 📋 **Detailed File-by-File Analysis**

### 🔴 **1. webserver_app/app/index.html** - **CRITICAL**
**Status**: ❌ **Heavily Hardcoded** (3,400+ lines with platform references)

**Hardcoded Content Found**:
```html
Line 34:   <title>AM335x Demo</title>
Line 2087: <ti-widget-menubar product-name="AM335x Demo">
Line 2112: <ti-widget-label label="AM335X" font-size="32px">
Line 2118: <ti-widget-label label="BeagleBone Green Eco: A low-cost...">
Line 2122: <ti-widget-label label="AM335x Evaluation Module: Comprehensive...">
Line 2117: <ti-widget-image image-path="images/beagl-bone-grn-eco-angled.png">
Line 2121: <ti-widget-image image-path="images/tmdxevm3358-angled.png">
Line 2933: <p>Everything you need to develop with AM335x Sitara processors</p>
Line 2937: onclick="window.open('https://www.ti.com/product/AM3358', '_blank')"
Line 2948: href="https://www.ti.com/product/AM3358"
Line 2963: Complete technical documentation covering all AM335x subsystems...
Line 2973: onclick="window.open('https://www.ti.com/tool/PROCESSOR-SDK-AM335X', '_blank')"
Line 2984: href="https://www.ti.com/tool/PROCESSOR-SDK-AM335X"
Line 2991: onclick="window.open('https://software-dl.ti.com/.../AM335X/latest/...')"
Line 3002: href="https://software-dl.ti.com/.../AM335X/latest/..."
```

**Genericization Plan**:
1. **Convert to EJS Templates**: Replace hardcoded content with template variables
2. **Dynamic Board Carousel**: Generate from platform config board array
3. **Dynamic Documentation Section**: Loop through platform config documentation
4. **Template Variables Needed**:
   ```html
   <%= platform.title %> → "AM335x Demo" | "AM62D Demo"
   <%= platform.displayName %> → "AM335X" | "AM62D"
   <%= platform.headerDescription %> → Platform-specific tagline
   <%= boards[0].image %> → "images/beagl-bone-grn-eco-angled.png"
   <%= boards[0].description %> → Board descriptions
   <%= docs[0].url %> → Documentation URLs
   ```

---

### 🔴 **2. webserver_app/app/main.js** - **CRITICAL**
**Status**: ❌ **Extensively Hardcoded** (845 lines, ~700 lines of hardcoded demo logic)

**Hardcoded Content Found**:
```javascript
// Hardcoded window names
Line 44: window.open('app/scripting.html', '_evm_scripting');

// Hardcoded demo element IDs (60+ references)
Line 157: templateObj.$.run_uname_button
Line 158: templateObj.$.uname_sysname
Line 221: document.getElementById('fetch_devices_button')
Line 222: document.getElementById('start_audio_button')
Line 898: templateObj.$.gauge1.value = data;

// Hardcoded demo logic (600+ lines)
Lines 156-216: Complete system info demo implementation
Lines 218-895: Complete audio classification demo implementation
Lines 896+: CPU performance demo implementation
```

**Genericization Plan**:
1. **Demo Module System**: Create loadable demo modules
2. **Dynamic Demo Loading**: Load demos based on platform config
3. **Conditional Demo Rendering**: Show/hide demos per platform
4. **Demo Registry**:
   ```javascript
   const enabledDemos = getPlatformConfig()?.demos?.enabled || [];
   if (enabledDemos.includes('audio-classification')) {
       loadAudioClassificationDemo();
   }
   if (enabledDemos.includes('system-info')) {
       loadSystemInfoDemo();
   }
   ```

---

### 🔴 **3. webserver_app/app/project.json** - **HIGH**
**Status**: ❌ **Fully Hardcoded**

**Hardcoded Content Found**:
```json
Line 2: "template":"AM335x Demo"
Line 6: "projectName":"AM335x_Demo"
Line 7: "applicationName":"AM335x Demo"
```

**Genericization Plan**:
1. **Template Variables**: Convert to template with platform variables
2. **Build-Time Generation**: Generate during platform build
3. **Template Structure**:
   ```json
   {
     "template": "{{PLATFORM_TEMPLATE}}",
     "projectName": "{{PLATFORM_PROJECT_NAME}}",
     "applicationName": "{{PLATFORM_APPLICATION_NAME}}"
   }
   ```

---

### 🔴 **4. webserver_app/linux_app/audio_utils.c** - **HIGH**
**Status**: ❌ **Hardcoded Model Paths**

**Hardcoded Content Found**:
```c
Line 54:  char fifo_path[256] = "/tmp/audio_classification_fifo";
Line 55:  char pid_file[256] = "/tmp/audio_classification.pid";
Line 201: model=/usr/share/oob-demo-assets/models/yamnet_audio_classification.tflite
Line 202: option1=/usr/share/oob-demo-assets/labels/yamnet_label_list.txt
```

**Genericization Plan**:
1. **Environment Variable Support**: Read paths from environment
2. **Command Line Arguments**: Accept model/label paths as arguments
3. **Default Fallbacks**: Use current paths as defaults
4. **Implementation**:
   ```c
   char *model_path = getenv("AUDIO_MODEL_PATH");
   if (!model_path) model_path = "/usr/share/oob-demo-assets/models/yamnet_audio_classification.tflite";

   char *labels_path = getenv("AUDIO_LABELS_PATH");
   if (!labels_path) labels_path = "/usr/share/oob-demo-assets/labels/yamnet_label_list.txt";
   ```

---

### 🔴 **5. webserver_app/linux_app/cpu_stats.c** - **LOW**
**Status**: ⚠️ **Hardcoded Temp Path** (Acceptable)

**Hardcoded Content Found**:
```c
Line 51: #define HISTORY_FILE "/tmp/cpu_stats_history.dat"
```

**Genericization Plan**:
1. **Environment Variable Override**: Allow custom history file path
2. **Keep Default**: /tmp is standard for temporary files
3. **Low Priority**: Current hardcoding is acceptable for most use cases

---

### 🔴 **6. webserver_app/webserver/fifo-reader.js** - **MEDIUM**
**Status**: ❌ **Hardcoded FIFO Path**

**Hardcoded Content Found**:
```javascript
Line 12: const fifoPath = '/tmp/audio_classification_fifo';
```

**Genericization Plan**:
1. **Environment Variable**: Read from AUDIO_FIFO_PATH
2. **Shared Configuration**: Use same config as audio_utils.c
3. **Implementation**:
   ```javascript
   const fifoPath = process.env.AUDIO_FIFO_PATH || '/tmp/audio_classification_fifo';
   ```

---

### 🔴 **7. webserver_app/webserver/webserver-oob.service** - **MEDIUM**
**Status**: ❌ **Hardcoded Description**

**Hardcoded Content Found**:
```ini
Line 2: Description=AM335x OOB Demo Webserver
```

**Genericization Plan**:
1. **Template Variable**: Replace with {{SERVICE_DESCRIPTION}}
2. **Build-Time Generation**: Generate during platform build
3. **Template**:
   ```ini
   Description={{SERVICE_DESCRIPTION}}  # "AM335x OOB Demo Webserver" | "AM62D OOB Demo Webserver"
   ```

---

### 🔴 **8. webserver_app/webserver/package.json** - **MEDIUM**
**Status**: ❌ **Hardcoded Description**

**Hardcoded Content Found**:
```json
Line 4: "description": "Webserver for the AM335x OOB Demo"
```

**Genericization Plan**:
1. **Template Variable**: Replace with {{PACKAGE_DESCRIPTION}}
2. **Build-Time Generation**: Generate during platform build
3. **Template**:
   ```json
   "description": "{{PACKAGE_DESCRIPTION}}"  # Platform-specific description
   ```

---

### ✅ **Files Already Generic:**
- ✅ `webserver_app/app/oneui.css` - No platform references
- ✅ `webserver_app/webserver/config-loader.js` - Fully generic configuration system
- ✅ `webserver_app/webserver/webserver-oob.js` - Uses platform configuration (✅ **Already Updated**)
- ✅ `README.md` - No platform references
- ✅ `webserver_app/app/splash/package.json` - Generic splash configuration
- ✅ Platform configuration files (`platforms/*.json`) - ✅ **Already Created**
- ✅ Build system (`build.js`) - ✅ **Already Created**

---

## 🎯 **PRIORITY-BASED IMPLEMENTATION PLAN**

### **🔥 PHASE 1: Critical Frontend Genericization (High Impact)**

#### **1.1 Convert index.html to EJS Template System**
**Files**: `webserver_app/app/index.html`
**Effort**: High (Major refactoring)
**Impact**: Critical (Removes 10+ hardcoded platform references)

**Implementation Steps**:
1. Create template directory: `webserver_app/app/templates/`
2. Split index.html into template sections:
   ```
   templates/
   ├── base.ejs          # Common HTML structure
   ├── home.ejs          # Home tab with board carousel
   ├── documentation.ejs # Documentation links section
   └── layout.ejs        # Main layout wrapper
   ```
3. Convert hardcoded content to template variables:
   ```html
   <!-- Before -->
   <title>AM335x Demo</title>
   <ti-widget-label label="AM335X" />
   <ti-widget-image image-path="images/beagl-bone-grn-eco-angled.png" />

   <!-- After -->
   <title><%= platform.title %></title>
   <ti-widget-label label="<%= platform.displayName %>" />
   <% boards.forEach(board => { %>
     <ti-widget-image image-path="<%= board.image %>" />
   <% }); %>
   ```
4. Update backend to render templates:
   ```javascript
   app.set('view engine', 'ejs');
   app.get('/', (req, res) => {
       const config = configManager.getConfig();
       res.render('index', {
           platform: config.platform,
           boards: config.boards,
           documentation: config.documentation
       });
   });
   ```

#### **1.2 Create Modular Demo System**
**Files**: `webserver_app/app/main.js`
**Effort**: High (Major refactoring)
**Impact**: Critical (Makes demo loading configurable)

**Implementation Steps**:
1. Create demo module structure:
   ```
   webserver_app/demos/
   ├── demo-registry.js        # Demo registration system
   ├── audio-classification/
   │   ├── demo.js            # Demo implementation
   │   ├── ui.html            # Demo UI template
   │   └── styles.css         # Demo-specific styles
   ├── system-info/
   │   └── demo.js
   └── cpu-performance/
       └── demo.js
   ```

2. Create demo registration system:
   ```javascript
   // demo-registry.js
   class DemoRegistry {
       constructor() { this.demos = new Map(); }

       register(demoId, demoModule) {
           this.demos.set(demoId, demoModule);
       }

       loadEnabledDemos(platformConfig) {
           const enabled = platformConfig.demos?.enabled || [];
           enabled.forEach(demoId => {
               if (this.demos.has(demoId)) {
                   this.demos.get(demoId).initialize(platformConfig);
               }
           });
       }
   }
   ```

3. Convert existing demo logic to modules:
   ```javascript
   // demos/audio-classification/demo.js
   class AudioClassificationDemo {
       initialize(platformConfig) {
           const config = platformConfig.demos.configurations['audio-classification'];
           this.setupUI();
           this.setupWebSocket();
           // Use config.modelPath, config.enableGpuAcceleration, etc.
       }
   }
   ```

### **🔸 PHASE 2: Native Utilities Configuration (Medium Impact)**

#### **2.1 Make audio_utils.c Configurable**
**Files**: `webserver_app/linux_app/audio_utils.c`
**Effort**: Medium
**Impact**: High (Enables platform-specific models)

**Implementation**:
```c
// Add environment variable support
char *get_model_path() {
    char *model_path = getenv("AUDIO_MODEL_PATH");
    return model_path ? model_path : "/usr/share/oob-demo-assets/models/yamnet_audio_classification.tflite";
}

char *get_labels_path() {
    char *labels_path = getenv("AUDIO_LABELS_PATH");
    return labels_path ? labels_path : "/usr/share/oob-demo-assets/labels/yamnet_label_list.txt";
}

// Update GStreamer pipeline construction to use configurable paths
snprintf(pipeline, sizeof(pipeline),
    "alsasrc device=%s ! ... tensor_filter model=%s ! tensor_decoder option1=%s ! ...",
    device, get_model_path(), get_labels_path());
```

#### **2.2 Make fifo-reader.js Configurable**
**Files**: `webserver_app/webserver/fifo-reader.js`
**Effort**: Low
**Impact**: Medium (Consistency with audio_utils)

**Implementation**:
```javascript
const fifoPath = process.env.AUDIO_FIFO_PATH || '/tmp/audio_classification_fifo';
```

### **🔹 PHASE 3: Build-Time Template Generation (Low Effort, High Consistency)**

#### **3.1 Template Generation for Static Files**
**Files**: `project.json`, `package.json`, `webserver-oob.service`
**Effort**: Low (Extend existing build system)
**Impact**: Medium (Removes remaining hardcoded references)

**Implementation**: Extend `build.js` to process template files:
```javascript
// In build.js
function processTemplate(templatePath, outputPath, platformConfig) {
    let content = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    content = content.replace(/\{\{PLATFORM_TITLE\}\}/g, platformConfig.platform.title);
    content = content.replace(/\{\{SERVICE_DESCRIPTION\}\}/g, platformConfig.branding.serviceDescription);
    content = content.replace(/\{\{PACKAGE_DESCRIPTION\}\}/g, platformConfig.branding.packageDescription);

    fs.writeFileSync(outputPath, content);
}
```

**Templates to Create**:
- `templates/project.json.template`
- `templates/package.json.template`
- `templates/webserver-oob.service.template`

---

## 📊 **IMPLEMENTATION EFFORT ESTIMATION**

| Phase | Files | Effort | Impact | Duration |
|-------|-------|--------|--------|----------|
| **Phase 1.1** | index.html → templates | High | Critical | 2-3 days |
| **Phase 1.2** | main.js → demo modules | High | Critical | 3-4 days |
| **Phase 2.1** | audio_utils.c config | Medium | High | 1 day |
| **Phase 2.2** | fifo-reader.js config | Low | Medium | 0.5 day |
| **Phase 3.1** | Build templates | Low | Medium | 1 day |
| **Testing & Integration** | All | Medium | Critical | 2 days |

**Total Estimated Effort**: 9-11 days

---

## 🎯 **EXPECTED RESULTS AFTER FULL IMPLEMENTATION**

### **Before (Current State)**:
```
✅ Platform config loading works
❌ All demos always load (regardless of platform config)
❌ UI shows hardcoded "AM335x Demo" title
❌ UI shows hardcoded BeagleBone/AM335x EVM boards
❌ UI shows hardcoded AM335x documentation links
❌ Audio classification uses hardcoded model paths
❌ Service/package descriptions hardcoded to AM335x
```

### **After (Fully Generic)**:
```
✅ Platform config loading works
✅ Only configured demos load per platform
✅ UI shows dynamic platform title ("AM62D Demo" for AM62D)
✅ UI shows platform-specific boards and descriptions
✅ UI shows platform-specific documentation links
✅ Audio classification uses platform-specific model paths
✅ Service/package descriptions reflect actual platform
✅ Easy to add new platforms via JSON configuration
✅ AM62D gets custom demos, AM335x keeps existing demos
```

---

## 🚨 **CRITICAL BLOCKERS IDENTIFIED**

### **1. Frontend UI Structure Dependencies**
**Problem**: Current HTML structure assumes specific element IDs and layouts
**Solution**: Must create dynamic UI generation system

### **2. Demo Interdependencies**
**Problem**: Demos share global variables and DOM assumptions
**Solution**: Must encapsulate demos into independent modules

### **3. Asset Path Management**
**Problem**: Board images have hardcoded paths throughout UI
**Solution**: Must create dynamic asset path resolution

### **4. WebSocket Protocol Assumptions**
**Problem**: Audio demo assumes specific WebSocket message formats
**Solution**: Must make protocol configurable per platform

---

## 💡 **RECOMMENDATIONS**

### **Immediate Actions Required**:
1. **🔥 Start with Phase 1.1** (index.html templates) - Biggest impact
2. **🔄 Refactor main.js** demo logic into modules
3. **⚙️ Add environment variable** support to native utilities
4. **🔧 Extend build system** for template processing

### **Architecture Decisions**:
- **Use EJS templating** for HTML generation (proven, lightweight)
- **Create demo module system** for future extensibility
- **Maintain backward compatibility** during transition
- **Support both build-time and runtime** configuration

### **Success Criteria**:
- ✅ `node build.js am62d` generates fully AM62D-specific package
- ✅ AM62D package shows AM62D branding, boards, docs, model paths
- ✅ No hardcoded AM335x references remain in generated packages
- ✅ Easy to add new platforms via JSON configuration only

**Current Status: ~20% Generic → Target: 100% Generic** 🎯