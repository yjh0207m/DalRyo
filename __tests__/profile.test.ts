import {normalizeDialect, validateProfile, type ProfileForm} from '../src/utils/profile';

const form: ProfileForm = {displayName: ' 달리너 ', website: '', height: '', weight: '', gender: null, region: '경기', dialect: 'std'};

test('선택 입력값은 비울 수 있고 닉네임은 정리한다', () => {
  expect(validateProfile(form)).toEqual({
    display_name: '달리너',
    website: null,
    height_cm: null,
    weight_kg: null,
    gender: null,
    region: '경기',
    dialect: 'std',
  });
});
test.each(['', ' ', '가'.repeat(21)])('잘못된 닉네임을 거부한다: %s', displayName => {
  expect(() => validateProfile({...form, displayName})).toThrow('닉네임');
});
test.each(['NaN', 'Infinity', '-1', '0', '1e2', '70kg', '401'])('잘못된 몸무게를 거부한다: %s', weight => {
  expect(() => validateProfile({...form, weight})).toThrow('몸무게');
});
test('소수 신체 정보와 정상 URL을 저장한다', () => {
  expect(validateProfile({...form, height: '170.5', weight: '65.5', website: ' https://example.com '})).toMatchObject({
    height_cm: 170.5,
    weight_kg: 65.5,
    website: 'https://example.com',
  });
});
test.each(['example.com', 'ftp://example.com', 'https://bad url'])('지원하지 않는 웹사이트 주소를 거부한다', website => {
  expect(() => validateProfile({...form, website})).toThrow('웹사이트');
});
test('지역을 검증하고 기존 표준어 지역 코드를 호환한다', () => {
  expect(() => validateProfile({...form, region: ''})).toThrow('지역');
  expect(normalizeDialect('gyeonggi')).toBe('std');
  expect(normalizeDialect('jeju')).toBe('jeju');
});
