# Cross-Platform AI Chat App Setup Guide

This guide walks through setting up a **React + Capacitor** mobile app from scratch – including project initialization, UI setup (Tailwind CSS + Radix via ShadCN/UI), integrating Vercel’s AI SDK for a chat interface, secure storage of API keys, and configuring GitHub Actions for building and deploying to iOS TestFlight (and Android). The instructions assume use of **pnpm** as the package manager and TypeScript for the project.

## Tech Stack Overview

* **React + Capacitor:** Use React for building UI and Capacitor for packaging the web app into native iOS/Android apps[[1]](https://capacitorjs.com/solution/react#:~:text=Install%20Capacitor). Capacitor provides a bridge to device APIs and handles deploying the web code to mobile platforms.
* **TypeScript:** Ensure type safety and better developer experience in the React codebase.
* **pnpm:** Fast, disk-efficient package manager (assumed installed). All commands below use pnpm.
* **Tailwind CSS:** Utility-first CSS framework for styling[[2]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,Auth.js)[[3]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,UI%20for%20accessibility%20and%20flexibility).
* **Radix UI + ShadCN/UI:** Radix provides accessible headless UI components, and ShadCN/UI offers pre-built styled components (using Tailwind + Radix) to speed up UI development[[2]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,Auth.js)[[3]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,UI%20for%20accessibility%20and%20flexibility).
* **Vercel AI SDK:** A toolkit for integrating AI, providing React hooks like useChat to manage message history and stream AI responses[[4]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,UI%20for%20accessibility%20and%20flexibility).
* **GitHub Actions CI:** Automate building the app (and optionally deploying) for iOS/Android. We will set up workflows to build an iOS .ipa for TestFlight distribution (and notes for Android build).

**Prerequisites:** Node.js (latest LTS), pnpm installed, and a Mac machine or access to MacOS for iOS builds (Xcode command-line tools for local iOS build or use a Mac CI runner). An Apple Developer account is needed for TestFlight distribution and an Android Developer account for Play Store (if targeting Android release).

## 1. Initialize the Project

### 1.1 Create the React App

First, scaffold a new React application. We’ll use Vite (which is fast and supports React + TypeScript out of the box):

1. **Run Vite’s create command** – specify a React + TypeScript template:

pnpm create vite@latest my-chat-app -- --template react-ts

This will create a new directory my-chat-app with a basic React+TS project (using Vite’s build system).

1. **Navigate into the project folder:**

cd my-chat-app

1. **Install dependencies:** Vite may have initialized with npm/yarn; let’s ensure we use pnpm to install:

pnpm install

1. **Verify the dev server runs:**

pnpm run dev

Open http://localhost:5173 (or the port shown) to confirm the base React app works.

### 1.2 Add Tailwind CSS

Next, set up Tailwind for styling. We will use Tailwind’s Vite plugin for integration:

1. **Install Tailwind CSS and its Vite plugin:**

pnpm add -D tailwindcss @tailwindcss/vite postcss autoprefixer

This installs Tailwind, the Vite plugin, plus PostCSS and Autoprefixer (which Tailwind needs). (If a tailwind.config.js and postcss.config.js were not created automatically, you can initialize them with pnpx tailwindcss init -p.)

1. **Configure Tailwind:** In tailwind.config.js, set the content paths to include your source files and ShadCN components. For example:

/\*\* @type {import('tailwindcss').Config} \*/
export default {
 content: [
 "./index.html",
 "./src/\*\*/\*.{js,ts,jsx,tsx}",
 "./node\_modules/@shadcn/ui/components/\*\*/\*.{js,ts,jsx,tsx}",
 "./node\_modules/@shadcn/ui/\*\*/!(\*.stories).{js,ts,jsx,tsx}"
 ],
 theme: {
 extend: {},
 },
 plugins: [],
};

This ensures Tailwind scans your app code and the ShadCN UI components for class names.

1. **Import Tailwind in CSS:** Open the main CSS file (e.g. src/index.css or src/global.css depending on template). Replace its content with Tailwind’s base imports:

@tailwind base;
@tailwind components;
@tailwind utilities;

If using the Tailwind Vite plugin, you can also use a single @import "tailwindcss"; as suggested in ShadCN docs[[5]](https://ui.shadcn.com/docs/installation/vite#:~:text=Replace%20everything%20in%20,the%20following). Make sure this CSS file is imported in your app (Vite’s template typically imports index.css in main.tsx).

1. **Integrate Tailwind plugin with Vite:** In vite.config.ts, import the plugin and add it to the Vite config:

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
 plugins: [react(), tailwindcss()],
 // ... (any other config, e.g. define aliases if needed)
});

This enables Tailwind processing in the build[[6]](https://ui.shadcn.com/docs/installation/vite#:~:text=Copy%20import%20path%20from%20,vite).

1. **Test styling:** Restart the dev server (pnpm run dev) and add a test Tailwind class in App.tsx (for example, a <h1 className="text-3xl font-bold underline">Hello World</h1>). Verify that Tailwind styles are applied.

### 1.3 Set Up ShadCN/UI (Radix Components)

ShadCN/UI will provide pre-styled Radix UI components using Tailwind. We’ll use the ShadCN CLI to initialize and add components:

1. **Run the ShadCN init command:**

pnpm dlx shadcn@latest init

This will install any required dependencies and create a components.json config for ShadCN[[7]](https://ui.shadcn.com/docs/cli#:~:text=init)[[8]](https://ui.shadcn.com/docs/cli#:~:text=pnpm%20dlx%20shadcn%40latest%20init). You might be prompted to choose a color mode or other options – follow the prompts (e.g. base color “neutral” or similar). The init process also adds a utility for merging classes (commonly cn in lib/utils.ts) and configures CSS variables for themes[[9]](https://ui.shadcn.com/docs/cli#:~:text=The%20,CSS%20variables%20for%20the%20project).

1. **Add the needed UI components:** Use ShadCN’s CLI to add Radix components that we’ll need for the chat app. At minimum, consider adding:
2. Button (for any clickable actions)
3. Input and/or Textarea (for the message input field)
4. ScrollArea (for a scrollable chat messages list)
5. Card (or another container, to style chat message bubbles if desired)
6. Avatar (for user/assistant profile icons next to messages, optional)
7. Tooltip or Dialog (optional, if you want modals or tooltips)

You can add multiple components in one command. For example:

pnpm dlx shadcn@latest add button input textarea scroll-area card avatar

The CLI will generate the component files under the components/ directory (and possibly some in lib/ or hooks/ if needed) and install any additional dependencies for those components[[10]](https://ui.shadcn.com/docs/cli#:~:text=Use%20the%20,and%20dependencies%20to%20your%20project)[[11]](https://ui.shadcn.com/docs/cli#:~:text=Arguments%3A%20components%20%20%20,or%20local%20path%20to%20component). Each component comes pre-styled with Tailwind classes and implements Radix primitives internally.

1. **Verify ShadCN components:** Check the generated files in the components folder. You should see files like Button.tsx, Input.tsx, etc., with Tailwind classes. The globals.css (or similar) provided by ShadCN may have added CSS variables for theme colors. Ensure that file is imported in your app (ShadCN may configure it automatically, e.g. in \_app.tsx for Next.js or via the index.css for Vite).
2. **Try using a component:** In your App.tsx or a test component, import something like the Button and render it to confirm the styling works. For example:

* import { Button } from "@/components/button";

  <Button variant="default">Test Button</Button>
* You should see a styled button (ShadCN’s default variant styling). This confirms Radix + Tailwind integration is set up.

## 2. Implement the Chat Interface

With the project scaffolded and UI components ready, we can build the chat interface. The chat has two key parts: **message display** (with history) and **message input** (with send action). We will integrate Vercel’s AI SDK to handle message state and responses.

### 2.1 Install Vercel AI SDK

Add the Vercel AI SDK packages to your project. The SDK has a core and React hooks:

pnpm add @ai-sdk/core @ai-sdk/react

*(Note: The package name may update; as of SDK v5, @ai-sdk/react provides the React hooks like useChat*[*[12]*](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=Svelte)*. Consult Vercel’s docs if a single ai package is used in newer versions.)*

### 2.2 Chat State and useChat Hook

Vercel’s **useChat** hook will manage the state of the conversation (an array of messages) and handle sending user prompts to an AI provider and streaming responses[[13]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=useChat)[[14]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=).

**Key implementation steps:**

1. **Create a Chat component:** Make a new file, e.g. src/components/ChatView.tsx. This will contain the chat UI.
2. **Use the useChat hook:** Inside this component, call the hook to get chat state and functions. For example:

* import { useChat } from "@ai-sdk/react";

  const ChatView = () => {
   const { messages, handleSubmit, input, setInput } = useChat({
   api: "https://api.openai.com/v1/chat/completions",
   body: {
   model: "gpt-3.5-turbo", // or the model you want to use
   },
   headers: {
   "Content-Type": "application/json",
   "Authorization": `Bearer ${yourApiKey}`
   }
   });
   // ...
  };
* In the above:

1. We configure api to call OpenAI’s chat completions endpoint directly.
2. We set an initial body with the model to use.
3. We include headers with the **Authorization** header using the user-provided API key.
4. useChat will then handle sending messages to this endpoint. By default, it sends the conversation as {messages: [ ... ]} in the request body along with any extra body fields provided[[14]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=)[[15]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=headers%3F%3A). (The OpenAI API expects a JSON body with model, messages, etc.)

**Security Note:** Normally, secret API keys are not exposed in client-side code[[16]](https://github.com/vercel/next.js/discussions/51458#:~:text=%E2%9A%A0%EF%B8%8F%20Important%20note%3A%20this%20library,expose%20your%20secret%20API%20key). In our case, the user will supply their own key at runtime, so it won’t be hardcoded. Be sure *not* to commit any keys. In a production app, consider using a backend proxy or Vercel Edge function to keep the key usage secure[[17]](https://apipie.ai/docs/Integrations/Agent-Frameworks/Vercel-AI#:~:text=Vercel%20AI%20SDK%20Integration%20Guide,development%20and%20Vercel%20environment), but since users bring their own key, we’ll proceed with direct calls.

1. **UI for message list:** Use the messages array from useChat to render the conversation. Each message has a role (e.g. “user” or “assistant”) and content. You can map over messages and display them in a list:

* <ScrollArea className="h-96 px-4"> {/\* allow scrolling if long \*/}
   {messages.map(m => (
   <div key={m.id} className="my-2">
   {m.role === 'user' ? <Avatar>User</Avatar> : <Avatar>AI</Avatar>}
   <Card className="inline-block p-2">
   {m.content}
   </Card>
   </div>
   ))}
  </ScrollArea>
* Style the messages as desired (e.g., right-align user messages, left-align AI messages, different colors, etc.).

1. **UI for input box and send:** Utilize the ShadCN Input/Textarea and a Button for submitting:

* <form onSubmit={handleSubmit}>
   <div className="flex items-center gap-2 p-4 border-t">
   <Textarea
   placeholder="Type your message..."
   value={input}
   onChange={e => setInput(e.target.value)}
   className="flex-1"
   rows={1}
   />
   <Button type="submit">Send</Button>
   </div>
  </form>
* Here, input (the current text) and setInput come from useChat. handleSubmit is a function that will send the current input to the AI and append the response to messages. The hook handles streaming responses from OpenAI and updating the messages state in real-time as tokens arrive[[13]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=useChat) – you should see the assistant’s message appear gradually if streaming is enabled (the OpenAI endpoint streams if you set stream: true in the request, which the Vercel SDK might handle internally via fetch).

1. **Include the ChatView in the app:** Import and render <ChatView /> in your main App component or route so that the chat interface is visible.

At this stage, running the app (in a web browser) would show a chat UI. But we need to allow the **user to provide their own API key** rather than a hardcoded yourApiKey. For that, we’ll add secure storage next.

### 2.3 Handling API Key Input and Secure Storage

We want the user to input their OpenAI API key once and store it on the device securely so it persists across sessions. We can create a simple settings modal or key input field for this:

1. **Choose a storage plugin:** Capacitor offers Preferences (simple key-value storage in plaintext)[[18]](https://forum.ionicframework.com/t/storage-space-capacitor-vs-ionic-storage-plugin/239676#:~:text=Storage%20space%20%3A%20Capacitor%20vs,I%20tried) and there are community plugins for secure (encrypted) storage. A recommended option is the **Capacitor Secure Storage** plugin which uses the device Keychain/Keystore under the hood[[19]](https://capacitor-tutorial.com/blog/capacitor-secure-storage-plugin/#:~:text=The%20plugin%20uses%20SwiftKeychainWrapper%20under,the%20hood%20for%20iOS)[[20]](https://capacitor-tutorial.com/blog/capacitor-secure-storage-plugin/#:~:text=Android). We will use @atroo/capacitor-secure-storage-plugin.
2. **Install the secure storage plugin:**

pnpm add @atroo/capacitor-secure-storage-plugin

After installing, run npx cap sync later to ensure native projects pick up the plugin.

1. **Create a Key input UI:** Perhaps a settings icon or a modal where the user can paste their API key. For simplicity, you might add a temporary input at the top of the chat for now:

* import { SecureStoragePlugin } from '@atroo/capacitor-secure-storage-plugin';

  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
   // on component mount, load stored key if exists
   SecureStoragePlugin.get({ key: 'openai\_api\_key' }).then(result => {
   if (result.value) {
   setApiKey(result.value);
   }
   });
  }, []);

  const saveKey = async (key: string) => {
   if (!key) return;
   await SecureStoragePlugin.set({ key: 'openai\_api\_key', value: key });
   setApiKey(key);
  };
* And in JSX:
* {!apiKey ? (
   <div className="p-4 bg-gray-100">
   <Input
   type="password"
   placeholder="Enter OpenAI API Key"
   onKeyDown={e => { if(e.key==='Enter') saveKey(e.currentTarget.value) }}
   />
   <Button onClick={() => saveKey(keyInputValue)}>Save Key</Button>
   </div>
  ) : null}
* This simplistic example either shows an input to enter the key (and save it) or, if apiKey is already set, hides the input. In practice, you’d make this a nice modal or settings screen. You may also validate the key format (they usually start with "sk-").

1. **Use the stored key for API calls:** Modify the useChat initialization to use the apiKey state. For example, pass the headers only if apiKey is set:

* const { messages, input, setInput, handleSubmit } = useChat({
   api: "https://api.openai.com/v1/chat/completions",
   body: { model: "gpt-3.5-turbo" },
   headers: apiKey ? {
   "Content-Type": "application/json",
   "Authorization": `Bearer ${apiKey}`
   } : {},
  });
* Now, the chat will only call the API when the user has provided a key. If apiKey is null, you could disable the input or the send button.

1. **Security considerations:** The secure storage plugin stores data encrypted on device – on iOS it uses Keychain, on Android it uses AndroidKeyStore[[19]](https://capacitor-tutorial.com/blog/capacitor-secure-storage-plugin/#:~:text=The%20plugin%20uses%20SwiftKeychainWrapper%20under,the%20hood%20for%20iOS). This is safer than plaintext storage. (Note: in a debug build, data might not be encrypted on older Android APIs per the plugin docs[[20]](https://capacitor-tutorial.com/blog/capacitor-secure-storage-plugin/#:~:text=Android), but on modern devices it’s secure). Always be careful to never log the key or expose it inadvertently.

At this point, the core application logic is done: the user can enter an API key, type messages, and get AI responses. The chat history (messages) persists in memory during a session (and if needed, you could also persist it to device storage or a database for long-term history, but that’s an enhancement).

## 3. Capacitor Configuration and Platform Setup

Now that the app runs as a web app, we integrate Capacitor to run it on iOS and Android devices.

### 3.1 Install and Initialize Capacitor

1. **Install Capacitor packages:**

pnpm add @capacitor/core @capacitor/cli

This adds Capacitor’s core runtime and CLI to the project (Core will be a dependency, CLI as a dev dependency).

1. **Initialize Capacitor config:**

pnpm exec cap init "AI Chat App" "com.yourdomain.aichatapp" --web-dir=dist

Replace "AI Chat App" with your app’s name and "com.yourdomain.aichatapp" with your chosen app Bundle ID (reverse-domain style). We use --web-dir=dist to tell Capacitor where the web build files will be (Vite’s production build outputs to dist by default)[[21]](https://capacitorjs.com/solution/react#:~:text=Add%20Capacitor%20to%20your%20project,a%20config%20for%20your%20app)[[22]](https://capacitorjs.com/solution/react#:~:text=npm%20install%20%40capacitor%2Fcore%20%40capacitor%2Fcli). This creates a capacitor.config.ts (or capacitor.config.json) with the app details, and a package.json entry for the app ID.

1. **Configure Capacitor (if needed):** Open capacitor.config.ts. You might want to set additional options:
2. **Server URL for live reload** (for development): You can leave this out normally (we’ll use the CLI for live reload), but if you ever want to manually configure live reload, you can add:

* server: {
   url: "http://<YOUR-PC-IP>:5173", // point to Vite dev server
   cleartext: true
  }
* Ensure not to commit this server URL in production builds[[23]](https://capacitorjs.com/docs/guides/live-reload#:~:text=Within%20,server%27s%20IP%20address%20and%20port)[[24]](https://capacitorjs.com/docs/guides/live-reload#:~:text=Open%20the%20native%20IDE%20if,it%27s%20not%20already%20open).

1. **Allowing Navigation to OpenAI (if needed):** Since our app will fetch from api.openai.com, Capacitor should allow that by default as it’s HTTPS. iOS may restrict non-HTTPS or certain domains via App Transport Security, but OpenAI is HTTPS with modern TLS, so it should be fine. No extra domain config needed in most cases.
2. **Preferences:** Capacitor automatically includes plugins like Preferences. Since we use a secure storage plugin, ensure it’s listed under plugins if required by that plugin’s instructions (some community plugins might need config in capacitor.config, see plugin docs).

### 3.2 Add iOS and Android Platforms

With Capacitor config in place, add the native projects:

1. **Install platform dependencies:**

pnpm add @capacitor/ios @capacitor/android

(This installs the Capacitor iOS and Android bridge packages.)

1. **Add iOS platform:**

pnpm exec cap add ios

This creates an ios/ directory with an Xcode project for your app[[25]](https://capacitorjs.com/solution/react#:~:text=Install%20the%20native%20platforms%20you,want%20to%20target)[[26]](https://capacitorjs.com/solution/react#:~:text=npm%20i%20%40capacitor%2Fios%20%40capacitor%2Fandroid). Open ios/App to see the native project.

1. **Add Android platform:**

pnpm exec cap add android

This creates an android/ directory with an Android Studio project.

These native projects should be checked into version control (best practice is to commit them)[[27]](https://capacitorjs.com/solution/react#:~:text=Image%3A%20Apple%20logo%20%2021), because you will configure things like app icons, signing, etc., inside them.

1. **Sync after any plugin changes:** Whenever you install new Capacitor plugins (like the secure storage plugin earlier), run:

pnpm exec cap sync

This ensures any native code for plugins is copied into the iOS/Android projects.

### 3.3 Local Development on Device/Emulator

During development, you can use **Live Reload** to instantly reflect web code changes in your app without rebuilding the native binary each time.

**Option 1: Using the Ionic CLI (simplest)** – Install the Ionic CLI which wraps Capacitor run with live reload:

npm install -g @ionic/cli native-run

Now run on iOS or Android with live reload:

ionic cap run ios -l --external
ionic cap run android -l --external

This will build the web app, start the Vite dev server, and launch the native app pointing to that server[[28]](https://capacitorjs.com/docs/guides/live-reload#:~:text=npm%20install%20). The --external flag ensures the dev server is accessible on your local network (your device and computer must be on the same Wi-Fi)[[29]](https://capacitorjs.com/docs/guides/live-reload#:~:text=,Fi%20network%20as%20your%20computer)[[28]](https://capacitorjs.com/docs/guides/live-reload#:~:text=npm%20install%20). The CLI will open Xcode/Android Studio the first time for you to install the app. Leave the dev server running; the app will auto-reload on code changes.

**Option 2: Manual Live Reload** – If you prefer not to install Ionic CLI: - Find your computer’s IP on the LAN (e.g., 192.168.x.y). Start the Vite dev server bound to 0.0.0.0 so it’s accessible: pnpm run dev -- --host 0.0.0.0. - Edit capacitor.config.ts to add:

server: { url: "http://192.168.x.y:5173", cleartext: true }

and run pnpm exec cap copy ios (and same for android) to update native projects with this config. - Open Xcode (with pnpm exec cap open ios) or Android Studio (pnpm exec cap open android), then run the app on a simulator/emulator or device. It will load the dev server URL. Code changes will reflect. (Remember to remove or don’t commit the server url in config after development[[24]](https://capacitorjs.com/docs/guides/live-reload#:~:text=Open%20the%20native%20IDE%20if,it%27s%20not%20already%20open).)

**Running on a physical iOS device:** You’ll need to have a signing certificate setup in Xcode (e.g., use your Apple ID free provisioning or a developer team profile) to run on device directly. Connect your iPhone via USB, select it in Xcode’s target, and hit run. For Android, enable USB debugging and use Android Studio to run on the device. Live reload works on devices too, provided network connectivity is allowed.

### 3.4 Building Production Release

When ready to test or distribute, you need to create release builds.

#### iOS (TestFlight Distribution):

Building for TestFlight requires an Apple Developer account and setting up code signing:

1. **Certificates and Provisioning Profile:** Create an **Apple Distribution Certificate** and an **App Store Provisioning Profile** for your app’s Bundle ID. Easiest way: on a Mac, open Xcode -> Preferences -> Accounts -> “Manage Certificates” and create an “Apple Distribution” certificate[[30]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=First%20we%20need%20to%20make,Apple%20distribution). Then on the Apple Developer portal, create an App Store provisioning profile for the app ID (explicit, not wildcard) and download the .mobileprovision[[31]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Now%20that%20we%20have%20a,a%20new%20App%20Store%20profile)[[32]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Then%20you%20select%20the%20associated,it%20should%20show%20up%20here).
2. Alternatively, you can generate a Certificate Signing Request (CSR) on Linux with OpenSSL and create a certificate without Xcode. For example, generate a key and CSR:

* openssl genrsa -out ios\_dist.key 2048
  openssl req -new -key ios\_dist.key -out ios\_dist.csr -subj "/CN=Your Name/OU=Your Org/C=US"
* Upload ios\_dist.csr to Apple’s Certificates section (select “App Store and Ad Hoc” type) to get ios\_distribution.cer. Convert and combine it:
* openssl x509 -in ios\_distribution.cer -inform DER -out ios\_distribution.pem -outform PEM
  openssl pkcs12 -inkey ios\_dist.key -in ios\_distribution.pem -export -out ios\_distribution.p12
* (Use a password when exporting the .p12.)[[33]](https://stackoverflow.com/questions/9418661/how-to-create-p12-certificate-for-ios-distribution#:~:text=4) *Note:* With OpenSSL 3, include legacy flags (-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1) in the pkcs12 command for compatibility with Apple security[[34]](https://stackoverflow.com/questions/9418661/how-to-create-p12-certificate-for-ios-distribution#:~:text=OpenSSL%203,algorithms%20in%20the%20OpenSSL%20command).

Save the distribution .p12 and the .mobileprovision file.

1. **Configure Xcode project for release signing:** Open ios/App/App.xcworkspace in Xcode. In the **Signing & Capabilities** for the target:
2. Uncheck “Automatically manage signing”.
3. Choose “Any iOS SDK” under Release and select **your Apple Distribution certificate and provisioning profile** for the App Store[[35]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Switching%20your%20app%20to%20manual,signing). Ensure the team is correct.
4. This will modify the Xcode project settings; commit those changes (the project.pbxproj will update with a provisioning profile reference)[[36]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=In%20order%20to%20be%20able,committed%20to%20GitHub%20source%20control).
5. **Archive and export IPA:** You can build via Xcode (Product -> Archive, then use the Organizer to Export for TestFlight or Upload). But we’ll set up CI next to automate this. If doing locally, Archive with a generic device selected, then choose “Distribute App -> App Store Connect -> Upload” to send to TestFlight. Xcode will handle the upload if credentials are set.

#### Android (APK/AAB):

For completeness, to build Android for release: - Create a signing keystore (keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key). Update android/app/build.gradle signingConfigs and buildTypes to use this keystore for release. - Run pnpm exec cap open android and use Android Studio’s Generate Signed Bundle/APK wizard, or run Gradle tasks to assemble a release build.

(However, since the focus is on TestFlight, we won’t detail Android distribution. You can see similar guides for Android CI/CD[[37]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Looking%20for%20building%20Android%20bundles,out%20this%20blog%20post%20instead).)

## 4. CI/CD with GitHub Actions

Setting up GitHub Actions can automate building the app and even deploying to TestFlight when you push to main.

### 4.1 Preparing Secrets

Add the following secrets to your GitHub repository (under **Settings > Secrets and variables > Actions**):

* **APPLE\_CERTIFICATE\_BASE64** – Your distribution certificate (.p12) base64-encoded[[38]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=)[[39]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=base64%20). For example:
* base64 -i ios\_distribution.p12 | pbcopy
* and paste into the secret value. (The certificate contains the private key, hence .p12.)
* **P12\_PASSWORD** – The password you used when exporting the .p12[[40]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=,Apple%20signing%20certificate).
* **BUILD\_PROVISION\_PROFILE\_BASE64** – The provisioning profile (.mobileprovision) base64-encoded[[41]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=):
* base64 -i My\_App\_Store\_Profile.mobileprovision | pbcopy
* **KEYCHAIN\_PASSWORD** – An arbitrary password for a temporary keychain (e.g. "random-secret")[[42]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=base64%20).

If you use fastlane or App Store Connect API keys, you would also add secrets for API key JSON/p8, issuer ID, etc., but here we’ll proceed with manual certs.

### 4.2 iOS Build & TestFlight Workflow

Create a workflow file (e.g. .github/workflows/ios-build.yml):

name: Build iOS

on:
 push:
 branches: [ main ]
 workflow\_dispatch:

jobs:
 build:
 runs-on: macos-latest
 steps:
 - name: Checkout source
 uses: actions/checkout@v3

 - name: Install Node.js
 uses: actions/setup-node@v3
 with:
 node-version: 18 # or your project’s Node version
 cache: 'pnpm'

 - name: Install dependencies
 run: pnpm install

 - name: Build web assets
 run: pnpm run build

 - name: Install Capacitor pods (iOS)
 run: |
 pnpm exec cap sync ios
 cd ios/App && pod install # install CocoaPods dependencies
 - name: Install the Apple certificate and provisioning profile
 env:
 BUILD\_CERTIFICATE\_BASE64: ${{ secrets.BUILD\_CERTIFICATE\_BASE64 }}
 P12\_PASSWORD: ${{ secrets.P12\_PASSWORD }}
 BUILD\_PROVISION\_PROFILE\_BASE64: ${{ secrets.BUILD\_PROVISION\_PROFILE\_BASE64 }}
 KEYCHAIN\_PASSWORD: ${{ secrets.KEYCHAIN\_PASSWORD }}
 run: |
 # Save cert and profile to temp files
 echo "$BUILD\_CERTIFICATE\_BASE64" | base64 --decode -o cert.p12
 echo "$BUILD\_PROVISION\_PROFILE\_BASE64" | base64 --decode -o profile.mobileprovision
 # Create a temporary keychain
 security create-keychain -p "$KEYCHAIN\_PASSWORD" build.keychain
 security unlock-keychain -p "$KEYCHAIN\_PASSWORD" build.keychain
 security set-keychain-settings -lut 21600 build.keychain
 # Import the signing certificate
 security import cert.p12 -P "$P12\_PASSWORD" -A -t cert -f pkcs12 -k build.keychain
 security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN\_PASSWORD" build.keychain
 # Install provisioning profile
 mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
 cp profile.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/
 - name: Build iOS app
 run: |
 xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
 -configuration Release -archivePath ios/App/output/App.xcarchive archive | xcpretty
 - name: Export IPA
 run: |
 # Create Export options plist on-the-fly:
 echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE plist PUBLIC ... >
 <plist version=\"1.0\"><dict><key>method</key><string>app-store</string>
 <key>signingStyle</key><string>manual</string>
 <key>provisioningProfiles</key><dict>
 <key>com.yourdomain.aichatapp</key><string>Your Provisioning Profile Name</string>
 </dict></dict></plist>" > exportOptions.plist
 xcodebuild -archivePath ios/App/output/App.xcarchive -exportArchive \
 -exportOptionsPlist exportOptions.plist -exportPath ios/App/output
 shell: bash
 - name: Upload to TestFlight
 env:
 AC\_USERNAME: ${{ secrets.APPLE\_ID }} # Apple ID/email for App Store Connect
 AC\_PASSWORD: ${{ secrets.APP\_SPECIFIC\_PASSWORD }} # App-specific password
 run: |
 xcrun altool --upload-app -f ios/App/output/App.ipa -t ios \
 -u "$AC\_USERNAME" -p "$AC\_PASSWORD"

Explanations: - We use MacOS runner, check out code, set up Node, and install deps (caching pnpm). - Build the web assets (pnpm run build). - Sync capacitor and run CocoaPods for iOS (installing any iOS plugin dependencies). - The **Install certificate** step imports the cert and profile into a temporary keychain on the runner[[43]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=CERTIFICATE_PATH%3D%24RUNNER_TEMP%2Fbuild_certificate.p12%20PP_PATH%3D%24RUNNER_TEMP%2Fbuild_pp.mobileprovision%20KEYCHAIN_PATH%3D%24RUNNER_TEMP%2Fapp)[[44]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=security%20create,p%20%22%24KEYCHAIN_PASSWORD%22%20%24KEYCHAIN_PATH). This uses the secrets we set: - Creates build.keychain, imports the .p12 (with security import)[[45]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=,s%20%24KEYCHAIN_PATH), and copies the mobileprovision to the profiles folder[[46]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=,). - We then run xcodebuild twice: - First, to **archive** the app into an .xcarchive[[47]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=run%3A%20xcodebuild%20,archivePath%20App.xcarchive%20archive). - Second, to **export** the archive to an IPA using an export options plist[[48]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=match%20at%20L241%20run%3A%20xcodebuild,allowProvisioningUpdates). We specify method "app-store" and manual signing with the provisioning profile name (you can find the profile name in Apple Developer or use the filename without extension). - Finally, we upload the .ipa to TestFlight. We use Apple’s CLI tool **altool** with an app-specific password (generate one in Apple ID settings for App Store Connect). Alternatively, you could use Fastlane’s pilot or the App Store Connect API key with Fastlane’s upload\_to\_testflight. The xcrun altool line uses environment variables AC\_USERNAME (your Apple ID email) and AC\_PASSWORD (an app-specific password) – store those in GitHub secrets as well.

After this Action runs on a push, it will output an IPA and upload it. If successful, you’ll see the build appear in App Store Connect > TestFlight, where you can add testers and send it out.

*(You may need to adjust Xcode version or add sudo xcode-select -s if you require a specific Xcode version on the Mac runner. Also, if your app uses capabilities like Push Notifications or Keychain Sharing, you’d include those in the entitlements and provisioning.)*

#### Additional CI Tips:

* **Android CI:** You can set up a similar GitHub Actions workflow for Android using the Java Gradle Actions. For example, checkout, install JDK, run ./gradlew assembleRelease. You’ll need to supply the keystore and its passwords as secrets and use the Gradle signingConfigs. There are guides available for building Android on GitHub Actions and producing an APK/AAB artifact[[49]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Build%20your%20Capacitor%20iOS%20app,Apple%20via%20the%20Transporter%20app)[[50]](https://github.com/marketplace/actions/kmp-build-ios-app#:~:text=KMP%20Build%20iOS%20App%20%C2%B7,signed%29%20builds).
* **Fastlane:** Instead of raw xcodebuild commands, you can use Fastlane in CI (with a Fastlane Fastfile to handle gym and pilot). Fastlane’s **match** can manage certs/profiles via a private repo. This can simplify long-term maintenance[[51]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=%3E%20Starting%20February%202021%2C%20two,From%20Apple%20Support)[[52]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=1,Key%20file%20or%20Key%20content). If interested, refer to Fastlane docs or the Capgo guide which uses Fastlane match with App Store Connect API keys for non-interactive authentication[[53]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=In%20order%20for%20Fastlane%20to,provide%20the%20following%20three%20things)[[54]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=1,Store%20Connect).
* **Caching:** Consider caching dependencies (pnpm store, CocoaPods) to speed up builds.

## 5. Testing on Devices and Best Practices

With the CI producing builds, you can continuously test on real devices:

* **TestFlight:** After uploading via CI, use App Store Connect to add internal testers (just your Apple ID or others) and push the build to TestFlight. You’ll get a link or notification in the TestFlight app on your iPhone to install the beta.
* **Android Internal Testing:** For Android, you can similarly upload an AAB to Google Play’s internal testing track using the Play Developer API or Fastlane supply. This allows installing via the Play Store.
* **Device Debugging:** For issues that only appear on device (e.g., plugin issues), you might need to run from Xcode/Android Studio with a debugger attached. Keep Xcode installed and up to date for iOS debugging. Android Studio’s Logcat will show logs from the app – you can use console.log in your JS and see it in Logcat (Capacitor forwards console logs to native log).
* **Capacitor Plugins Best Practices:** Only enable or request device permissions when needed. For example, if in future you add microphone access for speech input, use Capacitor’s Permissions API to request microphone permission at runtime. Always add descriptive usage descriptions in Info.plist for iOS if you use such features (e.g., NSMicrophoneUsageDescription).
* **Upgrading Capacitor:** Stay updated on Capacitor releases. Capacitor 5+ may have breaking changes or new features (refer to the official docs for upgrade guides). Also keep the ShadCN components updated (ShadCN’s CLI add command can update components if needed).
* **Design and UI:** Continue to refine the UI using Tailwind. You might introduce dark mode support (ShadCN has a dark mode setup guide[[55]](https://ui.shadcn.com/docs/monorepo#:~:text=Dark%20mode)). Also, ensure your layout accounts for mobile screen sizes – use responsive Tailwind utilities or media queries to make the chat interface comfortable on small screens.
* **Performance:** For heavy AI responses, consider streaming. The Vercel useChat hook streams by default. Test on device network conditions. If the streaming stalls due to fetch keep-alive, you might switch to using EventSource or a WebSocket in the future, or route through Vercel’s Edge Functions which can stream easily to the client.
* **Error handling:** Add error states (e.g., if API key is wrong or network fails). The UI should inform the user accordingly (perhaps using ShadCN’s <Toast> component for notifications).
* **Source Control:** Commit the entire project including ios and android folders (as recommended by Capacitor)[[27]](https://capacitorjs.com/solution/react#:~:text=Image%3A%20Apple%20logo%20%2021). Exclude any sensitive files (like Google Services JSON/plist if using Firebase, etc.). Also, never commit the .env or any API keys (not applicable here since user provides key at runtime)[[56]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=You%20will%20need%20to%20use,is%20all%20that%20is%20necessary).

By following this guide, you’ve set up a robust foundation: a cross-platform mobile app with a modern tech stack, an AI chat feature, and an automated deployment pipeline. You can now iterate on features such as on-device model support (in the future, e.g., integrating Apple’s Neural Engine if Apple provides on-device LLM APIs) or enhancing the UI/UX of the chat. Good luck with your app development!

**Sources:**

* Vercel AI Chatbot Template – uses Next.js, Tailwind, Radix (ShadCN/UI)[[4]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,UI%20for%20accessibility%20and%20flexibility)[[2]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,Auth.js).
* Capacitor Documentation (React integration, Live Reload)[[21]](https://capacitorjs.com/solution/react#:~:text=Add%20Capacitor%20to%20your%20project,a%20config%20for%20your%20app)[[28]](https://capacitorjs.com/docs/guides/live-reload#:~:text=npm%20install%20).
* ShadCN/UI Documentation (CLI usage and Vite setup)[[57]](https://ui.shadcn.com/docs/cli#:~:text=pnpmnpmyarnbun)[[58]](https://ui.shadcn.com/docs/installation/vite#:~:text=Run%20the%20,to%20setup%20your%20project).
* OpenAI API usage example (HTTP request structure for chat completions)[[59]](https://tomriha.com/how-to-use-chatgpt-in-your-power-automate-flow/#:~:text=Method%3A%20POST)[[60]](https://tomriha.com/how-to-use-chatgpt-in-your-power-automate-flow/#:~:text=The%20request%20body%20needs%20only,4%20later).
* Stanislav Khromov’s guide on GitHub Actions for Capacitor iOS builds[[30]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=First%20we%20need%20to%20make,Apple%20distribution)[[61]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=jobs%3A%20build%3A%20runs,name%3A%20Checkout%20source%20uses%3A%20actions%2Fcheckout%40v3).
* GitHub Actions official docs (installing Apple certificates on macOS runners)[[62]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=Create%20secrets%20in%20your%20repository,organization%20for%20the%20following%20items)[[43]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=CERTIFICATE_PATH%3D%24RUNNER_TEMP%2Fbuild_certificate.p12%20PP_PATH%3D%24RUNNER_TEMP%2Fbuild_pp.mobileprovision%20KEYCHAIN_PATH%3D%24RUNNER_TEMP%2Fapp).
* Capgo guide on CI/CD with Fastlane (for advanced setup)[[53]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=In%20order%20for%20Fastlane%20to,provide%20the%20following%20three%20things)[[54]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=1,Store%20Connect).

[[1]](https://capacitorjs.com/solution/react#:~:text=Install%20Capacitor) [[21]](https://capacitorjs.com/solution/react#:~:text=Add%20Capacitor%20to%20your%20project,a%20config%20for%20your%20app) [[22]](https://capacitorjs.com/solution/react#:~:text=npm%20install%20%40capacitor%2Fcore%20%40capacitor%2Fcli) [[25]](https://capacitorjs.com/solution/react#:~:text=Install%20the%20native%20platforms%20you,want%20to%20target) [[26]](https://capacitorjs.com/solution/react#:~:text=npm%20i%20%40capacitor%2Fios%20%40capacitor%2Fandroid) [[27]](https://capacitorjs.com/solution/react#:~:text=Image%3A%20Apple%20logo%20%2021) Using Capacitor with React

<https://capacitorjs.com/solution/react>

[[2]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,Auth.js) [[3]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,UI%20for%20accessibility%20and%20flexibility) [[4]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=,UI%20for%20accessibility%20and%20flexibility) [[56]](https://vercel.com/templates/next.js/nextjs-ai-chatbot#:~:text=You%20will%20need%20to%20use,is%20all%20that%20is%20necessary) Next.js AI Chatbot

<https://vercel.com/templates/next.js/nextjs-ai-chatbot>

[[5]](https://ui.shadcn.com/docs/installation/vite#:~:text=Replace%20everything%20in%20,the%20following) [[6]](https://ui.shadcn.com/docs/installation/vite#:~:text=Copy%20import%20path%20from%20,vite) [[58]](https://ui.shadcn.com/docs/installation/vite#:~:text=Run%20the%20,to%20setup%20your%20project) Vite - shadcn/ui

<https://ui.shadcn.com/docs/installation/vite>

[[7]](https://ui.shadcn.com/docs/cli#:~:text=init) [[8]](https://ui.shadcn.com/docs/cli#:~:text=pnpm%20dlx%20shadcn%40latest%20init) [[9]](https://ui.shadcn.com/docs/cli#:~:text=The%20,CSS%20variables%20for%20the%20project) [[10]](https://ui.shadcn.com/docs/cli#:~:text=Use%20the%20,and%20dependencies%20to%20your%20project) [[11]](https://ui.shadcn.com/docs/cli#:~:text=Arguments%3A%20components%20%20%20,or%20local%20path%20to%20component) [[57]](https://ui.shadcn.com/docs/cli#:~:text=pnpmnpmyarnbun) shadcn - shadcn/ui

<https://ui.shadcn.com/docs/cli>

[[12]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=Svelte) [[13]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=useChat) [[14]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=) [[15]](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#:~:text=headers%3F%3A) AI SDK UI: useChat

<https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat>

[[16]](https://github.com/vercel/next.js/discussions/51458#:~:text=%E2%9A%A0%EF%B8%8F%20Important%20note%3A%20this%20library,expose%20your%20secret%20API%20key) How to call openai api in client component? #51458 - GitHub

<https://github.com/vercel/next.js/discussions/51458>

[[17]](https://apipie.ai/docs/Integrations/Agent-Frameworks/Vercel-AI#:~:text=Vercel%20AI%20SDK%20Integration%20Guide,development%20and%20Vercel%20environment) Vercel AI SDK Integration Guide | APIpie

<https://apipie.ai/docs/Integrations/Agent-Frameworks/Vercel-AI>

[[18]](https://forum.ionicframework.com/t/storage-space-capacitor-vs-ionic-storage-plugin/239676#:~:text=Storage%20space%20%3A%20Capacitor%20vs,I%20tried) Storage space : Capacitor vs Ionic Storage Plugin?

<https://forum.ionicframework.com/t/storage-space-capacitor-vs-ionic-storage-plugin/239676>

[[19]](https://capacitor-tutorial.com/blog/capacitor-secure-storage-plugin/#:~:text=The%20plugin%20uses%20SwiftKeychainWrapper%20under,the%20hood%20for%20iOS) [[20]](https://capacitor-tutorial.com/blog/capacitor-secure-storage-plugin/#:~:text=Android) Using Capacitor Secure Storage Plugin

<https://capacitor-tutorial.com/blog/capacitor-secure-storage-plugin/>

[[23]](https://capacitorjs.com/docs/guides/live-reload#:~:text=Within%20,server%27s%20IP%20address%20and%20port) [[24]](https://capacitorjs.com/docs/guides/live-reload#:~:text=Open%20the%20native%20IDE%20if,it%27s%20not%20already%20open) [[28]](https://capacitorjs.com/docs/guides/live-reload#:~:text=npm%20install%20) [[29]](https://capacitorjs.com/docs/guides/live-reload#:~:text=,Fi%20network%20as%20your%20computer) Live Reload | Capacitor Documentation

<https://capacitorjs.com/docs/guides/live-reload>

[[30]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=First%20we%20need%20to%20make,Apple%20distribution) [[31]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Now%20that%20we%20have%20a,a%20new%20App%20Store%20profile) [[32]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Then%20you%20select%20the%20associated,it%20should%20show%20up%20here) [[35]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Switching%20your%20app%20to%20manual,signing) [[36]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=In%20order%20to%20be%20able,committed%20to%20GitHub%20source%20control) [[37]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Looking%20for%20building%20Android%20bundles,out%20this%20blog%20post%20instead) [[47]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=run%3A%20xcodebuild%20,archivePath%20App.xcarchive%20archive) [[48]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=match%20at%20L241%20run%3A%20xcodebuild,allowProvisioningUpdates) [[49]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=Build%20your%20Capacitor%20iOS%20app,Apple%20via%20the%20Transporter%20app) [[61]](https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/#:~:text=jobs%3A%20build%3A%20runs,name%3A%20Checkout%20source%20uses%3A%20actions%2Fcheckout%40v3) Build your Capacitor iOS app bundle using GitHub Actions - Stanislav Khromov

<https://khromov.se/build-your-capacitor-ios-app-bundle-using-github-actions/>

[[33]](https://stackoverflow.com/questions/9418661/how-to-create-p12-certificate-for-ios-distribution#:~:text=4) [[34]](https://stackoverflow.com/questions/9418661/how-to-create-p12-certificate-for-ios-distribution#:~:text=OpenSSL%203,algorithms%20in%20the%20OpenSSL%20command) iphone - How to create P12 certificate for iOS distribution - Stack Overflow

<https://stackoverflow.com/questions/9418661/how-to-create-p12-certificate-for-ios-distribution>

[[38]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=) [[39]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=base64%20) [[40]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=,Apple%20signing%20certificate) [[41]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=) [[42]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=base64%20) [[43]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=CERTIFICATE_PATH%3D%24RUNNER_TEMP%2Fbuild_certificate.p12%20PP_PATH%3D%24RUNNER_TEMP%2Fbuild_pp.mobileprovision%20KEYCHAIN_PATH%3D%24RUNNER_TEMP%2Fapp) [[44]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=security%20create,p%20%22%24KEYCHAIN_PASSWORD%22%20%24KEYCHAIN_PATH) [[45]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=,s%20%24KEYCHAIN_PATH) [[46]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=,) [[62]](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications#:~:text=Create%20secrets%20in%20your%20repository,organization%20for%20the%20following%20items) Installing an Apple certificate on macOS runners for Xcode development - GitHub Docs

<https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications>

[[50]](https://github.com/marketplace/actions/kmp-build-ios-app#:~:text=KMP%20Build%20iOS%20App%20%C2%B7,signed%29%20builds) KMP Build iOS App · Actions · GitHub Marketplace

<https://github.com/marketplace/actions/kmp-build-ios-app>

[[51]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=%3E%20Starting%20February%202021%2C%20two,From%20Apple%20Support) [[52]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=1,Key%20file%20or%20Key%20content) [[53]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=In%20order%20for%20Fastlane%20to,provide%20the%20following%20three%20things) [[54]](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/#:~:text=1,Store%20Connect) Automatic Capacitor IOS build with GitHub actions with certificate

<https://capgo.app/blog/automatic-capacitor-ios-build-github-action/>

[[55]](https://ui.shadcn.com/docs/monorepo#:~:text=Dark%20mode) Monorepo - shadcn/ui

<https://ui.shadcn.com/docs/monorepo>

[[59]](https://tomriha.com/how-to-use-chatgpt-in-your-power-automate-flow/#:~:text=Method%3A%20POST) [[60]](https://tomriha.com/how-to-use-chatgpt-in-your-power-automate-flow/#:~:text=The%20request%20body%20needs%20only,4%20later) How to use ChatGPT in your Power Automate flow

<https://tomriha.com/how-to-use-chatgpt-in-your-power-automate-flow/>
