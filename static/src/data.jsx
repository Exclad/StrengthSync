// Mock data that powers the prototype.

const GARMIN_WORKOUTS = [
  {
    id: "g1",
    name: "Strength Training",
    start: "2026-04-18T06:42:00",
    end:   "2026-04-18T07:54:00",
    durationSec: 72 * 60,
    device: "Forerunner 965",
    avgHr: 128, maxHr: 168, calories: 487,
    sets: 22, // Garmin-detected set count (often wrong)
    hevyMatchId: "h1",
    confidence: 0.98,
  },
  {
    id: "g2",
    name: "Strength Training",
    start: "2026-04-16T18:12:00",
    end:   "2026-04-16T19:21:00",
    durationSec: 69 * 60,
    device: "Forerunner 965",
    avgHr: 134, maxHr: 171, calories: 512,
    sets: 19,
    hevyMatchId: "h2",
    confidence: 0.96,
  },
  {
    id: "g3",
    name: "Cardio",
    start: "2026-04-15T07:10:00",
    end:   "2026-04-15T07:38:00",
    durationSec: 28 * 60,
    device: "Forerunner 965",
    avgHr: 148, maxHr: 176, calories: 318,
    sets: 0,
    hevyMatchId: null,
    confidence: 0.0,
  },
];

const HEVY_WORKOUTS = [
  {
    id: "h1",
    name: "Push Day A — Chest / Shoulders / Tri",
    start: "2026-04-18T06:45:00",
    durationSec: 68 * 60,
    exerciseCount: 6,
    totalVolume: 12480, // lbs
  },
  {
    id: "h2",
    name: "Pull Day B — Back / Biceps",
    start: "2026-04-16T18:15:00",
    durationSec: 66 * 60,
    exerciseCount: 7,
    totalVolume: 14220,
  },
  {
    id: "h3",
    name: "Leg Day — Quad Focus",
    start: "2026-04-14T18:05:00",
    durationSec: 82 * 60,
    exerciseCount: 5,
    totalVolume: 18900,
  },
];

// Hevy exercises for the selected workout (h1). Confidence is auto-map score.
const HEVY_EXERCISES = [
  {
    id: "e1", hevy: "Bench Press (Barbell)",
    garmin: "bench_press", garminLabel: "Bench Press",
    confidence: 0.99, status: "mapped",
    sets: [
      { reps: 10, weight: 135, rpe: 6 },
      { reps: 8,  weight: 185, rpe: 8 },
      { reps: 6,  weight: 205, rpe: 9 },
      { reps: 5,  weight: 215, rpe: 9.5 },
    ],
  },
  {
    id: "e2", hevy: "Incline Dumbbell Press",
    garmin: "incline_dumbbell_bench_press", garminLabel: "Incline Dumbbell Bench Press",
    confidence: 0.94, status: "mapped",
    sets: [
      { reps: 10, weight: 55, rpe: 7 },
      { reps: 10, weight: 55, rpe: 8 },
      { reps: 8,  weight: 60, rpe: 9 },
    ],
  },
  {
    id: "e3", hevy: "Cable Chest Fly (Low to High)",
    garmin: null, garminLabel: null,
    confidence: 0.62, status: "needs-review",
    suggestions: [
      { id: "cable_fly", label: "Cable Fly", score: 0.62 },
      { id: "cable_crossover", label: "Cable Crossover", score: 0.58 },
      { id: "dumbbell_fly", label: "Dumbbell Fly", score: 0.41 },
    ],
    sets: [
      { reps: 12, weight: 30, rpe: 7 },
      { reps: 12, weight: 35, rpe: 8 },
      { reps: 10, weight: 40, rpe: 9 },
    ],
  },
  {
    id: "e4", hevy: "Seated Overhead Press (Machine)",
    garmin: "overhead_press", garminLabel: "Overhead Press",
    confidence: 0.88, status: "mapped",
    sets: [
      { reps: 10, weight: 90, rpe: 7 },
      { reps: 10, weight: 110, rpe: 8 },
      { reps: 8,  weight: 120, rpe: 9 },
    ],
  },
  {
    id: "e5", hevy: "Lateral Raise (Dumbbell)",
    garmin: "lateral_raise", garminLabel: "Lateral Raise",
    confidence: 0.97, status: "mapped",
    sets: [
      { reps: 15, weight: 15, rpe: 6 },
      { reps: 12, weight: 20, rpe: 8 },
      { reps: 10, weight: 25, rpe: 9 },
    ],
  },
  {
    id: "e6", hevy: "Tricep Rope Pushdown",
    garmin: null, garminLabel: null,
    confidence: 0.0, status: "unmapped",
    suggestions: [
      { id: "triceps_pushdown", label: "Triceps Pushdown", score: 0.77 },
      { id: "cable_pushdown", label: "Cable Pushdown", score: 0.71 },
      { id: "tricep_extension", label: "Triceps Extension", score: 0.55 },
    ],
    sets: [
      { reps: 15, weight: 50, rpe: 7 },
      { reps: 12, weight: 60, rpe: 8 },
      { reps: 10, weight: 70, rpe: 9 },
      { reps: 10, weight: 70, rpe: 10 },
    ],
  },
];

// Heart-rate trace, 72 min workout @ 1 sample / 6 sec. Seeded, deterministic.
const HR_SAMPLES = (() => {
  const samples = [];
  let hr = 72;
  const rand = mulberry32(42);
  for (let t = 0; t < 72 * 10; t++) {
    const minute = t / 10;
    // set bumps every ~4 min
    const setPhase = (minute % 4.5) / 4.5;
    const target = 90 + Math.sin(setPhase * Math.PI) * 55 + minute * 0.3;
    hr += (target - hr) * 0.12 + (rand() - 0.5) * 3;
    samples.push({ t: minute, hr: Math.max(60, Math.min(178, hr)) });
  }
  return samples;
})();

// Set timeline — when each set happened (minute offsets), per exercise.
const SET_TIMELINE = [
  { exerciseId: "e1", color: "#E6FF3D", name: "Bench Press",         windows: [[2, 3.5], [7, 8.5], [12, 13.5], [17, 18.5]] },
  { exerciseId: "e2", color: "#9DE8FF", name: "Incline DB Press",    windows: [[22, 23.2], [26, 27.4], [30, 31.3]] },
  { exerciseId: "e3", color: "#FF9DD6", name: "Cable Fly",           windows: [[35, 36.1], [38.5, 39.6], [42, 43.1]] },
  { exerciseId: "e4", color: "#FFBA7A", name: "OHP Machine",         windows: [[46, 47.2], [49.5, 50.7], [53, 54.1]] },
  { exerciseId: "e5", color: "#B6FF9D", name: "Lateral Raise",       windows: [[57, 58], [60, 61], [62.5, 63.5]] },
  { exerciseId: "e6", color: "#D4B5FF", name: "Tricep Pushdown",     windows: [[65, 66], [67, 68], [69, 70], [70.5, 71.5]] },
];

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

Object.assign(window, {
  GARMIN_WORKOUTS, HEVY_WORKOUTS, HEVY_EXERCISES, HR_SAMPLES, SET_TIMELINE,
  fmtTime, fmtDate, fmtDuration,
});
