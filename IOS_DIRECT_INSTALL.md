# 📱 iOS Direct Device Installation Guide

This guide explains how to install the caw caw iOS app directly on your device using Ad Hoc distribution, bypassing TestFlight entirely.

## 🚀 Quick Start

### 1. Register Your Device UDID

**Get your UDID:**
- Connect your iPhone to a Mac with Xcode installed
- Open **Xcode** → **Window** → **Devices and Simulators**
- Select your device and copy the **Identifier** (this is your UDID)

**Or use shortcuts:**
- Settings → General → About → scroll down and tap **"UDID"** to copy

**Add to Apple Developer Portal:**
1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/devices/list)
2. Click **"Register Device"**
3. Enter **Device Name** (e.g., "John's iPhone") and **UDID**
4. Click **Register**

### 2. Trigger Ad Hoc Build

1. Go to [GitHub Actions](https://github.com/dbirks/cawcaw/actions)
2. Click **"iOS Ad Hoc Distribution"**
3. Click **"Run workflow"**
4. Select **"adhoc"** environment
5. Click **"Run workflow"**

### 3. Download & Install

**After build completes (~5-10 minutes):**

1. **Download IPA:**
   - Go to the completed workflow run
   - Scroll to **"Artifacts"** section
   - Download **"ios-adhoc-build-[number]"**
   - Extract the ZIP to get `caw_caw.ipa`

2. **Install Options:**

   **Option A: Over-the-Air (Easiest)**
   - Upload `caw_caw.ipa` to [Diawi.com](https://diawi.com)
   - Share the generated link
   - Open link on your iPhone and tap **"Install"**

   **Option B: Direct Install**
   - Connect iPhone to Mac
   - Open **Finder** → select your **iPhone**
   - Drag `caw_caw.ipa` to the **"Files"** section
   - The app will install automatically

   **Option C: Xcode Install**
   - Connect iPhone to Mac with Xcode
   - Open **Xcode** → **Window** → **Devices and Simulators**
   - Select your device → click **"+"** → select `caw_caw.ipa`

## 📋 Requirements

- **iOS 14.0+** (your device)
- **Device UDID** must be registered in Apple Developer Portal
- **Up to 100 devices** can be registered for Ad Hoc distribution

## 🔧 Troubleshooting

### "Untrusted Developer" Error
1. Go to **Settings** → **General** → **VPN & Device Management**
2. Find **"David Birks"** under **Enterprise App**
3. Tap → **Trust "David Birks"** → **Trust**

### "Unable to Install" Error
- Check that your device UDID is registered in Apple Developer Portal
- Ensure iOS version is 14.0 or later
- Try the installation again after a few minutes

### Build Fails
- Check GitHub Actions logs for specific errors
- Try running with **"Force certificate creation"** enabled

## 🆚 Ad Hoc vs TestFlight

| Feature | Ad Hoc Distribution | TestFlight |
|---------|-------------------|------------|
| **Speed** | ⚡ Instant (5-10 min) | 🐌 4-6 hours processing |
| **Devices** | 📱 100 devices max | 📱 10,000 testers |
| **Review** | ✅ No Apple review | ❌ First build needs review |
| **Installation** | 💻 Manual/OTA install | 📲 TestFlight app |
| **Updates** | 🔄 Manual re-install | 🔄 Auto-update in app |

## 🔗 Useful Links

- [Apple Developer Portal](https://developer.apple.com/account/)
- [Diawi - OTA Installation](https://diawi.com)
- [InstallOnAir - Alternative OTA](https://installonair.com)
- [GitHub Actions Workflows](https://github.com/dbirks/cawcaw/actions)

---

**Note:** Ad Hoc distribution is perfect for internal testing and development. For public beta testing, use the existing TestFlight workflow instead.