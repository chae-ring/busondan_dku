import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { icons } from '../../utils/icons';
import NoticeScreen from '../Notice/NoticeScreen';
import { Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from '../../utils/helpers';

export default function SubwayListScreen({ navigation }) {
  const [refreshLocked, setRefreshLocked] = useState(false);
  const refreshAnim = useRef(new Animated.Value(0)).current;
  const lastManualRefresh = useRef(0);
  const isFetching = useRef(false);
  const [data, setData] = useState({ up: [], down: [] });
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const [showNotice, setShowNotice] = useState(false);
  const [hasNewNotice, setHasNewNotice] = useState(false);

  const handleRefresh = async () => {
    if (refreshLocked) {
      spinRefreshIcon();
      return;
    }

    setRefreshLocked(true);
    spinRefreshIcon();

    lastManualRefresh.current = Date.now();
    setCountdown(10);

    await fetchData();

    setTimeout(() => setRefreshLocked(false), 2000);
  };

  const spinRefreshIcon = () => {
    refreshAnim.setValue(0);
    Animated.timing(refreshAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start(() => refreshAnim.setValue(0));
  };

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

  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.48,
          duration: 1390,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 1390,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [blinkAnim]);

  const fetchData = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      if (loading) setLoading(true);
      const res = await fetch(`${API_BASE}/subway/arrivals`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();

      const parseRemain = raw => {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (trimmed === '') return null;
          const num = Number(trimmed);
          return Number.isNaN(num) ? null : num;
        }
        if (typeof raw === 'number') return raw;
        return null;
      };

      const getArrivalTime = remain => {
        if (remain === null || remain === undefined || Number.isNaN(remain))
          return '-';
        const now = new Date();
        now.setMinutes(now.getMinutes() + remain);
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      };

      const upTrains =
        json.up?.arrivalInfoList?.map(item => {
          const remain = parseRemain(item.remainingTime);
          return {
            startStation:
              item.startStationName === '-' || !item.startStationName
                ? '죽전'
                : item.startStationName,
            destination:
              item.endStationName === '-' || !item.endStationName
                ? '죽전'
                : item.endStationName,
            remain,
            arrivalTime: getArrivalTime(remain),
            type: item.type || 'live',
            lastTrain: item.lastTrain,
          };
        }) || [];

      const downTrains =
        json.down?.arrivalInfoList?.map(item => {
          const remain = parseRemain(item.remainingTime);
          return {
            startStation:
              item.startStationName === '-' || !item.startStationName
                ? '죽전'
                : item.startStationName,
            destination:
              item.endStationName === '-' || !item.endStationName
                ? '죽전'
                : item.endStationName,
            remain,
            arrivalTime: getArrivalTime(remain),

            type: item.type || 'timetable',
            lastTrain: item.lastTrain,
          };
        }) || [];

      setData({ up: upTrains, down: downTrains });
    } catch (err) {
    } finally {
      isFetching.current = false;
      if (loading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const timer = setInterval(() => {
      const now = Date.now();

      setCountdown(prev => {
        if (prev <= 1) {
          if (now - lastManualRefresh.current >= 10000) {
            fetchData();
          }
          return 10;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchData]);

  if (showNotice) {
    return <NoticeScreen onBack={() => setShowNotice(false)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7F9' }}>
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

      <SafeAreaView
        style={[
          tw`bg-white border-b border-[#E6E7E9] rounded-t-[12px]`,
          { paddingTop: insets.top, height: 58 + insets.top },
        ]}
      >
        <View
          style={tw`flex-row items-center justify-between px-[20px] h-[58px]`}
        >
          <icons.busondan width={100} height={30} />
          <TouchableOpacity
            onPress={() => navigation.navigate('Notice')}
            activeOpacity={0.7}
            style={{ position: 'relative' }}
          >
            <icons.notice width={24} height={24} />

            {hasNewNotice && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#FF3B30',
                }}
              />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F6F7F9' }}
        contentContainerStyle={{
          paddingHorizontal: 13,
          paddingBottom: 10,
        }}
      >
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <icons.banner height={80} />
        </View>

        <View
          style={{
            alignItems: 'center',
            marginBottom: 8,
            marginTop: 32,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              lineHeight: 24,
              fontFamily: 'Pretendard-Bold',
              color: '#212326',
            }}
          >
            죽전역{' '}
            <Text
              style={{
                fontSize: 20,
                lineHeight: 24,
                fontFamily: 'Pretendard-Bold',
                color: '#FFAA00',
              }}
            >
              수인분당선
            </Text>
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 18,
              backgroundColor: '#FFAA00',
              width: 350,
              height: 24,
              borderRadius: 12,
            }}
          >
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
              }}
              activeOpacity={0.7}
            >
              <icons.arrow_left
                width={16}
                height={16}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  lineHeight: 18,
                  fontFamily: 'Pretendard-Medium',
                }}
              >
                오리
              </Text>
            </TouchableOpacity>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 19,
                borderWidth: 2,
                borderColor: '#FFAA00',
                width: 188,
                height: 36,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  columnGap: 10,
                }}
              >
                <View
                  style={{
                    width: 54,
                    height: 18,
                    backgroundColor: '#FFAA00',
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      lineHeight: 14,
                      fontFamily: 'Pretendard-SemiBold',
                    }}
                  >
                    수인분당
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 20,
                    fontFamily: 'Pretendard-Medium',
                    color: '#212326',
                  }}
                >
                  죽전
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  lineHeight: 18,
                  fontFamily: 'Pretendard-Medium',
                }}
              >
                보정
              </Text>

              <icons.arrow_right
                width={16}
                height={16}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 34 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: 345,
              alignSelf: 'center',
            }}
          >
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: 4,
                columnGap: 8,
              }}
              onPress={() =>
                navigation.navigate('SubwayDetail', { updnLine: 'up' })
              }
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 22,
                  fontFamily: 'Pretendard-Bold',
                  color: '#212326',
                }}
              >
                오리 방면
              </Text>

              <icons.more_subway
                width={16}
                height={16}
                style={{ transform: [{ translateY: -1 }] }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRefresh}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 18,
                  fontFamily: 'Pretendard-Medium',
                  color: '#828386',
                }}
              >
                {countdown}초
              </Text>

              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: refreshAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                }}
              >
                <icons.refresh
                  width={24}
                  height={24}
                  style={{ opacity: 0.7 }}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 0.5,
              borderColor: '#E6E7E9',
              paddingVertical: 20,
              width: 350,
              alignSelf: 'center',
              paddingHorizontal: 16,
              marginTop: 12,
            }}
          >
            <View style={{ rowGap: 20 }}>
              {(() => {
                const validUp = (data.up || []).filter(t => {
                  const hasRemain =
                    t.remain !== null &&
                    t.remain !== undefined &&
                    !isNaN(t.remain);
                  const hasTime = t.arrivalTime && t.arrivalTime !== '-';
                  return hasRemain || hasTime;
                });

                if (validUp.length === 0) {
                  return (
                    <View
                      style={{
                        height: 64,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 14,
                          color: '#BABBBd',
                        }}
                      >
                        운행 정보 없음
                      </Text>
                    </View>
                  );
                }

                return validUp.map((train, i) => (
                  <View
                    key={`up-${i}`}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      height: 20,
                    }}
                  >
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          lineHeight: 20,
                          fontFamily: 'Pretendard-Bold',
                          color: '#212326',
                        }}
                      >
                        {train.arrivalTime}
                      </Text>
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          lineHeight: 14,
                          fontFamily: 'Pretendard-Medium',
                          color: '#828386',
                        }}
                      >
                        {train.startStation}
                      </Text>

                      <icons.subway_arrow
                        width={12}
                        height={12}
                        style={{ marginHorizontal: 2 }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 14,
                          fontFamily: 'Pretendard-Medium',
                          color: '#828386',
                        }}
                      >
                        {train.destination}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {train.type === 'live' ? (
                        <Animated.Text
                          style={{
                            opacity: blinkAnim,
                            fontSize: 10,
                            lineHeight: 14,
                            fontFamily: 'Pretendard-Medium',
                            color: '#2373FF',
                            backgroundColor: '#DBE8FF',
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 5,
                          }}
                        >
                          실시간
                        </Animated.Text>
                      ) : (
                        <Text
                          style={{
                            fontSize: 10,
                            lineHeight: 14,
                            fontFamily: 'Pretendard-Medium',
                            color: '#828386',
                            backgroundColor: '#E6E7E9',
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 5,
                          }}
                        >
                          시간표 기준
                        </Text>
                      )}

                      <Text
                        style={{
                          fontSize: 16,
                          lineHeight: 20,
                          fontFamily: 'Pretendard-Bold',
                          color: i === 0 ? '#2373FF' : '#212326',
                        }}
                      >
                        {train.remain == null || isNaN(train.remain)
                          ? '-'
                          : train.remain < 1
                          ? '곧 도착'
                          : `${train.remain}분 후`}
                      </Text>
                    </View>
                  </View>
                ));
              })()}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 34, marginBottom: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: 345,
              alignSelf: 'center',
            }}
          >
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: 4,
                columnGap: 8,
              }}
              onPress={() =>
                navigation.navigate('SubwayDetail', { updnLine: 'down' })
              }
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 22,
                  fontFamily: 'Pretendard-Bold',
                  color: '#212326',
                }}
              >
                보정 방면
              </Text>
              <icons.more_subway
                width={16}
                height={16}
                style={{ transform: [{ translateY: -1 }] }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRefresh}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 18,
                  fontFamily: 'Pretendard-Medium',
                  color: '#828386',
                }}
              >
                {countdown}초
              </Text>

              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: refreshAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                }}
              >
                <icons.refresh
                  width={24}
                  height={24}
                  style={{ opacity: 0.7 }}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 0.5,
              borderColor: '#E6E7E9',
              paddingVertical: 20,
              width: 350,
              alignSelf: 'center',
              paddingHorizontal: 16,
              marginTop: 12,
            }}
          >
            <View style={{ rowGap: 20 }}>
              {(() => {
                const validDown = (data.down || []).filter(t => {
                  const hasRemain =
                    t.remain !== null &&
                    t.remain !== undefined &&
                    !isNaN(t.remain);
                  const hasTime = t.arrivalTime && t.arrivalTime !== '-';
                  return hasRemain || hasTime;
                });

                if (validDown.length === 0) {
                  return (
                    <View
                      style={{
                        height: 64,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 14,
                          color: '#BABBBd',
                        }}
                      >
                        운행 정보 없음
                      </Text>
                    </View>
                  );
                }

                return validDown.map((train, i) => (
                  <View
                    key={`down-${i}`}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      height: 20,
                    }}
                  >
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          lineHeight: 20,
                          fontFamily: 'Pretendard-Bold',
                          color: '#212326',
                        }}
                      >
                        {train.arrivalTime}
                      </Text>
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          lineHeight: 14,
                          fontFamily: 'Pretendard-Medium',
                          color: '#828386',
                        }}
                      >
                        {train.startStation}
                      </Text>
                      <icons.subway_arrow
                        width={12}
                        height={12}
                        style={{ marginHorizontal: 2 }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 14,
                          fontFamily: 'Pretendard-Medium',
                          color: '#828386',
                        }}
                      >
                        {train.destination}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {train.type === 'live' ? (
                        <Animated.Text
                          style={{
                            opacity: blinkAnim,
                            fontSize: 10,
                            lineHeight: 14,
                            fontFamily: 'Pretendard-Medium',
                            color: '#2373FF',
                            backgroundColor: '#DBE8FF',
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 5,
                          }}
                        >
                          실시간
                        </Animated.Text>
                      ) : (
                        <Text
                          style={{
                            fontSize: 10,
                            lineHeight: 14,
                            fontFamily: 'Pretendard-Medium',
                            color: '#828386',
                            backgroundColor: '#E6E7E9',
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 5,
                          }}
                        >
                          시간표 기준
                        </Text>
                      )}

                      <Text
                        style={{
                          fontSize: 16,
                          lineHeight: 20,
                          fontFamily: 'Pretendard-Bold',
                          color: i === 0 ? '#2373FF' : '#212326',
                        }}
                      >
                        {train.remain == null || isNaN(train.remain)
                          ? '-'
                          : train.remain < 1
                          ? '곧 도착'
                          : `${train.remain}분 후`}
                      </Text>
                    </View>
                  </View>
                ));
              })()}
            </View>
          </View>
        </View>
        <View style={tw`border-t border-[#E6E7E9] mt-[105px]`}>
          <View style={tw`items-center py-[20px]`}>
            <View style={tw`flex-row justify-center space-x-[6px]`}>
              <Text
                style={[
                  tw`text-[10px] text-[#828386]`,
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
                  tw`text-[10px] text-[#828386]`,
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
                  tw`text-[10px] text-[#828386]`,
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
    </View>
  );
}
