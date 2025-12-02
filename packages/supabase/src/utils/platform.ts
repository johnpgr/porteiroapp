export type PlatformType = 'ios' | 'android' | 'web' | 'server' | 'unknown';

export interface PlatformDetector {
  getPlatform(): PlatformType;
  isIOS(): boolean;
  isAndroid(): boolean;
  isWeb(): boolean;
  isServer(): boolean;
  isMobile(): boolean;
}

/**
 * Platform detector for React Native environments
 */
export class ReactNativePlatformDetector implements PlatformDetector {
  private platform: PlatformType;

  constructor(platformOS: string) {
    this.platform = this.mapPlatform(platformOS);
  }

  private mapPlatform(platformOS: string): PlatformType {
    switch (platformOS.toLowerCase()) {
      case 'ios':
        return 'ios';
      case 'android':
        return 'android';
      case 'web':
        return 'web';
      default:
        return 'unknown';
    }
  }

  getPlatform(): PlatformType {
    return this.platform;
  }

  isIOS(): boolean {
    return this.platform === 'ios';
  }

  isAndroid(): boolean {
    return this.platform === 'android';
  }

  isWeb(): boolean {
    return this.platform === 'web';
  }

  isServer(): boolean {
    return false;
  }

  isMobile(): boolean {
    return this.platform === 'ios' || this.platform === 'android';
  }
}

/**
 * Platform detector for browser environments
 */
export class BrowserPlatformDetector implements PlatformDetector {
  private platform: PlatformType;

  constructor() {
    this.platform = this.detectPlatform();
  }

  private detectPlatform(): PlatformType {
    //@ts-ignore
    if (typeof window === 'undefined') {
      return 'server';
    }

    //@ts-ignore
    const userAgent = window.navigator.userAgent;

    if (/iPad|iPhone|iPod/.test(userAgent)) {
      return 'ios';
    }

    if (/Android/.test(userAgent)) {
      return 'android';
    }

    return 'web';
  }

  getPlatform(): PlatformType {
    return this.platform;
  }

  isIOS(): boolean {
    return this.platform === 'ios';
  }

  isAndroid(): boolean {
    return this.platform === 'android';
  }

  isWeb(): boolean {
    return this.platform === 'web';
  }

  isServer(): boolean {
    return this.platform === 'server';
  }

  isMobile(): boolean {
    return this.platform === 'ios' || this.platform === 'android';
  }
}

/**
 * Platform detector for server environments
 */
export class ServerPlatformDetector implements PlatformDetector {
  getPlatform(): PlatformType {
    return 'server';
  }

  isIOS(): boolean {
    return false;
  }

  isAndroid(): boolean {
    return false;
  }

  isWeb(): boolean {
    return false;
  }

  isServer(): boolean {
    return true;
  }

  isMobile(): boolean {
    return false;
  }
}
