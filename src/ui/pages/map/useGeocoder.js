const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export async function geocodeAddress(address) {
  const parts = [address.street, address.number, address.postalCode, address.city]
    .filter(Boolean);
  const q = parts.length ? parts.join(' ') : (address.freeform || address.city || '');
  if (!q.trim()) throw new Error('Adresse vide');
  const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(q + ' Belgique')}&countrycodes=be&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  if (!res.ok) throw new Error('Nominatim indisponible');
  const data = await res.json();
  if (!data.length) throw new Error('Adresse introuvable');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'geocoded' };
}
