# Generic Platform WebServer Implementation Plan

## Overview
Transform webserver-oob-demo-pb from AM335x-specific to a generic platform framework with deploy-time platform configuration, and integrate rpmsg-dma-pb demos for AM62d platform.

## Cross-Compilation Setup
```bash
export PATH=$HOME/arm-gnu-toolchain-13.3.rel1-x86_64-aarch64-none-linux-gnu/bin:$PATH
# Use either:
CROSS_COMPILE=aarch64-none-linux-gnu-
# OR:
CC=aarch64-none-linux-gnu-gcc
```

## Architecture Design

### Single-Platform Deploy-Time Configuration
- **Principle**: One webserver instance per platform deployment
- **Configuration**: Platform-specific settings loaded at startup
- **Deployment**: Separate builds/packages per platform (AM335x, AM62d, etc.)

### Directory Structure (New)
```
webserver-oob-demo-pb/
├── webserver_app/
│   ├── common/                          # Platform-agnostic core
│   │   ├── webserver/
│   │   │   ├── webserver.js            # Generic server (renamed from webserver-oob.js)
│   │   │   ├── demo-manager.js         # NEW: Demo lifecycle management
│   │   │   ├── demo-parser.js          # NEW: Output parsing utilities
│   │   │   ├── fifo-reader.js          # Existing: Reuse pattern
│   │   │   └── package.json
│   │   ├── app/                        # Generic frontend
│   │   │   ├── index.html              # Template-based generic UI
│   │   │   ├── main.js                 # Platform-agnostic logic
│   │   │   ├── oneui.css               # Existing styling
│   │   │   └── components/             # GUI Composer components
│   │   └── linux_app/                  # Common C utilities
│   │       ├── cpu_stats.c
│   │       └── Makefile
│   │
│   ├── platforms/                       # Platform-specific configurations
│   │   ├── am335x/
│   │   │   ├── config.json             # Platform metadata
│   │   │   ├── demos.json              # Demo definitions
│   │   │   ├── assets/                 # Board images
│   │   │   │   ├── beagl-bone-grn-eco-angled.png
│   │   │   │   └── tmdxevm3358-angled.png
│   │   │   └── linux_app/              # Platform-specific utilities
│   │   │       └── audio_utils.c
│   │   │
│   │   └── am62d/
│   │       ├── config.json             # AM62d metadata
│   │       ├── demos.json              # RPMsg demo definitions
│   │       ├── assets/                 # AM62d board images
│   │       └── demos/                  # RPMsg-DMA executables
│   │           ├── rpmsg_2dfft_example
│   │           ├── rpmsg_audio_offload_example
│   │           ├── rpmsg_2dfft_nodata_example
│   │           └── rpmsg_control_example
│   │
│   └── config/                          # Deployment configuration
│       ├── webserver.conf              # Environment variables
│       └── webserver.service           # Systemd service
│
├── build/                              # Build outputs per platform
│   ├── am335x/
│   └── am62d/
│
└── scripts/                            # Build and deployment scripts
    ├── build.sh
    └── deploy.sh
```

## Implementation Phases

### Phase 1A: Core Genericization (2-3 hours)
1. Create platform configuration system
2. Modify webserver.js to load platform config
3. Update frontend to use template variables
4. Test with existing AM335x functionality

### Phase 1B: Platform Structure (1 hour)
1. Reorganize directory structure
2. Move AM335x-specific files to platforms/am335x/
3. Create am62d platform directory
4. Update build system

### Phase 2A: Demo Framework (2-3 hours)
1. Implement demo-manager.js
2. Implement demo-parser.js
3. Add demo HTTP endpoints
4. Create demo WebSocket channels

### Phase 2B: Batch Demos (2dfft, 2dfft_nodata) (2 hours)
1. Copy rpmsg executables
2. Configure demo definitions
3. Implement parsers for batch output
4. Create basic demo UI cards

### Phase 2C: Streaming Demos (audio_offload, audio_control) (4 hours)
1. Implement real-time parsing
2. Add WebSocket streaming
3. Create real-time UI components (charts, metrics)
4. Add control interfaces

### Phase 3: Testing & Polish (2 hours)
1. Integration testing
2. UI improvements
3. Error handling
4. Documentation

## Total Estimated Time: 12-15 hours

## Demo Integration Priority
1. **2dfft** (batch) - Simple, good starting point
2. **2dfft_nodata** (batch) - Similar to 2dfft, quick addition
3. **audio_offload** (streaming) - Most complex, most features
4. **audio_control** (streaming) - Similar to audio_offload

## Commit Strategy
Each phase will be committed separately with signed-off commits:
1. "platform: Create generic platform configuration system"
2. "platform: Restructure directories for multi-platform support"
3. "demos: Add demo framework and management system"
4. "demos: Integrate rpmsg 2dfft batch demos for am62d"
5. "demos: Integrate rpmsg streaming demos for am62d"
6. "ui: Update frontend for demo integration"
7. "build: Update build system for platform deployment"

## Benefits
- **Maintainability**: Clean separation of platform-specific code
- **Scalability**: Easy to add new platforms (AM64x, AM69x, etc.)
- **Reusability**: Common demo patterns can be reused across platforms
- **Deployment**: Platform-specific packages/containers