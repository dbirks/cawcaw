# Changelog

## [0.2.0](https://github.com/dbirks/cawcaw/compare/v0.1.4...v0.2.0) (2026-02-16)


### Features

* Add ACP (Agent Client Protocol) foundation (Phase 1) ([df65459](https://github.com/dbirks/cawcaw/commit/df65459f7da69505dbcdbd5e7c886860ef5e0428))
* Add base64 decode error handling and size mismatch detection ([f04ebe8](https://github.com/dbirks/cawcaw/commit/f04ebe89f2f33f65e5a6dcd382a92a429f51b8c9))
* Add bd issue for A2A client implementation (cawcaw-7tx) ([4fcb872](https://github.com/dbirks/cawcaw/commit/4fcb872723062d48cece61c845587f1d6a573359))
* Add Cache Health Check feature to Settings Debug tab ([8b92bc2](https://github.com/dbirks/cawcaw/commit/8b92bc2b41640b582497238f39e2fd792585b29c))
* Add cache health verification on app startup ([79a02ee](https://github.com/dbirks/cawcaw/commit/79a02ee163c286860b0634d488c1f9186870ba49))
* Add Capacitor Filesystem cache infrastructure for persistent model storage ([1400620](https://github.com/dbirks/cawcaw/commit/1400620487afc48e7b1ed1860ed3f9703128a436))
* Add comprehensive error path Sentry logging to cache operations ([de35167](https://github.com/dbirks/cawcaw/commit/de3516736cb85a940a9f15f9e0b0ccbfec19009a))
* Add comprehensive Sentry error tracking for audio/microphone features ([06e4bd1](https://github.com/dbirks/cawcaw/commit/06e4bd182a9f114da6ad3ab4687278fba2bd0d3c))
* Add comprehensive Sentry error tracking integration ([d545adb](https://github.com/dbirks/cawcaw/commit/d545adbcc97d97e42280323f099299b0e28acb4f))
* Add comprehensive Sentry logging to cache metadata operations ([76f9fed](https://github.com/dbirks/cawcaw/commit/76f9fed0824a933426c3b3623783baa86cef1624))
* Add comprehensive Sentry logging to track local AI download failures ([420fe85](https://github.com/dbirks/cawcaw/commit/420fe85eab63a0fd2ef92915074efd0beaa6de2d))
* Add comprehensive storage management and orphaned file detection ([56b1ef6](https://github.com/dbirks/cawcaw/commit/56b1ef6f06eaecd391f1fcef994c5cf26d04d7ec))
* Add download duration tracking to Sentry logging ([92b7de2](https://github.com/dbirks/cawcaw/commit/92b7de29e79d53c59bcf63d0fca1a44528c4f881))
* Add download speed, model name, and size to progress display ([3f6872e](https://github.com/dbirks/cawcaw/commit/3f6872e3fc59a4f41cb15ef05a3ca25f97026c4d))
* Add DuckDuckGo web search built-in tool ([3ce7ddb](https://github.com/dbirks/cawcaw/commit/3ce7ddb7d5ae5646b1c5a8dbdc3423e15a496b5e))
* Add explicit Sentry logging for Local AI cache operations ([bc741a4](https://github.com/dbirks/cawcaw/commit/bc741a41618b4fa2b235bd7113ed9a123587cd8a))
* Add feature flag system with 'Enable ACP' flag ([3659fd8](https://github.com/dbirks/cawcaw/commit/3659fd88471585b03d0fea4a9cdc016de140d003))
* Add Local AI toggle to Feature Flags UI ([deffb53](https://github.com/dbirks/cawcaw/commit/deffb53b80f9b7b97e3f69f405835d36f30023c7))
* Add new conversation button to navbar ([cebda41](https://github.com/dbirks/cawcaw/commit/cebda411b6736c8d3c7619efbcecf4308900dfec))
* Add Streamdown Tailwind CSS source directive ([95f2912](https://github.com/dbirks/cawcaw/commit/95f29120055de7bc3576760929f163490cb24844))
* Add user-visible error messages for Local AI download failures ([214e296](https://github.com/dbirks/cawcaw/commit/214e29639aa1aa5dc51a6af3d6304d77f7218c52))
* Add WebGPU detection probe with Sentry logging for iOS 26 testing ([28ea3a7](https://github.com/dbirks/cawcaw/commit/28ea3a728bb51d07eecfb86e683432fbfe22926e))
* Add WebSocket client for ACP protocol ([7133471](https://github.com/dbirks/cawcaw/commit/71334713544cdb70f963054b3b53029615cc8712))
* Add yellow indicator to MCP badge when servers have warnings ([85ab60e](https://github.com/dbirks/cawcaw/commit/85ab60eb7a6253f2c0141beb41a9b73cbde06d97))
* Complete ACP Phase 2 connection management ([5810898](https://github.com/dbirks/cawcaw/commit/58108987856b19e16bea4d832c383e66891e07b9))
* Configure Node.js version requirements with PNPM enforcement ([fff0c3c](https://github.com/dbirks/cawcaw/commit/fff0c3cc7f06145ae81c3d8bad3607521a6cb61c))
* Configure Sentry DSN in GitHub Actions build ([3865a2e](https://github.com/dbirks/cawcaw/commit/3865a2e4502ea267d3ca1d2cc9bd7024f907fde2))
* Gate Local AI behind feature flag in model selector ([2397b8b](https://github.com/dbirks/cawcaw/commit/2397b8ba4c058616b58783953a040d16afb86a55))
* Implement ACP permission request handling (Phase 4) ([1192bd0](https://github.com/dbirks/cawcaw/commit/1192bd0894416d9d04cf435771d69b5a89500835))
* Implement ACP Phase 3 chat integration with mode switcher and streaming ([989c279](https://github.com/dbirks/cawcaw/commit/989c27901c40ed182badec8e428765ddeef25f97))
* Implement WebSocket streaming for ACP and add Sentry MCP Quick Setup ([0444608](https://github.com/dbirks/cawcaw/commit/04446086e7843c6f9164a76663a11556260a0944))
* Improve new conversation button styling ([1a0e7c6](https://github.com/dbirks/cawcaw/commit/1a0e7c6a301c61bebbfae49dfa01000591f5e5af))
* Make assistant responses full-width without chat bubble ([7ca9608](https://github.com/dbirks/cawcaw/commit/7ca960862e2db23fd6aff872ba1f27b1fdb273a4))
* Make assistant responses full-width without chat bubble ([4ba5a8e](https://github.com/dbirks/cawcaw/commit/4ba5a8e5582de9965b8332c6a5ab592119166bb6))
* Make tool calls full-width with green background ([ef96822](https://github.com/dbirks/cawcaw/commit/ef96822c29b087a9968d1f7ad534a97ee50e0fce))
* **phase-0:** Add enhanced WebGPU diagnostics with compute pass test ([898201b](https://github.com/dbirks/cawcaw/commit/898201b76c4fe601d1960b27f9294fc718922e19))
* **phase-2:** Add Web Worker infrastructure for local AI ([150e71a](https://github.com/dbirks/cawcaw/commit/150e71a7d4aa935c949fe2d44035299dd5053db5))
* **phase-3:** Implement Transformers.js with Gemma 3 270M integration ([6dc4c34](https://github.com/dbirks/cawcaw/commit/6dc4c344efb68af56e95834fa14713b8e7283051))
* **phase-4:** Integrate local AI provider in ChatView UI ([2347899](https://github.com/dbirks/cawcaw/commit/2347899cbd5fc2aed8286ce00eb164f1fb038c03))
* **phase-5:** Add download progress UI, streaming tokens, and cache management ([f784af4](https://github.com/dbirks/cawcaw/commit/f784af4980b75c447593331fa6663f30806c7254))
* Redesign tool call UI with flat wall-to-wall dark green background ([b931bc5](https://github.com/dbirks/cawcaw/commit/b931bc58a622ca3db465ce58192b629c8eac9207))
* Redesign tool call UI with modern minimal styling ([2aa0e6f](https://github.com/dbirks/cawcaw/commit/2aa0e6f243578d342141a388176c0b78732aa6b8))
* Render JSON tool results with syntax highlighting ([4aa0aed](https://github.com/dbirks/cawcaw/commit/4aa0aede8fa7ed7e4d0051304789890781631a08))
* Show explicit tool names with spaces in collapsible tool UI ([0079898](https://github.com/dbirks/cawcaw/commit/0079898aa97c44ef924cec99f3b2b6608b319325))
* Support both OpenAI and Anthropic keys at startup ([a8d2ce4](https://github.com/dbirks/cawcaw/commit/a8d2ce40f88d9a4f41b8e18477efbd2ac055ffa1))
* UI improvements and feature flags ([2149997](https://github.com/dbirks/cawcaw/commit/2149997f6881acc25d113501b1db85b4c273b8c1))
* Update transcribe model and fix dialog close button ([19ef8bb](https://github.com/dbirks/cawcaw/commit/19ef8bbc9e7038832e10661b68093c0304ad6ef1))


### Bug Fixes

* Add comprehensive console logging fallback for Local AI download debugging ([918b56a](https://github.com/dbirks/cawcaw/commit/918b56a509d30a6db435a55e4ef0e33a0d4148d7))
* Add comprehensive logging to debug model cache persistence failure ([2f73f8f](https://github.com/dbirks/cawcaw/commit/2f73f8f3c85135bfca8ccad365bd6f1ddb963b2c))
* Add cursor-pointer to Button for iOS Safari touch events ([d670327](https://github.com/dbirks/cawcaw/commit/d670327f9ada2a160c7b9ea534966611a85191f6))
* Add error handling to prevent API key loading from blocking MCP server list ([7cb6e6b](https://github.com/dbirks/cawcaw/commit/7cb6e6b805e2888ece46087ce32342950c417bc8))
* Add left padding to Settings title in list view ([deffb53](https://github.com/dbirks/cawcaw/commit/deffb53b80f9b7b97e3f69f405835d36f30023c7))
* Add loading state checks and auto-reset mechanism for Local AI ([fd62c15](https://github.com/dbirks/cawcaw/commit/fd62c15e668f9b7b415411e7ad1763aa9f4c14c1))
* Add missing cn import to fix Settings crash ([758adc7](https://github.com/dbirks/cawcaw/commit/758adc7acffc57529e9052516b67fa15c1bda16d))
* Add missing size="icon" prop to Edit dialog close buttons ([45a1f9a](https://github.com/dbirks/cawcaw/commit/45a1f9a8d6f7d698d85594f27a4340dbc82edec4))
* Add scope parameter to dynamic client registration (RFC 7591) ([abd13fd](https://github.com/dbirks/cawcaw/commit/abd13fddaa7280ca1e86c2855a2891737c27f41c))
* Add type='button' to dialog close buttons to prevent form submission behavior ([6f805e6](https://github.com/dbirks/cawcaw/commit/6f805e6a35e6679b0099f84bbb64a7bbb2e1609d))
* Adjust hamburger menu button to 30px ([4fa16d7](https://github.com/dbirks/cawcaw/commit/4fa16d7f1a3d5a8bee202cf179d5dd5838aca453))
* Apply Biome code formatting fixes for CI ([d9f9747](https://github.com/dbirks/cawcaw/commit/d9f9747812bddb7804eaab5a90344ec0db93d0ca))
* Apply Biome formatting fixes to pass CI checks ([faaa8bc](https://github.com/dbirks/cawcaw/commit/faaa8bc3543016450c70772eaaeffb32e7be8018))
* Change new conversation button to solid color styling ([a01cc8a](https://github.com/dbirks/cawcaw/commit/a01cc8a2b6ade22aef0ea7ab30fa7fbbc978ed51))
* Code quality issues from merged branch ([1005e26](https://github.com/dbirks/cawcaw/commit/1005e26745d353eca9fd8160e22d5d9d5638a1b1))
* Correct download progress percentage calculation (5004% bug) ([61cf50b](https://github.com/dbirks/cawcaw/commit/61cf50bbe556569bc72850600a14b5226fa57ef8))
* **deps:** update all non-major dependencies ([#22](https://github.com/dbirks/cawcaw/issues/22)) ([7b16653](https://github.com/dbirks/cawcaw/commit/7b1665366f377f6b9cf43e762b371aacdab7870c))
* **deps:** update dependency react-syntax-highlighter to v16 ([#9](https://github.com/dbirks/cawcaw/issues/9)) ([bfd5b15](https://github.com/dbirks/cawcaw/commit/bfd5b1500a67a90bc2e082c4a22b08df5c98ce54))
* Display full tool name in collapsible header (e.g., GetCurrentDate instead of just date) ([5be18ea](https://github.com/dbirks/cawcaw/commit/5be18eafe024342c4e3b493885d346f139fd5a4c))
* Display full tool name in collapsible header instead of truncated version ([aecb913](https://github.com/dbirks/cawcaw/commit/aecb913283b9097a98e3ec51995b979aa23edea3))
* Ensure local model appears in chat selector when WebGPU available ([2cf482e](https://github.com/dbirks/cawcaw/commit/2cf482ef3d5bc085a8438448bd1e3758acfe5a04))
* Ensure title generation fallback always runs ([0fc74a5](https://github.com/dbirks/cawcaw/commit/0fc74a5a087a5098525aad284d9da0d550cd97df))
* Fix audio transcription format detection and add whisper-1 fallback ([65f7fb4](https://github.com/dbirks/cawcaw/commit/65f7fb4410b31f49ce5a1400f86b1434dffabfc6))
* Implement force refresh and comprehensive OAuth token logging ([79a7c3c](https://github.com/dbirks/cawcaw/commit/79a7c3cc883d782dec746f80daf7a387f2b7c92d))
* Implement monotonic progress aggregation for multi-file downloads ([612a200](https://github.com/dbirks/cawcaw/commit/612a20092335678ee40e2f264d0f4c7c40fb08b1))
* Implement proactive and reactive OAuth token refresh strategies ([366dfdc](https://github.com/dbirks/cawcaw/commit/366dfdc9499c35c54f8941b8c20fc0476aad5f09))
* Improve local AI download UX with progress and correct size ([42c7434](https://github.com/dbirks/cawcaw/commit/42c743428a46518da19b21e48ac28e89b82c70d1))
* Improve sidebar title alignment and Settings X button on iOS ([c831189](https://github.com/dbirks/cawcaw/commit/c831189ba03c849dbecbdcc93753e15a7475c3ad))
* Improve storage estimate accuracy and labeling ([b7234c4](https://github.com/dbirks/cawcaw/commit/b7234c4deb30961df3e6f1c7d08069a803464cfc))
* Keep gpt-4o-mini-transcribe as default, whisper-1 as fallback only ([81abe4d](https://github.com/dbirks/cawcaw/commit/81abe4d090bd4457bfb165114b6ae1cbe32b5929))
* Make tool call background extend full width ([f246da4](https://github.com/dbirks/cawcaw/commit/f246da444c91ad0eaa6c1f462e6ee1a3b50fb9a3))
* Make tool call visualization stretch wall-to-wall with no padding ([6a263df](https://github.com/dbirks/cawcaw/commit/6a263df237cf4b1f5e9b0648ec329b7fa2f213f6))
* Migrate cache to Directory.Library for iOS app update persistence ([5a575a2](https://github.com/dbirks/cawcaw/commit/5a575a2c4b7f93100b7f6b97233176abf66a0b45))
* Prevent progress bar jumping to 100% by excluding files with unknown sizes from calculation ([4f96c99](https://github.com/dbirks/cawcaw/commit/4f96c9930985500fcddd0170a5b9b262d7b1fa1d))
* Prevent Settings close button event bubbling ([3d68dc7](https://github.com/dbirks/cawcaw/commit/3d68dc7aa73740a94617fac72e1b80df76127c46))
* Prevent Settings title from overlapping with status bar ([68afdcc](https://github.com/dbirks/cawcaw/commit/68afdcca69b637397ea63b7ddc8326a5334a75d7))
* Reduce excessive whitespace in MCP server configuration UI ([b8a52c6](https://github.com/dbirks/cawcaw/commit/b8a52c6048e8c56fa726ed8214f43d0758d826c3))
* Reduce hamburger menu button to 26px ([deffb53](https://github.com/dbirks/cawcaw/commit/deffb53b80f9b7b97e3f69f405835d36f30023c7))
* Remove alert() that dismisses Settings modal after download ([ff562de](https://github.com/dbirks/cawcaw/commit/ff562deb6e1f33d266ed9b43cb90b7f25dc5fc86))
* Remove dual spinner from microphone button ([3283f2a](https://github.com/dbirks/cawcaw/commit/3283f2a1c9e989abafb2fe844757f26d05db186d))
* Remove duck-duck-scrape web search (Node.js-only library) ([f471678](https://github.com/dbirks/cawcaw/commit/f471678653fda04147854545bd46637d313fb26f))
* Remove duplicate text and extra separators in About section ([f6db151](https://github.com/dbirks/cawcaw/commit/f6db1516d8ea11c337d41f02f2eebc82c7ebe581))
* Remove horizontal overflow clipping in tool calls and assistant messages ([b154c20](https://github.com/dbirks/cawcaw/commit/b154c20fb7cba8bbad94d33872c36794f8099f15))
* Remove pnpm version from workflow to use packageManager field ([1ed6639](https://github.com/dbirks/cawcaw/commit/1ed6639a4b6ac8da7230fc18eb3746a5fd553727))
* Remove redundant success pop-up after OAuth redirect ([3ee373c](https://github.com/dbirks/cawcaw/commit/3ee373ca655fee6ad69100a1d05e170c479b260d))
* Remove scope parameter from OAuth refresh token requests ([518228e](https://github.com/dbirks/cawcaw/commit/518228e1417c73aa98c957858a3adac67e964ed3))
* Remove unused cache health check function from Settings ([d5d34f1](https://github.com/dbirks/cawcaw/commit/d5d34f1c94357d40a662d24e1c3ff667f99586a2))
* Reorder STT models to show recommended default first ([08ecd2a](https://github.com/dbirks/cawcaw/commit/08ecd2a4ea0e4d1e58c16d6fc2aa2f3a8bea704d))
* Request offline_access scope to enable refresh token support ([3fbc994](https://github.com/dbirks/cawcaw/commit/3fbc994e3095efb827da1f704a5819fa0821b838))
* Resolve Biome linting issues in WebSocket and ACP code ([a00ef46](https://github.com/dbirks/cawcaw/commit/a00ef46db4ee15bb824bbb19c12f046213efd7a9))
* Resolve Settings dialog stuck in Loading state ([39762f9](https://github.com/dbirks/cawcaw/commit/39762f9698e7aa4e4e447830063b4616dea20e4e))
* Resolve Settings screen performance and iOS status bar overlap issues ([81935c0](https://github.com/dbirks/cawcaw/commit/81935c0a3ae7a08ce28fcbc6e907ec3120deda80))
* Resolve TypeScript compilation errors in WebSocket client ([5d0ddf0](https://github.com/dbirks/cawcaw/commit/5d0ddf0ee5060764d22ebb9e8d3738fd007d8828))
* Restore Settings close button and shrink hamburger menu ([c69492d](https://github.com/dbirks/cawcaw/commit/c69492d7f57af862131f1f5ce1affb6fb3ce3ef3))
* Restore Settings dialog close button functionality ([163e96d](https://github.com/dbirks/cawcaw/commit/163e96db9858be4f2ebbe664437edcecc9db8a45))
* Restructure Sidebar to eliminate nested buttons and fix accessibility ([8f475cd](https://github.com/dbirks/cawcaw/commit/8f475cd0ec701c823c286cd74456ef63f8da9be3))
* Simplify Settings close button to match working back button pattern ([23a67a0](https://github.com/dbirks/cawcaw/commit/23a67a0c92b0e08c204ff49ee0a11e8776ddb37d))
* Update hardcoded model size to accurate 430 MB and ensure Settings stays open after download ([7d3052c](https://github.com/dbirks/cawcaw/commit/7d3052c2ff489e53dfe6a22e343482b70577d1a0))
* Update MCP edit dialog close button to match Settings page size ([f709dde](https://github.com/dbirks/cawcaw/commit/f709dde92d533a60a02fed51f9c3e5de87f04baf))
* Update Xcode project deployment target to iOS 15.0 for Capacitor 8 ([a1a7b63](https://github.com/dbirks/cawcaw/commit/a1a7b638dd3c8c249df36eae824c6682ebd63a32))
* Use @sentry/capacitor instead of @sentry/react in Web Worker ([e0e62f2](https://github.com/dbirks/cawcaw/commit/e0e62f2f4dc4c9e2522ca6f176b6af7ee102a240))
* Use native touch events for iOS close button compatibility ([ec94541](https://github.com/dbirks/cawcaw/commit/ec94541b8dcfd90e23d3b66eaa7f180ae2401eb0))


### Documentation

* Add async parallel subagent best practices to AGENTS.md ([ce8616a](https://github.com/dbirks/cawcaw/commit/ce8616a7f14a65694a25587f4e35cab18e3e9de9))
* Add bd (beads) issue tracking onboarding ([1603185](https://github.com/dbirks/cawcaw/commit/160318502411aba855044daef8cb06ee679250e1))
* Add browser polyfill research for util.debuglog to web search issue ([25ca846](https://github.com/dbirks/cawcaw/commit/25ca846b5ae387f821be9ce60412f3f9d0fa0919))
* Add critical guidance to always prefer async/parallel subagents ([021ac6c](https://github.com/dbirks/cawcaw/commit/021ac6cd3735cf43819d63efd01ec187388085c1))
* Add Gemma 3 270M local inference research ([ed55c5f](https://github.com/dbirks/cawcaw/commit/ed55c5fc07290c58beb7307ec52c64b5a1f2e080))
* Add WebGPU Capacitor support investigation ([f4488aa](https://github.com/dbirks/cawcaw/commit/f4488aa2f4ec6cd2f878134263f30f3eff9e304c))
* Complete A2A protocol research and testing resources ([3f5860a](https://github.com/dbirks/cawcaw/commit/3f5860aa6081dfb3595efd54fe950611516f3914))
* Complete research for A2A patterns and startup UX investigation ([20f51cb](https://github.com/dbirks/cawcaw/commit/20f51cb1db61239736a31d4d9382e5d5434713fd))
* Update Anthropic Console references to Claude Console ([160ecf4](https://github.com/dbirks/cawcaw/commit/160ecf46e6ce136871574b0a6c6ca4f8721eb333))
* Update cawcaw-wst with web search removal details ([6c10deb](https://github.com/dbirks/cawcaw/commit/6c10deb60cdb4271e3501c26dacce544bf5eac9f))
* Update web search issue with stdio MCP limitation and abandonment rationale ([7b0d281](https://github.com/dbirks/cawcaw/commit/7b0d28155fccc8bbf50e550e7ec081e57955a663))


### Styles

* Remove padding/margin for wall-to-wall message design ([e79b205](https://github.com/dbirks/cawcaw/commit/e79b205157226d275459504246c2a97d5959110f))
* Replace garish green UI colors with more subtle emerald tones ([f9ed514](https://github.com/dbirks/cawcaw/commit/f9ed51403e04830d7c9cf629a6920c0a4b68d9f8))


### Miscellaneous Chores

* Add beads issue tracking database ([d129166](https://github.com/dbirks/cawcaw/commit/d1291663eda991446e3912a566721eb490a5bbe7))
* Add issue cawcaw-ebw - tool call padding investigation ([85537e1](https://github.com/dbirks/cawcaw/commit/85537e1e568c6427d073e7bf2dcdd070c1cff2bb))
* Add new issues - Node.js version control, tool call UI fixes, MCP OAuth/whitespace cleanup, and iCloud sync research ([d95086e](https://github.com/dbirks/cawcaw/commit/d95086e274907905dedeb4ce2d699edd4806968d))
* Add new styling issue cawcaw-y4y for wall-to-wall message design ([e528f86](https://github.com/dbirks/cawcaw/commit/e528f869de6332577a9007df32899d15623ccf0c))
* **ci:** Exclude .beads directory from triggering GitHub Actions workflows ([0ee6888](https://github.com/dbirks/cawcaw/commit/0ee688877109914190d3754616ad318c374b89c7))
* Clean up beads redirect directory and add handoff skill ([171fc45](https://github.com/dbirks/cawcaw/commit/171fc45cb2711f8c681b33530aa5b92e6e656dd3))
* Close BD issue cawcaw-tgd - title generation logging complete ([ea3e061](https://github.com/dbirks/cawcaw/commit/ea3e0616cbef7e7be9ae7f161780d463caa23ddb))
* Close BD issues cawcaw-mcs and cawcaw-wst - both features complete ([6d404f0](https://github.com/dbirks/cawcaw/commit/6d404f0ca54aa112e0786f2dac4741aecd041fbd))
* Complete research on iCloud Keychain sync for API keys ([28e6c1a](https://github.com/dbirks/cawcaw/commit/28e6c1a1bc195bd46ef2e10894c7ced54226af97))
* **deps:** update dependency @vitejs/plugin-react to v5 ([#6](https://github.com/dbirks/cawcaw/issues/6)) ([1d22f23](https://github.com/dbirks/cawcaw/commit/1d22f23d730fa8f476eb0fc64a050f7456f7e236))
* Enhance beads gitignore and add session completion protocol ([2518f72](https://github.com/dbirks/cawcaw/commit/2518f722187a244f78c067a19cc48bdb04e1eea5))
* Remove crew-level beads tracking, add Gas Town ignores ([fbfebd4](https://github.com/dbirks/cawcaw/commit/fbfebd4a03cf08cd07ba6a1a7a63e5516c9de636))
* Sync bd issues after rebase ([ac0367b](https://github.com/dbirks/cawcaw/commit/ac0367bd42c04e265294a2950e9d8c24b221bc99))
* Update BD issue tracking (close cawcaw-5rr) ([3d2b3aa](https://github.com/dbirks/cawcaw/commit/3d2b3aa14cc9ccfe58ba67ab059dc1379cae0287))
* Update BD issues - Local AI download fixes completed ([05bad31](https://github.com/dbirks/cawcaw/commit/05bad3165b91de3222be87178ba8ea33447ad50b))
* Update BD issues - Settings screen fixes completed ([398dd05](https://github.com/dbirks/cawcaw/commit/398dd057e9806e90062a2ea37813bcbafec82dae))
* Update iOS deployment target to 15.0 for Capacitor 8 compatibility ([729184c](https://github.com/dbirks/cawcaw/commit/729184c3d92c026e0f1b97d7d951ecca98544945))
* Update issue status - closed cawcaw-24t and cawcaw-y4y ([7183e78](https://github.com/dbirks/cawcaw/commit/7183e7861455f0290c972e32c7de83068b21072a))
* Update issue status - closed cawcaw-9uq ([eec7514](https://github.com/dbirks/cawcaw/commit/eec7514aa68ad68a6aaa97433ba281e3f726d631))
* Update issue status - closed cawcaw-9wm ([655a5ab](https://github.com/dbirks/cawcaw/commit/655a5abc6dd9a30fb9f747b4a7876dd509869931))
* Update issue status - closed cawcaw-c01 ([6c98fea](https://github.com/dbirks/cawcaw/commit/6c98feab0229408ae3de61df310b8d7ce7882ab6))
* Update issue status - closed cawcaw-dd2 ([e410c30](https://github.com/dbirks/cawcaw/commit/e410c30e83ae8c5a56ca9350e1e3ecb71a41abd0))
* Update issue status - closed cawcaw-ebw ([d98a619](https://github.com/dbirks/cawcaw/commit/d98a619b4aed8047b8771aebaae963f22664d856))
* Update issue status - closed cawcaw-h9w ([dc67f1e](https://github.com/dbirks/cawcaw/commit/dc67f1e8322363e609e8c17d4d4ee70e24a9cdc4))
* Update issue status - closed cawcaw-idz ([b3e455f](https://github.com/dbirks/cawcaw/commit/b3e455f287d436de3474d060e354e265b584bd89))
* Update issue status - closed cawcaw-onl ([484fb26](https://github.com/dbirks/cawcaw/commit/484fb261322de7438438f00e939e0e65e3c41961))
* Update issue status - closed cawcaw-y4y ([7c41050](https://github.com/dbirks/cawcaw/commit/7c410505ddaf88a20d892e9a5ba460e3480ac40c))
* Update issue status - closed cawcaw-znf ([0f61cd5](https://github.com/dbirks/cawcaw/commit/0f61cd5d2bc8cba73275dda35816d3b1831bc10f))


### Code Refactoring

* Improve Settings UX - make Debug scrollable and move cache management to LLM Provider ([8991abd](https://github.com/dbirks/cawcaw/commit/8991abd01cc309a26cae68081c927872725b9e28))
* Move MCP server badges to vertical stack on right side ([c074ed5](https://github.com/dbirks/cawcaw/commit/c074ed576a08c92da3334a60273a39025c59c841))
* Remove MCP quick setup and improve dialog close buttons ([aae095b](https://github.com/dbirks/cawcaw/commit/aae095be6594611fb185c4cc77aa43b6b6bba3f3))
* Simplify ACPAgentClient to use WebSocket-only transport ([0b4eb13](https://github.com/dbirks/cawcaw/commit/0b4eb130d103231e5725d339dc93e44c71125890))


### Continuous Integration

* Update Node version to 22 for Capacitor 8 compatibility ([9646a13](https://github.com/dbirks/cawcaw/commit/9646a13195d598f9a03102adb9a67fadb6d347f7))

## [0.1.4](https://github.com/dbirks/cawcaw/compare/v0.1.3...v0.1.4) (2025-11-11)


### Bug Fixes

* Make chat auto-scroll to bottom when new messages arrive ([950e2ee](https://github.com/dbirks/cawcaw/commit/950e2ee3e8bc7f83c2eee989df078f76842032b3))
* Prevent voice recording from stopping after 10-15 seconds ([562cbe7](https://github.com/dbirks/cawcaw/commit/562cbe769ea47832239b34f25df94968cc91be84))


### Documentation

* Add Apple TestFlight upload rate limit to common issues ([ecbed27](https://github.com/dbirks/cawcaw/commit/ecbed27814dab00e9e277e4219ec59ec20102b29))

## [0.1.3](https://github.com/dbirks/cawcaw/compare/v0.1.2...v0.1.3) (2025-11-10)


### Bug Fixes

* Add beta app description for external TestFlight distribution ([64e5199](https://github.com/dbirks/cawcaw/commit/64e5199e4f51e04e2f0a6dd953e970b67bf2bfbc))


### Documentation

* Consolidate documentation into AGENTS.md ([2528dfa](https://github.com/dbirks/cawcaw/commit/2528dfa69e675e724cf023e8dc2c56f3c6f2bc4e))

## [0.1.2](https://github.com/dbirks/cawcaw/compare/v0.1.1...v0.1.2) (2025-11-10)


### Bug Fixes

* Enable external TestFlight distribution for tagged releases ([6a41ebf](https://github.com/dbirks/cawcaw/commit/6a41ebf0b600c38996809cb1ba0fcd42a120d1fc))

## [0.1.1](https://github.com/dbirks/cawcaw/compare/v0.1.0...v0.1.1) (2025-11-10)


### Bug Fixes

* Add seconds to build number to prevent collisions ([5cdb160](https://github.com/dbirks/cawcaw/commit/5cdb1607f0751429eea9884d6f8efe4fa200fd41))
* **deps:** pin dependencies ([#20](https://github.com/dbirks/cawcaw/issues/20)) ([0aafcd2](https://github.com/dbirks/cawcaw/commit/0aafcd26f0bbe008af136f66077e7d9bf030863c))
* **deps:** pin dependencies ([#21](https://github.com/dbirks/cawcaw/issues/21)) ([ffcd20d](https://github.com/dbirks/cawcaw/commit/ffcd20d1ee7b9984f87a333591ac7d3e20dc942f))


### Documentation

* Overhaul README with focus on technical accuracy ([8e89097](https://github.com/dbirks/cawcaw/commit/8e890979cd466c204f7d966780f98171572460ec))
* Simplify README installation and title ([e9a4fb3](https://github.com/dbirks/cawcaw/commit/e9a4fb3c081b70d222261057eeb5cb596fb3fc90))
* Trim down changelog for the initial release ([4f5daf4](https://github.com/dbirks/cawcaw/commit/4f5daf4315aaa91655f6672496b0fe4ec651933a))


### Miscellaneous Chores

* **config:** migrate Renovate config ([#23](https://github.com/dbirks/cawcaw/issues/23)) ([0090c4d](https://github.com/dbirks/cawcaw/commit/0090c4d6644d77e6184186f8da9ab4b4c055681c))
* **deps:** lock file maintenance ([#10](https://github.com/dbirks/cawcaw/issues/10)) ([1fd3603](https://github.com/dbirks/cawcaw/commit/1fd3603efb2563ffafe094ef10f12009224cf0a3))
* **deps:** pin dependencies ([#19](https://github.com/dbirks/cawcaw/issues/19)) ([bb323aa](https://github.com/dbirks/cawcaw/commit/bb323aa6a70a9b6f0b6854a36d04ad50a083eca7))
* Update Gemfile.lock for exact fastlane version ([cf511ef](https://github.com/dbirks/cawcaw/commit/cf511efe16e1654cdb1889516ac78ec748c4fb69))

## 0.1.0 (2025-11-10)

Initial release
