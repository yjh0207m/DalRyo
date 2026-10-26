import type {ImageSourcePropType} from 'react-native';
import {fetchCharacterImageUrl} from '../../services/character.service';
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
