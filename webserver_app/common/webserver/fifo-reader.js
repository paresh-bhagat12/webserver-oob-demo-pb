#!/usr/bin/env node

/*
 * FIFO Reader Process - Blocking I/O for Real-time Audio Classification
 * This runs as a child process to handle blocking FIFO reads without
 * affecting the main webserver's responsiveness
 */

const fs = require('fs');
const readline = require('readline');

const fifoPath = '/tmp/audio_classification_fifo';

// Setup stdout to send messages to parent process
process.stdout.write(JSON.stringify({
    type: 'status',
    message: 'FIFO reader process started'
}) + '\n');

function startReading() {
    try {
        // Check if FIFO exists
        if (!fs.existsSync(fifoPath)) {
            process.stdout.write(JSON.stringify({
                type: 'error',
                message: 'FIFO does not exist, waiting...'
            }) + '\n');

            // Retry after 1 second
            setTimeout(startReading, 1000);
            return;
        }

        // Open FIFO for reading (this will block until a writer connects)
        const stream = fs.createReadStream(fifoPath, {
            encoding: 'utf8',
            highWaterMark: 128  // Small buffer for low latency
        });

        // Create readline interface for line-by-line reading
        const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity
        });

        let buffer = '';

        // Handle data as it arrives
        stream.on('data', (chunk) => {
            buffer += chunk;

            // Process all complete classifications (dollar-delimited)
            let dollarIndex;
            while ((dollarIndex = buffer.indexOf('$')) !== -1) {
                const classification = buffer.substring(0, dollarIndex).trim();
                buffer = buffer.substring(dollarIndex + 1);

                if (classification) {
                    // Send classification to parent process
                    process.stdout.write(JSON.stringify({
                        type: 'classification',
                        class: classification,
                        timestamp: Date.now()
                    }) + '\n');
                }
            }
        });

        stream.on('end', () => {
            process.stdout.write(JSON.stringify({
                type: 'status',
                message: 'FIFO closed, restarting...'
            }) + '\n');

            // Restart reading after a short delay
            setTimeout(startReading, 500);
        });

        stream.on('error', (err) => {
            process.stdout.write(JSON.stringify({
                type: 'error',
                message: err.message
            }) + '\n');

            // Restart on error
            setTimeout(startReading, 1000);
        });

    } catch (err) {
        process.stdout.write(JSON.stringify({
            type: 'error',
            message: 'Fatal error: ' + err.message
        }) + '\n');

        // Restart on fatal error
        setTimeout(startReading, 1000);
    }
}

// Handle termination signals
process.on('SIGTERM', () => {
    process.stdout.write(JSON.stringify({
        type: 'status',
        message: 'FIFO reader shutting down'
    }) + '\n');
    process.exit(0);
});

process.on('SIGINT', () => {
    process.exit(0);
});

// Start reading
startReading();