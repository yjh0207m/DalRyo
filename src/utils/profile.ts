import type {Dialect, Gender} from '../types/user.types';

export const DIALECT_OPTIONS: Array<{value: Dialect; label: string; example: string}> = [
  {value: 'std', label: '표준어', example: '달료!'},
  {value: 'gyeong', label: '경상도', example: '달려뿌라!'},
  {value: 'jeon', label: '전라도', example: '달려부러!'},
  {value: 'chung', label: '충청도', example: '달려야쥐!'},
  {value: 'jeju', label: '제주도', example: '달려수다!'},
];

export const REGIONS = [
  '서울',
  '경기',
  '인천',
  '강원',
  '충북',
  '충남',
  '대전',
  '세종',
  '경북',
  '경남',
  '대구',
  '부산',
  '울산',
  '전북',
  '전남',
  '광주',
  '제주',
];

export type ProfileForm = {
  displayName: string;
  website: string;
  height: string;
  weight: string;
  gender: Gender;
  region: string;
  dialect: Dialect;
};

export function normalizeDialect(value: Dialect): Dialect {
  return DIALECT_OPTIONS.some(option => option.value === value) ? value : 'std';
}

export function validateProfile(form: ProfileForm) {
  const displayName = form.displayName.trim();
  if (!displayName || displayName.length > 20) throw new Error('닉네임은 1~20자로 입력해 주세요.');
  const website = form.website.trim();
  if (website && (!/^https?:\/\/[^\s]+$/i.test(website) || website.length > 500)) {
    throw new Error('웹사이트는 https:// 또는 http://로 시작하는 주소를 입력해 주세요.');
  }
  const numberOrNull = (value: string, label: string, min: number, max: number) => {
    if (!value.trim()) return null;
    const number = Number(value);
    if (!/^\d+(\.\d+)?$/.test(value.trim()) || !Number.isFinite(number) || number < min || number > max) {
      throw new Error(`${label}는 ${min}~${max} 사이의 숫자로 입력해 주세요.`);
    }
    return number;
  };
  if (!REGIONS.includes(form.region)) throw new Error('지역을 선택해 주세요.');
  if (!DIALECT_OPTIONS.some(option => option.value === form.dialect)) throw new Error('말투를 선택해 주세요.');
  if (form.gender !== null && form.gender !== 'female' && form.gender !== 'male') throw new Error('성별을 다시 선택해 주세요.');
  return {
    display_name: displayName,
    website: website || null,
    height_cm: numberOrNull(form.height, '키', 50, 250),
    weight_kg: numberOrNull(form.weight, '몸무게', 10, 400),
    gender: form.gender,
    region: form.region,
    dialect: form.dialect,
  };
}
