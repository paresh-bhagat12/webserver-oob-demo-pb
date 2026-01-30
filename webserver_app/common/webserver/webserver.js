#!/usr/bin/env node

/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the
 * distribution.
 *
 * Neither the name of Texas Instruments Incorporated nor the names of
 * its contributors may be used to endorse or promote products derived
 * from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

/*
 * Generic Platform WebServer
 * Platform-agnostic webserver with configurable platform support and demo management
 */

const express = require('express');
const { exec, spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Platform configuration
const PLATFORM = process.env.PLATFORM || 'am335x';
const PLATFORM_DIR = process.env.PLATFORM_DIR || path.join(__dirname, '../../platforms', PLATFORM);
const APP_DIR = process.argv[2] || path.join(__dirname, '../app');
const PORT = process.env.PORT || 3000;

console.log(`[Platform] Loading platform: ${PLATFORM}`);
console.log(`[Platform] Platform directory: ${PLATFORM_DIR}`);
console.log(`[Platform] App directory: ${APP_DIR}`);

// Load platform configuration
let platformConfig = {};
let demosConfig = {};

try {
    platformConfig = JSON.parse(fs.readFileSync(path.join(PLATFORM_DIR, 'config.json'), 'utf8'));
    console.log(`[Platform] Loaded config for ${platformConfig.platform.name}`);
} catch (err) {
    console.error(`[Platform] Failed to load platform config: ${err.message}`);
    process.exit(1);
}

try {
    demosConfig = JSON.parse(fs.readFileSync(path.join(PLATFORM_DIR, 'demos.json'), 'utf8'));
    console.log(`[Platform] Loaded ${demosConfig.demos?.length || 0} demo configurations`);
} catch (err) {
    console.warn(`[Platform] No demos config found: ${err.message}`);
    demosConfig = { demos: [] };
}

/* Create the express app */
const app = express();
const server = http.createServer(app);

/* Demo management */
let currentDemo = null;
let demoClients = new Set();
let fifoReaderProcess = null;
let connectedAudioClients = new Set(); // For legacy audio classification support

/* Place the GUI files onto the server */
app.use(express.static(APP_DIR));

/* Serve platform-specific assets */
app.use('/platform', express.static(PLATFORM_DIR));

/* Platform configuration endpoint */
app.get('/api/platform', (req, res) => {
    res.json({
        platform: platformConfig.platform,
        ui: platformConfig.ui,
        documentation: platformConfig.documentation,
        features: platformConfig.features
    });
});

/* Demo configuration endpoint */
app.get('/api/demos', (req, res) => {
    const demos = demosConfig.demos.map(demo => ({
        id: demo.id,
        name: demo.name,
        description: demo.description,
        type: demo.type,
        category: demo.category,
        expected_duration: demo.expected_duration,
        ui: demo.ui,
        metrics: demo.metrics,
        controls: demo.controls
    }));
    res.json({ demos });
});

/* Demo status endpoint */
app.get('/api/demos/status', (req, res) => {
    res.json({
        running: currentDemo !== null,
        demo: currentDemo ? currentDemo.id : null,
        status: currentDemo ? currentDemo.status : 'idle'
    });
});

/* Start demo endpoint */
app.post('/api/demos/:id/start', (req, res) => {
    const demoId = req.params.id;

    if (currentDemo) {
        return res.status(400).json({
            error: 'Demo already running',
            current: currentDemo.id
        });
    }

    const demoConfig = demosConfig.demos.find(d => d.id === demoId);
    if (!demoConfig) {
        return res.status(404).json({ error: 'Demo not found' });
    }

    startDemo(demoConfig);
    res.json({
        status: 'started',
        id: demoId,
        type: demoConfig.type
    });
});

/* Stop demo endpoint */
app.get('/api/demos/:id/stop', (req, res) => {
    const demoId = req.params.id;

    if (!currentDemo || currentDemo.id !== demoId) {
        return res.status(400).json({ error: 'Demo not running' });
    }

    stopDemo();
    res.json({ status: 'stopped', id: demoId });
});

/* Legacy audio classification endpoints for AM335x compatibility */
app.get('/run-uname', (req, res) => {
    exec('uname -a', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send(error);
        }
        res.send(stdout);
    });
});

app.get('/cpu-load', (req, res) => {
    exec('/usr/bin/cpu_stats enhanced', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send(error);
        }
        res.send(stdout);
    });
});

app.get('/cpu-info', (req, res) => {
    exec('/usr/bin/cpu_stats info', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send(error);
        }
        res.send(stdout);
    });
});

// Legacy audio classification support (AM335x)
if (platformConfig.platform.id === 'am335x') {
    app.get('/audio-devices', (req, res) => {
        const audioUtilsPath = path.join(PLATFORM_DIR, 'linux_app', 'audio_utils');
        exec(`${audioUtilsPath} devices`, (error, stdout) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return res.status(500).send('Error listing audio devices');
            }
            res.send(stdout);
        });
    });

    app.get('/start-audio-classification', (req, res) => {
        const device = req.query.device || 'default';

        if (currentDemo) {
            return res.status(400).send('Demo already running');
        }

        startAudioClassification(device);
        res.send('Audio classification started');
    });

    app.get('/stop-audio-classification', (req, res) => {
        stopAudioClassification();
        res.send('Audio classification stopped');
    });
}

/* Demo management functions */
function startDemo(demoConfig) {
    console.log(`[Demo] Starting ${demoConfig.name} (${demoConfig.id})`);

    const executablePath = path.join(PLATFORM_DIR, demoConfig.executable);

    if (!fs.existsSync(executablePath)) {
        console.error(`[Demo] Executable not found: ${executablePath}`);
        return;
    }

    currentDemo = {
        id: demoConfig.id,
        name: demoConfig.name,
        type: demoConfig.type,
        status: 'starting',
        config: demoConfig,
        process: null,
        startTime: Date.now(),
        output: []
    };

    // Spawn the demo process
    currentDemo.process = spawn(executablePath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: PLATFORM_DIR
    });

    currentDemo.status = 'running';
    broadcastDemoUpdate('status_change', {
        demo: currentDemo.id,
        status: 'running',
        startTime: currentDemo.startTime
    });

    // Handle stdout
    currentDemo.process.stdout.on('data', (data) => {
        const output = data.toString();
        currentDemo.output.push({
            type: 'stdout',
            data: output,
            timestamp: Date.now()
        });

        console.log(`[Demo ${currentDemo.id}] ${output.trim()}`);

        // Parse and broadcast demo-specific updates
        parseDemoOutput(currentDemo, output);
    });

    // Handle stderr
    currentDemo.process.stderr.on('data', (data) => {
        const output = data.toString();
        currentDemo.output.push({
            type: 'stderr',
            data: output,
            timestamp: Date.now()
        });

        console.error(`[Demo ${currentDemo.id}] ERROR: ${output.trim()}`);

        broadcastDemoUpdate('error', {
            demo: currentDemo.id,
            error: output.trim(),
            timestamp: Date.now()
        });
    });

    // Handle process exit
    currentDemo.process.on('exit', (code) => {
        console.log(`[Demo ${currentDemo.id}] Process exited with code ${code}`);

        const endTime = Date.now();
        const duration = endTime - currentDemo.startTime;

        broadcastDemoUpdate('completed', {
            demo: currentDemo.id,
            exitCode: code,
            duration: duration,
            success: code === 0,
            timestamp: endTime
        });

        currentDemo = null;
    });

    // Handle process error
    currentDemo.process.on('error', (err) => {
        console.error(`[Demo ${currentDemo.id}] Process error:`, err);

        broadcastDemoUpdate('error', {
            demo: currentDemo.id,
            error: err.message,
            timestamp: Date.now()
        });

        currentDemo = null;
    });

    // Set timeout for batch demos
    if (demoConfig.type === 'batch' && demoConfig.timeout) {
        setTimeout(() => {
            if (currentDemo && currentDemo.id === demoConfig.id) {
                console.log(`[Demo ${currentDemo.id}] Timeout reached, killing process`);
                currentDemo.process.kill('SIGTERM');
            }
        }, demoConfig.timeout);
    }
}

function stopDemo() {
    if (!currentDemo) return;

    console.log(`[Demo] Stopping ${currentDemo.name} (${currentDemo.id})`);

    if (currentDemo.process) {
        currentDemo.process.kill('SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
            if (currentDemo && currentDemo.process) {
                console.log(`[Demo ${currentDemo.id}] Force killing process`);
                currentDemo.process.kill('SIGKILL');
            }
        }, 5000);
    }

    currentDemo = null;
}

function parseDemoOutput(demo, output) {
    const lines = output.split('\n');

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // Parse based on demo type
        if (demo.id.includes('2dfft')) {
            parse2dfftOutput(demo, line);
        } else if (demo.id.includes('audio_offload')) {
            parseAudioOffloadOutput(demo, line);
        } else if (demo.id.includes('audio_control')) {
            parseAudioControlOutput(demo, line);
        }
    });
}

function parse2dfftOutput(demo, line) {
    if (line.includes('Test PASSED') || line.includes('Test FAILED')) {
        const passed = line.includes('PASSED');
        broadcastDemoUpdate('result', {
            demo: demo.id,
            status: passed ? 'PASSED' : 'FAILED',
            timestamp: Date.now()
        });
    } else if (line.includes('C7x Load:')) {
        const match = line.match(/C7x Load:\s*(\d+)%/);
        if (match) {
            broadcastDemoUpdate('metric', {
                demo: demo.id,
                metric: 'dsp_load',
                value: parseInt(match[1]),
                unit: '%',
                timestamp: Date.now()
            });
        }
    } else if (line.includes('Cycle Count:')) {
        const match = line.match(/Cycle Count:\s*(\d+)/);
        if (match) {
            broadcastDemoUpdate('metric', {
                demo: demo.id,
                metric: 'cycle_count',
                value: parseInt(match[1]),
                timestamp: Date.now()
            });
        }
    } else if (line.includes('DDR Throughput:')) {
        const match = line.match(/DDR Throughput:\s*([\d.]+)\s*MB\/s/);
        if (match) {
            broadcastDemoUpdate('metric', {
                demo: demo.id,
                metric: 'ddr_throughput',
                value: parseFloat(match[1]),
                unit: 'MB/s',
                timestamp: Date.now()
            });
        }
    }
}

function parseAudioOffloadOutput(demo, line) {
    // Parse Frame updates: "Frame 1: AvgAmp=256.5, Latency=1.2ms, Mode=DSP, CPULoad=15%, DSPLoad=75%"
    const frameMatch = line.match(/Frame\s+(\d+):/);
    if (frameMatch) {
        const frameNum = parseInt(frameMatch[1]);

        const latencyMatch = line.match(/Latency=([\d.]+)ms/);
        const modeMatch = line.match(/Mode=(\w+)/);
        const cpuMatch = line.match(/CPULoad=(\d+)%/);
        const dspMatch = line.match(/DSPLoad=(\d+)%/);

        const metrics = { demo: demo.id, frame: frameNum, timestamp: Date.now() };

        if (latencyMatch) metrics.latency_ms = parseFloat(latencyMatch[1]);
        if (modeMatch) metrics.exec_mode = modeMatch[1];
        if (cpuMatch) metrics.cpu_load = parseInt(cpuMatch[1]);
        if (dspMatch) metrics.dsp_load = parseInt(dspMatch[1]);

        broadcastDemoUpdate('frame_update', metrics);
    }
}

function parseAudioControlOutput(demo, line) {
    // Similar to audio offload but simpler
    const frameMatch = line.match(/Frame\s+(\d+):/);
    if (frameMatch) {
        parseAudioOffloadOutput(demo, line); // Reuse parser
    }
}

function broadcastDemoUpdate(type, data) {
    const message = JSON.stringify({
        type: type,
        timestamp: Date.now(),
        ...data
    });

    demoClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

/* Legacy audio classification functions for AM335x */
function startAudioClassification(device) {
    console.log('[Audio Classification] Starting with device:', device);

    const audioUtilsPath = path.join(PLATFORM_DIR, 'linux_app', 'audio_utils');
    currentDemo = {
        id: 'audio_classification',
        type: 'streaming',
        process: spawn(audioUtilsPath, ['start_gst', device])
    };

    currentDemo.process.on('error', (err) => {
        console.error('Failed to start audio classification:', err);
        currentDemo = null;
    });

    currentDemo.process.on('exit', (code) => {
        console.log(`Audio classification process exited with code ${code}`);
        currentDemo = null;
        stopFifoReader();
    });

    startFifoReader();
}

function stopAudioClassification() {
    if (currentDemo && currentDemo.id === 'audio_classification') {
        const audioUtilsPath = path.join(PLATFORM_DIR, 'linux_app', 'audio_utils');
        exec(`${audioUtilsPath} stop_gst`, (error) => {
            if (error) {
                console.error('Error stopping audio classification:', error);
            }
        });

        if (currentDemo.process) {
            currentDemo.process.kill();
        }
        currentDemo = null;
    }

    stopFifoReader();

    exec('pkill -f gst-launch', (error) => {
        if (error) {
            console.log('No GStreamer processes to kill');
        }
    });
}

function startFifoReader() {
    if (fifoReaderProcess) return;

    console.log('[FIFO Reader] Starting child process for blocking FIFO reads');

    fifoReaderProcess = spawn('node', [path.join(__dirname, 'fifo-reader.js')]);

    fifoReaderProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);

                    if (message.type === 'classification') {
                        const resultData = {
                            class: message.class,
                            timestamp: message.timestamp
                        };

                        connectedAudioClients.forEach(ws => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify(resultData));
                            }
                        });

                        console.log(`[FIFO Reader] Classification: ${message.class}`);
                    }
                } catch (err) {
                    console.error('[FIFO Reader] Failed to parse message:', err);
                }
            }
        });
    });

    fifoReaderProcess.stderr.on('data', (data) => {
        console.error(`[FIFO Reader] stderr: ${data}`);
    });

    fifoReaderProcess.on('exit', (code) => {
        console.log(`[FIFO Reader] Process exited with code ${code}`);
        fifoReaderProcess = null;
    });
}

function stopFifoReader() {
    if (fifoReaderProcess) {
        console.log('[FIFO Reader] Stopping child process');
        fifoReaderProcess.kill('SIGTERM');
        fifoReaderProcess = null;
    }
}

/* WebSocket server for demos and audio */
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    console.log(`New WebSocket connection: ${req.url}`);

    if (req.url === '/demos') {
        console.log('[Demo WebSocket] New client connected');

        demoClients.add(ws);

        ws.send(JSON.stringify({
            type: 'connected',
            platform: platformConfig.platform.id,
            timestamp: Date.now()
        }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('[Demo WebSocket] Received:', data);

                // Handle demo control commands
                if (data.type === 'demo_control' && currentDemo) {
                    handleDemoControl(data);
                }
            } catch (err) {
                console.error('[Demo WebSocket] Error parsing message:', err);
            }
        });

        ws.on('close', () => {
            console.log('[Demo WebSocket] Client disconnected');
            demoClients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[Demo WebSocket] Error:', err);
            demoClients.delete(ws);
        });

    } else if (req.url === '/audio') {
        // Legacy audio WebSocket for AM335x
        console.log('[Audio WebSocket] New client connected');

        connectedAudioClients.add(ws);

        ws.send(JSON.stringify({
            status: 'connected',
            message: 'WebSocket connected for audio classification'
        }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'diagnostic_ping') {
                    ws.send(JSON.stringify({
                        type: 'diagnostic_response',
                        fifo_exists: fs.existsSync('/tmp/audio_classification_fifo'),
                        reader_running: fifoReaderProcess !== null,
                        timestamp: Date.now()
                    }));
                }
            } catch (err) {
                console.error('[Audio WebSocket] Error parsing message:', err);
            }
        });

        ws.on('close', () => {
            console.log('[Audio WebSocket] Client disconnected');
            connectedAudioClients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[Audio WebSocket] Error:', err);
            connectedAudioClients.delete(ws);
        });

    } else {
        ws.close(1003, "Unsupported WebSocket URL");
    }
});

function handleDemoControl(data) {
    if (!currentDemo || !currentDemo.config.controls) return;

    const command = currentDemo.config.controls[data.command];
    if (!command) return;

    console.log(`[Demo Control] Sending command: ${command} ${data.value || ''}`);

    // For audio demos with network control, send via TCP
    if (currentDemo.config.ports && currentDemo.config.ports.cmd) {
        // TODO: Implement TCP command sending for audio offload
        console.log(`[Demo Control] Would send to port ${currentDemo.config.ports.cmd}: ${command}`);
    }
}

/* Cleanup on exit */
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, cleaning up...');
    stopDemo();
    stopAudioClassification();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, cleaning up...');
    stopDemo();
    stopAudioClassification();
    process.exit(0);
});

/* Start the server */
server.listen(PORT, () => {
    console.log(`Generic Platform WebServer listening on port ${PORT}`);
    console.log(`Platform: ${platformConfig.platform.name} (${platformConfig.platform.id})`);
    console.log(`Serving files from: ${APP_DIR}`);
    console.log(`Platform assets from: ${PLATFORM_DIR}`);
});