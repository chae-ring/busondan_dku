import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import tw from 'twrnc';
import { icons } from '../../utils/icons';
import { API_BASE } from '../../utils/helpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function NoticeScreen({ navigation }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotices = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setNotices(data.notifications || []);
    } catch (err) {
      setError('공지사항을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchNotices();
    }, []),
  );

  const formatDate = isoString => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-white`}>
      <View
        style={tw`flex-row items-center border-b border-[#E6E7E9] h-[58px] px-[20px]`}
      >
        <TouchableOpacity
          onPress={async () => {
            if (notices.length > 0) {
              const ids = notices.map(n => String(n.id));
              await AsyncStorage.setItem('prevNoticeIds', JSON.stringify(ids));
            }
            navigation.goBack();
          }}
        >
          <icons.back width={24} height={24} />
        </TouchableOpacity>

        <Text
          style={[
            tw`ml-[20px] text-[20px]  text-[#212326]`,
            { fontFamily: 'Pretendard-Bold', lineHeight: 24 },
          ]}
        >
          공지사항
        </Text>
      </View>

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={tw`px-[20px] pb-[40px] pt-[1px]`}
      >
        {loading ? (
          <View style={tw`h-[100px] flex justify-center items-center`}>
            <ActivityIndicator size="small" color="#2373FF" />
            <Text style={tw`text-[#BABBBd] text-[14px] mt-[8px]`}>
              불러오는 중...
            </Text>
          </View>
        ) : error ? (
          <View style={tw`h-[100px] flex justify-center items-center`}>
            <Text style={tw`text-[#BABBBd] text-[14px]`}>{error}</Text>
          </View>
        ) : notices.length === 0 ? (
          <View style={tw`h-[100px] flex justify-center items-center`}>
            <Text
              style={[
                tw`text-[#BABBBd] text-[14px]`,
                { fontFamily: 'Pretendard-Medium' },
              ]}
            >
              공지사항이 없습니다.
            </Text>
          </View>
        ) : (
          <View style={tw`flex flex-col`}>
            {notices.map((notice, idx) => (
              <TouchableOpacity
                key={notice.id || idx}
                onPress={() =>
                  notice.linkUrl ? Linking.openURL(notice.linkUrl) : null
                }
                activeOpacity={0.7}
                style={tw`py-[16px] border-b border-[#E6E7E9]`}
              >
                <Text
                  style={[
                    tw`text-[16px] text-[#212326]`,
                    { fontFamily: 'Pretendard-Medium', lineHeight: 20 },
                  ]}
                  numberOfLines={1}
                >
                  {notice.title}
                </Text>
                <Text
                  style={[
                    tw`text-[14px] text-[#babbbd] mt-[6px]`,
                    { fontFamily: 'Pretendard-Medium', lineHeight: 18 },
                  ]}
                >
                  {formatDate(notice.createdAt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
