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

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <pthread.h>
#include <signal.h>
#include <sys/types.h>

#define MAX_DEVICES 10

typedef struct {
    char display_name[128];
    char alsa_device[128];
} audio_device_info;

audio_device_info audio_devices[MAX_DEVICES];
int device_count = 0;
char *g_selected_device = NULL;
char fifo_path[256] = "/tmp/audio_classification_fifo";
char pid_file[256] = "/tmp/audio_classification.pid";
volatile int running = 0;

// Signal handler for graceful shutdown
void signal_handler(int signum) {
    if (signum == SIGTERM || signum == SIGINT) {
        fprintf(stderr, "Received signal %d, stopping audio classification\n", signum);
        running = 0;
    }
}

// Get list of audio recording devices
char* get_arecord_devices() {
    FILE *fp;
    char path[1035];
    char *device_list = malloc(4096);

    if (!device_list) return NULL;
    device_list[0] = '\0';

    // Clear existing device count
    device_count = 0;

    // First check if ALSA is available
    fp = popen("which arecord 2>/dev/null", "r");
    if (fp == NULL || !fgets(path, sizeof(path), fp)) {
        fprintf(stderr, "arecord not found on system\n");
        if (fp) pclose(fp);
        strcpy(device_list, "No audio devices found - arecord not available");
        return device_list;
    }
    pclose(fp);

    fp = popen("arecord -l 2>/dev/null", "r");
    if (fp == NULL) {
        fprintf(stderr, "Failed to run command: arecord -l\n");
        strcpy(device_list, "Error running arecord command");
        return device_list;
    }

    char current_card_name[256] = {0};
    int card_num = -1;

    // Reset device array
    memset(audio_devices, 0, sizeof(audio_devices));

    // Process arecord output
    while (fgets(path, sizeof(path), fp) != NULL) {
        if (strncmp(path, "card", 4) == 0) {
            char *card_str = strstr(path, "card ");
            if (card_str) {
                sscanf(card_str, "card %d:", &card_num);
            }

            char *name_start = strchr(path, '[');
            char *name_end = strchr(path, ']');
            if (name_start && name_end && name_end > name_start && device_count < MAX_DEVICES) {
                int name_len = name_end - name_start - 1;
                if (name_len > 0 && name_len < sizeof(current_card_name)) {
                    strncpy(current_card_name, name_start + 1, name_len);
                    current_card_name[name_len] = '\0';

                    // Skip HDMI/playback-only devices
                    if (strstr(current_card_name, "HDMI") != NULL ||
                        strstr(current_card_name, "hdmi") != NULL ||
                        strstr(current_card_name, "cape") != NULL) {
                        fprintf(stderr, "Skipping playback-only device: %s (card %d)\n",
                                current_card_name, card_num);
                        continue;
                    }

                    // Save device details
                    strncpy(audio_devices[device_count].display_name,
                            current_card_name,
                            sizeof(audio_devices[device_count].display_name) - 1);
                    audio_devices[device_count].display_name[sizeof(audio_devices[device_count].display_name) - 1] = '\0';

                    snprintf(audio_devices[device_count].alsa_device,
                             sizeof(audio_devices[device_count].alsa_device),
                             "plughw:%d,0", card_num);

                    // Add to return string with newline separation
                    if (device_count > 0) {
                        strcat(device_list, "\n");
                    }
                    strcat(device_list, current_card_name);

                    fprintf(stderr, "Found capture device: %s -> %s\n",
                           current_card_name, audio_devices[device_count].alsa_device);

                    device_count++;
                }
            }
        }
    }

    pclose(fp);

    // If no devices found, provide a clear message
    if (device_count == 0) {
        strcpy(device_list, "No audio input devices found");
    }

    return device_list;
}

// Placeholder for update_label_text - will be handled by WebSocket in JS
void update_label_text(const char* text) {
    // In a real scenario, this would send data over a socket or write to a shared memory.
    // For this demo, the GStreamer pipeline will write to a FIFO, and the JS server will read from it.
    fprintf(stderr, "Classification: %s\n", text);
}

void* gst_launch_thread(void *arg) {
    char buffer[256];  // Increased buffer size

    // Check if GStreamer is installed
    FILE *check = popen("which gst-launch-1.0 2>/dev/null", "r");
    if (check == NULL || !fgets(buffer, sizeof(buffer), check)) {
        fprintf(stderr, "Error: GStreamer (gst-launch-1.0) not found on system\n");
        if (check) pclose(check);
        running = 0;
        return NULL;
    }
    pclose(check);

    // Remove any existing FIFO and create a new one
    unlink(fifo_path);
    if (mkfifo(fifo_path, 0666) != 0) {
        perror("Failed to create FIFO");
        running = 0;
        return NULL;
    }

    // Use the default device if none selected
    const char *device = g_selected_device ? g_selected_device : "plughw:0,0";

    char gst_command[2048]; // Increased buffer size for gst_command
    snprintf(gst_command, sizeof(gst_command),
             "gst-launch-1.0 alsasrc device=%s ! "
             "audioconvert ! audio/x-raw,format=S16LE,channels=1,rate=16000,layout=interleaved ! "
             "tensor_converter frames-per-tensor=3900 ! "
             "tensor_aggregator frames-in=3900 frames-out=15600 frames-flush=3900 frames-dim=1 ! "
             "tensor_transform mode=arithmetic option=typecast:float32,add:0.5,div:32767.5 ! "
             "tensor_transform mode=transpose option=1:0:2:3 ! "
             "queue leaky=2 max-size-buffers=10 ! "
             "tensor_filter framework=tensorflow2-lite model=/usr/share/oob-demo-assets/models/yamnet_audio_classification.tflite custom=Delegate:XNNPACK,NumThreads:2 ! "
             "tensor_decoder mode=image_labeling option1=/usr/share/oob-demo-assets/labels/yamnet_label_list.txt ! "
             "filesink buffer-mode=2 location=%s 2>/dev/null",
             device, fifo_path);

    fprintf(stderr, "Starting GStreamer with device: %s\n", device);

    // Execute the GStreamer pipeline
    FILE *pipe = popen(gst_command, "r");
    if (!pipe) {
        perror("Failed to start GStreamer pipeline");
        unlink(fifo_path);
        running = 0;
        return NULL;
    }

    // Set up non-blocking read from FIFO to detect results
    int fifo_fd = open(fifo_path, O_RDONLY | O_NONBLOCK);
    if (fifo_fd == -1) {
        perror("Failed to open FIFO for reading");
        pclose(pipe);
        unlink(fifo_path);
        running = 0;
        return NULL;
    }

    // Set up file stream for the FIFO
    FILE *fifo_stream = fdopen(fifo_fd, "r");
    if (!fifo_stream) {
        perror("Failed to create stream from FIFO");
        close(fifo_fd);
        pclose(pipe);
        unlink(fifo_path);
        running = 0;
        return NULL;
    }

    // Monitor the pipeline while it's running
    fprintf(stderr, "Audio classification started successfully\n");

    fd_set read_fds;
    struct timeval tv;

    while (running) {
        FD_ZERO(&read_fds);
        FD_SET(fifo_fd, &read_fds);

        // Set timeout to 1 second to check running flag periodically
        tv.tv_sec = 1;
        tv.tv_usec = 0;

        int ret = select(fifo_fd + 1, &read_fds, NULL, NULL, &tv);

        if (ret < 0) {
            // Error in select
            perror("select() error");
            break;
        } else if (ret > 0 && FD_ISSET(fifo_fd, &read_fds)) {
            // Data available to read
            if (fgets(buffer, sizeof(buffer), fifo_stream) != NULL) {
                // Remove trailing newline and $ character if present
                size_t len = strlen(buffer);
                if (len > 0 && buffer[len-1] == '\n') buffer[len-1] = '\0';

                char *dollar_pos = strchr(buffer, '$');
                if (dollar_pos) *dollar_pos = '\0';

                // Print to stderr for debugging
                fprintf(stderr, "Classification result: %s\n", buffer);
            }
        }
    }

    // Cleanup resources
    fclose(fifo_stream);  // This also closes fifo_fd
    pclose(pipe);
    unlink(fifo_path);

    fprintf(stderr, "GStreamer pipeline stopped and FIFO unlinked\n");
    return NULL;
}

// Main function for testing or direct execution
int main(int argc, char *argv[]) {
    if (argc > 1 && strcmp(argv[1], "devices") == 0) {
        char *devices = get_arecord_devices();
        if (devices) {
            if (device_count > 0) {
                // Print both ALSA identifier and friendly name separated by '|' for UI parsing
                // Format: plughw:X,Y|Device Name
                // This ensures unique identification while showing friendly names
                for (int i = 0; i < device_count; i++) {
                    printf("%s|%s\n", audio_devices[i].alsa_device, audio_devices[i].display_name);
                }
            } else {
                // Just output the message from get_arecord_devices for UI display
                printf("%s\n", devices);
            }
            free(devices);
        } else {
            printf("Error retrieving audio devices\n");
            return 1;
        }
    } else if (argc > 1 && strcmp(argv[1], "start_gst") == 0) {
        // Ensure we have the list of devices
        char *devices = get_arecord_devices();
        if (devices) {
            free(devices);
        }

        // No audio devices found
        if (device_count == 0) {
            fprintf(stderr, "No audio input devices found. Cannot start audio classification.\n");
            printf("ERROR: No audio input devices found\n");
            return 1;
        }

        // Handle device selection
        if (argc > 2) {
            // Map display name to ALSA device
            g_selected_device = NULL;
            char *requested_device = argv[2];

            // First check if it's directly an ALSA device format (plughw:X,Y)
            if (strncmp(requested_device, "plughw:", 7) == 0) {
                g_selected_device = strdup(requested_device);
            } else {
                // Otherwise, try to match by display name
                for (int i = 0; i < device_count; i++) {
                    if (strcmp(audio_devices[i].display_name, requested_device) == 0) {
                        g_selected_device = strdup(audio_devices[i].alsa_device);
                        fprintf(stderr, "Mapped device '%s' to ALSA device: %s\n",
                               requested_device, g_selected_device);
                        break;
                    }
                }

                // If no match found, default to the first device if available
                if (!g_selected_device && device_count > 0) {
                    g_selected_device = strdup(audio_devices[0].alsa_device);
                    fprintf(stderr, "No exact match for '%s', using default device: %s\n",
                           requested_device, g_selected_device);
                }
            }

            // If still no device, use a default
            if (!g_selected_device) {
                g_selected_device = strdup("plughw:0,0");
                fprintf(stderr, "Using fallback default device: %s\n", g_selected_device);
            }
        } else if (device_count > 0) {
            // No device specified, use the first available one
            g_selected_device = strdup(audio_devices[0].alsa_device);
            fprintf(stderr, "No device specified, using first device: %s\n", g_selected_device);
        }

        // Setup signal handlers for graceful shutdown
        signal(SIGTERM, signal_handler);
        signal(SIGINT, signal_handler);

        // Write PID file so stop_gst can find us
        FILE *pf = fopen(pid_file, "w");
        if (pf) {
            fprintf(pf, "%d\n", getpid());
            fclose(pf);
        }

        running = 1;
        pthread_t gst_thread;
        if (pthread_create(&gst_thread, NULL, gst_launch_thread, NULL) != 0) {
            fprintf(stderr, "Failed to create GStreamer thread\n");
            printf("ERROR: Failed to start audio classification\n");
            unlink(pid_file);
            if (g_selected_device) {
                free(g_selected_device);
                g_selected_device = NULL;
            }
            return 1;
        }

        // Print success message for UI feedback
        printf("SUCCESS: Audio classification started\n");
        fflush(stdout);

        // Detach the thread to let it run independently
        pthread_detach(gst_thread);

        // Keep the process running to maintain the pipeline
        while (running) {
            sleep(1);
        }

        // Cleanup
        unlink(pid_file);
        if (g_selected_device) {
            free(g_selected_device);
            g_selected_device = NULL;
        }
    } else if (argc > 1 && strcmp(argv[1], "stop_gst") == 0) {
        // Read PID from file and send SIGTERM
        FILE *pf = fopen(pid_file, "r");
        if (pf) {
            pid_t pid;
            if (fscanf(pf, "%d", &pid) == 1) {
                fclose(pf);
                fprintf(stderr, "Sending SIGTERM to PID %d\n", pid);
                if (kill(pid, SIGTERM) == 0) {
                    printf("SUCCESS: Audio classification stopped\n");
                    // Give it a moment to cleanup, then remove PID file
                    sleep(1);
                    unlink(pid_file);
                } else {
                    perror("Failed to send signal");
                    printf("ERROR: Failed to stop audio classification\n");
                    // Clean up stale PID file
                    unlink(pid_file);
                }
            } else {
                fclose(pf);
                printf("ERROR: Invalid PID file\n");
                unlink(pid_file);
            }
        } else {
            printf("INFO: Audio classification not running (no PID file)\n");
        }
    } else if (argc > 1 && strcmp(argv[1], "status") == 0) {
        // New command to check if audio classification is running
        printf("%s\n", running ? "RUNNING" : "STOPPED");
    } else {
        printf("Usage:\n");
        printf("  %s devices        - List audio recording devices\n", argv[0]);
        printf("  %s start_gst [device] - Start GStreamer pipeline (e.g., plughw:1,0)\n", argv[0]);
        printf("  %s stop_gst       - Stop GStreamer pipeline\n", argv[0]);
        printf("  %s status         - Check if audio classification is running\n", argv[0]);
        return 1;
    }
    return 0;
}
