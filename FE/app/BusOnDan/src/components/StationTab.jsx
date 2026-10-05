import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import tw from 'twrnc';

export default function StationTab({ name, activeTab, setActiveTab }) {
  const isActive = activeTab === name;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setActiveTab(name)}
      style={[
        tw.style(
          `px-4 h-[34px] rounded-[17px] border items-center justify-center`,
          isActive ? `bg-white border-[#2373FF]` : `bg-white border-[#E6E7E9]`,
        ),
        isActive && {
          shadowColor: '#2373FF',
          shadowOpacity: 0.3,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 4,
          elevation: 2,
        },
      ]}
    >
      <Text
        style={[
          tw`text-[14px]`,
          {
            fontFamily: isActive ? 'Pretendard-Bold' : 'Pretendard-Medium',
            color: isActive ? '#2373FF' : '#BABBBd',
            lineHeight: 18,
          },
        ]}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}
