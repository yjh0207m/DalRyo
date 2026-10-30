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
  globalThis.fetch = jest.fn().mockResolvedValue({ok:true,json:async()=>({address:{country_code:'kr',city:'서울특별시'}})});
});
afterAll(() => {globalThis.fetch=originalFetch;});

test('approximate location is sufficient and duplicate requests share one lookup', async () => {
  const first=detect(), second=detect();
  expect(first).toBe(second);
  await expect(first).resolves.toMatchObject({label:'서울',dialect:'seoul'});
  await expect(detect()).resolves.toMatchObject({label:'서울'});
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
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
