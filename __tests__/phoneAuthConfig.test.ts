import {Platform, Settings} from 'react-native';
import {auth} from '../src/lib/firebase';
import {requestPhoneVerification} from '../src/services/auth.service';

jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  getConstants: () => ({settings: {}}),
}));

jest.mock('../src/lib/firebase', () => ({
  auth: jest.fn(),
  firestore: jest.fn(),
  messaging: jest.fn(),
}));

const sendCode = jest.fn();

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.mocked(auth).mockReturnValue({signInWithPhoneNumber: sendCode} as unknown as ReturnType<typeof auth>);
  sendCode.mockResolvedValue({verificationId: 'fixture', confirm: jest.fn()});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test.each([
  [{bundleMatchesFirebase: false, callbackSchemeRegistered: true}, 'ios-bundle-mismatch'],
  [{bundleMatchesFirebase: true, callbackSchemeRegistered: false}, 'ios-auth-callback-missing'],
])('invalid installed iOS configuration blocks the SMS request: %s', async (config, errorCode) => {
  jest.spyOn(Settings, 'get').mockReturnValue(config);

  await expect(requestPhoneVerification('01055500000')).rejects.toThrow(errorCode);
  expect(sendCode).not.toHaveBeenCalled();
});

test.each([
  {bundleMatchesFirebase: true, callbackSchemeRegistered: true},
  undefined,
])('valid or older native iOS configuration allows the normal request: %s', async config => {
  jest.spyOn(Settings, 'get').mockReturnValue(config);

  await expect(requestPhoneVerification('01055500000')).resolves.toMatchObject({verificationId: 'fixture'});
  expect(sendCode).toHaveBeenCalledWith('+821055500000');
});

test('Android does not read the iOS configuration', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const getSettings = jest.spyOn(Settings, 'get');

  await requestPhoneVerification('01055500000');

  expect(getSettings).not.toHaveBeenCalled();
  expect(sendCode).toHaveBeenCalledWith('+821055500000');
});
