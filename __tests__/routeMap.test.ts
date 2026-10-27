import {routeMapHtml, validRoute} from '../src/utils/routeMap';
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
