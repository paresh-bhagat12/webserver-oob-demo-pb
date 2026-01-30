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
 * WebServer OOB with LVGL-style FIFO Reading
 * Enhanced with dedicated child process for blocking FIFO reads
 * providing real-time audio classification without affecting server responsiveness
 */

const express = require('express');
const { exec, spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

/* Set the path from command line argument */
const app_dir = process.argv[2] || 'app';

/* Create the express app */
const app = express();
const server = http.createServer(app);
const port = 3000;

/* Audio classification support */
const fifoPath = '/tmp/audio_classification_fifo';
let fifoReaderProcess = null;
let audioProcess = null;
let connectedAudioClients = new Set();

/* Place the GUI files onto the server */
app.use(express.static(app_dir));

/* Handle system information requests */
app.get('/run-uname', (req, res) => {
    exec('uname -a', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send(error);
        }
        res.send(stdout);
    });
});

/* Handle CPU load requests */
app.get('/cpu-load', (req, res) => {
    exec('/usr/bin/cpu_stats enhanced', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send(error);
        }
        res.send(stdout);
    });
});

/* Handle CPU info requests */
app.get('/cpu-info', (req, res) => {
    exec('/usr/bin/cpu_stats info', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send(error);
        }
        res.send(stdout);
    });
});

/* Handle audio device list requests */
app.get('/audio-devices', (req, res) => {
    exec('/usr/bin/audio_utils devices', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send('Error listing audio devices');
        }
        res.send(stdout);
    });
});

/* Start audio classification */
app.get('/start-audio-classification', (req, res) => {
    const device = req.query.device || 'default';

    console.log('[Audio Classification] Starting with device:', device);
    console.log('[Audio Classification] Device format:', {
        raw: device,
        isPlugHw: device.includes('plughw:'),
        command: `/usr/bin/audio_utils start_gst "${device}"`
    });

    if (audioProcess) {
        return res.status(400).send('Audio classification already running');
    }

    // Start the audio classification process
    audioProcess = spawn('/usr/bin/audio_utils', ['start_gst', device]);

    audioProcess.on('error', (err) => {
        console.error('Failed to start audio classification:', err);
        audioProcess = null;
    });

    audioProcess.on('exit', (code) => {
        console.log(`Audio classification process exited with code ${code}`);
        audioProcess = null;
        stopFifoReader();
    });

    // Start the FIFO reader child process
    startFifoReader();

    res.send('Audio classification started');
});

/* Stop audio classification */
app.get('/stop-audio-classification', (req, res) => {
    stopAudioClassification();
    res.send('Audio classification stopped');
});

/* Start FIFO reader child process */
function startFifoReader() {
    if (fifoReaderProcess) {
        console.log('[FIFO Reader] Already running');
        return;
    }

    console.log('[FIFO Reader] Starting child process for blocking FIFO reads');

    // Spawn the FIFO reader process
    fifoReaderProcess = spawn('node', [path.join(__dirname, 'fifo-reader.js')]);

    // Handle data from the FIFO reader
    fifoReaderProcess.stdout.on('data', (data) => {
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

                        connectedAudioClients.forEach(ws => {
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

    fifoReaderProcess.stderr.on('data', (data) => {
        console.error(`[FIFO Reader] stderr: ${data}`);
    });

    fifoReaderProcess.on('exit', (code) => {
        console.log(`[FIFO Reader] Process exited with code ${code}`);
        fifoReaderProcess = null;
    });
}

/* Stop FIFO reader process */
function stopFifoReader() {
    if (fifoReaderProcess) {
        console.log('[FIFO Reader] Stopping child process');
        fifoReaderProcess.kill('SIGTERM');
        fifoReaderProcess = null;
    }
}

/* Stop audio classification completely */
function stopAudioClassification() {
    // Stop the audio process
    if (audioProcess) {
        exec('/usr/bin/audio_utils stop_gst', (error) => {
            if (error) {
                console.error('Error stopping audio classification:', error);
            }
        });
        audioProcess.kill();
        audioProcess = null;
    }

    // Stop the FIFO reader
    stopFifoReader();

    // Force kill any stray GStreamer processes
    exec('pkill -f gst-launch', (error) => {
        if (error) {
            console.log('No GStreamer processes to kill');
        }
    });
}

/* WebSocket server for terminal and audio */
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    console.log(`New WebSocket connection: ${req.url}`);

    if (req.url === '/audio') {
        console.log('[Audio WebSocket] New client connected');

        // Add to connected clients set
        connectedAudioClients.add(ws);

        // Send initial connected message
        ws.send(JSON.stringify({
            status: 'connected',
            message: 'WebSocket connected for audio classification'
        }));

        // Handle client messages
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('[Audio WebSocket] Received:', data);

                // Handle diagnostic pings (simplified - no test messages)
                if (data.type === 'diagnostic_ping') {
                    ws.send(JSON.stringify({
                        type: 'diagnostic_response',
                        fifo_exists: fs.existsSync(fifoPath),
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
        // Unknown WebSocket URL
        ws.close(1003, "Unsupported WebSocket URL");
    }
});

/* Cleanup on exit */
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, cleaning up...');
    stopAudioClassification();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, cleaning up...');
    stopAudioClassification();
    process.exit(0);
});

/* Start the server */
server.listen(port, () => {
    console.log(`WebServer OOB (Simplified) listening on port ${port}`);
    console.log(`Serving files from: ${app_dir}`);
});