import { normalizeUserId, userIdError } from '../src/utils/userId';
import { validateProfile, type ProfileForm } from '../src/utils/profile';
import { userIdValue, validateAccount } from '../functions/src/validation';

const form: ProfileForm = {
  displayName: '달리너',
  website: '',
  height: '',
  weight: '',
  gender: null,
  region: '경기',
  dialect: 'std',
};
const account = {
  displayName: '달리너',
  petName: '달료',
  website: '',
  heightCm: null,
  weightKg: null,
  gender: null,
  region: '경기',
  dialect: 'std',
  notifications: { push: false, growth: true, social: true, stone: true },
};

describe('user id on the app side', () => {
  test.each(['dalryo', 'run_2026', 'abcd', 'a'.repeat(20), '_runner_'])(
    'accepts %s',
    id => expect(userIdError(id)).toBeNull(),
  );

  test.each([
    '',
    'abc',
    'a'.repeat(21),
    'has space',
    '한글아이디',
    'dot.name',
    'dash-name',
  ])('rejects %j', id => expect(userIdError(id)).toContain('아이디'));

  test('a leading @, spaces and capitals are cleaned up before checking', () => {
    expect(normalizeUserId('  @DalRyo_Kim ')).toBe('dalryo_kim');
    expect(userIdError('@DalRyo')).toBeNull();
  });

  test('the profile form keeps the id lower-cased, and leaving it empty means "no change"', () => {
    expect(validateProfile({ ...form, userId: ' @Run_Kim ' }).user_id).toBe(
      'run_kim',
    );
    expect(validateProfile({ ...form, userId: '' }).user_id).toBeNull();
    expect(validateProfile(form).user_id).toBeNull();
    expect(() => validateProfile({ ...form, userId: 'ab' })).toThrow('아이디');
  });
});

describe('user id on the server side', () => {
  test('uses the same rule as the app', () => {
    expect(userIdValue('@Run_Kim')).toBe('run_kim');
    expect(userIdValue('')).toBeNull();
    expect(userIdValue(undefined)).toBeNull();
    expect(userIdValue(null)).toBeNull();
    expect(() => userIdValue('ab')).toThrow('아이디');
    expect(() => userIdValue('no spaces')).toThrow('아이디');
    expect(() => userIdValue(123)).toThrow('아이디');
  });

  test('is part of the validated account changes', () => {
    expect(validateAccount({ ...account, userId: 'Run_Kim' }).user_id).toBe(
      'run_kim',
    );
    expect(validateAccount(account).user_id).toBeNull();
    expect(() => validateAccount({ ...account, userId: 'x' })).toThrow('아이디');
  });
});
