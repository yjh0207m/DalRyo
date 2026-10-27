import type { GpsPoint } from '../types/run.types';

export function validRoute(route: readonly GpsPoint[]) {
  return route.filter(
    point =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Math.abs(point.lat) <= 85.05112878 &&
      Math.abs(point.lng) <= 180,
  );
}

// 경로 색: 출발(초록) → 중간(연두) → 도착 직전(노랑) → 도착(주황). 디자인 시안(UI 구성 > 기록)과 맞춤
export const ROUTE_STOPS: Array<[number, [number, number, number]]> = [
  [0, [47, 163, 107]],
  [0.55, [158, 210, 74]],
  [0.85, [245, 180, 58]],
  [1, [240, 101, 75]],
];
export const START_COLOR = '#2E9E6A';
export const FINISH_COLOR = '#F0654B';

export function routeColorAt(t: number) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < ROUTE_STOPS.length; i++) {
    const [t1, c1] = ROUTE_STOPS[i];
    const [t0, c0] = ROUTE_STOPS[i - 1];
    if (x <= t1) {
      const k = (x - t0) / (t1 - t0 || 1);
      const mix = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
    }
  }
  const last = ROUTE_STOPS[ROUTE_STOPS.length - 1][1];
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}

// 그라데이션 선: 경로를 여러 토막으로 나눠 토막마다 색을 바꾼다 (Leaflet 선은 한 가지 색만 지원)
export function routeSegments(points: Array<[number, number]>, count = 40) {
  if (points.length < 2) return [];
  const size = Math.max(1, Math.ceil((points.length - 1) / count));
  const segments: Array<{ points: Array<[number, number]>; color: string }> = [];
  for (let start = 0; start < points.length - 1; start += size) {
    const end = Math.min(points.length - 1, start + size);
    segments.push({
      points: points.slice(start, end + 1),
      color: routeColorAt((start + end) / 2 / (points.length - 1)),
    });
  }
  return segments;
}

const MARKER_CSS = `
.mk{position:relative;width:0;height:0}
.dot{position:absolute;left:-6px;top:-6px;width:8px;height:8px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)}
.tag{position:absolute;left:0;bottom:11px;transform:translateX(-50%);color:#fff;font:800 12px/1 -apple-system,Roboto,'Noto Sans KR',sans-serif;letter-spacing:.4px;padding:6px 10px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.22);white-space:nowrap}
.tag:after{content:'';position:absolute;left:50%;bottom:-5px;margin-left:-6px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid var(--c)}
.tag.below{bottom:auto;top:11px}.tag.below:after{bottom:auto;top:-5px;border-top:0;border-bottom:6px solid var(--c)}
`;

// START/FINISH 이름표 위치. points는 [북쪽 좌표, 동쪽 좌표] (위도·경도, 또는 화면 좌표면 [-y, x]).
//   기본: 점 위. 경로가 그 점에서 북쪽(위)으로 이어지면 선을 가리지 않게 점 아래로 내린다.
//   출발과 도착이 가까우면(한 바퀴 코스·아주 짧은 기록) 남쪽(아래) 점의 이름표를 아래, 다른 쪽을 위로 둔다.
//   nearGap: 이 거리 안이면 겹친다고 본다 (위도·경도 기준 약 60m)
export function labelSides(points: Array<[number, number]>, nearGap = 0.0006) {
  const none = { start: '', finish: '' };
  if (points.length < 2) return none;
  const lats = points.map(p => p[0]);
  const lngs = points.map(p => p[1]);
  const span = Math.hypot(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  const [start, end] = [points[0], points[points.length - 1]];
  const gap = Math.hypot(start[0] - end[0], start[1] - end[1]);
  const near = gap <= nearGap || span === 0 || gap <= span * 0.3;
  if (near) return start[0] >= end[0] ? { start: '', finish: 'below' } : { start: 'below', finish: '' };
  const k = Math.min(points.length - 1, Math.max(1, Math.round(points.length * 0.08)));
  return {
    start: points[k][0] > start[0] ? 'below' : '',
    finish: points[points.length - 1 - k][0] > end[0] ? 'below' : '',
  };
}

// interactive=false: 완료 화면 미리보기처럼 손가락으로 움직이지 않는 지도
export function routeMapHtml(route: readonly GpsPoint[], interactive = true) {
  const clean = validRoute(route);
  if (!clean.length) return null;
  const step = Math.max(1, Math.ceil(clean.length / 1500));
  const points = clean
    .filter((_, i) => i % step === 0 || i === clean.length - 1)
    .map(p => [p.lat, p.lng] as [number, number]);
  const segments = routeSegments(points);
  const options = interactive
    ? 'scrollWheelZoom:false'
    : 'scrollWheelZoom:false,dragging:false,touchZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,zoomControl:false';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""><style>html,body,#map{height:100%;margin:0;background:#eef4ef}.leaflet-control-attribution{font-size:10px}.leaflet-tile-pane{opacity:.62}${MARKER_CSS}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" onerror="window.ReactNativeWebView.postMessage('error')"></script><script>
  try{const points=${JSON.stringify(points)};const segments=${JSON.stringify(segments)};
  const map=L.map('map',{${options}}).setView(points[0],16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileload',()=>window.ReactNativeWebView.postMessage('ready')).on('tileerror',()=>window.ReactNativeWebView.postMessage('error')).addTo(map);
  if(points.length>1){
    L.polyline(points,{color:'#fff',weight:10,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(map);
    segments.forEach(s=>L.polyline(s.points,{color:s.color,weight:6,lineCap:'round',lineJoin:'round'}).addTo(map));
    map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[34,46],paddingBottomRight:[34,46],maxZoom:17});
  }
  const marker=(at,label,color,side)=>L.marker(at,{interactive:false,icon:L.divIcon({className:'',iconSize:[0,0],html:'<div class="mk"><div class="tag '+side+'" style="background:'+color+';--c:'+color+'">'+label+'</div><div class="dot" style="background:'+color+'"></div></div>'})}).addTo(map);
  const end=points[points.length-1];
  const side=${JSON.stringify(labelSides(points))};
  if(points.length>1)marker(end,'FINISH','${FINISH_COLOR}',side.finish);
  marker(points[0],'START','${START_COLOR}',side.start);
  }catch(e){window.ReactNativeWebView.postMessage('error');}
  </script></body></html>`;
}
