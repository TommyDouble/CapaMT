export function normalizeCoordinates(coords = {}, defaultSource = 'manual') {
  const lat = parseCoordinate(coords?.lat);
  const lng = parseCoordinate(coords?.lng);
  return {
    lat,
    lng,
    source: coords?.source || defaultSource,
  };
}

export function hasValidCoordinates(coords) {
  if (!coords) return false;
  const lat = parseCoordinate(coords.lat);
  const lng = parseCoordinate(coords.lng);
  return lat !== null && lng !== null && lat !== 0 && lng !== 0;
}

function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
