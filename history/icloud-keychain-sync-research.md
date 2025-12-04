# iCloud Keychain Sync Research for API Key Storage

**Date:** 2025-01-04
**Issue:** cawcaw-8j9
**Objective:** Research how to enable iCloud Keychain sync for OpenAI and Anthropic API keys in the caw caw iOS app

## Executive Summary

There are **two viable approaches** to enable API key sync across iOS devices:

1. **Replace current plugin** with `@aparajita/capacitor-secure-storage` (recommended)
2. **Native iOS implementation** using Swift with `kSecAttrSynchronizable`

The **recommended approach is Option 1** (plugin replacement) due to:
- Capacitor 7 compatibility
- Minimal code changes required
- Battle-tested implementation
- Active maintenance

## Current Implementation

**Plugin:** `capacitor-secure-storage-plugin` v0.12.0
**Features:** Local-only secure storage (no iCloud sync)
**Storage Keys:**
- `openai_api_key`
- `anthropic_api_key`
- `selected_provider`
- `selected_model`
- `stt_model`
- `title_model`
- `theme_preference`
- `mcp_server_configs` (and various OAuth tokens)

**Usage Pattern:**
```typescript
// Current implementation
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

await SecureStoragePlugin.set({ key: 'openai_api_key', value: apiKey });
const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
await SecureStoragePlugin.remove({ key: 'openai_api_key' });
```

**Files using SecureStoragePlugin:**
- `src/components/ChatView.tsx` (API keys, provider, model, STT model)
- `src/components/Settings.tsx` (API key management, title model, STT model)
- `src/services/mcpManager.ts` (MCP server configs)
- `src/services/mcpOAuth.ts` (OAuth tokens, state, verifiers)
- `src/services/mcpOAuthCompliant.ts` (OAuth tokens, discovery, client info)
- `src/services/conversationStorage.ts` (Title generation with API keys)
- `src/hooks/useTheme.ts` (Theme preference)

## Option 1: @aparajita/capacitor-secure-storage Plugin (RECOMMENDED)

### Overview
Active, maintained plugin with built-in iCloud Keychain sync support.

### Key Features
- **iCloud Sync:** Global and per-operation control
- **Capacitor 7:** Fully compatible
- **API Compatibility:** Similar to current plugin
- **Cross-Platform:** iOS Keychain + Android Keystore

### API Comparison

**Current Plugin:**
```typescript
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

await SecureStoragePlugin.set({ key: 'openai_api_key', value: apiKey });
const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
```

**@aparajita Plugin:**
```typescript
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

// Enable iCloud sync globally (one-time setup)
await SecureStorage.setSynchronize(true);

// Regular operations (will sync to iCloud)
await SecureStorage.set('openai_api_key', apiKey);
const value = await SecureStorage.get('openai_api_key');

// Or control sync per-operation
await SecureStorage.set('openai_api_key', apiKey, { sync: true });
await SecureStorage.set('local_only_key', value, { sync: false });
```

### Installation

```bash
npm uninstall capacitor-secure-storage-plugin
npm install @aparajita/capacitor-secure-storage
npx cap sync ios
```

### Migration Strategy

1. **Create migration utility** (`src/utils/secureStorageMigration.ts`):
   ```typescript
   import { SecureStoragePlugin as OldPlugin } from 'capacitor-secure-storage-plugin';
   import { SecureStorage as NewPlugin } from '@aparajita/capacitor-secure-storage';

   const KEYS_TO_MIGRATE = [
     'openai_api_key',
     'anthropic_api_key',
     'selected_provider',
     'selected_model',
     'stt_model',
     'title_model',
     'theme_preference',
     'mcp_server_configs',
   ];

   export async function migrateToNewSecureStorage() {
     for (const key of KEYS_TO_MIGRATE) {
       try {
         const result = await OldPlugin.get({ key });
         if (result?.value) {
           await NewPlugin.set(key, result.value);
         }
       } catch (error) {
         console.warn(`Migration failed for key: ${key}`, error);
       }
     }
   }
   ```

2. **Update imports** in all 7 files:
   ```typescript
   // Old
   import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

   // New
   import { SecureStorage } from '@aparajita/capacitor-secure-storage';
   ```

3. **Update API calls**:
   ```typescript
   // Old: await SecureStoragePlugin.set({ key: 'openai_api_key', value: apiKey });
   // New: await SecureStorage.set('openai_api_key', apiKey);

   // Old: const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
   // New: const value = await SecureStorage.get('openai_api_key');

   // Old: await SecureStoragePlugin.remove({ key: 'openai_api_key' });
   // New: await SecureStorage.remove('openai_api_key');
   ```

4. **Enable iCloud sync** during app initialization:
   ```typescript
   // In ChatView.tsx useEffect initialization
   await SecureStorage.setSynchronize(true);
   ```

5. **Test migration** on development device before release

### iCloud Keychain Behavior

**Important Details:**
- iOS treats local and iCloud keychains as **separate storage**
- Same key can exist in **both** keychains with different values
- `keys()` method returns keys from **both** keychains when sync is enabled (may have duplicates)
- User **must enable iCloud Keychain** on their device for sync to work
- Sync happens automatically in the background when enabled

### Pros
✅ Drop-in replacement with minimal code changes
✅ Actively maintained (compatible with Capacitor 7)
✅ Battle-tested implementation
✅ Global and per-operation sync control
✅ Handles keychain complexity automatically
✅ Cross-platform (Android Keystore support)

### Cons
❌ Adds external dependency (though well-maintained)
❌ User must manually enable iCloud Keychain
❌ Potential key duplication in `keys()` results
❌ Two separate keychains can cause confusion during debugging

### Estimated Migration Effort
- **Code Changes:** 2-3 hours (7 files to update)
- **Testing:** 2-3 hours (migration, sync verification)
- **Total:** ~1 day

## Option 2: Native iOS Implementation

### Overview
Write custom Capacitor plugin using Swift and iOS Keychain APIs directly.

### Implementation Approach

1. **Create Capacitor Plugin** (`ios/App/SecureStorageSync/SecureStorageSync.swift`):
   ```swift
   import Capacitor
   import Security

   @objc(SecureStorageSync)
   public class SecureStorageSync: CAPPlugin {
     @objc func set(_ call: CAPPluginCall) {
       guard let key = call.getString("key"),
             let value = call.getString("value") else {
         call.reject("Missing key or value")
         return
       }

       let sync = call.getBool("sync") ?? true

       let query: [String: Any] = [
         kSecClass as String: kSecClassGenericPassword,
         kSecAttrAccount as String: key,
         kSecValueData as String: value.data(using: .utf8)!,
         kSecAttrSynchronizable as String: sync ? kCFBooleanTrue! : kCFBooleanFalse!
       ]

       SecItemDelete(query as CFDictionary)
       let status = SecItemAdd(query as CFDictionary, nil)

       if status == errSecSuccess {
         call.resolve()
       } else {
         call.reject("Failed to store value")
       }
     }

     @objc func get(_ call: CAPPluginCall) {
       guard let key = call.getString("key") else {
         call.reject("Missing key")
         return
       }

       let query: [String: Any] = [
         kSecClass as String: kSecClassGenericPassword,
         kSecAttrAccount as String: key,
         kSecMatchLimit as String: kSecMatchLimitOne,
         kSecReturnData as String: true
       ]

       var result: AnyObject?
       let status = SecItemCopyMatching(query as CFDictionary, &result)

       if status == errSecSuccess,
          let data = result as? Data,
          let value = String(data: data, encoding: .utf8) {
         call.resolve(["value": value])
       } else {
         call.reject("Key not found")
       }
     }
   }
   ```

2. **Register Plugin** in Capacitor
3. **Create TypeScript wrapper** for type safety
4. **Replace all SecureStoragePlugin calls** with native implementation

### Pros
✅ Complete control over implementation
✅ No external dependencies
✅ Custom sync logic possible
✅ Can optimize for specific use case

### Cons
❌ Requires Swift/iOS development expertise
❌ Must maintain native code across iOS updates
❌ More complex testing required
❌ Higher maintenance burden
❌ Longer development time
❌ No Android support (would need separate implementation)

### Estimated Implementation Effort
- **Swift Plugin Development:** 1-2 days
- **TypeScript Wrapper:** 4-6 hours
- **Code Migration:** 4-6 hours
- **Testing:** 2-3 days
- **Total:** ~1 week

## Security Considerations

### Apple's iCloud Keychain Security

**Encryption:**
- End-to-end encryption with AES-256-GCM
- Apple **cannot** decrypt synced keychain items
- Two-tier encryption: table key (metadata) + per-row key (secret values)

**Best Practices for API Key Storage:**

1. **Use appropriate accessibility class:**
   - `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` → No iCloud sync, highest security
   - `kSecAttrAccessibleWhenUnlocked` → Syncs to iCloud, still secure (recommended for API keys)
   - `kSecAttrAccessibleAfterFirstUnlock` → For background services

2. **Security recommendations:**
   - ✅ Store API keys in Keychain (never in UserDefaults or plain files)
   - ✅ Use iCloud sync for user convenience across devices
   - ✅ Rely on iOS encryption (AES-256, end-to-end)
   - ✅ Require device passcode for maximum security
   - ❌ Don't implement custom encryption (iOS handles this)
   - ❌ Don't store keys in app bundle or code

3. **User requirements:**
   - iCloud Keychain must be enabled on user's device
   - Device must be signed in to iCloud account
   - Recommended: Device passcode/Touch ID/Face ID enabled

### API Key Sync Risk Assessment

**Risk Level:** LOW-MEDIUM
**Justification:**
- User-provided API keys (user owns the security responsibility)
- End-to-end encryption by Apple (even Apple can't decrypt)
- Sync provides **significant UX benefit** (seamless multi-device usage)
- Standard practice for password managers and other security apps

**Mitigations:**
- Clear documentation that API keys will sync via iCloud
- Optional: Add UI toggle to disable sync (store local-only)
- Educate users about iCloud Keychain requirements

## Recommendations

### Immediate Action (Priority 1)
1. **Migrate to @aparajita/capacitor-secure-storage**
   - Lowest risk, fastest implementation
   - Battle-tested, actively maintained
   - Minimal code changes required

### Implementation Plan

**Phase 1: Migration (1 day)**
1. Install @aparajita/capacitor-secure-storage
2. Create migration utility
3. Update all imports (7 files)
4. Update API calls throughout codebase
5. Test on development device

**Phase 2: Enable Sync (2 hours)**
1. Add `setSynchronize(true)` to initialization
2. Test sync between two devices (iPhone + iPad)
3. Verify API key persistence and sync

**Phase 3: Documentation (1 hour)**
1. Add "API keys sync via iCloud" notice to Settings UI
2. Update README with iCloud Keychain requirements
3. Document migration process for existing users

**Phase 4: Release (standard process)**
1. TestFlight beta testing
2. Monitor for sync-related issues
3. Production release

### Long-Term Considerations

**Future Enhancements:**
- UI toggle to disable sync (local-only storage option)
- Sync status indicator in Settings
- Manual sync trigger for debugging
- Migration wizard for existing users

**Monitoring:**
- Track iCloud Keychain availability in debug logs
- User feedback on sync reliability
- Support for users without iCloud access

## Conclusion

**Recommended Approach:** Option 1 (@aparajita/capacitor-secure-storage)

**Rationale:**
- Fastest time to implementation (~1 day vs ~1 week)
- Lowest risk (proven, maintained solution)
- Minimal code changes (API mostly compatible)
- Comprehensive iCloud sync support built-in
- Active maintenance for Capacitor 7+

**Next Steps:**
1. Create new issue for implementation (or update cawcaw-8j9 to "in_progress")
2. Install @aparajita/capacitor-secure-storage
3. Implement migration utility
4. Update all SecureStoragePlugin usages
5. Test sync between devices
6. Document iCloud requirements for users

---

## References

- [@aparajita/capacitor-secure-storage GitHub](https://github.com/aparajita/capacitor-secure-storage)
- [Apple Keychain Security Overview](https://support.apple.com/guide/security/icloud-keychain-security-overview-sec1c89c6f3b/web)
- [Apple kSecAttrSynchronizable Documentation](https://developer.apple.com/documentation/security/ksecattrsynchronizable)
- [Capacitor Secure Storage Comparison](https://capgo.app/blog/capacitor-plugins-for-secure-session-management/)
