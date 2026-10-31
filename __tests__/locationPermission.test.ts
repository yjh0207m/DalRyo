const mockRequest = jest.fn();
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {requestAuthorization: (...args: unknown[]) => mockRequest(...args)},
}));

let request: typeof import('../src/services/locationPermission.service').requestIosLocationPermission;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.useFakeTimers();
  request = require('../src/services/locationPermission.service').requestIosLocationPermission;
});
afterEach(() => jest.useRealTimers());

test('once granted, later calls resolve without asking the library again', async () => {
  mockRequest.mockImplementation(success => success());
  await expect(request()).resolves.toBe(true);
  // iOS는 상태가 그대로면 콜백을 다시 부르지 않으므로, 재호출이 라이브러리를 거치면 멈춘다
  mockRequest.mockImplementation(() => {});
  await expect(request()).resolves.toBe(true);
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test('first request waits for the user prompt without a timeout', async () => {
  let answer: () => void = () => {};
  mockRequest.mockImplementation(success => {answer = success;});
  const pending = request();
  jest.advanceTimersByTime(60000);
  answer();
  await expect(pending).resolves.toBe(true);
});

test('a denied answer is reported, and asking again does not hang when the status is unchanged', async () => {
  mockRequest.mockImplementationOnce((_success, error) => error());
  await expect(request()).resolves.toBe(false);
  mockRequest.mockImplementationOnce(() => {});
  const again = request();
  jest.advanceTimersByTime(1500);
  await expect(again).resolves.toBe(false);
});
