import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import tw from 'twrnc';
import { icons } from '../../utils/icons';
import {
  API_BASE,
  getBusColor,
  directionMap,
  stationMap,
} from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BusDetailScreen({ route, navigation }) {
  const { station, route: routeId } = route.params;
  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get('window');

  const [activeDay, setActiveDay] = useState('월');
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [closestIndex, setClosestIndex] = useState(-1);
  const timeRefs = useRef({});
  const scrollRef = useRef(null);

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () =>
      parent?.setOptions({
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
  }, [navigation]);

  const stationIdMap = useMemo(
    () => ({
      죽전역: 228001028,
      정문: 228001978,
      종합실험동: 228001979,
      인문관: 228001981,
      평화의광장: 228001980,
      치과병원: 228001737,
    }),
    [],
  );

  const isUp = Object.values(stationMap.up).includes(station);
  const fallbackEnd = directionMap[isUp ? 'up' : 'down']?.[routeId];

  const getClosestIndex = useCallback(times => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const toMinutes = t => {
      if (!t || t.length < 5) return Infinity;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const diffs = times.map((t, i) => ({
      diff: toMinutes(t) - currentMinutes,
      index: i,
    }));
    const upcoming = diffs.filter(x => x.diff >= 0);
    return upcoming.length > 0 ? upcoming[0].index : -1;
  }, []);

  const fetchTimetable = useCallback(async () => {
    if (times.length === 0) setLoading(true);
    const stationId = stationIdMap[station];

    try {
      if (!stationId) {
        setData({ stationName: station, endStationName: fallbackEnd });
        setTimes([]);
        setClosestIndex(-1);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_BASE}/buses/stations/${stationId}/timetable?routeId=${routeId}`,
      );
      if (!response.ok) throw new Error('서버 응답 실패');

      const json = await response.json();

      setData({
        stationName: json.stationName || station,
        endStationName:
          (json.endStationName && json.endStationName !== '-'
            ? json.endStationName
            : null) || fallbackEnd,
      });

      const dayData = json.dayofweek?.find(d => d.name === activeDay);
      const timetableArray = dayData?.timetable || [];

      if (timetableArray.length === 0) {
        setTimes([]);
        setClosestIndex(-1);
      } else {
        const parsed = timetableArray.map(t => t.predict);
        setTimes(parsed);
        setClosestIndex(getClosestIndex(parsed));
      }
    } catch (err) {
      setData({ stationName: station, endStationName: fallbackEnd });
      setTimes([]);
      setClosestIndex(-1);
    } finally {
      setLoading(false);
    }
  }, [
    station,
    routeId,
    activeDay,
    fallbackEnd,
    stationIdMap,
    times.length,
    getClosestIndex,
  ]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  useEffect(() => {
    if (closestIndex < 0) return;

    setTimeout(() => {
      if (!scrollRef.current) return;

      const targetY = closestIndex * 52 - 150;
      scrollRef.current.scrollTo({
        y: Math.max(targetY, 0),
        animated: false,
      });
    }, 50);
  }, [closestIndex]);

  const boxMaxHeight = height - (insets.top + 58 + 94 + 80);
  const boxHeight = times.length === 0 ? 75 : boxMaxHeight;

  return (
    <View style={tw`flex-1 bg-[#FFFFFF]`}>
      <SafeAreaView
        style={[
          tw`bg-white border-b border-[#E6E7E9] rounded-t-[12px]`,
          { paddingTop: insets.top, height: 58 + insets.top },
        ]}
      >
        <View style={tw`flex-row items-center px-[16px] h-[58px]`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={tw`flex items-center justify-center w-[24px] h-[24px] mr-[12px]`}
          >
            <icons.back width={24} height={24} />
          </TouchableOpacity>
          <Text
            style={[
              tw`text-[20px]`,
              {
                fontFamily: 'Pretendard-Bold',
                lineHeight: 24,
                color: getBusColor(routeId),
              },
            ]}
          >
            {routeId}
          </Text>
        </View>
      </SafeAreaView>

      <View
        style={tw`px-5 bg-white h-[94px] flex-col items-center justify-center border-b border-[#E6E7E9]`}
      >
        <Text
          style={[
            tw`text-[18px] text-[#212326]`,
            { fontFamily: 'Pretendard-Bold', lineHeight: 22 },
          ]}
        >
          {data.stationName || station}
        </Text>
        <Text
          style={[
            tw`text-[12px] text-[#828386] mt-2`,
            { fontFamily: 'Pretendard-Medium', lineHeight: 14 },
          ]}
        >
          {(data.endStationName && data.endStationName.trim().length > 0
            ? data.endStationName
            : fallbackEnd || '정보 없음') + ' 방면'}
        </Text>
      </View>

      <View style={tw`px-5 bg-[#FFFFFF] flex-col gap-y-4 my-4`}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['월', '화', '수', '목', '금', '토', '휴일'].map(d => (
            <TouchableOpacity
              key={d}
              activeOpacity={1}
              onPress={() => setActiveDay(d)}
              style={tw.style(
                `h-[34px] rounded-[17px] border flex items-center justify-center mr-2`,
                d === '휴일' ? `w-[49px]` : `w-[37px]`,
                activeDay === d ? `border-[#2373FF]` : `border-[#E6E7E9]`,
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
        </ScrollView>
      </View>

      <View style={tw`px-5 pb-10 flex justify-center`}>
        <View
          style={[
            tw`bg-white border border-[#E6E7E9] rounded-[12px] overflow-hidden`,
            { height: boxHeight, width: '100%' },
          ]}
        >
          {loading ? (
            <View style={tw`flex-1 items-center justify-center`}>
              <ActivityIndicator />
            </View>
          ) : times.length === 0 ? (
            <View style={tw`flex-1 items-center justify-center`}>
              <Text style={tw`text-[#212326]`}>준비된 시간표가 없습니다.</Text>
            </View>
          ) : (
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator>
              {times.map((t, index) => {
                const isFirst = index === 0;
                const isLast = index === times.length - 1;
                const isClosest = index === closestIndex;
                return (
                  <View
                    key={`${t}-${index}`}
                    style={tw.style(
                      `h-[52px] flex-row items-center justify-center border-b border-[#E6E7E9]`,
                      isLast && `border-none`,
                      isClosest && `bg-[#EBF2FF]`,
                    )}
                  >
                    {isFirst && (
                      <View
                        style={tw`flex items-center justify-center mr-1 w-4 h-4 rounded-full border border-[#2373FF]`}
                      >
                        <Text
                          style={[
                            tw`text-[9px]`,
                            {
                              fontFamily: 'Pretendard-SemiBold',
                              color: '#2373FF',
                            },
                          ]}
                        >
                          첫
                        </Text>
                      </View>
                    )}
                    {isLast && (
                      <View
                        style={tw`flex items-center justify-center mr-1 w-4 h-4 rounded-full border border-[#FF2F2F]`}
                      >
                        <Text
                          style={[
                            tw`text-[9px]`,
                            {
                              fontFamily: 'Pretendard-SemiBold',
                              color: '#FF2F2F',
                            },
                          ]}
                        >
                          막
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        tw`text-[16px] text-[#212326]`,
                        { fontFamily: 'Pretendard-Medium', lineHeight: 20 },
                      ]}
                    >
                      {t}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}
