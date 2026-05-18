function nowIso() {
  return new Date().toISOString();
}

function diffMinutes(later, earlier) {
  const a = later instanceof Date ? later : new Date(later);
  const b = earlier instanceof Date ? earlier : new Date(earlier);
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / 60000));
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000);
}

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

module.exports = { nowIso, diffMinutes, addMinutes, formatDuration };
