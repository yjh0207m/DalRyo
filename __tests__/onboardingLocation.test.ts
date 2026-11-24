const mockPermissions = jest.fn();
const mockPosition = jest.fn();
jest.mock('react-native', () => ({
  Platform: {OS:'android'},
  PermissionsAndroid: {PERMISSIONS:{ACCESS_FINE_LOCATION:'fine',ACCESS_COARSE_LOCATION:'coarse'},RESULTS:{GRANTED:'granted'},requestMultiple:(...args: unknown[])=>mockPermissions(...args)},
}));
jest.mock('@react-native-community/geolocation', () => ({__esModule:true,default:{getCurrentPosition:(...args: unknown[])=>mockPosition(...args)}}));

const originalFetch = globalThis.fetch;
let detect: typeof import('../src/services/onboardingLocation.service').detectOnboardingRegion;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  detect = require('../src/services/onboardingLocation.service').detectOnboardingRegion;
  mockPermissions.mockResolvedValue({fine:'denied',coarse:'granted'});
  mockPosition.mockImplementation(success=>success({coords:{latitude:37.5665,longitude:126.978}}));
  globalThis.fetch = jest.fn().mockResolvedValue({ok:true,json:async()=>({address:{country_code:'kr',city:'서울특별시',borough:'중구'}})});
});
afterAll(() => {globalThis.fetch=originalFetch;});

test('approximate location is sufficient and duplicate requests share one lookup', async () => {
  const first=detect(), second=detect();
  expect(first).toBe(second);
  await expect(first).resolves.toMatchObject({region:{label:'서울',dialect:'seoul'},area:'중구'});
  await expect(detect()).resolves.toMatchObject({region:{label:'서울'},area:'중구'});
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  // 구·군까지 받으려고 zoom=12로 묻는다
  expect(String((globalThis.fetch as jest.Mock).mock.calls[0][0])).toContain('zoom=12');
});
test('the province is found even when the map does not know the area below it', async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>({address:{country_code:'kr',state:'경기도'}})});
  await expect(detect()).resolves.toMatchObject({region:{label:'경기'},area:null});
});
test('a province city keeps only its 시, not the 구 inside it', async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>({address:{country_code:'kr',province:'경기도',city:'수원시',borough:'영통구'}})});
  await expect(detect()).resolves.toMatchObject({region:{label:'경기'},area:'수원시'});
});
test('denied permission explains manual selection without requesting GPS or sending coordinates', async () => {
  mockPermissions.mockResolvedValue({fine:'denied',coarse:'never_ask_again'});
  await expect(detect()).rejects.toThrow('지역을 직접 선택');
  expect(mockPosition).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
test('GPS failure is bounded by a native timeout and allows manual selection', async () => {
  mockPosition.mockImplementation((_success,error)=>error({code:3}));
  await expect(detect()).rejects.toThrow('위치 서비스를 켜거나');
  expect(mockPosition.mock.calls[0][2]).toMatchObject({timeout:15000});
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
test.each(['network','unsupported'])('lookup %s failure is actionable', async failure => {
  (globalThis.fetch as jest.Mock).mockImplementation(async()=>{
    if(failure==='network') throw new Error('offline');
    return {ok:true,json:async()=>({address:{country_code:'us',state:'California'}})};
  });
  await expect(detect()).rejects.toThrow('아래에서 지역을 직접 선택');
});
