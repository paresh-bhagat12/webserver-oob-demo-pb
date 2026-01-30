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

#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>  /* For usleep() */
#include <time.h>    /* For nanosleep() */
#include <math.h>    /* For fabs() */
#include <fcntl.h>   /* For file operations */
#include <sys/stat.h>
#include <sys/types.h>

#define HISTORY_SIZE 300        /* Store 5 minutes of history (assuming 1 second per sample) */
#define SAMPLE_COUNT 2          /* Number of samples to take for one measurement - reduced for real-time */
#define SAMPLE_INTERVAL_MS 100  /* Time between samples in milliseconds - reduced for faster response */
#define SPIKE_THRESHOLD 40.0    /* Percentage change to consider a spike - increased for less filtering */
#define EMA_ALPHA 0.5           /* Weight for current sample in exponential moving average - increased for faster response */
#define HISTORY_FILE "/tmp/cpu_stats_history.dat"  /* File to store history data */
#define HISTORY_VERSION 1       /* Version of history file format */

/* Structure to hold CPU time stats */
typedef struct {
    long long int user;
    long long int nice;
    long long int system;
    long long int idle;
    long long int iowait;
    long long int irq;
    long long int softirq;
    long long int steal;
    long long int total;
    long long int idle_total;
    long long int active;       /* Non-idle time */
} CpuTimes;

/* History tracking structure */
typedef struct {
    double history[HISTORY_SIZE];
    int history_index;
    int history_count;
    double max_cpu_usage;
    double avg_cpu_usage;
    time_t last_update;
    double last_reading;        /* Last valid CPU percentage for spike detection */
    double ema;                 /* Exponential Moving Average for smoothing */
    time_t start_time;          /* When the program first started */
} CpuHistory;

/* Global history state */
static CpuHistory cpu_history = {{0}, 0, 0, 0.0, 0.0, 0, 0.0, 0.0, 0};

/* Flag to indicate if history was loaded from file */
static int history_initialized = 0;

/* Sleep for specified milliseconds */
void sleep_ms(int milliseconds) {
    struct timespec ts;
    ts.tv_sec = milliseconds / 1000;
    ts.tv_nsec = (milliseconds % 1000) * 1000000;
    nanosleep(&ts, NULL);
}

/* Read CPU times from /proc/stat */
int read_cpu_times(CpuTimes *times) {
    FILE *fp = fopen("/proc/stat", "r");
    if (fp == NULL) {
        perror("Error opening /proc/stat");
        return 0;
    }

    /* Read the first line with overall CPU stats */
    if (fscanf(fp, "cpu %lld %lld %lld %lld %lld %lld %lld %lld",
               &times->user, &times->nice, &times->system, &times->idle,
               &times->iowait, &times->irq, &times->softirq, &times->steal) != 8) {
        fclose(fp);
        return 0;
    }

    fclose(fp);

    /* Calculate totals */
    times->idle_total = times->idle + times->iowait;
    times->active = times->user + times->nice + times->system +
                   times->irq + times->softirq + times->steal;
    times->total = times->active + times->idle_total;

    return 1;
}

/* Functions to save and load CPU history data to ensure persistence between program runs */

/* Save CPU history data to file */
void save_cpu_history(const CpuHistory *history) {
    FILE *file = fopen(HISTORY_FILE, "wb");
    if (!file) {
        perror("Error opening history file for writing");
        return;
    }

    /* Write header with version and timestamp */
    int32_t version = HISTORY_VERSION;
    time_t current_time = time(NULL);

    if (fwrite(&version, sizeof(version), 1, file) != 1 ||
        fwrite(&current_time, sizeof(current_time), 1, file) != 1) {
        perror("Error writing header to history file");
        fclose(file);
        return;
    }

    /* Write history data */
    if (fwrite(&history->history_index, sizeof(history->history_index), 1, file) != 1 ||
        fwrite(&history->history_count, sizeof(history->history_count), 1, file) != 1 ||
        fwrite(&history->max_cpu_usage, sizeof(history->max_cpu_usage), 1, file) != 1 ||
        fwrite(&history->avg_cpu_usage, sizeof(history->avg_cpu_usage), 1, file) != 1 ||
        fwrite(&history->last_update, sizeof(history->last_update), 1, file) != 1 ||
        fwrite(&history->last_reading, sizeof(history->last_reading), 1, file) != 1 ||
        fwrite(&history->ema, sizeof(history->ema), 1, file) != 1 ||
        fwrite(&history->start_time, sizeof(history->start_time), 1, file) != 1) {

        perror("Error writing history data to file");
        fclose(file);
        return;
    }

    /* Write history array */
    if (fwrite(history->history, sizeof(double), HISTORY_SIZE, file) != HISTORY_SIZE) {
        perror("Error writing history array to file");
        fclose(file);
        return;
    }

    fclose(file);
}

/* Load CPU history data from file */
int load_cpu_history(CpuHistory *history) {
    FILE *file = fopen(HISTORY_FILE, "rb");
    if (!file) {
        /* File doesn't exist or can't be opened - not an error for first run */
        return 0;
    }

    /* Read and verify header */
    int32_t version;
    time_t file_time;

    if (fread(&version, sizeof(version), 1, file) != 1 || version != HISTORY_VERSION) {
        /* Version mismatch or read error */
        fclose(file);
        return 0;
    }

    if (fread(&file_time, sizeof(file_time), 1, file) != 1) {
        fclose(file);
        return 0;
    }

    /* We'll accept the file regardless of age to maintain continuity
     * This ensures the history graph doesn't suddenly change shape
     * Instead, we'll just update the timestamp to show it's being used now
     */
    time_t current_time = time(NULL);

    /* Read history data */
    if (fread(&history->history_index, sizeof(history->history_index), 1, file) != 1 ||
        fread(&history->history_count, sizeof(history->history_count), 1, file) != 1 ||
        fread(&history->max_cpu_usage, sizeof(history->max_cpu_usage), 1, file) != 1 ||
        fread(&history->avg_cpu_usage, sizeof(history->avg_cpu_usage), 1, file) != 1 ||
        fread(&history->last_update, sizeof(history->last_update), 1, file) != 1 ||
        fread(&history->last_reading, sizeof(history->last_reading), 1, file) != 1 ||
        fread(&history->ema, sizeof(history->ema), 1, file) != 1 ||
        fread(&history->start_time, sizeof(history->start_time), 1, file) != 1) {

        fclose(file);
        return 0;
    }

    /* Read history array */
    if (fread(history->history, sizeof(double), HISTORY_SIZE, file) != HISTORY_SIZE) {
        fclose(file);
        return 0;
    }

    fclose(file);
    return 1;
}

/* Calculate CPU usage with optimized real-time approach */
double get_cpu_usage() {
    CpuTimes sample1, sample2;
    double cpu_percentage = 0.0;
    time_t now = time(NULL);

    /* Take first sample */
    if (!read_cpu_times(&sample1)) {
        return cpu_history.last_reading;
    }

    /* Short delay for accurate delta measurement */
    sleep_ms(SAMPLE_INTERVAL_MS);

    /* Take second sample */
    if (!read_cpu_times(&sample2)) {
        return cpu_history.last_reading;
    }

    /* Calculate CPU usage percentage */
    long long int total_diff = sample2.total - sample1.total;
    long long int idle_diff = sample2.idle_total - sample1.idle_total;

    if (total_diff > 0) {
        cpu_percentage = ((total_diff - idle_diff) * 100.0) / total_diff;

        /* Basic validity checks */
        if (cpu_percentage < 0) cpu_percentage = 0.0;
        if (cpu_percentage > 100) cpu_percentage = 100.0;
    } else {
        return cpu_history.last_reading;
    }

    /* Simple spike detection - only check for extreme changes */
    if (cpu_history.history_count > 0) {
        double change = fabs(cpu_percentage - cpu_history.last_reading);

        /* If change is too extreme (>50%), apply light smoothing */
        if (change > 50.0 && cpu_history.last_reading < 80.0) {
            /* Blend with previous value to smooth the spike */
            cpu_percentage = (cpu_percentage * 0.7) + (cpu_history.last_reading * 0.3);
        }
    }

    /* Apply light exponential moving average for smoothing */
    if (cpu_history.history_count > 0) {
        cpu_history.ema = (EMA_ALPHA * cpu_percentage) +
                          ((1.0 - EMA_ALPHA) * cpu_history.ema);
        cpu_percentage = cpu_history.ema;
    } else {
        cpu_history.ema = cpu_percentage;
    }

    /* Initialize start_time if this is the first run */
    if (cpu_history.start_time == 0) {
        cpu_history.start_time = now;
    }

    /* Update history if enough time has passed or history is empty (first run) */
    if (now - cpu_history.last_update >= 1 || cpu_history.history_count == 0) {
        /* Save this reading */
        cpu_history.history[cpu_history.history_index] = cpu_percentage;
        cpu_history.history_index = (cpu_history.history_index + 1) % HISTORY_SIZE;
        if (cpu_history.history_count < HISTORY_SIZE) {
            cpu_history.history_count++;
        }

        /* Update stats with a different approach for average and max */
        double sum = 0;
        double current_max = 0;  // Track max in current window only

        /* Calculate statistics from stored history */
        for (int i = 0; i < cpu_history.history_count; i++) {
            sum += cpu_history.history[i];

            /* Find maximum in current window (not persistent) */
            if (cpu_history.history[i] > current_max) {
                current_max = cpu_history.history[i];
            }
        }

        /* Calculate running average based on history window */
        double new_avg = (cpu_history.history_count > 0) ?
                        (sum / cpu_history.history_count) : 0.0;

        /* Apply gentle smoothing to average */
        if (cpu_history.history_count > 1) {
            cpu_history.avg_cpu_usage = (0.9 * new_avg) + (0.1 * cpu_history.avg_cpu_usage);
        } else {
            cpu_history.avg_cpu_usage = new_avg;
        }

        /* Simplest approach: max CPU usage is just the maximum value in the history array */
        double max_value = 0;
        for (int i = 0; i < cpu_history.history_count; i++) {
            if (cpu_history.history[i] > max_value) {
                max_value = cpu_history.history[i];
            }
        }

        /* Set max CPU usage to the maximum value found in the history array */
        cpu_history.max_cpu_usage = max_value;

        cpu_history.last_update = now;
    }

    /* Store current reading for next comparison */
    cpu_history.last_reading = cpu_percentage;

    return cpu_percentage;
}

int main(int argc, char *argv[]) {
    /* Initialize history from file if not already done */
    if (!history_initialized) {
        history_initialized = 1;

        /* If loading fails, we'll start with a fresh history */
        if (!load_cpu_history(&cpu_history)) {
            /* Initialize start_time for fresh history */
            cpu_history.start_time = time(NULL);
        }
    }

    /* Only clean up history file if it's extremely old (more than 7 days)
     * This is just for housekeeping and won't affect normal operation
     */
    struct stat file_stat;
    time_t now = time(NULL);
    if (stat(HISTORY_FILE, &file_stat) == 0) {
        /* If file exists and is more than 7 days old, remove it */
        if (difftime(now, file_stat.st_mtime) > 604800) {
            if (remove(HISTORY_FILE) != 0) {
                perror("Warning: Failed to remove old history file");
            }
        }
    }

    /* Get current CPU usage with robust measurement */
    double current_cpu_usage = get_cpu_usage();

    /* Save history after update */
    save_cpu_history(&cpu_history);

    /* Realtime mode: return instant CPU load without smoothing */
    if (argc > 1 && strcmp(argv[1], "realtime") == 0) {
        CpuTimes sample1, sample2;
        double instant_cpu = 0.0;

        /* Take two quick samples for instant reading */
        if (read_cpu_times(&sample1)) {
            sleep_ms(50);  /* Very short delay for instant reading */
            if (read_cpu_times(&sample2)) {
                long long int total_diff = sample2.total - sample1.total;
                long long int idle_diff = sample2.idle_total - sample1.idle_total;

                if (total_diff > 0) {
                    instant_cpu = ((total_diff - idle_diff) * 100.0) / total_diff;
                    if (instant_cpu < 0) instant_cpu = 0.0;
                    if (instant_cpu > 100) instant_cpu = 100.0;
                }
            }
        }
        printf("%.1f\n", instant_cpu);
        return 0;
    }

    /* Basic mode: return just the current CPU load */
    if (argc == 1) {
        printf("%.0f\n", current_cpu_usage);
        return 0;
    }

    /* Enhanced mode: return detailed CPU stats in JSON format */
    if (argc > 1 && strcmp(argv[1], "enhanced") == 0) {
        /* Construct JSON with current usage, average, max, history count and history */
        printf("{\"current_cpu_usage\":%.1f,\"average_cpu_usage\":%.1f,\"max_cpu_usage\":%.1f,\"history_count\":%d,\"history\":[",
               current_cpu_usage, cpu_history.avg_cpu_usage, cpu_history.max_cpu_usage, cpu_history.history_count);

        /* Add history array in chronological order (all entries, up to HISTORY_SIZE)
         * Ensure proper ordering by calculating the starting index carefully
         */
        if (cpu_history.history_count > 0) {
            // Calculate the starting index (oldest entry)
            int start_idx = 0;
            if (cpu_history.history_count == HISTORY_SIZE) {
                // If buffer is full, start at the next position after the current index
                start_idx = (cpu_history.history_index + 1) % HISTORY_SIZE;
            } else {
                // If buffer is not full, start at the beginning (index 0)
                start_idx = 0;
            }

            // Output all entries in chronological order
            for (int i = 0; i < cpu_history.history_count; i++) {
                int idx = (start_idx + i) % HISTORY_SIZE;
                printf("%.1f%s", cpu_history.history[idx], (i < cpu_history.history_count - 1) ? "," : "");
            }
        }

        printf("]}\n");
        return 0;
    }

    /* Info mode: return CPU information in JSON format */
    if (argc > 1 && strcmp(argv[1], "info") == 0) {
        /* Use lscpu command for CPU information */
        FILE *lscpu_output = popen("lscpu", "r");
        if (lscpu_output == NULL) {
            printf("{\"error\":\"Could not run lscpu command\"}\n");
            return 1;
        }

        char line[256];
        char architecture[64] = "Unknown";
        char vendor_id[64] = "Unknown";
        char model_name[256] = "Unknown";

        while (fgets(line, sizeof(line), lscpu_output)) {
            /* Extract Architecture */
            if (strncmp(line, "Architecture:", 13) == 0) {
                char *value = line + 13;
                while (*value == ' ' || *value == '\t') value++; /* Skip whitespace */
                sscanf(value, "%63[^\n]", architecture);
            }
            /* Extract Vendor ID */
            else if (strncmp(line, "Vendor ID:", 10) == 0) {
                char *value = line + 10;
                while (*value == ' ' || *value == '\t') value++; /* Skip whitespace */
                sscanf(value, "%63[^\n]", vendor_id);
            }
            /* Extract Model name */
            else if (strncmp(line, "Model name:", 11) == 0) {
                char *value = line + 11;
                while (*value == ' ' || *value == '\t') value++; /* Skip whitespace */
                sscanf(value, "%255[^\n]", model_name);
            }
        }
        pclose(lscpu_output);

        /* Return CPU information in JSON format */
        printf("{\"architecture\":\"%s\",\"vendor\":\"%s\",\"model\":\"%s\"}\n",
               architecture, vendor_id, model_name);
        return 0;
    }

    /* Note: Process list functionality was removed to keep the tool generic */

    return 0;
}
