import {coordinate,parseOsmParks,parkDistance,parkWeekKey} from '../functions/src/parkData';
test('only named, accessible parks with real coordinates are accepted',()=>{
 const base={type:'way',id:12,center:{lat:37.55,lon:126.95},tags:{leisure:'park',name:'Park','name:ko':'공원',phone:'secret'}};
 const result=parseOsmParks({elements:[base,base,{...base,id:13,tags:{...base.tags,access:'private'}},{...base,id:14,center:{lat:NaN,lon:127}},{...base,id:15,tags:{leisure:'park'}},{...base,id:16,type:'unknown'}]});
 expect(result).toEqual([{park_id:'osm_way_12',name:'공원',lat:37.55,lng:126.95,address:'',source:'OpenStreetMap',osm_url:'https://www.openstreetmap.org/way/12'}]);
});
test('malformed responses and injected coordinate strings fail',()=>{
 expect(()=>parseOsmParks({})).toThrow();
 expect(()=>parseOsmParks({elements:[],remark:'timeout'})).toThrow();
 expect(()=>coordinate('37);out body;',true)).toThrow();
 expect(()=>coordinate(Infinity,false)).toThrow();
 expect(()=>coordinate(86,true)).toThrow();
});
test('distance filtering uses real coordinates',()=>{
 expect(parkDistance({lat:37.55,lng:126.95},{lat:37.55,lng:126.95})).toBe(0);
 expect(parkDistance({lat:37.55,lng:126.95},{lat:38.55,lng:126.95})).toBeGreaterThan(100);
});
test('weekly ranking boundaries use Monday in Korea, independently of host timezone',()=>{
 expect(parkWeekKey(new Date('2026-10-25T14:59:59Z'))).toBe('2026-10-19');
 expect(parkWeekKey(new Date('2026-10-25T15:00:00Z'))).toBe('2026-10-26');
 expect(parkWeekKey(new Date('2026-10-28T12:00:00Z'))).toBe('2026-10-26');
});
