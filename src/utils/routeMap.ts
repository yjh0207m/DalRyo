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
export function routeMapHtml(route: readonly GpsPoint[]) {
  const clean = validRoute(route);
  if (!clean.length) return null;
  const step = Math.max(1, Math.ceil(clean.length / 1500));
  const points = clean
    .filter((_, i) => i % step === 0 || i === clean.length - 1)
    .map(p => [p.lat, p.lng]);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""><style>html,body,#map{height:100%;margin:0;background:#e9f4f3}.leaflet-control-attribution{font-size:10px}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" onerror="window.ReactNativeWebView.postMessage('error')"></script><script>
  try{const points=${JSON.stringify(points)};
  const map=L.map('map',{scrollWheelZoom:false}).setView(points[0],16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileload',()=>window.ReactNativeWebView.postMessage('ready')).on('tileerror',()=>window.ReactNativeWebView.postMessage('error')).addTo(map);
  const line=L.polyline(points,{color:'#159e83',weight:5}).addTo(map);if(points.length>1)map.fitBounds(line.getBounds(),{padding:[28,28],maxZoom:17});
  L.circleMarker(points[0],{radius:7,color:'#fff',fillColor:'#19b696',fillOpacity:1,weight:2}).addTo(map).bindPopup('출발');
  if(points.length>1)L.circleMarker(points[points.length-1],{radius:7,color:'#fff',fillColor:'#253f3a',fillOpacity:1,weight:2}).addTo(map).bindPopup('도착');
  }catch(e){window.ReactNativeWebView.postMessage('error');}
  </script></body></html>`;
}
