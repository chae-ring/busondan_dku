import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import tw from 'twrnc';
import { icons } from '../../utils/icons';
import { API_BASE } from '../../utils/helpers';

export default function SubwayDetailScreen({ route, navigation }) {
  const { updnLine = 'up' } = route.params;
  const onBack = () => navigation.goBack();

  useFocusEffect(
    React.useCallback(() => {
      const parentNav = navigation.getParent();
      if (!parentNav) return;

      parentNav.setOptions({ tabBarStyle: { display: 'none' } });

      return () => {
        parentNav.setOptions({
          tabBarStyle: {
            height: 90,
            paddingTop: 12,
            paddingBottom: 36,
            borderTopWidth: 1,
            borderTopColor: '#E6E7E9',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            backgroundColor: 'white',
          },
        });
      };
    }, [navigation]),
  );

  const [activeDay, setActiveDay] = useState('월');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  const cacheRef = useRef({});
  const allDayCacheRef = useRef({});
  const timeRefs = useRef({});
  const scrollRef = useRef(null);
  const didScrollRef = useRef(false);

  const groupByHour = list => {
    const grouped = [];
    const byHour = {};
    list.forEach(t => {
      const time = t.time;
      if (!time || time.length < 5) return;
      const hour = time.slice(0, 2);
      if (!byHour[hour]) byHour[hour] = [];
      byHour[hour].push(t);
    });
    Object.keys(byHour)
      .sort((a, b) => {
        const A = Number(a);
        const B = Number(b);
        const adjust = h => (h < 4 ? h + 24 : h);
        return adjust(A) - adjust(B);
      })
      .forEach(h => grouped.push({ hour: h, times: byHour[h] }));
    return grouped;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const lineParam = updnLine === 'up' ? 'up' : 'down';
        const res = await fetch(
          `${API_BASE}/subway/timetable?updnLine=${lineParam}`,
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        json.dayofweek.forEach(dayObj => {
          const dayName = dayObj.name;
          const raw = dayObj.timetables || dayObj.timtables || [];

          const dedup = raw.filter(
            (v, i, arr) => arr.findIndex(x => x.time === v.time) === i,
          );

          allDayCacheRef.current[dayName] = groupByHour(dedup);
        });
      } catch (err) {
        setError('시간표 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [updnLine]);

  const closestTime = useMemo(() => {
    const flat = rows.flatMap(r => r.times);
    if (!flat.length) return null;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const toMinutes = timeStr => {
      if (!timeStr || timeStr.length < 5) return Infinity;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const upcoming = flat
      .map(t => ({ diff: toMinutes(t.time) - currentMinutes, t }))
      .filter(x => x.diff >= 0);

    return upcoming.length > 0 ? upcoming[0].t.time : null;
  }, [rows]);

  useEffect(() => {
    if (loading) return;

    if (!allDayCacheRef.current[activeDay]) return;

    setRows(allDayCacheRef.current[activeDay]);
  }, [activeDay, loading]);

  useLayoutEffect(() => {
    if (loading || !rows.length) return;
    if (didScrollRef.current) return;
    didScrollRef.current = true;

    const targetTime = closestTime || (rows[0]?.times[0]?.time ?? null);
    if (!targetTime) return;

    setTimeout(() => {
      const targetRef = timeRefs.current[targetTime];
      if (!targetRef) return;

      targetRef.measureLayout(
        scrollRef.current,
        (x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(y - Dimensions.get('window').height / 2 + 50, 0),
            animated: false,
          });
        },
        () => {},
      );
    }, 250);
  }, [closestTime, rows, loading]);

  const SCREEN_H = Dimensions.get('window').height;
  const INNER_SCROLL_H = SCREEN_H - 170;

  return (
    <SafeAreaView style={tw`flex-1 bg-[#F6F7F9]`}>
      <View
        style={tw`w-full h-[58px] bg-white border-b border-[#E6E7E9] flex-row items-center px-[16px]`}
      >
        <TouchableOpacity
          onPress={onBack}
          style={tw`w-[24px] h-[24px] items-center justify-center mr-[12px]`}
        >
          <icons.back width={24} height={24} />
        </TouchableOpacity>
        <View style={tw`flex-row items-center`}>
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

          <Text style={[tw`mx-[8px] text-[#D9D9D9]`, { fontSize: 20 }]}>|</Text>

          <Text
            style={[
              tw`text-[#828386]`,
              {
                fontSize: 16,
                lineHeight: 20,
                fontFamily: 'Pretendard-Medium',
              },
            ]}
          >
            {updnLine === 'up' ? '오리 방면' : '보정 방면'}
          </Text>
        </View>
      </View>

      <View style={tw`bg-white px-[20px] pt-[16px] pb-[16px]`}>
        <View style={tw`flex-row`}>
          {['월', '화', '수', '목', '금', '토', '휴일'].map(d => (
            <TouchableOpacity
              key={d}
              activeOpacity={1}
              onPress={() => setActiveDay(d)}
              style={tw.style(
                `h-[34px] rounded-[17px] border flex items-center justify-center mr-[8px]`,
                d === '휴일' ? `w-[49px]` : `w-[37px]`,
                activeDay === d
                  ? `bg-white border-[#2373FF]`
                  : `bg-white border-[#E6E7E9]`,
              )}
            >
              <Text
                style={[
                  tw`text-[14px]`,
                  {
                    fontFamily:
                      activeDay === d ? 'Pretendard-Bold' : 'Pretendard-Medium',
                    color: activeDay === d ? '#2373FF' : '#828386',
                    lineHeight: 18,
                  },
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={tw`flex-1 px-[20px] bg-white`}>
        <View
          style={tw`bg-white border border-[#E6E7E9] rounded-[12px] overflow-hidden w-full`}
        >
          <ScrollView
            ref={scrollRef}
            style={{ height: INNER_SCROLL_H }}
            showsVerticalScrollIndicator
          >
            {loading ? (
              <View style={tw`h-[200px] items-center justify-center`}>
                <ActivityIndicator />
              </View>
            ) : rows.length === 0 ? (
              <View style={tw`h-[200px] items-center justify-center`}>
                <ActivityIndicator />
                <Text
                  style={[
                    tw`text-[#828386] mt-2`,
                    { fontFamily: 'Pretendard-Medium' },
                  ]}
                >
                  불러오는 중...
                </Text>
              </View>
            ) : (
              <View style={tw`flex-col`}>
                {rows.map(block => (
                  <View
                    key={block.hour}
                    style={tw`flex-row bg-white border-b border-[#E6E7E9]`}
                  >
                    <View
                      style={tw`w-[120px] items-center justify-center py-[8px] border-r border-[#E6E7E9]`}
                    >
                      <Text
                        style={[
                          tw`text-[#828386]`,
                          {
                            fontSize: 16,
                            lineHeight: 20,
                            fontFamily: 'Pretendard-Medium',
                          },
                        ]}
                      >
                        {block.hour}시
                      </Text>
                    </View>

                    <View style={tw`flex-1`}>
                      {block.times.map((t, i) => {
                        const isFirst = t.firstTrain;
                        const isLast = t.lastTrain;
                        const isClosest = t.time === closestTime;
                        return (
                          <View
                            key={t.time + i}
                            ref={el => {
                              if (el) timeRefs.current[t.time] = el;
                            }}
                            style={tw.style(
                              `flex-col items-center justify-center h-[70px] border-b border-[#E6E7E9]`,
                              isClosest ? `bg-[#EBF2FF]` : `bg-white`,
                            )}
                          >
                            <View style={tw`flex-row items-center`}>
                              {isFirst && (
                                <View style={tw`mr-[6px]`}>
                                  <View
                                    style={tw`w-[16px] h-[16px] rounded-[12px] border border-[#2373FF] items-center justify-center`}
                                  >
                                    <Text
                                      style={[
                                        tw`text-[9px]  text-[#2373FF]`,
                                        { fontFamily: 'Pretendard-SemiBold' },
                                      ]}
                                    >
                                      첫
                                    </Text>
                                  </View>
                                </View>
                              )}
                              {isLast && (
                                <View style={tw`mr-[6px]`}>
                                  <View
                                    style={tw`w-[16px] h-[16px] rounded-[12px] border border-[#FF2F2F] items-center justify-center`}
                                  >
                                    <Text
                                      style={[
                                        tw`text-[9px]  text-[#FF2F2F]`,
                                        { fontFamily: 'Pretendard-SemiBold' },
                                      ]}
                                    >
                                      막
                                    </Text>
                                  </View>
                                </View>
                              )}
                              <Text
                                style={[
                                  tw`text-[16px] text-[#212326]`,
                                  {
                                    fontFamily: 'Pretendard-Medium',
                                    lineHeight: 20,
                                  },
                                ]}
                              >
                                {t.time}
                              </Text>
                            </View>

                            <View
                              style={tw`flex-row items-center justify-center mt-[4px]`}
                            >
                              <Text
                                style={[
                                  tw`text-[12px] text-[#828386]`,
                                  {
                                    fontFamily: 'Pretendard-Medium',
                                    lineHeight: 14,
                                  },
                                ]}
                              >
                                {t.startStation}
                              </Text>
                              <icons.arrow_route
                                width={12}
                                height={12}
                                style={tw`mx-[4px]`}
                              />
                              <Text
                                style={[
                                  tw`text-[12px] text-[#828386]`,
                                  {
                                    fontFamily: 'Pretendard-Medium',
                                    lineHeight: 14,
                                  },
                                ]}
                              >
                                {t.endStationName}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
