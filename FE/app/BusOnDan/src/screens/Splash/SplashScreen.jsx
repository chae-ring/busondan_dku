import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions } from 'react-native';
import { icons } from '../../utils/icons';

const { width } = Dimensions.get('window');

export default function SplashScreen({
  startFetch,
  minDuration = 1500,
  onFinish,
}) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);

  useEffect(() => {
    const start = Date.now();

    const run = async () => {
      try {
        await startFetch?.();
      } catch (e) {
      } finally {
        const elapsed = Date.now() - start;
        const remain = Math.max(0, minDuration - elapsed);

        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }).start(() => {
            if (!finishedRef.current) {
              finishedRef.current = true;
              onFinish?.();
            }
          });
        }, remain);
      }
    };

    run();
  }, []);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: '#2373FF',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeAnim,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      <icons.busondan_white width={width * 0.45} height={width * 0.18} />
    </Animated.View>
  );
}
