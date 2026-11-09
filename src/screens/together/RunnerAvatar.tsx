import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { colors } from '../../theme';

export function RunnerAvatar({
  uri,
  size = 44,
}: {
  uri?: string | null;
  size?: number;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri && uri !== failedUri ? (
        <Image
          accessible={false}
          source={{ uri }}
          onError={() => setFailedUri(uri)}
          style={styles.image}
        />
      ) : (
        <UserRound size={Math.round(size * 0.48)} color={colors.primaryInk} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
  },
  image: { width: '100%', height: '100%' },
});
