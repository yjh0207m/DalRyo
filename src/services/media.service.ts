import {launchCamera, launchImageLibrary, type Asset} from 'react-native-image-picker';
import {auth, storage} from '../lib/firebase';

export async function choosePhoto(camera = false): Promise<Asset | null> {
  const options = {mediaType: 'photo' as const, maxWidth: 1600, maxHeight: 1600, quality: 0.8 as const, assetRepresentationMode: 'compatible' as const};
  const response = camera ? await launchCamera({...options, saveToPhotos: false}) : await launchImageLibrary({...options, selectionLimit: 1});
  if (response.didCancel) return null;
  if (response.errorCode) throw new Error(response.errorCode === 'permission' ? '사진 또는 카메라 접근 권한을 설정에서 허용해 주세요.' : '사진을 불러오지 못했어요. 다시 시도해 주세요.');
  const photo = response.assets?.[0];
  if (!photo?.uri || !photo.type?.startsWith('image/')) throw new Error('사진 파일을 선택해 주세요.');
  if ((photo.fileSize ?? 0) >= 8 * 1024 * 1024) throw new Error('사진은 8MB보다 작아야 해요.');
  return photo;
}

export async function uploadPhoto(photo: Asset, folder: 'profiles' | 'posts', onProgress?: (percent: number) => void) {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요해요.');
  if (!photo.uri || !photo.type?.startsWith('image/') || (photo.fileSize ?? 0) >= 8 * 1024 * 1024) throw new Error('사진 파일을 확인해 주세요.');
  const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const ref = storage().ref(`${folder}/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`);
  const task = ref.putFile(photo.uri, {contentType: photo.type});
  const unsubscribe = task.on('state_changed', snap => onProgress?.(snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0));
  try {
    await task;
    return {url: await ref.getDownloadURL(), discard: () => ref.delete()};
  } finally {
    unsubscribe();
  }
}
