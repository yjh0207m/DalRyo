import {labelSides, routeColorAt, routeMapHtml, routeSegments, validRoute} from '../src/utils/routeMap';
test('invalid GPS numbers cannot enter map JavaScript or bounds',()=>{
  expect(validRoute([{lat:NaN,lng:127,timestamp:0},{lat:91,lng:127,timestamp:0},{lat:37,lng:Infinity,timestamp:0}])).toEqual([]);
  expect(routeMapHtml([])).toBeNull();
});
test('dense routes preserve their start and destination within the drawing budget',()=>{
  const route=Array.from({length:12000},(_,i)=>({lat:37+i/1000000,lng:127,timestamp:i}));
  const html=routeMapHtml(route)!;
  const encoded=html.match(/const points=(\[.*?\]);/)!;
  const points=JSON.parse(encoded[1]);
  expect(points[0]).toEqual([37,127]);
  expect(points.at(-1)).toEqual([route.at(-1)!.lat,127]);
  expect(points.length).toBeLessThanOrEqual(1501);
});
test('gradient segments cover the whole route without gaps, green to orange',()=>{
  const points=Array.from({length:101},(_,i)=>[37+i/10000,127] as [number,number]);
  const segments=routeSegments(points);
  expect(segments[0].points[0]).toEqual(points[0]);
  expect(segments.at(-1)!.points.at(-1)).toEqual(points.at(-1));
  segments.slice(1).forEach((s,i)=>expect(s.points[0]).toEqual(segments[i].points.at(-1)));
  expect(routeColorAt(0)).toBe('rgb(47,163,107)');
  expect(routeColorAt(1)).toBe('rgb(240,101,75)');
});
test('start and finish are labelled on the map',()=>{
  const html=routeMapHtml([{lat:37,lng:127,timestamp:0},{lat:37.01,lng:127.01,timestamp:1}])!;
  expect(html).toContain("'START'");
  expect(html).toContain("'FINISH'");
});
test('loop courses split START and FINISH labels apart, long routes keep them centered',()=>{
  expect(labelSides([[37.001,127],[37.01,127.01],[37,127.001]])).toEqual({start:'',finish:'below'});
  expect(labelSides([[37,127.002],[37.01,127.01],[37.001,127]])).toEqual({start:'below',finish:''});
  // 북동쪽으로 쭉 달린 기록: 출발 이름표는 선을 피해 아래, 도착 이름표는 위
  expect(labelSides([[37,127],[37.005,127.005],[37.01,127.01]])).toEqual({start:'below',finish:''});
  // 남쪽으로 달린 기록: 출발은 위, 도착은 선이 위에서 내려오므로 아래
  expect(labelSides([[37.01,127],[37.005,127.005],[37,127.01]])).toEqual({start:'',finish:'below'});
});
test('very short runs still separate overlapping labels',()=>{
  expect(labelSides([[37.5763,126.9769],[37.57645,126.9769]])).toEqual({start:'below',finish:''});
});
