import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  const agoraPath =
    'ios/Pods/AgoraRtm_iOS/AgoraRtmKit.xcframework/ios-arm64_armv7/AgoraRtmKit.framework/AgoraRtmKit';

  if (fs.existsSync(agoraPath)) {
    execSync(`xcrun -sdk iphoneos bitcode_strip -r ${agoraPath} -o ${agoraPath}`, {
      stdio: 'inherit',
    });
    console.log('✅ Bitcode stripped from AgoraRtmKit');
  } else {
    console.log('⚠️  AgoraRtmKit not found at expected path, skipping bitcode strip');
  }
} catch (error) {
  console.error('❌ Failed to strip bitcode:', error.message);
}
