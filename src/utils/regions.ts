import { REGIONS } from './onboarding';

// 주소는 특별시·광역시면 구·군까지, 도면 시·군까지만 쓴다(예: 서울 강남구, 경기 수원시).
// "경기"처럼 시·도만으로는 너무 넓고, 수원시 영통구처럼 도 아래 시의 구까지는 쓰지 않는다.
// 세종특별자치시는 아래 단위가 없어 "세종"만 쓴다.
//
// 시·도 줄임 이름(프로필 지역 목록과 같은 순서) → 고를 수 있는 시·군·구.
// 2026-07 인천 행정 개편(제물포구·영종구·검단구), 2023-07 군위군의 대구 편입을 반영했다
export const REGION_AREAS: Readonly<Record<string, readonly string[]>> = {
  서울: [
    '강남구',
    '강동구',
    '강북구',
    '강서구',
    '관악구',
    '광진구',
    '구로구',
    '금천구',
    '노원구',
    '도봉구',
    '동대문구',
    '동작구',
    '마포구',
    '서대문구',
    '서초구',
    '성동구',
    '성북구',
    '송파구',
    '양천구',
    '영등포구',
    '용산구',
    '은평구',
    '종로구',
    '중구',
    '중랑구',
  ],
  경기: [
    '가평군',
    '고양시',
    '과천시',
    '광명시',
    '광주시',
    '구리시',
    '군포시',
    '김포시',
    '남양주시',
    '동두천시',
    '부천시',
    '성남시',
    '수원시',
    '시흥시',
    '안산시',
    '안성시',
    '안양시',
    '양주시',
    '양평군',
    '여주시',
    '연천군',
    '오산시',
    '용인시',
    '의왕시',
    '의정부시',
    '이천시',
    '파주시',
    '평택시',
    '포천시',
    '하남시',
    '화성시',
  ],
  인천: [
    '강화군',
    '검단구',
    '계양구',
    '남동구',
    '미추홀구',
    '부평구',
    '서구',
    '연수구',
    '영종구',
    '옹진군',
    '제물포구',
  ],
  강원: [
    '강릉시',
    '고성군',
    '동해시',
    '삼척시',
    '속초시',
    '양구군',
    '양양군',
    '영월군',
    '원주시',
    '인제군',
    '정선군',
    '철원군',
    '춘천시',
    '태백시',
    '평창군',
    '홍천군',
    '화천군',
    '횡성군',
  ],
  충북: [
    '괴산군',
    '단양군',
    '보은군',
    '영동군',
    '옥천군',
    '음성군',
    '제천시',
    '증평군',
    '진천군',
    '청주시',
    '충주시',
  ],
  충남: [
    '계룡시',
    '공주시',
    '금산군',
    '논산시',
    '당진시',
    '보령시',
    '부여군',
    '서산시',
    '서천군',
    '아산시',
    '예산군',
    '천안시',
    '청양군',
    '태안군',
    '홍성군',
  ],
  대전: ['대덕구', '동구', '서구', '유성구', '중구'],
  세종: [],
  경북: [
    '경산시',
    '경주시',
    '고령군',
    '구미시',
    '김천시',
    '문경시',
    '봉화군',
    '상주시',
    '성주군',
    '안동시',
    '영덕군',
    '영양군',
    '영주시',
    '영천시',
    '예천군',
    '울릉군',
    '울진군',
    '의성군',
    '청도군',
    '청송군',
    '칠곡군',
    '포항시',
  ],
  경남: [
    '거제시',
    '거창군',
    '고성군',
    '김해시',
    '남해군',
    '밀양시',
    '사천시',
    '산청군',
    '양산시',
    '의령군',
    '진주시',
    '창녕군',
    '창원시',
    '통영시',
    '하동군',
    '함안군',
    '함양군',
    '합천군',
  ],
  대구: [
    '군위군',
    '남구',
    '달서구',
    '달성군',
    '동구',
    '북구',
    '서구',
    '수성구',
    '중구',
  ],
  부산: [
    '강서구',
    '금정구',
    '기장군',
    '남구',
    '동구',
    '동래구',
    '부산진구',
    '북구',
    '사상구',
    '사하구',
    '서구',
    '수영구',
    '연제구',
    '영도구',
    '중구',
    '해운대구',
  ],
  울산: ['남구', '동구', '북구', '울주군', '중구'],
  전북: [
    '고창군',
    '군산시',
    '김제시',
    '남원시',
    '무주군',
    '부안군',
    '순창군',
    '완주군',
    '익산시',
    '임실군',
    '장수군',
    '전주시',
    '정읍시',
    '진안군',
  ],
  전남: [
    '강진군',
    '고흥군',
    '곡성군',
    '광양시',
    '구례군',
    '나주시',
    '담양군',
    '목포시',
    '무안군',
    '보성군',
    '순천시',
    '신안군',
    '여수시',
    '영광군',
    '영암군',
    '완도군',
    '장성군',
    '장흥군',
    '진도군',
    '함평군',
    '해남군',
    '화순군',
  ],
  광주: ['광산구', '남구', '동구', '북구', '서구'],
  제주: ['서귀포시', '제주시'],
};

// 특별시·광역시(구·군까지 쓴다)
export const METROPOLITAN = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
];

// 시·도 아래에서 고르는 단위의 이름
export function areaKind(province: string) {
  return METROPOLITAN.includes(province) ? '구·군' : '시·군';
}

// 시·도와 시·군·구를 한 줄로. 아래 단위가 없으면 시·도만
export function regionLabel(province: string, area?: string | null) {
  return area ? `${province} ${area}` : province;
}

// "경기 수원시" → { province: '경기', area: '수원시' }. 예전처럼 시·도만 저장한 값은 area가 null
export function splitRegion(region: string | null | undefined) {
  const [province = '', area = null] = (region ?? '').trim().split(' ');
  return { province, area: area || null };
}

// 저장할 수 있는 지역인지. 예전에 저장한 시·도만 있는 값도 그대로 받는다
export function isRegion(region: string | null | undefined) {
  const { province, area } = splitRegion(region);
  const areas = REGION_AREAS[province];
  if (!areas) return false;
  return area === null || areas.includes(area);
}

// 주소로 쓰기에 충분히 자세한지: 시·군·구까지 있거나, 아래 단위가 없는 세종
export function isDetailedRegion(region: string | null | undefined) {
  const { province, area } = splitRegion(region);
  const areas = REGION_AREAS[province];
  if (!areas) return false;
  return area === null ? areas.length === 0 : areas.includes(area);
}

// 지도 서비스(Nominatim)의 주소를 "서울 강남구"·"경기 수원시"로 바꾼다.
// 시·도만 알 수 있고 그 아래를 모르면(세종 제외) 너무 넓어서 null
export function regionFromAddressDetail(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const fields = address as Record<string, unknown>;
  if (fields.country_code !== 'kr') return null;
  const names = [
    'state',
    'province',
    'region',
    'city',
    'county',
    'municipality',
    'city_district',
    'borough',
    'district',
    'town',
  ]
    .map(key => fields[key])
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim());
  // 시·도는 도·특별시 칸을 먼저 본다. 경기도 광주시를 광주광역시로 착각하지 않게 하려는 순서다
  let province = REGIONS.find(item =>
    ['state', 'province', 'region'].some(
      key =>
        typeof fields[key] === 'string' &&
        item.names.includes((fields[key] as string).trim()),
    ),
  )?.label;
  province ??= REGIONS.find(item =>
    names.some(name => item.names.includes(name)),
  )?.label;
  if (!province) return null;
  // 지도에 아직 예전 소속으로 남아 있는 곳
  if (province === '경북' && names.includes('군위군'))
    return regionLabel('대구', '군위군');
  if (province === '인천' && names.includes('동구'))
    return regionLabel('인천', '제물포구');
  const areas = REGION_AREAS[province];
  if (areas.length === 0) return province;
  const area = areas.find(item => names.includes(item));
  return area ? regionLabel(province, area) : null;
}
