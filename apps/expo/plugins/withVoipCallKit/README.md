# VoIP CallKit Plugin

Unified Expo config plugin for VoIP push notifications and CallKit integration on iOS.

## Structure

```
withVoipCallKit/
├── ios/
│   ├── VoipCallKitHandler.h    # Header file with all function declarations
│   └── VoipCallKitHandler.mm   # Implementation file with all logic
├── index.js                     # Main plugin file
└── README.md                   # This file
```

## How It Works

1. **Native Files**: All Objective-C implementation is stored in proper `.h` and `.mm` files - **no code in JavaScript strings!**

2. **File Copying**: During `expo prebuild`, the plugin copies the native files to `ios/VoipCallKitHandler/` in the generated iOS project.

3. **AppDelegate Integration**: The plugin modifies `AppDelegate.mm` to:
   - Import `VoipCallKitHandler.h` header
   - Register for VoIP push notifications in `didFinishLaunchingWithOptions`
   - Add minimal delegate methods that **only call** Objective-C functions (no logic in strings)

## Responsibilities

This unified plugin handles:
- ✅ VoIP push registration
- ✅ Token update handling
- ✅ Token invalidation handling
- ✅ Incoming VoIP push handling
- ✅ CallKit integration (iOS 13+ requirement)

## Benefits

- ✅ **Zero Objective-C code in JavaScript strings** - all logic in proper `.mm` files
- ✅ Proper Objective-C syntax highlighting and autocomplete
- ✅ Easier to maintain and review native code
- ✅ Type safety and compile-time checks
- ✅ Can be edited directly in Xcode if needed
- ✅ Minimal string injection (only thin wrapper methods that call functions)

## Files

- **VoipCallKitHandler.h**: Function declarations for all VoIP and CallKit operations
- **VoipCallKitHandler.mm**: Full implementation of all VoIP push and CallKit logic
- **index.js**: Expo config plugin that orchestrates file copying and AppDelegate modification

## Migration from Separate Plugins

This plugin replaces:
- `withVoipPush` - VoIP push registration and token handling
- `withCallKitAppDelegate` - CallKit integration for incoming calls

Both functionalities are now unified in a single, cleaner plugin.

