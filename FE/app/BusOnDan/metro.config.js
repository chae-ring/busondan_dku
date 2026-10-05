const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const {
  resolver: { sourceExts, assetExts },
} = defaultConfig;

/**
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    // SVG 트랜스포머를 Babel 트랜스포머 경로로 지정
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    // assetExts에서 'svg'를 제거 (이미지 에셋으로 취급 방지)
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    // sourceExts에 'svg'를 추가 (소스 코드로 취급)
    sourceExts: [...sourceExts, 'svg'],
  },
};

// 기존 설정과 새 설정을 병합하여 내보냅니다.
module.exports = mergeConfig(defaultConfig, config);
