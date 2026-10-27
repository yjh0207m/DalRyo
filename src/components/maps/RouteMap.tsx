import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { GpsPoint } from '../../types/run.types';
import { routeMapHtml } from '../../utils/routeMap';
import { AppText, Button } from '../ui';
import { colors } from '../../theme';

export function RouteMap({ route }: { route: readonly GpsPoint[] }) {
  const html = useMemo(() => routeMapHtml(route), [route]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setStatus('loading');
    const timer = setTimeout(
      () => setStatus(s => (s === 'loading' ? 'error' : s)),
      15000,
    );
    return () => clearTimeout(timer);
  }, [html, revision]);
  if (!html)
    return (
      <View style={styles.empty}>
        <AppText color={colors.textMuted}>저장된 GPS 위치가 없어요.</AppText>
      </View>
    );
  return (
    <View style={styles.wrapper}>
      <View style={styles.map}>
        <WebView
          key={revision}
          source={{ html, baseUrl: 'https://dalryo-dev.firebaseapp.com/' }}
          originWhitelist={['*']}
          applicationNameForUserAgent="DalRyo/0.1 (com.dalryo.app)"
          cacheEnabled
          mixedContentMode="never"
          javaScriptEnabled
          domStorageEnabled={false}
          setSupportMultipleWindows={false}
          onMessage={event =>
            setStatus(event.nativeEvent.data === 'ready' ? 'ready' : 'error')
          }
          onError={() => setStatus('error')}
          onHttpError={() => setStatus('error')}
          onShouldStartLoadWithRequest={request => {
            if (
              request.url === 'about:blank' ||
              request.url.startsWith('https://dalryo-dev.firebaseapp.com/')
            )
              return true;
            if (request.url === 'https://www.openstreetmap.org/copyright')
              Linking.openURL(request.url).catch(() => undefined);
            return false;
          }}
        />
      </View>
      {status === 'loading' && (
        <AppText variant="caption" color={colors.textMuted}>
          지도를 불러오고 있어요…
        </AppText>
      )}
      {status === 'error' && (
        <>
          <AppText variant="caption" color={colors.textMuted}>
            일부 지도를 불러오지 못했어요. 네트워크를 확인해 주세요.
          </AppText>
          <Button
            label="지도 다시 불러오기"
            size="md"
            variant="secondary"
            onPress={() => setRevision(v => v + 1)}
          />
        </>
      )}
      <AppText variant="label" color={colors.textMuted}>
        초록 점: 출발 · 진한 점: 도착 · 지도를 확대해 경로를 확인하세요.
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  map: {
    height: 300,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  empty: { padding: 24, alignItems: 'center' },
});
