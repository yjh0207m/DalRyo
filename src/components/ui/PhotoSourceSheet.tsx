import React from 'react';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onAlbum: () => void;
  // 이미 고른 사진이 있을 때만 넘긴다. 있으면 '사진 삭제' 항목이 나온다
  onRemove?: () => void;
};

// 사진 촬영 / 앨범에서 선택을 고르는 하단 시트
export function PhotoSourceSheet({
  visible,
  onClose,
  onCamera,
  onAlbum,
  onRemove,
}: Props) {
  const items: ActionSheetItem[] = [
    { icon: Camera, label: '사진 촬영', onPress: onCamera },
    { icon: ImageIcon, label: '앨범에서 선택', onPress: onAlbum },
  ];
  if (onRemove)
    items.push({
      icon: Trash2,
      label: '사진 삭제',
      danger: true,
      onPress: onRemove,
    });
  return <ActionSheet visible={visible} onClose={onClose} items={items} />;
}
