// Mock data stubs — replaced by real API calls in screen components.
// These prevent ReferenceError if a screen reads a global before its fetch resolves.
const GARMIN_WORKOUTS = [];
const HEVY_WORKOUTS   = [];
const HEVY_EXERCISES  = [];
const HR_SAMPLES      = [];
const SET_TIMELINE    = [];

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
