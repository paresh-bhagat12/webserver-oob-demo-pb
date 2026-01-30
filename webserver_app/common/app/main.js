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


// Wait for DOMContentLoaded event before trying to access the application template
var init = function() {
    console.log("init() function called.");
    templateObj = document.querySelector('#template_obj');
    console.log("templateObj after querySelector:", templateObj);

    // Wait for the template to fire a dom-change event to indicate that it has been 'stamped'
    // before trying to access components in the application.
    templateObj.addEventListener('dom-change', function() {
        if (initComplete) return;
        this.async(function() {
            initComplete = true;
            console.log("Application template has been stamped.");
            templateObj.$.ti_widget_toast.hideToast();
            templateObj.$.ti_widget_eventlog_view.log("info", "Application started.");

            // Expand vtabcontainer nav bar when user clicks on menu icon or 'Menu' label
            templateObj.toggleMenu = function(event){
                console.log("toggleMenu called. Current isExpanded:", templateObj.$.ti_widget_vtabcontainer.isExpanded);
                templateObj.$.ti_widget_vtabcontainer.isExpanded = !templateObj.$.ti_widget_vtabcontainer.isExpanded;
                console.log("New isExpanded:", templateObj.$.ti_widget_vtabcontainer.isExpanded);
            };
            templateObj.$.ti_widget_icon_button_menu.addEventListener('click',templateObj.toggleMenu);
            templateObj.$.ti_widget_label_menu.addEventListener('click',templateObj.toggleMenu);

            // Uname Demo specific logic
            const runUnameButton = templateObj.$.run_uname_button;
            const unameSysname = templateObj.$.uname_sysname;
            const unameNodename = templateObj.$.uname_nodename;
            const unameRelease = templateObj.$.uname_release;
            const unameVersion = templateObj.$.uname_version;
            const unameMachine = templateObj.$.uname_machine;
            const unameProcessor = templateObj.$.uname_processor;
            const unameOs = templateObj.$.uname_os;

            if (runUnameButton) {
                runUnameButton.addEventListener('click', function() {
                    // Set loading state
                    unameSysname.label = "Loading...";
                    unameNodename.label = "Loading...";
                    unameRelease.label = "Loading...";
                    unameVersion.label = "Loading...";
                    unameMachine.label = "Loading...";
                    unameProcessor.label = "Loading...";
                    unameOs.label = "Loading...";

                    $.get("/run-uname", function(data) {
                        const unameParts = data.trim().split(/\s+/);
                        if (unameParts.length >= 7) {
                            unameSysname.label = unameParts[0];
                            unameNodename.label = unameParts[1];
                            unameRelease.label = unameParts[2];
                            unameVersion.label = unameParts[3];
                            unameMachine.label = unameParts[4];
                            unameProcessor.label = unameParts[5];
                            unameOs.label = unameParts[6];
                        } else if (unameParts.length >= 6) {
                            // Handle cases where OS might be missing or combined
                            unameSysname.label = unameParts[0];
                            unameNodename.label = unameParts[1];
                            unameRelease.label = unameParts[2];
                            unameVersion.label = unameParts[3];
                            unameMachine.label = unameParts[4];
                            unameProcessor.label = unameParts[5];
                            unameOs.label = "N/A"; // Or try to infer
                        } else {
                            unameSysname.label = "Error: Invalid uname output";
                            unameNodename.label = "Error: Invalid uname output";
                            unameRelease.label = "Error: Invalid uname output";
                            unameVersion.label = "Error: Invalid uname output";
                            unameMachine.label = "Error: Invalid uname output";
                            unameProcessor.label = "Error: Invalid uname output";
                            unameOs.label = "Error: Invalid uname output";
                        }
                    }).fail(function(jqXHR, textStatus, errorThrown) {
                        const errorMessage = "Error fetching uname -a output: " + textStatus + " - " + errorThrown;
                        unameSysname.label = errorMessage;
                        unameNodename.label = errorMessage;
                        unameRelease.label = errorMessage;
                        unameVersion.label = errorMessage;
                        unameMachine.label = errorMessage;
                        unameProcessor.label = errorMessage;
                        unameOs.label = errorMessage;
                    });
                });
            }

            // ===== AUDIO CLASSIFICATION - MODERN UI VERSION =====
            console.log("=== Audio Classification Init ===");

            const fetchDevicesButton = document.getElementById('fetch_devices_button');
            const startAudioButton = document.getElementById('start_audio_button');
            const stopAudioButton = document.getElementById('stop_audio_button');
            const audioClassificationResult = document.getElementById('audio_classification_result');

            let selectedDevice = null;
            let audioDevices = [];
            let classificationStats = {
                total: 0,
                uniqueClasses: new Set(),
                startTime: null,
                lastUpdateTime: null,
                history: []
            };

            console.log("Fetch button:", fetchDevicesButton ? "OK" : "MISSING");
            console.log("Start button:", startAudioButton ? "OK" : "MISSING");

            // Event listeners using getElementById instead of templateObj
            if (fetchDevicesButton) {
                fetchDevicesButton.addEventListener('click', function() {
                    console.log(">>> FETCH DEVICES BUTTON CLICKED <<<");

                    // Check if classification is running
                    if (isClassifying) {
                        if (confirm("Audio classification is currently running. Stop it and refresh devices?")) {
                            // Stop classification first
                            $.ajax({
                                url: '/stop-audio-classification',
                                type: 'GET',
                                complete: function() {
                                    isClassifying = false;
                                    stopAudioButton.disabled = true;

                                    // Stop session timer
                                    if (sessionTimer) {
                                        clearInterval(sessionTimer);
                                        sessionTimer = null;
                                    }

                                    // Update status
                                    const statusIndicator = document.getElementById('status_indicator');
                                    const statusText = document.getElementById('status_text');
                                    if (statusIndicator) {
                                        statusIndicator.classList.remove('active');
                                        statusIndicator.classList.add('inactive');
                                    }
                                    if (statusText) {
                                        statusText.textContent = 'Inactive';
                                    }

                                    // Now fetch devices
                                    fetchAudioDevices();
                                }
                            });
                        }
                        // If user cancels, don't do anything
                    } else {
                        // No classification running, just fetch devices
                        fetchAudioDevices();
                    }
                });
            }

            function fetchAudioDevices() {
                console.log("fetchAudioDevices() called");

                var container = document.getElementById('device_list_container');
                if (!container) {
                    console.error("ERROR: device_list_container not found!");
                    return;
                }

                // Reset selection when fetching devices
                selectedDevice = null;
                startAudioButton.disabled = true;

                // Reset the classification display
                audioClassificationResult.textContent = "Waiting to start...";
                audioClassificationResult.classList.add('waiting');

                container.innerHTML = '<div class="loading-devices">Loading audio devices...</div>';

                console.log("Making AJAX call to /audio-devices");

                $.ajax({
                    url: '/audio-devices',
                    type: 'GET',
                    dataType: 'text',
                    success: function(response) {
                        console.log("SUCCESS! Response:", response);
                        displayDevices(response);
                    },
                    error: function(xhr, status, error) {
                        console.error("ERROR!", status, error);
                        console.error("Response:", xhr.responseText);
                        container.innerHTML = '<div class="no-devices-message">Error loading devices: ' + error + '</div>';
                    }
                });
            }

            function displayDevices(responseText) {
                console.log("displayDevices() called with:", responseText);

                var container = document.getElementById('device_list_container');
                var lines = responseText.trim().split('\n');

                console.log("Parsed lines:", lines);

                if (lines.length === 0 || lines[0].toLowerCase().includes('error') ||
                    lines[0].toLowerCase().includes('no audio')) {
                    container.innerHTML = '<div class="no-devices-message">No audio devices found</div>';
                    return;
                }

                audioDevices = [];
                var html = '';

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();

                    // Parse the new format: plughw:X,Y|Device Name
                    var parts = line.split('|');
                    var alsaDevice = parts[0];
                    var friendlyName = parts[1] || 'Unknown Device';

                    // Store only the ALSA device identifier
                    audioDevices.push(alsaDevice);

                    // Create display name with both friendly name and ALSA identifier
                    var displayName = friendlyName;
                    var cardInfo = '';

                    if (alsaDevice.includes('plughw:')) {
                        var match = alsaDevice.match(/plughw:(\d+),(\d+)/);
                        if (match) {
                            cardInfo = 'Card ' + match[1] + ', Subdevice ' + match[2];
                        }
                    } else if (alsaDevice === 'default') {
                        cardInfo = 'Default Device';
                    }

                    html += '<div class="device-card" data-device="' + alsaDevice + '">';
                    html += '  <div class="device-info">';
                    html += '    <div class="device-name">' + displayName + '</div>';
                    html += '    <div class="device-id">' + cardInfo + ' (' + alsaDevice + ')</div>';
                    html += '  </div>';
                    html += '  <div class="device-status available">';
                    html += 'Available';
                    html += '  </div>';
                    html += '</div>';
                }

                container.innerHTML = html;

                // Add click handlers to all device cards
                var deviceCards = container.querySelectorAll('.device-card');
                deviceCards.forEach(function(card) {
                    card.addEventListener('click', function() {
                        var deviceName = this.getAttribute('data-device');
                        window.selectDevice(deviceName);
                    });
                });
            }

            // Global function for device selection
            window.selectDevice = function(deviceName) {
                console.log("Device selected:", deviceName);
                selectedDevice = deviceName;

                // Update UI - only highlight the selected device
                var deviceCards = document.querySelectorAll('.device-card');

                // Single loop to handle all cards
                deviceCards.forEach(function(card) {
                    var cardDevice = card.getAttribute('data-device');
                    var statusElem = card.querySelector('.device-status');

                    if (cardDevice && statusElem) {
                        // Check if this is the selected device by comparing data-device attribute
                        if (cardDevice === deviceName) {
                            // This is the selected device
                            console.log("Highlighting device:", deviceName);
                            card.classList.add('selected');
                            statusElem.classList.remove('available');
                            statusElem.classList.add('selected');
                            statusElem.textContent = 'Selected';
                        } else {
                            // This is not the selected device
                            card.classList.remove('selected');
                            statusElem.classList.remove('selected');
                            statusElem.classList.add('available');
                            statusElem.textContent = 'Available';
                        }
                    }
                });

                startAudioButton.disabled = false;

                // Update display with shortened device name
                var shortName = deviceName;
                if (deviceName.includes('plughw:')) {
                    var match = deviceName.match(/plughw:(\d+),(\d+)/);
                    if (match) {
                        shortName = "Device " + match[1] + " (Sub " + match[2] + ")";
                    }
                }
                audioClassificationResult.textContent = "Ready: " + shortName;
                audioClassificationResult.classList.remove('waiting');
            };

            // Update session time display
            function updateSessionTime() {
                if (classificationStats.startTime) {
                    const elapsed = Date.now() - classificationStats.startTime;
                    const minutes = Math.floor(elapsed / 60000);
                    const seconds = Math.floor((elapsed % 60000) / 1000);
                    const timeStr = minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');

                    const sessionTimeElem = document.getElementById('session_time');
                    if (sessionTimeElem) {
                        sessionTimeElem.textContent = timeStr;
                    }
                }
            }

            // Update statistics
            function updateStats(classification) {
                classificationStats.total++;
                classificationStats.uniqueClasses.add(classification);
                classificationStats.lastUpdateTime = Date.now();

                // Add to history
                const historyItem = {
                    class: classification,
                    time: new Date().toLocaleTimeString()
                };
                classificationStats.history.unshift(historyItem);
                if (classificationStats.history.length > 20) {
                    classificationStats.history.pop();
                }

                // Update UI
                const totalElem = document.getElementById('total_classifications');
                if (totalElem) totalElem.textContent = classificationStats.total;

                const uniqueElem = document.getElementById('unique_classes');
                if (uniqueElem) uniqueElem.textContent = classificationStats.uniqueClasses.size;

                // Calculate update rate
                if (classificationStats.startTime) {
                    const elapsed = (Date.now() - classificationStats.startTime) / 60000; // minutes
                    const rate = Math.round(classificationStats.total / elapsed);
                    const rateElem = document.getElementById('update_rate');
                    if (rateElem) rateElem.textContent = rate;
                }

                // Update history display
                updateHistoryDisplay();
            }

            // Update history display
            function updateHistoryDisplay() {
                const historyContainer = document.getElementById('classification_history');
                if (!historyContainer) return;

                if (classificationStats.history.length === 0) {
                    historyContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No classifications yet. Start audio classification to see results here.</div>';
                } else {
                    let html = '';
                    classificationStats.history.forEach((item, index) => {
                        html += '<div class="history-item' + (index === 0 ? ' new-classification' : '') + '">';
                        html += '  <span class="history-class">' + item.class + '</span>';
                        html += '  <span class="history-time">' + item.time + '</span>';
                        html += '</div>';
                    });
                    historyContainer.innerHTML = html;
                }
            }

            // WebSocket for audio classification results
            let wsAudio = null;
            let isClassifying = false;
            let reconnectTimeout = null;
            let reconnectAttempts = 0;
            const MAX_RECONNECT_ATTEMPTS = 5;
            const RECONNECT_INTERVAL = 1000; // 1 second between attempts

            // Add diagnostic timer - send a ping every 5 seconds when classifying
            let diagnosticInterval = null;
            const startDiagnostics = () => {
                if (diagnosticInterval) clearInterval(diagnosticInterval);
                let pingCounter = 0;
                diagnosticInterval = setInterval(() => {
                    if (!isClassifying) {
                        clearInterval(diagnosticInterval);
                        diagnosticInterval = null;
                        return;
                    }

                    // Log diagnostic info
                    pingCounter++;
                    console.log(`[DIAGNOSTIC] Ping #${pingCounter}, classification active for ${pingCounter} seconds`);

                    // Check WebSocket state
                    if (!wsAudio) {
                        console.error("[DIAGNOSTIC] WebSocket is null!");
                    } else {
                        console.log(`[DIAGNOSTIC] WebSocket readyState: ${wsAudio.readyState} (${wsAudio.readyState === 0 ? 'CONNECTING' : wsAudio.readyState === 1 ? 'OPEN' : wsAudio.readyState === 2 ? 'CLOSING' : 'CLOSED'})`);
                    }

                    // Send diagnostic ping through WebSocket if it's open
                    if (wsAudio && wsAudio.readyState === WebSocket.OPEN) {
                        wsAudio.send(JSON.stringify({type: "diagnostic_ping", counter: pingCounter}));
                    }
                }, 1000); // Changed from 5000ms to 1000ms (1 second) for faster updates
            };

            // Set up WebSocket immediately (persistent connection)
            setupAudioWebSocket();

            // Function to set up WebSocket for audio classification results
            function setupAudioWebSocket() {
                console.log("[Audio WebSocket] Setting up connection");
                clearTimeout(reconnectTimeout); // Clear any pending reconnects

                // Close any existing WebSocket connection
                if (wsAudio) {
                    try {
                        console.log("[Audio WebSocket] Closing existing connection");
                        wsAudio.onclose = null; // Prevent onclose handler during intentional close
                        wsAudio.close();
                    } catch (e) {
                        console.error("[Audio WebSocket] Error closing socket:", e);
                    }
                    wsAudio = null;
                }

                try {
                    // Create new WebSocket connection
                    wsAudio = new WebSocket("ws://" + window.location.hostname + ":" + window.location.port + "/audio");

                    wsAudio.onopen = function() {
                        console.log("[Audio WebSocket] Connected successfully");
                        reconnectAttempts = 0; // Reset reconnect counter on successful connection
                    };

                    wsAudio.onmessage = function(event) {
                        try {
                            console.log("[Audio WebSocket] Raw message received:", event.data);

                            const result = JSON.parse(event.data);
                            console.log("[Audio WebSocket] Parsed message:", result);

                            // Handle different message types
                            if (result.status === 'connected') {
                                console.log("[Audio WebSocket] Initial connection message received");
                            } else if (result.status === 'stopped') {
                                console.log("[Audio WebSocket] Classification stopped");
                                audioClassificationResult.textContent = "Classification stopped";
                                audioClassificationResult.classList.add('waiting');
                                startAudioButton.disabled = false;
                                stopAudioButton.disabled = true;
                                isClassifying = false;

                                // Update status indicator
                                const statusIndicator = document.getElementById('status_indicator');
                                const statusText = document.getElementById('status_text');
                                if (statusIndicator) {
                                    statusIndicator.classList.remove('active');
                                    statusIndicator.classList.add('inactive');
                                }
                                if (statusText) {
                                    statusText.textContent = 'Inactive';
                                }
                            } else if (result.error) {
                                console.error("[Audio WebSocket] Error:", result.error);
                                audioClassificationResult.textContent = "Error: " + result.error;
                                audioClassificationResult.style.color = "#dc3545"; // Red for error
                                startAudioButton.disabled = false;
                                stopAudioButton.disabled = true;
                                isClassifying = false;

                                // Update status indicator
                                const statusIndicator = document.getElementById('status_indicator');
                                const statusText = document.getElementById('status_text');
                                if (statusIndicator) {
                                    statusIndicator.classList.remove('active');
                                    statusIndicator.classList.add('inactive');
                                }
                                if (statusText) {
                                    statusText.textContent = 'Error';
                                }
                            } else if (result.class) {
                                // Classification result - LIVE UPDATES!
                                console.log("[Audio WebSocket] Classification result received:", result.class);

                                // Update main display
                                if (audioClassificationResult) {
                                    audioClassificationResult.textContent = result.class;
                                    audioClassificationResult.classList.remove('waiting');

                                    // Brief highlight animation
                                    audioClassificationResult.style.animation = 'none';
                                    setTimeout(() => {
                                        audioClassificationResult.style.animation = 'highlight 0.5s ease';
                                    }, 10);

                                    console.log("[Audio WebSocket] Updated UI with:", result.class);
                                }

                                // Update statistics
                                updateStats(result.class);

                                // Add notification for user if needed
                                if (document.hidden) {
                                    console.log("[Audio WebSocket] Page hidden, classification continuing in background");
                                }
                            } else if (result.type === 'diagnostic_response') {
                                console.log("[Audio WebSocket] Diagnostic response:", result);
                            }
                        } catch (e) {
                            console.error("[Audio WebSocket] Error parsing message:", e);
                            console.error("[Audio WebSocket] Problematic data:", event.data);
                        }
                    };

                    wsAudio.onclose = function(event) {
                        console.log("[Audio WebSocket] Connection closed", event ? `code: ${event.code}` : '');

                        // If we're classifying, show connection lost
                        if (isClassifying) {
                            audioClassificationResult.label = "Connection lost - reconnecting...";
                        }

                        wsAudio = null;

                        // Auto reconnect unless max attempts reached
                        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                            reconnectAttempts++;
                            const delay = RECONNECT_INTERVAL * reconnectAttempts;
                            console.log(`[Audio WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

                            reconnectTimeout = setTimeout(setupAudioWebSocket, delay);
                        } else if (isClassifying) {
                            console.error("[Audio WebSocket] Max reconnection attempts reached");
                            audioClassificationResult.label = "Connection lost";
                            startAudioButton.disabled = false;
                            stopAudioButton.disabled = true;
                            isClassifying = false;
                        }
                    };

                    wsAudio.onerror = function(error) {
                        console.error("[Audio WebSocket] Connection error:", error);
                        // Don't reset UI here - onclose will be called after error and handle it
                    };
                } catch (e) {
                    console.error("[Audio WebSocket] Error creating WebSocket:", e);
                    wsAudio = null;
                }
            }

            // Session timer
            let sessionTimer = null;

            // Start button handler
            if (startAudioButton) {
                startAudioButton.addEventListener('click', function() {
                    console.log(">>> START BUTTON CLICKED <<<");
                    if (!selectedDevice) {
                        alert("Please select a device first!");
                        return;
                    }

                    console.log("[Audio] Starting classification with device:", selectedDevice);

                    // Log the exact device format being sent
                    console.log("[Audio] Device format check:");
                    console.log("  - Raw device string:", selectedDevice);
                    console.log("  - URL encoded:", encodeURIComponent(selectedDevice));

                    // Verify it's in the correct format for GStreamer (plughw:X,Y)
                    if (selectedDevice.includes('plughw:')) {
                        var match = selectedDevice.match(/plughw:(\d+),(\d+)/);
                        if (match) {
                            console.log("  - Card number:", match[1]);
                            console.log("  - Subdevice number:", match[2]);
                            console.log("  - GStreamer will use: alsasrc device=" + selectedDevice);
                        }
                    }

                    // WebSocket is already set up (persistent connection)
                    // Just ensure it's connected or reconnect if needed
                    if (!wsAudio) {
                        console.log("[Audio] WebSocket not connected, reconnecting");
                        setupAudioWebSocket();
                    }

                    // Reset statistics
                    classificationStats = {
                        total: 0,
                        uniqueClasses: new Set(),
                        startTime: Date.now(),
                        lastUpdateTime: null,
                        history: []
                    };

                    // Start session timer
                    if (sessionTimer) clearInterval(sessionTimer);
                    sessionTimer = setInterval(updateSessionTime, 1000);

                    // Update UI
                    audioClassificationResult.textContent = "Starting...";
                    audioClassificationResult.classList.add('waiting');
                    startAudioButton.disabled = true;
                    stopAudioButton.disabled = true;

                    // Update status indicator
                    const statusIndicator = document.getElementById('status_indicator');
                    const statusText = document.getElementById('status_text');
                    if (statusIndicator) {
                        statusIndicator.classList.remove('inactive');
                        statusIndicator.classList.add('active');
                    }
                    if (statusText) {
                        statusText.textContent = 'Connecting...';
                    }

                    // First try stopping any existing classification
                    $.ajax({
                        url: '/stop-audio-classification',
                        type: 'GET',
                        complete: function() {
                            // Start classification after cleanup - no matter what happened with stop
                            // Set classifying flag BEFORE the AJAX call
                            isClassifying = true;

                            // Create a blinking effect to indicate active listening
                            const startPulsing = () => {
                                let pulseState = true;
                                if (pulseInterval) {
                                    clearInterval(pulseInterval);
                                }
                                pulseInterval = setInterval(() => {
                                    if (!isClassifying) {
                                        clearInterval(pulseInterval);
                                        audioClassificationResult.style.opacity = "1";
                                        return;
                                    }

                                    pulseState = !pulseState;
                                    audioClassificationResult.style.opacity = pulseState ? "1" : "0.7";
                                }, 1000); // Pulse every second
                            };

                            $.ajax({
                                url: '/start-audio-classification?device=' + encodeURIComponent(selectedDevice),
                                type: 'GET',
                                success: function(response) {
                                    console.log("[Audio] Start SUCCESS:", response);
                                    audioClassificationResult.textContent = "Listening...";
                                    audioClassificationResult.classList.add('waiting');
                                    stopAudioButton.disabled = false;

                                    // Update status
                                    if (statusText) {
                                        statusText.textContent = 'Active - Listening';
                                    }

                                    // Start diagnostics
                                    startDiagnostics();

                                    // Send status update via WebSocket
                                    if (wsAudio && wsAudio.readyState === WebSocket.OPEN) {
                                        wsAudio.send(JSON.stringify({type: "client_status", status: "started"}));
                                    }
                                },
                                error: function(xhr, status, error) {
                                    console.error("[Audio] Start ERROR:", error);
                                    let errorMessage = error;

                                    // Handle "already running" error specifically
                                    if (xhr.responseText && xhr.responseText.indexOf('already running') !== -1) {
                                        console.log("[Audio] Classification already running - treating as success");
                                        audioClassificationResult.label = "Listening... (reconnected)";
                                        stopAudioButton.disabled = false;
                                        isClassifying = true;
                                        return; // Exit early - we're treating this as success
                                    }

                                    audioClassificationResult.label = "Error: " + errorMessage;
                                    startAudioButton.disabled = false;
                                    stopAudioButton.disabled = true;
                                    isClassifying = false;
                                    if (wsAudio) {
                                        wsAudio.close();
                                        wsAudio = null;
                                    }
                                }
                            });
                        }
                    });
                });
            }

            // Global variable for the pulse interval
            let pulseInterval = null;

            // Stop button handler
            if (stopAudioButton) {
                stopAudioButton.addEventListener('click', function() {
                    console.log(">>> STOP BUTTON CLICKED <<<");

                    audioClassificationResult.textContent = "Stopping...";
                    audioClassificationResult.classList.add('waiting');
                    stopAudioButton.disabled = true;

                    // Stop session timer
                    if (sessionTimer) {
                        clearInterval(sessionTimer);
                        sessionTimer = null;
                    }

                    // Clear diagnostics
                    if (diagnosticInterval) {
                        clearInterval(diagnosticInterval);
                        diagnosticInterval = null;
                    }

                    // Update status indicator
                    const statusIndicator = document.getElementById('status_indicator');
                    const statusText = document.getElementById('status_text');
                    if (statusIndicator) {
                        statusIndicator.classList.remove('active');
                        statusIndicator.classList.add('inactive');
                    }
                    if (statusText) {
                        statusText.textContent = 'Stopping...';
                    }

                    $.ajax({
                        url: '/stop-audio-classification',
                        type: 'GET',
                        success: function(response) {
                            console.log("[Audio] Stop SUCCESS:", response);
                            audioClassificationResult.textContent = "Classification stopped";
                            audioClassificationResult.classList.add('waiting');
                            startAudioButton.disabled = false;
                            stopAudioButton.disabled = true;

                            // Make sure to set the flag to stop classification
                            isClassifying = false;

                            // Update status
                            if (statusText) {
                                statusText.textContent = 'Inactive';
                            }

                            // Send status update via WebSocket
                            if (wsAudio && wsAudio.readyState === WebSocket.OPEN) {
                                wsAudio.send(JSON.stringify({type: "client_status", status: "stopped"}));
                            }
                        },
                        error: function(xhr, status, error) {
                            console.error("[Audio] Stop ERROR:", error);
                            audioClassificationResult.textContent = "Error stopping";
                            startAudioButton.disabled = false;
                            stopAudioButton.disabled = true;
                            isClassifying = false;
                        }
                    });
                });
            }

            function updateCpuLoad() {
                $.get("/cpu-load", function(data) {
                    templateObj.$.gauge1.value = data;
                });
            }

            setInterval(updateCpuLoad, 1000);
            updateCpuLoad();

        }, 1);

    });
};

templateObj = document.querySelector('#template_obj');
if (templateObj) {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}