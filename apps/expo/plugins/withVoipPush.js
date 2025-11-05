/**
 * Expo Config Plugin for VoIP Push Notifications
 *
 * This plugin modifies the iOS AppDelegate to:
 * 1. Import PushKit framework
 * 2. Register for VoIP push notifications
 * 3. Handle VoIP push token updates
 * 4. Handle incoming VoIP push notifications
 * 5. Report calls to CallKit immediately (iOS 13+ requirement)
 *
 * CRITICAL: This ensures native code survives EAS builds via config plugin system
 */

const { withAppDelegate, withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Add PushKit import to AppDelegate
 */
function addPushKitImport(content) {
  // Add PushKit import after UIKit
  if (!content.includes('#import <PushKit/PushKit.h>')) {
    const uiKitImportRegex = /#import <UIKit\/UIKit\.h>/;
    if (uiKitImportRegex.test(content)) {
      content = content.replace(
        uiKitImportRegex,
        `#import <UIKit/UIKit.h>\n#import <PushKit/PushKit.h>`
      );
    } else {
      // Fallback: add at the top after #import statements
      const firstImport = content.indexOf('#import');
      if (firstImport !== -1) {
        const endOfLine = content.indexOf('\n', firstImport);
        content =
          content.slice(0, endOfLine + 1) +
          '#import <PushKit/PushKit.h>\n' +
          content.slice(endOfLine + 1);
      }
    }
  }

  // Add PKPushRegistryDelegate to interface
  if (!content.includes('PKPushRegistryDelegate')) {
    content = content.replace(
      /@interface AppDelegate : EXAppDelegateWrapper <([^>]+)>/,
      '@interface AppDelegate : EXAppDelegateWrapper <$1, PKPushRegistryDelegate>'
    );
  }

  return content;
}

/**
 * Add VoIP push registration in didFinishLaunchingWithOptions
 */
function addVoipPushRegistration(content) {
  const registrationCode = `
  // Register for VoIP push notifications
  PKPushRegistry *pushRegistry = [[PKPushRegistry alloc] initWithQueue:dispatch_get_main_queue()];
  pushRegistry.delegate = self;
  pushRegistry.desiredPushTypes = [NSSet setWithObject:PKPushTypeVoIP];
`;

  // Find didFinishLaunchingWithOptions method
  const methodRegex = /-\s*\(BOOL\)application:\(UIApplication\s*\*\)application\s+didFinishLaunchingWithOptions:/;

  if (content.match(methodRegex) && !content.includes('PKPushRegistry')) {
    // Add after [super application:application didFinishLaunchingWithOptions:launchOptions]
    const superCallRegex = /\[super application:application didFinishLaunchingWithOptions:launchOptions\];/;

    if (superCallRegex.test(content)) {
      content = content.replace(
        superCallRegex,
        `[super application:application didFinishLaunchingWithOptions:launchOptions];\n${registrationCode}`
      );
    }
  }

  return content;
}

/**
 * Add PKPushRegistry delegate methods
 */
function addPushRegistryDelegates(content) {
  const delegateMethods = `

#pragma mark - PKPushRegistryDelegate

// Handle updated VoIP push credentials
- (void)pushRegistry:(PKPushRegistry *)registry
didUpdatePushCredentials:(PKPushCredentials *)credentials
             forType:(PKPushType)type {
  NSLog(@"[VoIP Push] Token updated");

  // Convert token to string
  const char *tokenBytes = (const char *)[credentials.token bytes];
  NSMutableString *hexString = [NSMutableString string];
  for (NSUInteger i = 0; i < [credentials.token length]; i++) {
    [hexString appendFormat:@"%02.2hhx", tokenBytes[i]];
  }

  NSLog(@"[VoIP Push] Token: %@", hexString);

  // Send token to React Native
  [[NSNotificationCenter defaultCenter] postNotificationName:@"voipPushTokenUpdated"
                                                      object:nil
                                                    userInfo:@{@"token": hexString}];
}

// Handle incoming VoIP push notification
- (void)pushRegistry:(PKPushRegistry *)registry
didReceiveIncomingPushWithPayload:(PKPushPayload *)payload
             forType:(PKPushType)type
withCompletionHandler:(void (^)(void))completion {
  NSLog(@"[VoIP Push] Received incoming push");
  NSLog(@"[VoIP Push] Payload: %@", payload.dictionaryPayload);

  // Extract call information from payload
  NSDictionary *data = payload.dictionaryPayload;
  NSString *callId = data[@"callId"] ?: @"unknown";
  NSString *callerName = data[@"fromName"] ?: @"Doorman";
  NSString *apartmentNumber = data[@"apartmentNumber"] ?: @"";

  NSLog(@"[VoIP Push] Call ID: %@, Caller: %@, Apt: %@", callId, callerName, apartmentNumber);

  // CRITICAL (iOS 13+): Report call to CallKit immediately
  // Failure to do so will terminate the app and stop future VoIP pushes
  [[NSNotificationCenter defaultCenter] postNotificationName:@"voipPushReceived"
                                                      object:nil
                                                    userInfo:data];

  // Complete the handler
  completion();
}

// Handle invalidated push credentials
- (void)pushRegistry:(PKPushRegistry *)registry
didInvalidatePushTokenForType:(PKPushType)type {
  NSLog(@"[VoIP Push] Token invalidated");

  [[NSNotificationCenter defaultCenter] postNotificationName:@"voipPushTokenInvalidated"
                                                      object:nil
                                                    userInfo:nil];
}
`;

  // Only add if not already present
  if (!content.includes('#pragma mark - PKPushRegistryDelegate')) {
    // Add before @end
    content = content.replace(/@end\s*$/, `${delegateMethods}\n\n@end`);
  }

  return content;
}

/**
 * Main plugin function
 */
const withVoipPush = (config) => {
  // Modify AppDelegate
  config = withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    // Add PushKit imports and delegate
    contents = addPushKitImport(contents);

    // Add VoIP push registration
    contents = addVoipPushRegistration(contents);

    // Add delegate methods
    contents = addPushRegistryDelegates(contents);

    config.modResults.contents = contents;
    return config;
  });

  // Add VoIP entitlement to entitlements plist
  config = withEntitlementsPlist(config, (config) => {
    if (!config.modResults['voip']) {
      config.modResults['voip'] = true;
    }
    return config;
  });

  return config;
};

module.exports = withVoipPush;
