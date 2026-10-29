import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Trees } from 'lucide-react-native';
import { AppText, Button, Card, IconButton } from '../../components/ui';
import { RouteMap } from '../../components/maps/RouteMap';
import {
  getCurrentParkLocation,
  parkRequest,
  type NearbyPark,
  type ParkCourse,
  type ParkRunner,
} from '../../services/park.service';
import { socialError } from '../../services/social.service';
import { colors, spacing } from '../../theme';
type Status = 'idle' | 'loading' | 'success' | 'error';
export function ParksScreen({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (park: NearbyPark, km: number, courseId?: string) => void;
}) {
  const [parks, setParks] = useState<NearbyPark[]>([]),
    [selected, setSelected] = useState<NearbyPark | null>(null);
  const [courses, setCourses] = useState<ParkCourse[]>([]),
    [course, setCourse] = useState<ParkCourse | null>(null);
  const [runners, setRunners] = useState<ParkRunner[]>([]),
    [week, setWeek] = useState('');
  const [status, setStatus] = useState<Status>('idle'),
    [detailStatus, setDetailStatus] = useState<Status>('idle');
  const [rankStatus, setRankStatus] = useState<Status>('idle');
  const [locationFailed,setLocationFailed]=useState(false);
  const [error, setError] = useState(''),
    [stale, setStale] = useState(false),
    [locating, setLocating] = useState(false);
  const epoch = useRef(0),
    detailEpoch = useRef(0),
    busy = useRef(false);
  useEffect(
    () => () => {
      epoch.current++;
      detailEpoch.current++;
    },
    [],
  );
  const back = useCallback(() => {
    if (selected) {
      detailEpoch.current++;
      setSelected(null);
      setCourse(null);
    } else onBack();
  }, [selected, onBack]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  const search = async () => {
    if (busy.current) return;
    busy.current = true;
    const key = ++epoch.current;
    setError('');
    setStatus('loading');
    setLocating(true);
    setLocationFailed(false);
    let located=false;
    try {
      const position = await getCurrentParkLocation();
      located=true;
      if (key !== epoch.current) return;
      setLocating(false);
      const response = await parkRequest<{
        parks: NearbyPark[];
        stale: boolean;
      }>('nearby', position);
      if (key !== epoch.current) return;
      setParks(response.parks);
      setStale(response.stale);
      setStatus('success');
    } catch (e) {
      if (key === epoch.current) {
        setError(socialError(e));
        setLocationFailed(!located);
        setStatus('error');
      }
    } finally {
      if (key === epoch.current) {
        setLocating(false);
        busy.current = false;
      }
    }
  };
  const loadDetail = async (park: NearbyPark) => {
    const key = ++detailEpoch.current;
    setSelected(park);
    setCourse(null);
    setCourses([]);
    setRunners([]);
    setDetailStatus('loading');
    setRankStatus('loading');
    await Promise.allSettled([
      parkRequest<{ courses: ParkCourse[] }>('courses', {
        parkId: park.park_id,
      })
        .then(response => {
          if (key === detailEpoch.current) {
            setCourses(response.courses);
            setDetailStatus('success');
          }
        })
        .catch(() => {
          if (key === detailEpoch.current) setDetailStatus('error');
        }),
      parkRequest<{ week: string; runners: ParkRunner[] }>('rankings', {
        parkId: park.park_id,
      })
        .then(response => {
          if (key === detailEpoch.current) {
            setRunners(response.runners);
            setWeek(response.week);
            setRankStatus('success');
          }
        })
        .catch(() => {
          if (key === detailEpoch.current) setRankStatus('error');
        }),
    ]);
  };
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="공원 달리기에서 뒤로"
          onPress={back}
        />
        <AppText variant="heading">
          {selected ? '공원과 코스' : '공원 달리기'}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {selected ? (
          <>
            <Card style={styles.gap}>
              <AppText variant="heading">{selected.name}</AppText>
              <AppText color={colors.textMuted}>
                {selected.distance_km.toFixed(1)}km 거리
                {selected.address ? ` · ${selected.address}` : ''}
              </AppText>
              <Button
                label="지도에서 위치 보기"
                icon={MapPin}
                variant="secondary"
                size="md"
                onPress={() =>
                  Linking.openURL(
                    `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=16/${selected.lat}/${selected.lng}`,
                  ).catch(() => setError('지도를 열지 못했어요.'))
                }
              />
            </Card>
            <AppText variant="subheading">등록된 러닝 코스</AppText>
            {detailStatus === 'loading' ? (
              <ActivityIndicator color={colors.primary} />
            ) : detailStatus === 'error' ? (
              <Button
                label="코스 다시 불러오기"
                variant="secondary"
                size="md"
                onPress={() => loadDetail(selected)}
              />
            ) : courses.length === 0 ? (
              <>
                <AppText color={colors.textMuted}>
                  등록된 코스가 없어요. 원하는 거리 목표를 정하고 공원에서
                  자유롭게 달릴 수 있어요.
                </AppText>
                <View style={styles.row}>
                  {[3, 5, 10].map(km => (
                    <Button
                      key={km}
                      label={`${km}km`}
                      size="md"
                      style={styles.grow}
                      onPress={() => onStart(selected, km)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                {courses.map(item => (
                  <Button
                    key={item.course_id}
                    label={`${item.name} · ${item.distance_km}km`}
                    size="md"
                    variant={
                      course?.course_id === item.course_id
                        ? 'primary'
                        : 'secondary'
                    }
                    onPress={() => setCourse(item)}
                  />
                ))}
                {course && (
                  <Card style={styles.gap}>
                    {course.route.length > 1 ? (
                      <RouteMap route={course.route} />
                    ) : (
                      <AppText color={colors.textMuted}>
                        이 코스에는 경로 미리보기가 등록되지 않았어요.
                      </AppText>
                    )}
                    <Button
                      label={`${course.distance_km}km 코스로 시작`}
                      onPress={() =>
                        onStart(selected, course.distance_km, course.course_id)
                      }
                    />
                  </Card>
                )}
              </>
            )}
            <AppText variant="subheading">이번 주 공원 랭킹</AppText>
            {rankStatus === 'loading' ? (
              <ActivityIndicator color={colors.primary} />
            ) : rankStatus === 'error' ? (
              <Button
                label="랭킹 다시 불러오기"
                variant="secondary"
                size="md"
                onPress={() => loadDetail(selected)}
              />
            ) : (
              <>
                <AppText variant="caption" color={colors.textMuted}>
                  {week}부터 · 한국 시간 월요일 기준 · 공원 달리기로 저장한 거리
                </AppText>
                {runners.length === 0 ? (
                  <AppText color={colors.textMuted}>
                    이번 주 등록된 기록이 없어요.
                  </AppText>
                ) : (
                  runners.map((runner, index) => (
                    <Card key={runner.uid} style={styles.row}>
                      <AppText variant="subheading">{index + 1}</AppText>
                      <View style={styles.grow}>
                        <AppText>{runner.display_name}</AppText>
                        <AppText variant="caption" color={colors.textMuted}>
                          {runner.run_count}회 달리기
                        </AppText>
                      </View>
                      <AppText variant="subheading" color={colors.primaryInk}>
                        {runner.distance_km.toFixed(2)} km
                      </AppText>
                    </Card>
                  ))
                )}
              </>
            )}
          </>
        ) : (
          <>
            <Card style={styles.gap}>
              <AppText variant="heading">가까운 공원에서 달려요</AppText>
              <AppText color={colors.textMuted}>
                현재 위치 주변 10km 이내에서 가까운 공원 최대 50개를 찾아요.
              </AppText>
              <Button
                label={
                  status === 'loading'
                    ? locating
                      ? '현재 위치 확인 중…'
                      : '공원 검색 중…'
                    : '내 주변 공원 찾기'
                }
                icon={Trees}
                disabled={status === 'loading'}
                onPress={search}
              />
            </Card>
            {status === 'loading' && (
              <ActivityIndicator color={colors.primary} />
            )}
            {status === 'error' && locationFailed && (
              <Button
                label="위치 설정 열기"
                variant="secondary"
                size="md"
                onPress={() => Linking.openSettings()}
              />
            )}
            {stale && (
              <AppText color={colors.textMuted}>
                정보 제공 서비스 연결이 원활하지 않아 최근에 불러온 공원을
                표시하고 있어요.
              </AppText>
            )}
            {status === 'success' && parks.length === 0 && (
              <AppText color={colors.textMuted}>
                주변에 등록된 공원 정보가 없어요. 위치를 이동한 뒤 다시
                찾아보세요.
              </AppText>
            )}
            {parks.map(park => (
              <Card key={park.park_id} style={styles.gap}>
                <AppText variant="subheading">{park.name}</AppText>
                <AppText color={colors.textMuted}>
                  {park.distance_km.toFixed(1)}km 거리
                  {park.address ? ` · ${park.address}` : ''}
                </AppText>
                <Button
                  label="코스·주간 랭킹 보기"
                  size="md"
                  variant="secondary"
                  onPress={() => loadDetail(park)}
                />
              </Card>
            ))}
          </>
        )}
        {!!error && (
          <AppText color={colors.danger} accessibilityRole="alert">
            {error}
          </AppText>
        )}
        <AppText variant="label" color={colors.textMuted}>
          공원 위치는 대표 지점 기준이며 실제 출입구와 다를 수 있어요.
        </AppText>
        <Button
          label="© OpenStreetMap contributors"
          variant="ghost"
          size="md"
          onPress={() =>
            Linking.openURL('https://www.openstreetmap.org/copyright')
          }
        />
        <Button
          label="공원 정보 제공 · Private.coffee"
          variant="ghost"
          size="md"
          onPress={() =>
            Linking.openURL('https://overpass.private.coffee/#privacy-policy')
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
});
