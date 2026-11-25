/**
 * The six original music loops, written as text patterns (format explained in
 * sequencer.ts). One step = one 8th note, 8 steps per bar.
 *
 * Every tune is "chords + a hand-written melody"; the arpeggio and bass are
 * generated from the chords by the short patterns at the top of each song.
 * Variation between repeats comes from the `form`: the same sections come back
 * with the melody an octave lower, an alternate arpeggio, or a voice resting.
 */
import type { MusicTrack } from "@/game/bridge";
import type { Song } from "./sequencer";

const ARP_UP_DOWN = "1 3 5 3 8 5 3 5";
const ARP_WIDE = "1 5 8 10 8 5 3 5";

const title: Song = {
  title: "Title",
  about: "F major, 92 BPM. Two 8-bar sections, form A B A B (32 bars, ~84 s); 2nd A has a new arp, 2nd B drops the drums. Inviting, a little wistful: long notes, maj7 colour (A over B♭).",
  tonic: "F",
  mode: "major",
  bpm: 92,
  arp: "1 5 8 5 10 5 8 5",
  bass: "1 - - - 5 - - -",
  drums: "K . H . . . H .",
  sections: {
    A: {
      chords: "F | Am | Dm | Bb | F | Am | Gm | C",
      lead: `A4 - C5 - F5 - - G5 | E5 - - - C5 - A4 - | D5 - F5 - A5 - - G5 | F5 - - - D5 - . . |
             C5 - F5 - A5 - G5 F5 | E5 - - - A4 - C5 - | Bb4 - D5 - G5 - F5 E5 | C5 - - - - - . .`,
    },
    B: {
      chords: "Bb | C | Am | Dm | Gm | Bb | C | C7",
      lead: `D5 - - F5 - - Bb5 - | A5 - G5 - E5 - C5 - | E5 - - A5 - - C6 - | A5 - F5 - D5 - - - |
             D5 - - G5 - - Bb5 - | A5 - G5 - F5 - D5 - | E5 - - G5 - - C6 - | Bb5 - - - G5 - E5 -`,
    },
  },
  form: [
    { section: "A" },
    { section: "B" },
    { section: "A", arp: ARP_UP_DOWN },
    { section: "B", mute: ["drums"] },
  ],
};

const overworld: Song = {
  title: "Overworld",
  about: "G major, 112 BPM. 8-bar A (bouncy, staccato) + 8-bar B (lyrical, long notes); form A B ×4 (64 bars, ~2¼ min) with variations: melody an octave lower, an alternate arp, a drum-less B and a melody-less A as a breather.",
  tonic: "G",
  mode: "major",
  bpm: 112,
  arp: ARP_UP_DOWN,
  bass: "1 . 5 . 8 . 5 .",
  drums: "K . H . S . H .",
  sections: {
    A: {
      chords: "G | Em | C | D | G | Em | Am D | G",
      lead: `D5 . B4 . D5 . G5 - | - . E5 . D5 . B4 . | C5 . E5 . G5 . E5 . | F#5 - - . D5 - - . |
             B4 . D5 . G5 . A5 . | B5 - A5 . G5 . E5 . | C5 . E5 . F#5 . A5 . | G5 - - - . . . .`,
    },
    B: {
      chords: "C | D | Bm | Em | C | D | G Em | A7 D",
      lead: `E5 - - G5 - - E5 - | F#5 - - A5 - - F#5 - | D5 - - F#5 - - B5 - | G5 - - - E5 - . . |
             C5 . E5 . G5 . C6 . | B5 . A5 . F#5 . D5 . | G5 - B5 - E5 - G5 - | E5 . C#5 . D5 . F#5 .`,
      drums: "K . H K S . H .",
    },
  },
  form: [
    { section: "A" },
    { section: "B" },
    { section: "A", leadOctave: -1, arp: ARP_WIDE },
    { section: "B", mute: ["drums"] },
    { section: "A", mute: ["lead"], arp: ARP_WIDE }, // a breather: just arp, bass and drums
    { section: "B", leadOctave: -1 },
    { section: "A" },
    { section: "B", arp: ARP_WIDE },
  ],
};

const dungeon: Song = {
  title: "Dungeon",
  about: "D dorian (minor with a raised 6th — the B natural), 84 BPM. 8-bar A + 8-bar B, form A B A(melody low) B(no drums) (32 bars, ~91 s). Sneaky staccato and off-beat plinks: mysterious but playful.",
  tonic: "D",
  mode: "minor",
  bpm: 84,
  arp: ". 1 . 5 . 3 . 5",
  bass: "1 . . 5 8 . 5 .",
  drums: "K . . . S . . H",
  sections: {
    A: {
      chords: "Dm | G | Dm | G | F | C | Em | A7",
      lead: `D5 . F5 . A5 . . G5 | - . B4 . D5 . G5 . | F5 . E5 . D5 . A4 . | B4 - - . . . . . |
             C5 . F5 . A5 . C6 . | G5 . E5 . C5 . E5 . | E5 . G5 . B5 - A5 . | C#5 - - - E5 - . .`,
    },
    B: {
      chords: "C | G | Am | Dm | C | G | Em | A7",
      lead: `E5 . . G5 . . C6 . | B5 . . G5 . . D5 . | C5 . E5 . A5 . G5 . | F5 - - - D5 . . . |
             G5 . E5 . G5 . C6 . | B5 - A5 . G5 . D5 . | B4 . E5 . G5 . B5 . | A5 - - . G5 . E5 .`,
    },
  },
  form: [
    { section: "A" },
    { section: "B" },
    { section: "A", leadOctave: -1 },
    { section: "B", mute: ["drums"] },
  ],
};

const boss: Song = {
  title: "Boss",
  about: "E minor, 150 BPM. 8-bar A (punchy repeated-note hook) + 8-bar B (long notes over the pumping bass), form A B A B (32 bars, ~51 s). Driving octave bass, busy drums, B7 for tension.",
  tonic: "E",
  mode: "minor",
  bpm: 150,
  arp: "1 3 5 8 1 3 5 8",
  bass: "1 8 1 8 1 8 1 8",
  drums: "K H S H K K S H",
  sections: {
    A: {
      chords: "Em | C | D | B7 | Em | C | Am | B7",
      lead: `E5 . E5 G5 . E5 B5 . | A5 . G5 . E5 . G5 . | F#5 . F#5 A5 . F#5 D6 . | B5 - A5 - F#5 - D#5 - |
             E5 . E5 G5 . E5 B5 . | C6 . B5 . G5 . E5 . | A5 . C6 . A5 . E5 . | F#5 - D#5 - B4 - - .`,
    },
    B: {
      chords: "C | D | Em | Em | C | D | B7 | B7",
      lead: `G5 - - - E5 - - - | F#5 - - - A5 - - - | B5 - - - G5 - E5 - | B4 - - - . . . . |
             C6 - - - G5 - - - | A5 - - - F#5 - D5 - | D#5 - F#5 - B5 - - - | A5 . F#5 . D#5 . B4 .`,
      drums: "K H S H K H S H",
    },
  },
  form: [
    { section: "A" },
    { section: "B" },
    { section: "A", arp: "8 5 3 1 8 5 3 1" },
    { section: "B", leadOctave: -1 },
  ],
};

const loading: Song = {
  title: "Loading",
  about: "C major, 138 BPM. One 8-bar section played twice (16 bars, ~28 s); the repeat has a falling arp and an extra kick. Peppy hook that repeats its shape a step higher (a sequence).",
  tonic: "C",
  mode: "major",
  bpm: 138,
  arp: "1 5 3 5 1 5 3 5",
  bass: "1 . 8 . 1 . 8 .",
  drums: "K H S H K H S H",
  sections: {
    A: {
      chords: "C | F | G | C | Am | F | G | G",
      lead: `E5 . G5 . C6 . G5 . | A5 . F5 . C5 . F5 . | G5 . B5 . D6 . B5 . | C6 - - . G5 - E5 - |
             E5 . A5 . C6 . A5 . | F5 . A5 . C6 - A5 - | G5 . F5 . E5 . D5 . | B4 . D5 . G5 - - .`,
    },
  },
  form: [{ section: "A" }, { section: "A", arp: "8 5 3 1 8 5 3 1", drums: "K H S H K K S H" }],
};

const victory: Song = {
  title: "Victory",
  about: "C major, 120 BPM. One 8-bar section played twice (16 bars, 32 s); the repeat drops the melody an octave and widens the arp. Celebratory; follows the C-major victory fanfare.",
  tonic: "C",
  mode: "major",
  bpm: 120,
  arp: ARP_UP_DOWN,
  bass: "1 . 5 . 8 . 5 .",
  drums: "K . H . S . H H",
  sections: {
    A: {
      chords: "C | Am | F | G | C | Am | F G | C",
      lead: `G5 - E5 - G5 - C6 - | A5 - - - E5 - - - | F5 - A5 - C6 - A5 - | B5 - - - G5 - D5 - |
             E5 . G5 . C6 - - . | C6 . B5 . A5 . E5 . | F5 - A5 - G5 - B5 - | C6 - - - - - . .`,
    },
  },
  form: [{ section: "A" }, { section: "A", leadOctave: -1, arp: ARP_WIDE }],
};

export const SONGS: Record<MusicTrack, Song> = { title, overworld, dungeon, boss, loading, victory };

export const MUSIC_TRACKS = Object.keys(SONGS) as MusicTrack[];
