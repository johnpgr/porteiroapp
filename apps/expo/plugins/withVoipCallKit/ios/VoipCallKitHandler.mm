//
// VoipCallKitHandler.mm
// Expo Config Plugin - Unified VoIP Push & CallKit Integration
//
// Implementation for VoIP push notifications and CallKit integration
//
// This file is completely self-contained - no code injection needed!
// The +load method runs automatically when the class is loaded by the runtime.
//

#import "VoipCallKitHandler.h"
#import <RNCallKeep/RNCallKeep.h>
#import <PushKit/PushKit.h>

// Helper class that implements PKPushRegistryDelegate
@interface VoipCallKitDelegate : NSObject <PKPushRegistryDelegate>
@property (nonatomic, strong) PKPushRegistry *pushRegistry;
@end

@implementation VoipCallKitDelegate

- (instancetype)init {
  self = [super init];
  if (self) {
    _pushRegistry = [[PKPushRegistry alloc] initWithQueue:dispatch_get_main_queue()];
    _pushRegistry.delegate = self;
    _pushRegistry.desiredPushTypes = [NSSet setWithObject:PKPushTypeVoIP];
    NSLog(@"[VoIP CallKit] Registered for VoIP push notifications");
  }
  return self;
}

#pragma mark - PKPushRegistryDelegate

- (void)pushRegistry:(PKPushRegistry *)registry
didUpdatePushCredentials:(PKPushCredentials *)credentials
             forType:(PKPushType)type {
  NSLog(@"[VoIP CallKit] Token updated");

  if (!credentials || !credentials.token) {
    NSLog(@"[VoIP CallKit] Error: Invalid credentials");
    return;
  }

  // Convert token to hex string
  const char *tokenBytes = (const char *)[credentials.token bytes];
  NSMutableString *hexString = [NSMutableString string];
  for (NSUInteger i = 0; i < [credentials.token length]; i++) {
    [hexString appendFormat:@"%02.2hhx", tokenBytes[i]];
  }

  NSLog(@"[VoIP CallKit] Token: %@", hexString);

  // Send token to React Native
  [[NSNotificationCenter defaultCenter] postNotificationName:@"voipPushTokenUpdated"
                                                      object:nil
                                                    userInfo:@{@"token": hexString}];
}

- (void)pushRegistry:(PKPushRegistry *)registry
didReceiveIncomingPushWithPayload:(PKPushPayload *)payload
             forType:(PKPushType)type
withCompletionHandler:(void (^)(void))completion {
  NSLog(@"[VoIP CallKit] Received incoming VoIP push");
  NSLog(@"[VoIP CallKit] Payload: %@", payload.dictionaryPayload);

  // Extract call information from payload
  NSDictionary *data = payload.dictionaryPayload;
  NSString *callId = data[@"callId"] ?: data[@"call_id"] ?: @"unknown";
  NSString *callerName = data[@"callerName"] ?: data[@"fromName"] ?: data[@"from_name"] ?: @"Porteiro";
  NSString *channelName = data[@"channelName"] ?: data[@"channel_name"] ?: data[@"channel"] ?: [NSString stringWithFormat:@"call-%@", callId];
  NSString *from = data[@"from"] ?: @"";
  NSString *apartmentNumber = data[@"apartmentNumber"] ?: data[@"apartment_number"] ?: @"";

  NSLog(@"[VoIP CallKit] Call ID: %@, Caller: %@, Channel: %@", callId, callerName, channelName);

  // CRITICAL iOS 13+ requirement: Report call to CallKit IMMEDIATELY
  // Failure to do so within the completion handler will terminate the app
  // and stop future VoIP pushes
  
  // Create callKeepPayload with all call data for JS bridge
  NSDictionary *callKeepPayload = @{
    @"callId": callId,
    @"callerName": callerName,
    @"channelName": channelName,
    @"from": from,
    @"apartmentNumber": apartmentNumber,
  };

  // Use callId as UUID directly (must be valid UUID format)
  NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:callId];
  if (!uuid) {
    // If callId is not a valid UUID, generate one and store mapping
    uuid = [NSUUID UUID];
    NSLog(@"[VoIP CallKit] Warning: callId '%@' is not a valid UUID, generated: %@", callId, [uuid UUIDString]);
  }

  // Report new incoming call to CallKit
  // This must be called synchronously within the completion handler
  [RNCallKeep reportNewIncomingCall:[uuid UUIDString]
                              handle:from
                          handleType:@"generic"
                            hasVideo:NO
                              payload:callKeepPayload
                          completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"[VoIP CallKit] ❌ Failed to report call to CallKit: %@", error.localizedDescription);
    } else {
      NSLog(@"[VoIP CallKit] ✅ Call reported to CallKit successfully");
    }
  }];

  // Notify React Native about the push (for JS handling)
  [[NSNotificationCenter defaultCenter] postNotificationName:@"voipPushReceived"
                                                      object:nil
                                                    userInfo:callKeepPayload];

  // CRITICAL: Call completion handler to satisfy iOS
  completion();
}

- (void)pushRegistry:(PKPushRegistry *)registry
didInvalidatePushTokenForType:(PKPushType)type {
  NSLog(@"[VoIP CallKit] Token invalidated");

  [[NSNotificationCenter defaultCenter] postNotificationName:@"voipPushTokenInvalidated"
                                                      object:nil
                                                    userInfo:nil];
}

@end

// Global instance to keep the delegate alive
static VoipCallKitDelegate *_voipCallKitDelegate = nil;

// +load method runs automatically when this class is loaded by the Objective-C runtime
// This happens before main() runs, so VoIP push is set up automatically
+ (void)load {
  @autoreleasepool {
    if (_voipCallKitDelegate == nil) {
      _voipCallKitDelegate = [[VoipCallKitDelegate alloc] init];
      // Keep a strong reference to prevent deallocation
      // The delegate will be retained for the app lifetime
      NSLog(@"[VoIP CallKit] ✅ Auto-initialized via +load method");
    }
  }
}

// Legacy function for backwards compatibility (not needed if using +load)
void setupVoipCallKit(void) {
  if (_voipCallKitDelegate == nil) {
    _voipCallKitDelegate = [[VoipCallKitDelegate alloc] init];
  }
}
