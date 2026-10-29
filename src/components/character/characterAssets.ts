import type {ImageSourcePropType} from 'react-native';
import {fetchCharacterImageUrl, fetchCharacterRiveUrl} from '../../services/character.service';
import type {CharacterMotion, CharacterStage, CharacterType} from '../../types/character.types';
import bipedGaits from '../../../assets/rive/biped-v1.motion.json';

const localImages = {
  egg: require('../../assets/images/egg.png'),
};

// 시각 검수를 통과한 단계만 등록한다. 이전 이족 토끼는 비율/옷 문제로 제외했다.
const bundledRives: Partial<Record<`${CharacterType}/${CharacterStage}`, number>> = {};

export function bundledCharacterRive(type: CharacterType, stage: CharacterStage): number | null {
  return bundledRives[`${type}/${stage}`] ?? null;
}

export function bundledCharacterStepMs(type: CharacterType, stage: CharacterStage, motion: CharacterMotion): number | null {
  if (bundledCharacterRive(type, stage) === null) return null;
  const gait = motion === 'slow' ? bipedGaits.walk : motion === 'run' ? bipedGaits.run : motion === 'sprint' ? bipedGaits.sprint : null;
  return gait ? gait.frames / 60 * 1000 / 2 : null;
}

// 같은 캐릭터 이미지를 화면마다 다시 받지 않도록 다운로드 URL을 앱 실행 동안 캐시
const urlCache = new Map<string, Promise<string | null>>();

export function resolveCharacterSource(
  type: CharacterType,
  stage: CharacterStage,
): ImageSourcePropType | Promise<ImageSourcePropType | null> {
  if (stage === 'egg') {
    return localImages.egg;
  }

  const key = `${type}/${stage}`;
  let pending = urlCache.get(key);

  if (!pending) {
    pending = fetchCharacterImageUrl(type, stage).catch(() => {
      urlCache.delete(key);
      return null;
    });
    urlCache.set(key, pending);
  }

  return pending.then(url => (url ? {uri: url} : null));
}

const riveCache = new Map<CharacterType, Promise<string | null>>();

// 동물별 Rive 파일 URL. 파일이 없거나 받지 못하면 null → PNG 애니메이션을 쓴다
export function resolveCharacterRiveUrl(type: CharacterType): Promise<string | null> {
  let pending = riveCache.get(type);

  if (!pending) {
    pending = fetchCharacterRiveUrl(type).catch(() => {
      // 네트워크 오류는 다음 화면에서 다시 시도할 수 있게 캐시하지 않는다
      riveCache.delete(type);
      return null;
    });
    riveCache.set(type, pending);
  }

  return pending;
}
