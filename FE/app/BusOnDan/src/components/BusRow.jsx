import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import tw from 'twrnc';
import { getBusColor, directionMap } from '../utils/helpers';
import { icons } from '../utils/icons';

export default function BusRow({ bus, isLast, onArrow }) {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.4,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [blinkAnim]);

  const validNumber = (val: any) =>
    val !== null && val !== undefined && val !== '' && !isNaN(Number(val));

  const hasInfo =
    (typeof bus.primaryMinutes === 'string' &&
      isNaN(Number(bus.primaryMinutes))) ||
    validNumber(bus.primaryMinutes);

  const p = validNumber(bus.primaryMinutes)
    ? Math.floor(Number(bus.primaryMinutes))
    : null;

  let primaryText = '';
  if (
    typeof bus.primaryMinutes === 'string' &&
    isNaN(Number(bus.primaryMinutes))
  ) {
    primaryText = bus.primaryMinutes.trim();
  } else if (validNumber(bus.primaryMinutes)) {
    primaryText = p <= 1 ? '곧 도착' : `${p}분 후`;
  } else {
    primaryText = '운행 정보 없음';
  }

  const s = validNumber(bus.secondaryMinutes)
    ? Math.floor(Number(bus.secondaryMinutes))
    : null;
  const secondaryText = s !== null ? (s <= 1 ? '곧 도착' : `${s}분 후`) : null;

  return (
    <TouchableOpacity
      style={tw`px-[16px]`}
      onPress={onArrow}
      activeOpacity={0.7}
    >
      <View
        style={[
          tw`flex-row justify-between items-center h-[76px] border-b border-[#E6E7E9]`,
          isLast && { borderBottomWidth: 0 },
        ]}
      >
        <View style={tw`flex-col justify-between h-full py-[16px]`}>
          <Text
            style={[
              tw`text-[18px] leading-[22px]`,
              {
                fontFamily: 'Pretendard-Bold',
                color: getBusColor(bus.routeName),
              },
            ]}
          >
            {bus.routeName}
          </Text>

          <Text
            style={[
              tw`text-[12px] leading-[14px] text-[#828386] mt-[6px]`,
              { fontFamily: 'Pretendard-Medium' },
            ]}
          >
            {bus.direction ||
              directionMap[bus.updnLine?.toLowerCase()]?.[bus.routeName]}
          </Text>
        </View>

        <View style={tw`flex-row items-center justify-end w-[160px]`}>
          <View style={tw`flex-col items-end justify-between h-full py-[16px]`}>
            {hasInfo ? (
              <>
                <View style={tw`flex-row items-center justify-end`}>
                  {bus.routeName !== '셔틀버스' &&
                    bus.type === 'live' &&
                    validNumber(bus.primaryMinutes) && (
                      <Animated.Text
                        style={[
                          tw`text-[10px] leading-[14px] text-[#2373FF] bg-[#DBE8FF] px-[4px] py-[2px] rounded-[5px] mr-[6px]`,
                          {
                            fontFamily: 'Pretendard-Medium',
                            opacity: blinkAnim,
                          },
                        ]}
                      >
                        실시간
                      </Animated.Text>
                    )}
                  {bus.routeName !== '셔틀버스' && bus.type === 'timetable' && (
                    <Text
                      style={[
                        tw`text-[10px] leading-[14px] text-[#828386] bg-[#E6E7E9] px-[4px] py-[2px] rounded-[5px] mr-[6px]`,
                        { fontFamily: 'Pretendard-Medium' },
                      ]}
                    >
                      시간표 기준
                    </Text>
                  )}

                  <Text
                    style={[
                      tw`text-[16px] text-[#212326]`,
                      { fontFamily: 'Pretendard-Bold', lineHeight: 20 },
                    ]}
                  >
                    {primaryText}
                  </Text>
                </View>

                {secondaryText && (
                  <Text
                    style={[
                      tw`text-[14px] leading-[18px] text-[#BABBBd] mt-[6px]`,
                      { fontFamily: 'Pretendard-SemiBold', lineHeight: 18 },
                    ]}
                  >
                    {secondaryText}
                  </Text>
                )}
              </>
            ) : (
              <Text
                style={[
                  tw`text-[12px] text-[#BABBBd]`,
                  { fontFamily: 'Pretendard-Medium', lineHeight: 14 },
                ]}
              >
                운행 정보 없음
              </Text>
            )}
          </View>

          <icons.more width={14} height={14} style={tw`opacity-60 ml-[12px]`} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
