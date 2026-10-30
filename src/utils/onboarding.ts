import type {Dialect} from '../types/user.types';

export const REGIONS: readonly {label: string; dialect: Dialect; names: readonly string[]}[] = [
  {label:'서울',dialect:'seoul',names:['서울특별시','서울','Seoul']},
  {label:'경기',dialect:'gyeonggi',names:['경기도','경기','Gyeonggi-do']},
  {label:'인천',dialect:'seoul',names:['인천광역시','인천','Incheon']},
  {label:'강원',dialect:'gangwon',names:['강원특별자치도','강원도','강원','Gangwon-do']},
  {label:'충북',dialect:'chung',names:['충청북도','충북','Chungcheongbuk-do']},
  {label:'충남',dialect:'chung',names:['충청남도','충남','Chungcheongnam-do']},
  {label:'대전',dialect:'chung',names:['대전광역시','대전','Daejeon']},
  {label:'세종',dialect:'chung',names:['세종특별자치시','세종시','세종','Sejong']},
  {label:'경북',dialect:'gyeong',names:['경상북도','경북','Gyeongsangbuk-do']},
  {label:'경남',dialect:'gyeong',names:['경상남도','경남','Gyeongsangnam-do']},
  {label:'대구',dialect:'gyeong',names:['대구광역시','대구','Daegu']},
  {label:'울산',dialect:'gyeong',names:['울산광역시','울산','Ulsan']},
  {label:'부산',dialect:'gyeong',names:['부산광역시','부산','Busan']},
  {label:'전북',dialect:'jeon',names:['전북특별자치도','전라북도','전북','Jeollabuk-do']},
  {label:'전남',dialect:'jeon',names:['전라남도','전남','Jeollanam-do']},
  {label:'광주',dialect:'jeon',names:['광주광역시','광주','Gwangju']},
  {label:'제주',dialect:'jeju',names:['제주특별자치도','제주도','제주','Jeju-do']},
];
export type Region = (typeof REGIONS)[number];

export function regionFromAddress(address: unknown): Region | null {
  if (!address || typeof address !== 'object') return null;
  const fields = address as Record<string, unknown>;
  if (fields.country_code !== 'kr') return null;
  // Prefer province/state to city so 경기도 광주시 is not mistaken for 광주광역시.
  for (const key of ['state', 'province', 'region', 'city', 'municipality']) {
    const name = fields[key];
    if (typeof name !== 'string') continue;
    const region = REGIONS.find(item => item.names.includes(name));
    if (region) return region;
  }
  return null;
}

export function bodyInputError(height: string, weight: string): string | null {
  for (const [value, min, max, label] of [[height,50,250,'키'],[weight,10,400,'몸무게']] as const) {
    if (!value.trim()) continue;
    if (!/^\d+(\.\d+)?$/.test(value.trim()) || Number(value) < min || Number(value) > max) {
      return `${label}는 ${min}~${max}${label === '키' ? 'cm' : 'kg'} 범위의 숫자로 입력해 주세요.`;
    }
  }
  return null;
}
