import type {ImageSourcePropType} from 'react-native';
import {fetchCharacterImageUrl, fetchCharacterRiveUrl} from '../../services/character.service';
import type {CharacterStage, CharacterType} from '../../types/character.types';

const localImages = {
  egg: require('../../assets/images/egg.png'),
};

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
