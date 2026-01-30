INCLUDE=../../common/include
CFLAGS=-I${INCLUDE}

all: audio_utils cpu_stats

audio_utils: audio_utils.c
	$(CC) $(CFLAGS) audio_utils.c -o audio_utils -pthread

cpu_stats: cpu_stats.c
	$(CC) $(CFLAGS) cpu_stats.c -o cpu_stats -lm

clean:
	rm -f audio_utils cpu_stats
