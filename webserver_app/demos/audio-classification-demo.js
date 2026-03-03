/*
 * Audio Classification Demo Module
 * Real-time audio device management and ML inference demo
 */

class AudioClassificationDemo {
    constructor() {
        this.initialized = false;
        this.elements = {};
        this.selectedDevice = null;
        this.audioDevices = [];
        this.isClassifying = false;
        this.socket = null;
        this.classificationStats = {
            total: 0,
            uniqueClasses: new Set(),
            startTime: null,
            lastUpdateTime: null,
            history: []
        };
        this.demoConfig = {};
    }

    // Initialize the demo
    async initialize(demoConfig, platformConfig) {
        console.log("[AudioClassificationDemo] Initializing audio classification demo");

        try {
            this.demoConfig = demoConfig || {};

            // Get UI elements
            this.elements = this.getUIElements();

            // Check if required elements exist
            if (!this.elements.fetchButton || !this.elements.startButton) {
                console.log("[AudioClassificationDemo] Audio demo UI elements not found, skipping initialization");
                return;
            }

            // Set up event listeners
            this.setupEventListeners();

            // Initialize WebSocket connection
            this.initializeWebSocket();

            this.initialized = true;
            console.log("[AudioClassificationDemo] Audio classification demo initialized successfully");

        } catch (error) {
            console.error("[AudioClassificationDemo] Error initializing:", error);
        }
    }

    // Get UI elements using multiple fallback methods
    getUIElements() {
        const elements = {};

        try {
            // Try getElementById first (most reliable for this demo)
            elements.fetchButton = document.getElementById('fetch_devices_button');
            elements.startButton = document.getElementById('start_audio_button');
            elements.stopButton = document.getElementById('stop_audio_button');
            elements.result = document.getElementById('audio_classification_result');
            elements.devicesList = document.getElementById('audio_devices_list');
            elements.statusDisplay = document.getElementById('classification_status');

            // Additional optional elements
            elements.statsDisplay = document.getElementById('classification_stats');
            elements.deviceInfo = document.getElementById('selected_device_info');

        } catch (error) {
            console.error("[AudioClassificationDemo] Error getting UI elements:", error);
        }

        return elements;
    }

    // Set up event listeners
    setupEventListeners() {
        // Fetch devices button
        if (this.elements.fetchButton) {
            this.elements.fetchButton.addEventListener('click', () => {
                this.fetchAudioDevices();
            });
        }

        // Start audio classification button
        if (this.elements.startButton) {
            this.elements.startButton.addEventListener('click', () => {
                this.startAudioClassification();
            });
        }

        // Stop audio classification button
        if (this.elements.stopButton) {
            this.elements.stopButton.addEventListener('click', () => {
                this.stopAudioClassification();
            });
        }

        console.log("[AudioClassificationDemo] Event listeners set up");
    }

    // Initialize WebSocket connection for real-time updates
    initializeWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;

            console.log("[AudioClassificationDemo] Connecting to WebSocket:", wsUrl);

            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log("[AudioClassificationDemo] WebSocket connected");
            };

            this.socket.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };

            this.socket.onclose = () => {
                console.log("[AudioClassificationDemo] WebSocket disconnected");
                // Attempt reconnection after delay if classification is running
                if (this.isClassifying) {
                    setTimeout(() => this.initializeWebSocket(), 5000);
                }
            };

            this.socket.onerror = (error) => {
                console.error("[AudioClassificationDemo] WebSocket error:", error);
            };

        } catch (error) {
            console.error("[AudioClassificationDemo] Error initializing WebSocket:", error);
        }
    }

    // Handle WebSocket messages
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'audio_classification') {
                this.updateClassificationResult(data);
            } else if (data.type === 'audio_status') {
                this.updateClassificationStatus(data);
            }

        } catch (error) {
            console.error("[AudioClassificationDemo] Error parsing WebSocket message:", error);
        }
    }

    // Fetch available audio devices
    async fetchAudioDevices() {
        console.log("[AudioClassificationDemo] Fetching audio devices");

        try {
            // Check if classification is running
            if (this.isClassifying) {
                if (confirm("Audio classification is currently running. Stop it and refresh devices?")) {
                    await this.stopAudioClassification();
                } else {
                    return;
                }
            }

            this.updateStatus("Fetching audio devices...");

            const response = await fetch('/get-audio-devices');
            const devicesData = await response.text();

            this.parseAndDisplayDevices(devicesData);

        } catch (error) {
            console.error("[AudioClassificationDemo] Error fetching devices:", error);
            this.updateStatus("Error fetching audio devices");
        }
    }

    // Parse and display audio devices
    parseAndDisplayDevices(devicesData) {
        try {
            this.audioDevices = [];

            if (devicesData && devicesData.trim()) {
                const lines = devicesData.split('\n');

                for (const line of lines) {
                    if (line.includes('|')) {
                        const [identifier, name] = line.split('|');
                        this.audioDevices.push({
                            identifier: identifier.trim(),
                            name: name.trim()
                        });
                    }
                }
            }

            this.displayDevices();
            this.updateStatus(`Found ${this.audioDevices.length} audio devices`);

        } catch (error) {
            console.error("[AudioClassificationDemo] Error parsing devices:", error);
            this.updateStatus("Error parsing device list");
        }
    }

    // Display devices in the UI
    displayDevices() {
        if (!this.elements.devicesList) {
            console.log("[AudioClassificationDemo] No devices list element found");
            return;
        }

        // Clear existing list
        this.elements.devicesList.innerHTML = '';

        if (this.audioDevices.length === 0) {
            this.elements.devicesList.innerHTML = '<p>No audio devices found. Click "Fetch Devices" to refresh.</p>';
            return;
        }

        // Create device list
        const deviceList = document.createElement('ul');
        deviceList.className = 'audio-devices-list';

        for (const device of this.audioDevices) {
            const listItem = document.createElement('li');
            listItem.className = 'audio-device-item';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'audio_device';
            radio.value = device.identifier;
            radio.id = `device_${device.identifier.replace(/[^a-zA-Z0-9]/g, '_')}`;

            const label = document.createElement('label');
            label.htmlFor = radio.id;
            label.textContent = `${device.name} (${device.identifier})`;

            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.selectedDevice = device.identifier;
                    this.updateDeviceInfo(device);
                }
            });

            listItem.appendChild(radio);
            listItem.appendChild(label);
            deviceList.appendChild(listItem);
        }

        this.elements.devicesList.appendChild(deviceList);

        // Select first device by default
        if (this.audioDevices.length > 0) {
            const firstRadio = deviceList.querySelector('input[type="radio"]');
            if (firstRadio) {
                firstRadio.checked = true;
                this.selectedDevice = this.audioDevices[0].identifier;
                this.updateDeviceInfo(this.audioDevices[0]);
            }
        }
    }

    // Update selected device info display
    updateDeviceInfo(device) {
        if (this.elements.deviceInfo) {
            this.elements.deviceInfo.innerHTML = `
                <strong>Selected Device:</strong><br>
                Name: ${device.name}<br>
                Identifier: ${device.identifier}
            `;
        }
    }

    // Start audio classification
    async startAudioClassification() {
        console.log("[AudioClassificationDemo] Starting audio classification");

        try {
            if (this.isClassifying) {
                this.updateStatus("Classification is already running");
                return;
            }

            if (!this.selectedDevice) {
                this.updateStatus("Please select an audio device first");
                return;
            }

            this.updateStatus("Starting audio classification...");
            this.resetStats();

            const url = `/start-audio-classification?device=${encodeURIComponent(this.selectedDevice)}`;
            const response = await fetch(url);
            const result = await response.text();

            if (response.ok) {
                this.isClassifying = true;
                this.classificationStats.startTime = Date.now();
                this.updateStatus("Audio classification running");
                this.updateButtonStates();
            } else {
                throw new Error(result);
            }

        } catch (error) {
            console.error("[AudioClassificationDemo] Error starting classification:", error);

            // Handle "already running" error specifically
            if (error.message && error.message.includes('already running')) {
                console.log("[AudioClassificationDemo] Classification already running - treating as success");
                this.isClassifying = true;
                this.updateStatus("Audio classification running (was already started)");
                this.updateButtonStates();
            } else {
                this.updateStatus(`Error: ${error.message}`);
            }
        }
    }

    // Stop audio classification
    async stopAudioClassification() {
        console.log("[AudioClassificationDemo] Stopping audio classification");

        try {
            this.updateStatus("Stopping audio classification...");

            const response = await fetch('/stop-audio-classification');
            const result = await response.text();

            this.isClassifying = false;
            this.updateStatus("Audio classification stopped");
            this.updateButtonStates();

        } catch (error) {
            console.error("[AudioClassificationDemo] Error stopping classification:", error);
            this.updateStatus(`Error stopping classification: ${error.message}`);
        }
    }

    // Update classification result from WebSocket
    updateClassificationResult(data) {
        if (!this.elements.result) return;

        try {
            // Update statistics
            this.classificationStats.total++;
            this.classificationStats.lastUpdateTime = Date.now();

            if (data.class) {
                this.classificationStats.uniqueClasses.add(data.class);
            }

            // Add to history
            this.classificationStats.history.push({
                timestamp: Date.now(),
                class: data.class,
                confidence: data.confidence
            });

            // Keep only recent history (last 100 items)
            if (this.classificationStats.history.length > 100) {
                this.classificationStats.history.shift();
            }

            // Update result display
            const confidence = data.confidence ? (data.confidence * 100).toFixed(1) : 'N/A';
            this.elements.result.innerHTML = `
                <div class="classification-result">
                    <strong>Latest Result:</strong><br>
                    Class: ${data.class || 'Unknown'}<br>
                    Confidence: ${confidence}%<br>
                    <small>Time: ${new Date().toLocaleTimeString()}</small>
                </div>
            `;

            // Update statistics display
            this.updateStatsDisplay();

        } catch (error) {
            console.error("[AudioClassificationDemo] Error updating classification result:", error);
        }
    }

    // Update classification status
    updateClassificationStatus(data) {
        if (data.message) {
            this.updateStatus(data.message);
        }

        if (data.running !== undefined) {
            this.isClassifying = data.running;
            this.updateButtonStates();
        }
    }

    // Update statistics display
    updateStatsDisplay() {
        if (!this.elements.statsDisplay) return;

        const runtime = this.classificationStats.startTime ?
            Math.floor((Date.now() - this.classificationStats.startTime) / 1000) : 0;

        const avgRate = runtime > 0 ?
            (this.classificationStats.total / runtime).toFixed(2) : '0.00';

        this.elements.statsDisplay.innerHTML = `
            <div class="classification-stats">
                <strong>Statistics:</strong><br>
                Total Classifications: ${this.classificationStats.total}<br>
                Unique Classes: ${this.classificationStats.uniqueClasses.size}<br>
                Runtime: ${runtime}s<br>
                Average Rate: ${avgRate}/s
            </div>
        `;
    }

    // Reset statistics
    resetStats() {
        this.classificationStats = {
            total: 0,
            uniqueClasses: new Set(),
            startTime: null,
            lastUpdateTime: null,
            history: []
        };
    }

    // Update status display
    updateStatus(message) {
        console.log(`[AudioClassificationDemo] Status: ${message}`);

        if (this.elements.statusDisplay) {
            this.elements.statusDisplay.textContent = message;
        }
    }

    // Update button states based on classification status
    updateButtonStates() {
        if (this.elements.startButton) {
            this.elements.startButton.disabled = this.isClassifying;
        }

        if (this.elements.stopButton) {
            this.elements.stopButton.disabled = !this.isClassifying;
        }

        if (this.elements.fetchButton) {
            this.elements.fetchButton.disabled = this.isClassifying;
        }
    }

    // Check if the demo is currently running
    isRunning() {
        return this.initialized && this.isClassifying;
    }

    // Cleanup method
    cleanup() {
        console.log("[AudioClassificationDemo] Cleaning up audio classification demo");

        // Stop classification if running
        if (this.isClassifying) {
            this.stopAudioClassification();
        }

        // Close WebSocket connection
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        // Reset state
        this.initialized = false;
        this.isClassifying = false;
        this.selectedDevice = null;
        this.audioDevices = [];
        this.resetStats();
    }
}

// Export the demo
export default AudioClassificationDemo;

// Also make it available globally for non-module environments
window.AudioClassificationDemo = AudioClassificationDemo;