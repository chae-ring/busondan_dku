import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { icons } from '../../utils/icons';
import StationTab from '../../components/StationTab';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import BusRow from '../../components/BusRow';
import { API_BASE, stationMap, directionMap } from '../../utils/helpers';

export default function BusListScreen({ navigation }) {
  const [busData, setBusData] = useState({
    up: { stops: Object.values(stationMap.up), stops_data: {} },
    down: { stops: Object.values(stationMap.down), stops_data: {} },
  });
  const [countdown, setCountdown] = useState(10);
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpTimetable, setShowUpTimetable] = useState(false);
  const [showDownTimetable, setShowDownTimetable] = useState(false);
  const insets = useSafeAreaInsets();
  const [failCount, setFailCount] = useState(0);
  const isDegraded = failCount >= 10;
  const [hasNewNotice, setHasNewNotice] = useState(false);
  const isFetching = useRef(false);
  const [refreshLocked, setRefreshLocked] = useState(false);
  const refreshAnim = useRef(new Animated.Value(0)).current;
  const lastManualRefresh = useRef(0);

  const [activeUpTab, setActiveUpTab] = useState(stationMap.up['228001028']);
  const [activeDownTab, setActiveDownTab] = useState(
    stationMap.down['228001978'],
  );

  const spinRefreshIcon = () => {
    refreshAnim.setValue(0);
    Animated.timing(refreshAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const handleRefresh = async () => {
    if (refreshLocked) {
      spinRefreshIcon();
      return;
    }

    setRefreshLocked(true);
    spinRefreshIcon();

    lastManualRefresh.current = Date.now();

    setCountdown(10);

    await fetchBusData();

    setTimeout(() => {
      setRefreshLocked(false);
    }, 2000);
  };

  const rotate = refreshAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useFocusEffect(
    React.useCallback(() => {
      const syncNotice = async () => {
        try {
          const stored = await AsyncStorage.getItem('prevNoticeIds');
          const prevIds = stored ? JSON.parse(stored) : [];

          const res = await fetch(`${API_BASE}/notifications`);
          const data = await res.json();
          const notices = data.notifications || [];

          const newExists = notices.some(n => !prevIds.includes(String(n.id)));
          setHasNewNotice(newExists);
        } catch (err) {}
      };

      syncNotice();
    }, []),
  );

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const stored = await AsyncStorage.getItem('prevNoticeIds');
        const prevIds = stored ? JSON.parse(stored) : [];

        const res = await fetch(`${API_BASE}/notifications`);
        const data = await res.json();
        const notices = data.notifications || [];

        const newExists = notices.some(n => !prevIds.includes(String(n.id)));
        setHasNewNotice(newExists);
      } catch (err) {}
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchBusData = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      const res = await fetch(`${API_BASE}/bus_info`);
      if (!res.ok) throw new Error('API 응답 실패');
      const data = await res.json();

      const processed = {
        up: { stops: Object.values(stationMap.up), stops_data: {} },
        down: { stops: Object.values(stationMap.down), stops_data: {} },
      };

      const parseRemain = val => {
        if (val === null || val === undefined) return null;
        const trimmed = String(val).trim();
        if (trimmed === '') return '';
        if (isNaN(trimmed)) return trimmed;
        return parseInt(trimmed, 10);
      };

      Object.entries(data).forEach(([stationId, station]) => {
        const updnLine = stationMap.up[stationId] ? 'up' : 'down';
        const mapped = (station.busList || []).map((b, i) => ({
          id: `${stationId}-${b.routeName}-${i}`,
          routeName: b.routeName?.trim() || '운행정보 없음',
          direction: b.direction?.trim() || '',
          type: b.type,
          primaryMinutes: parseRemain(b.firstRemainingTime),
          secondaryMinutes: parseRemain(b.secondRemainingTime),
          updnLine,
        }));

        if (stationMap.up[stationId]) {
          processed.up.stops_data[stationMap.up[stationId]] = mapped;
        } else if (stationMap.down[stationId]) {
          processed.down.stops_data[stationMap.down[stationId]] = mapped;
        }
      });

      setBusData(processed);
      setFailCount(0);
      //setCountdown(10);
    } catch (e) {
      setFailCount(c => c + 1);
    } finally {
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchBusData();

    const timer = setInterval(() => {
      setCountdown(prev => {
        const now = Date.now();

        if (prev <= 1) {
          if (now - lastManualRefresh.current >= 10000) {
            fetchBusData();
          }
          return 10;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchBusData]);

  const renderBusRows = (
    stopName,
    lineType,
    isTimetableShown,
    setTimetable,
  ) => {
    let stopData = busData[lineType].stops_data[stopName] || [];
    const isUp = lineType === 'up';

    stopData = stopData.filter(
      b => !(stopName === '평화의광장' && b.direction === '단국대.평화의광장'),
    );

    const fixedRoutes =
      stopName === '죽전역' ? ['셔틀버스', '24', '720-3'] : null;
    if (fixedRoutes) {
      stopData = stopData.filter(b => fixedRoutes.includes(b.routeName));
    }

    const shuttle = stopData.find(b => b.routeName === '셔틀버스');

    const liveOthers = isDegraded
      ? []
      : stopData.filter(
          b =>
            b.routeName !== '셔틀버스' &&
            b.type === 'live' &&
            b.primaryMinutes !== null &&
            b.primaryMinutes !== '' &&
            !isNaN(b.primaryMinutes),
        );

    const noLive = liveOthers.length === 0;
    const isShuttleLive =
      shuttle &&
      (shuttle.primaryMinutes === '수시 운행 중' ||
        (shuttle.primaryMinutes !== null &&
          shuttle.primaryMinutes !== '' &&
          !isNaN(shuttle.primaryMinutes)));

    const shouldMoveShuttleToTimetable = !isShuttleLive || isDegraded;

    const busesToShow = shouldMoveShuttleToTimetable
      ? []
      : [
          shuttle || {
            id: `placeholder-${stopName}-shuttle`,
            routeName: '셔틀버스',
            direction: isUp ? '캠퍼스 순환' : '죽전역 방면',
            primaryMinutes: null,
            secondaryMinutes: null,
            type: 'timetable',
            updnLine: lineType,
          },
          ...liveOthers,
        ];

    const allRoutes =
      fixedRoutes?.filter(r => r !== '셔틀버스') ||
      Array.from(new Set(stopData.map(b => b.routeName))).filter(
        r => r && r !== '셔틀버스',
      );

    const liveRouteNames = stopData
      .filter(b => b.type === 'live')
      .map(b => b.routeName);

    let timetableBuses = allRoutes
      .map(name => {
        if (isDegraded || (!isDegraded && liveRouteNames.includes(name))) {
          const liveBus = stopData.find(
            b => b.routeName === name && b.type === 'live',
          );
          const hasValidInfo =
            liveBus &&
            liveBus.primaryMinutes !== null &&
            liveBus.primaryMinutes !== '' &&
            !isNaN(liveBus.primaryMinutes);
          if (hasValidInfo) return null;
          if (liveBus) return liveBus;
        }

        const found = stopData.find(
          b => b.routeName === name && b.type === 'timetable',
        ) ||
          stopData.find(
            b => b.routeName === name && b.type === 'live' && !b.primaryMinutes,
          ) || {
            id: `placeholder-timetable-${stopName}-${name}`,
            routeName: name || '운행정보 없음',
            direction: isUp
              ? directionMap.up[name] || '캠퍼스 방면'
              : directionMap.down[name] || '죽전역 방면',
            primaryMinutes: null,
            secondaryMinutes: null,
            type: 'timetable',
            updnLine: lineType,
          };

        return found;
      })
      .filter(Boolean);

    if (shouldMoveShuttleToTimetable && shuttle) {
      timetableBuses.unshift(shuttle);
    }

    return (
      <View
        style={tw`bg-white rounded-xl border border-[#E6E7E9] overflow-hidden`}
      >
        {busesToShow.map((bus, i, arr) => (
          <BusRow
            key={bus.id}
            bus={bus}
            isLast={i === arr.length - 1 && !isTimetableShown}
            onArrow={() =>
              navigation.navigate('BusDetail', {
                station: stopName,
                route: bus.routeName,
              })
            }
          />
        ))}

        {busesToShow.length === 0 && (
          <View style={tw`h-[76px] items-center justify-center`}>
            <Text
              style={[
                tw`text-[14px] text-[#BABBBd]`,
                { fontFamily: 'Pretendard-Medium' },
              ]}
            >
              운행 정보 없음
            </Text>

            <View
              style={tw`absolute bottom-0 left-[16px] right-[16px] border-b border-[#E6E7E9]`}
            />
          </View>
        )}

        {isTimetableShown && (
          <View>
            <View style={tw`px-[16px] mt-[32px] mb-[8px]`}>
              <Text
                style={[
                  tw`text-[14px] font-bold text-[#212326]`,
                  { fontFamily: 'Pretendard-Bold', lineHeight: 18 },
                ]}
              >
                예상시간표{'    '}
                <Text
                  style={[
                    tw`text-[12px] text-[#828386] font-medium ml-[15px]`,
                    { fontFamily: 'Pretendard-Medium', lineHeight: 14 },
                  ]}
                >
                  과거 운행정보 기반
                </Text>
              </Text>
            </View>

            {timetableBuses.map((bus, i, arr) => (
              <BusRow
                key={`${bus.id}-timetable`}
                bus={bus}
                isLast={i === arr.length - 1}
                onArrow={() =>
                  navigation.navigate('BusDetail', {
                    station: stopName,
                    route: bus.routeName,
                  })
                }
              />
            ))}

            <TouchableOpacity
              style={tw`w-full flex-row justify-center items-center gap-[8px] h-[48px] bg-white`}
              onPress={() => setTimetable(false)}
              activeOpacity={0.7}
            >
              <View
                style={tw`absolute top-0 left-[16px] right-[16px] border-t border-[#E6E7E9]`}
              />

              <Text
                style={[
                  tw`text-[12px] text-[#BABBBd]`,
                  { fontFamily: 'Pretendard-Medium', lineHeight: 14 },
                ]}
              >
                예상시간표
              </Text>
              <icons.arrow_up width={16} height={16} />
            </TouchableOpacity>
          </View>
        )}

        {!isTimetableShown && (
          <TouchableOpacity
            style={tw`w-full flex-row justify-center items-center gap-[8px] h-[48px] bg-white`}
            onPress={() => setTimetable(true)}
            activeOpacity={0.7}
          >
            {busesToShow.length > 0 && (
              <View
                style={tw`absolute top-0 left-[16px] right-[16px] border-t border-[#E6E7E9]`}
              />
            )}
            <Text
              style={[
                tw`text-[12px] text-[#BABBBd]`,
                { fontFamily: 'Pretendard-Medium', lineHeight: 14 },
              ]}
            >
              예상시간표
            </Text>
            <icons.arrow_down width={16} height={16} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#F6F7F9]`}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: '#FFFFFF',
          zIndex: 10,
        }}
      />
      <View
        style={tw`bg-white w-full h-[58px] px-[20px] flex-row items-center justify-between border-b border-[#E6E7E9]`}
      >
        <icons.busondan width={100} height={30} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Notice')}
          style={tw`relative`}
        >
          <icons.notice width={24} height={24} />
          {hasNewNotice && (
            <View
              style={tw`absolute -top-[2px] -right-[2px] w-[8px] h-[8px] bg-[#FF3B30] rounded-full`}
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={tw`w-full bg-[#F6F7F9] px-4 pt-[16px]`}
        contentContainerStyle={tw`pb-[20px] flex-col gap-y-7`}
      >
        <View style={{ alignItems: 'center' }}>
          <icons.banner height={80} />
        </View>

        <View style={tw`flex-col gap-y-3 -mt-[10]`}>
          <View style={tw`flex-row justify-between items-center`}>
            <Text
              style={[
                tw`text-[18px] text-[#212326] ml-[3px]`,
                { fontFamily: 'Pretendard-Bold', lineHeight: 22 },
              ]}
            >
              상행 (캠퍼스 방면)
            </Text>

            <TouchableOpacity
              style={tw`flex-row items-center mr-[5px]`}
              activeOpacity={0.7}
              onPress={handleRefresh}
            >
              <Text
                style={[
                  tw`text-[14px] text-[#828386]`,
                  { fontFamily: 'Pretendard-Medium', lineHeight: 18 },
                ]}
              >
                {countdown}초
              </Text>

              <Animated.View
                style={[
                  tw`ml-1`,
                  {
                    transform: [
                      {
                        rotate: refreshAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <icons.refresh width={24} height={24} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['죽전역', '치과병원', '종합실험동'].map(stop => (
              <View key={stop} style={tw`mr-2`}>
                <StationTab
                  name={stop}
                  activeTab={activeUpTab}
                  setActiveTab={setActiveUpTab}
                />
              </View>
            ))}
          </ScrollView>

          {renderBusRows(
            activeUpTab,
            'up',
            showUpTimetable,
            setShowUpTimetable,
          )}
        </View>

        <View style={tw`flex-col gap-y-3`}>
          <View style={tw`flex-row justify-between items-center`}>
            <Text
              style={[
                tw`text-[18px] text-[#212326] ml-[3px]`,
                { fontFamily: 'Pretendard-Bold', lineHeight: 22 },
              ]}
            >
              하행 (죽전역 방면)
            </Text>

            <TouchableOpacity
              style={tw`flex-row items-center mr-[5px]`}
              activeOpacity={0.7}
              onPress={handleRefresh}
            >
              <Text
                style={[
                  tw`text-[14px] text-[#828386]`,
                  { fontFamily: 'Pretendard-Medium', lineHeight: 18 },
                ]}
              >
                {countdown}초
              </Text>

              <Animated.View
                style={[
                  tw`ml-1`,
                  {
                    transform: [
                      {
                        rotate: refreshAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <icons.refresh width={24} height={24} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['평화의광장', '인문관', '정문'].map(stop => (
              <View key={stop} style={tw`mr-2`}>
                <StationTab
                  name={stop}
                  activeTab={activeDownTab}
                  setActiveTab={setActiveDownTab}
                />
              </View>
            ))}
          </ScrollView>

          {renderBusRows(
            activeDownTab,
            'down',
            showDownTimetable,
            setShowDownTimetable,
          )}
        </View>
        <View style={tw`border-t border-[#E6E7E9] mt-[95px]`}>
          <View style={tw`items-center py-[20px]`}>
            <View style={tw`flex-row justify-center space-x-[6px]`}>
              <Text
                style={[
                  tw`text-[10px] font-semibold text-[#828386]`,
                  { fontFamily: 'Pretendard-SemiBold' },
                ]}
                onPress={() =>
                  Linking.openURL(
                    'https://busondan.notion.site/2a1a4cf4c61c80d08078e26338835ec2?source=copy_link',
                  )
                }
              >
                버스온단 이용약관
              </Text>

              <Text
                style={[
                  tw`text-[10px] text-[#E6E7E9] mx-[4px]`,
                  { fontFamily: 'Pretandard-Regular' },
                ]}
              >
                |
              </Text>

              <Text
                style={[
                  tw`text-[10px] font-semibold text-[#828386]`,
                  { fontFamily: 'Pretendard-SemiBold' },
                ]}
                onPress={() =>
                  Linking.openURL(
                    'https://busondan.notion.site/2a1a4cf4c61c80d097e5feec2a7a32c4?source=copy_link',
                  )
                }
              >
                사용방법
              </Text>

              <Text
                style={[
                  tw`text-[10px] text-[#E6E7E9] mx-[4px]`,
                  { fontFamily: 'Pretandard-Regular' },
                ]}
              >
                |
              </Text>

              <Text
                style={[
                  tw`text-[10px] font-semibold text-[#828386]`,
                  { fontFamily: 'Pretendard-SemiBold' },
                ]}
                onPress={() =>
                  Linking.openURL(
                    'https://busondan.notion.site/2a1a4cf4c61c80d097e5feec2a7a32c4?source=copy_link',
                  )
                }
              >
                문의하기
              </Text>
            </View>

            <Text
              style={[
                tw`mt-[8px] text-[10px] text-[#828386]`,
                { fontFamily: 'Pretendard-Regular' },
              ]}
            >
              이메일 : contact@busondan.org
            </Text>

            <Text
              style={[
                tw`mt-[8px] text-[10px] text-[#828386]`,
                { fontFamily: 'Pretendard-Light' },
              ]}
            >
              ©버스온단. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
