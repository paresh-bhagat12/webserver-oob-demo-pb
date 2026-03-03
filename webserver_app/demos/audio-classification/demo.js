/*
 * Audio Classification Demo Module
 * Provides audio device enumeration and real-time audio classification
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

class AudioClassificationDemo {
    constructor(config = {}) {
        this.config = {
            modelPath: config.modelPath || '/usr/share/oob-demo-assets/models/yamnet_audio_classification.tflite',
            labelsPath: config.labelsPath || '/usr/share/oob-demo-assets/labels/yamnet_label_list.txt',
            enableGpuAcceleration: config.enableGpuAcceleration || false,
            useAiAccelerator: config.useAiAccelerator || false,
            fifoPath: config.fifoPath || '/tmp/audio_classification_fifo',
            utilityPath: config.utilityPath || '/usr/bin/audio_utils',
            ...config
        };

        this.audioProcess = null;
        this.fifoReaderProcess = null;
        this.connectedClients = new Set();
    }

    // Get demo metadata
    static getInfo() {
        return {
            id: 'audio-classification',
            name: 'Audio Classification',
            description: 'Real-time audio classification using machine learning',
            icon: 'av:volume-up',
            category: 'AI/ML',
            requiredAssets: ['models', 'labels'],
            backendRoutes: [
                '/audio-devices',
                '/start-audio-classification',
                '/stop-audio-classification'
            ],
            websocketEndpoint: '/audio'
        };
    }

    // Register HTTP routes
    registerRoutes(app) {
        // List available audio devices
        app.get('/audio-devices', (req, res) => {
            exec(`${this.config.utilityPath} devices`, (error, stdout) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return res.status(500).send('Error listing audio devices');
                }
                res.send(stdout);
            });
        });

        // Start audio classification
        app.get('/start-audio-classification', (req, res) => {
            const device = req.query.device || 'default';

            console.log('[Audio Classification] Starting with device:', device);

            if (this.audioProcess) {
                return res.status(400).send('Audio classification already running');
            }

            // Build audio_utils command with configuration
            const args = ['start_gst', device];

            // Add model path if configured
            if (this.config.modelPath) {
                args.push('--model', this.config.modelPath);
            }

            // Add labels path if configured
            if (this.config.labelsPath) {
                args.push('--labels', this.config.labelsPath);
            }

            // Add GPU acceleration if enabled
            if (this.config.enableGpuAcceleration) {
                args.push('--gpu');
            }

            // Add AI accelerator if enabled (AM62D specific)
            if (this.config.useAiAccelerator) {
                args.push('--ai-accelerator');
            }

            // Start the audio classification process
            this.audioProcess = spawn(this.config.utilityPath, args);

            this.audioProcess.on('error', (err) => {
                console.error('Failed to start audio classification:', err);
                this.audioProcess = null;
            });

            this.audioProcess.on('exit', (code) => {
                console.log(`Audio classification process exited with code ${code}`);
                this.audioProcess = null;
                this.stopFifoReader();
            });

            // Start the FIFO reader child process
            this.startFifoReader();

            res.send('Audio classification started');
        });

        // Stop audio classification
        app.get('/stop-audio-classification', (req, res) => {
            this.stop();
            res.send('Audio classification stopped');
        });
    }

    // Register WebSocket handlers
    setupWebSocket(wss) {
        wss.on('connection', (ws, req) => {
            if (req.url === '/audio') {
                console.log('[Audio WebSocket] New client connected');

                // Add to connected clients set
                this.connectedClients.add(ws);

                // Send initial connected message
                ws.send(JSON.stringify({
                    status: 'connected',
                    message: 'WebSocket connected for audio classification',
                    config: {
                        modelPath: this.config.modelPath,
                        enableGpuAcceleration: this.config.enableGpuAcceleration,
                        useAiAccelerator: this.config.useAiAccelerator
                    }
                }));

                // Handle client messages
                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message);
                        console.log('[Audio WebSocket] Received:', data);

                        // Handle diagnostic pings
                        if (data.type === 'diagnostic_ping') {
                            ws.send(JSON.stringify({
                                type: 'diagnostic_response',
                                fifo_exists: fs.existsSync(this.config.fifoPath),
                                reader_running: this.fifoReaderProcess !== null,
                                timestamp: Date.now()
                            }));
                        }
                    } catch (err) {
                        console.error('[Audio WebSocket] Error parsing message:', err);
                    }
                });

                ws.on('close', () => {
                    console.log('[Audio WebSocket] Client disconnected');
                    this.connectedClients.delete(ws);
                });

                ws.on('error', (err) => {
                    console.error('[Audio WebSocket] Error:', err);
                    this.connectedClients.delete(ws);
                });
            }
        });
    }

    // Start FIFO reader child process
    startFifoReader() {
        if (this.fifoReaderProcess) {
            console.log('[FIFO Reader] Already running');
            return;
        }

        console.log('[FIFO Reader] Starting child process for blocking FIFO reads');

        // Spawn the FIFO reader process
        this.fifoReaderProcess = spawn('node', [path.join(__dirname, '../../webserver/fifo-reader.js')]);

        // Handle data from the FIFO reader
        this.fifoReaderProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line);

                        // Handle different message types
                        if (message.type === 'classification') {
                            // Send to all connected WebSocket clients
                            const resultData = {
                                class: message.class,
                                timestamp: message.timestamp
                            };

                            this.connectedClients.forEach(ws => {
                                if (ws.readyState === WebSocket.OPEN) {
                                    ws.send(JSON.stringify(resultData));
                                }
                            });

                            console.log(`[FIFO Reader] Classification: ${message.class}`);
                        } else if (message.type === 'status') {
                            console.log(`[FIFO Reader] Status: ${message.message}`);
                        } else if (message.type === 'error') {
                            console.error(`[FIFO Reader] Error: ${message.message}`);
                        }
                    } catch (err) {
                        console.error('[FIFO Reader] Failed to parse message:', err);
                    }
                }
            });
        });

        this.fifoReaderProcess.stderr.on('data', (data) => {
            console.error(`[FIFO Reader] stderr: ${data}`);
        });

        this.fifoReaderProcess.on('exit', (code) => {
            console.log(`[FIFO Reader] Process exited with code ${code}`);
            this.fifoReaderProcess = null;
        });
    }

    // Stop FIFO reader process
    stopFifoReader() {
        if (this.fifoReaderProcess) {
            console.log('[FIFO Reader] Stopping child process');
            this.fifoReaderProcess.kill('SIGTERM');
            this.fifoReaderProcess = null;
        }
    }

    // Stop audio classification completely
    stop() {
        // Stop the audio process
        if (this.audioProcess) {
            exec(`${this.config.utilityPath} stop_gst`, (error) => {
                if (error) {
                    console.error('Error stopping audio classification:', error);
                }
            });
            this.audioProcess.kill();
            this.audioProcess = null;
        }

        // Stop the FIFO reader
        this.stopFifoReader();

        // Force kill any stray GStreamer processes
        exec('pkill -f gst-launch', (error) => {
            if (error) {
                console.log('No GStreamer processes to kill');
            }
        });
    }

    // Get current status
    getStatus() {
        return {
            running: this.audioProcess !== null,
            fifoReaderRunning: this.fifoReaderProcess !== null,
            connectedClients: this.connectedClients.size,
            config: this.config
        };
    }
}

module.exports = AudioClassificationDemo;