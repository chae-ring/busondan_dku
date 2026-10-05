import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import tw from 'twrnc';

export default function LoadingSpinner({
  message = '버스 정보를 불러오는 중...',
}) {
  return (
    <View style={tw`flex-1 justify-center items-center bg-gray-100`}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={tw`ml-4 text-gray-600 mt-3`}>{message}</Text>
    </View>
  );
}
