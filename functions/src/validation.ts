export function text(
  value: unknown,
  label: string,
  min: number,
  max: number,
): string {
  if (typeof value !== 'string') throw new Error(`${label}을 확인해 주세요.`);
  const result = value.trim();
  if (result.length < min || result.length > max)
    throw new Error(`${label}은 ${min}~${max}자로 입력해 주세요.`);
  return result;
}

export function documentId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new Error('항목을 찾을 수 없어요.');
  return value;
}

export function validateAccount(input: Record<string, unknown>) {
  const display_name = text(input.displayName, '닉네임', 1, 20);
  const pet_name = text(input.petName, '캐릭터 이름', 1, 20);
  const website = typeof input.website === 'string' ? input.website.trim() : '';
  if (
    website &&
    (!/^https?:\/\/[^\s]+$/i.test(website) || website.length > 500)
  )
    throw new Error('웹사이트 주소를 확인해 주세요.');
  const nullableNumber = (value: unknown, min: number, max: number) => {
    if (value === null || value === undefined || value === '') return null;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      throw new Error('신체 정보를 확인해 주세요.');
    return value;
  };
  if (
    !['std', 'gyeong', 'jeon', 'chung', 'jeju'].includes(String(input.dialect))
  )
    throw new Error('말투를 확인해 주세요.');
  const regions = [
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
  if (!regions.includes(String(input.region)))
    throw new Error('지역을 확인해 주세요.');
  if (
    input.gender !== null &&
    input.gender !== 'female' &&
    input.gender !== 'male'
  )
    throw new Error('성별을 확인해 주세요.');
  const prefs = input.notifications as Record<string, unknown>;
  if (
    !prefs ||
    ['push', 'growth', 'social', 'stone'].some(
      key => typeof prefs[key] !== 'boolean',
    )
  )
    throw new Error('알림 설정을 확인해 주세요.');
  return {
    display_name,
    pet_name,
    website: website || null,
    height_cm: nullableNumber(input.heightCm, 50, 250),
    weight_kg: nullableNumber(input.weightKg, 10, 400),
    gender: input.gender,
    region: input.region,
    dialect: input.dialect,
    notification_settings: {
      push: prefs.push,
      growth: prefs.growth,
      social: prefs.social,
      stone: prefs.stone,
    },
  };
}

export function scopedImageUrl(
  value: unknown,
  uid: string,
  folder: 'profiles' | 'posts',
  project?: string,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 3000)
    throw new Error('사진 주소를 확인해 주세요.');
  const url = new URL(value);
  const marker = url.pathname.indexOf('/o/');
  const object =
    marker < 0 ? '' : decodeURIComponent(url.pathname.slice(marker + 3));
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'firebasestorage.googleapis.com' ||
    !object.startsWith(`${folder}/${uid}/`) ||
    object.includes('..')
  )
    throw new Error('본인 사진만 사용할 수 있어요.');
  const bucket = url.pathname.split('/')[3];
  if (
    project &&
    bucket !== `${project}.firebasestorage.app` &&
    bucket !== `${project}.appspot.com`
  )
    throw new Error('앱 저장소의 사진만 사용할 수 있어요.');
  return value;
}
