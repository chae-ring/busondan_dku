import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';

export default function ErrorMessage({ message, onRetry }) {
  return (
    <View style={tw`flex-1 justify-center items-center`}>
      <Text style={tw`text-[16px] text-red-500 mb-[16px]`}>{message}</Text>
      <TouchableOpacity
        onPress={onRetry}
        style={tw`bg-[#2373FF] px-[16px] py-[10px] rounded-[8px]`}
      >
        <Text style={tw`text-white font-semibold text-[14px]`}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );
}
