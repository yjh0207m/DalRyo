export type ParkData = {
  park_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  source?: string;
  osm_url?: string;
};
export function coordinate(value: unknown, lat: boolean): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > (lat ? 85 : 180)
  )
    throw new Error('위치 정보를 확인해 주세요.');
  return value;
}
export function parkDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180,
    dy = (b.lat - a.lat) * rad,
    dx = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dy / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dx / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function parseOsmParks(value: unknown): ParkData[] {
  if ((value as {remark?:unknown})?.remark) throw new Error('공원 조회가 완료되지 않았어요.');
  const elements = (value as { elements?: unknown[] })?.elements;
  if (!Array.isArray(elements))
    throw new Error('공원 정보 응답을 확인하지 못했어요.');
  const result = new Map<string, ParkData>();
  for (const item of elements) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>,
      tags = d.tags as Record<string, unknown> | undefined;
    if (
      !tags ||
      tags.leisure !== 'park' ||
      tags.access === 'private' ||
      tags.access === 'no'
    )
      continue;
    const name =
      typeof tags['name:ko'] === 'string' ? tags['name:ko'] : tags.name;
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      !['node', 'way', 'relation'].includes(String(d.type)) ||
      !Number.isSafeInteger(d.id) ||
      Number(d.id) <= 0
    )
      continue;
    const center = d.center as { lat?: unknown; lon?: unknown } | undefined;
    try {
      const lat = coordinate(d.lat ?? center?.lat, true),
        lng = coordinate(d.lon ?? center?.lon, false);
      const id = `osm_${d.type}_${d.id}`;
      const address = [
        tags['addr:city'],
        tags['addr:district'],
        tags['addr:street'],
        tags['addr:housenumber'],
      ]
        .filter(v => typeof v === 'string')
        .join(' ')
        .slice(0, 200);
      result.set(id, {
        park_id: id,
        name: name.trim().slice(0, 100),
        lat,
        lng,
        address,
        source: 'OpenStreetMap',
        osm_url: `https://www.openstreetmap.org/${d.type}/${d.id}`,
      });
    } catch {
      continue;
    }
  }
  return [...result.values()];
}
export function parkWeekKey(at: Date) {
  const kst = new Date(at.getTime() + 9 * 3600000);
  kst.setUTCHours(0, 0, 0, 0);
  kst.setUTCDate(kst.getUTCDate() - ((kst.getUTCDay() + 6) % 7));
  return kst.toISOString().slice(0, 10);
}
