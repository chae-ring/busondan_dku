import React from 'react';
import { Text, Platform, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { icons } from '../utils/icons';

import BusListScreen from '../screens/Bus/BusListScreen';
import BusDetailScreen from '../screens/Bus/BusDetailScreen';
import SubwayListScreen from '../screens/Subway/SubwayListScreen';
import SubwayDetailScreen from '../screens/Subway/SubwayDetailScreen';
import NoticeScreen from '../screens/Notice/NoticeScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function BusStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BusList" component={BusListScreen} />
      <Stack.Screen name="BusDetail" component={BusDetailScreen} />
      <Stack.Screen name="Notice" component={NoticeScreen} />
    </Stack.Navigator>
  );
}

function SubwayStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SubwayList" component={SubwayListScreen} />
      <Stack.Screen name="SubwayDetail" component={SubwayDetailScreen} />
      <Stack.Screen name="Notice" component={NoticeScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F6F7F9' }}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, size }) => {
              let IconComponent;
              if (route.name === 'Bus') {
                IconComponent = focused ? icons.bus_active : icons.bus_default;
              } else if (route.name === 'Subway') {
                IconComponent = focused
                  ? icons.subway_active
                  : icons.subway_default;
              }
              return <IconComponent width={size} height={size} />;
            },
            tabBarLabel: ({ focused }) => (
              <Text
                style={[
                  tw.style(
                    'text-[12px] leading-[14px]',
                    focused ? 'text-[#2373FF]' : 'text-[#BABBBD]',
                  ),
                  { fontFamily: 'Pretendard-SemiBold' },
                ]}
              >
                {route.name === 'Bus' ? '버스' : '지하철'}
              </Text>
            ),
            tabBarStyle: {
              height: 90,
              paddingTop: 10,
              paddingBottom: Platform.OS === 'ios' ? 20 : 36,
              borderTopWidth: 1,
              borderTopColor: '#E6E7E9',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: -2 },
              elevation: 10,
            },
          })}
        >
          <Tab.Screen name="Bus" component={BusStack} />
          <Tab.Screen name="Subway" component={SubwayStack} />
        </Tab.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  );
}
