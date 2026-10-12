# Flutter for mobile, Riverpod for state management

A single Flutter codebase targets both iOS and Android, keeping mobile logic unified while the web admin panel lives in a separate Next.js app. Riverpod was chosen over BLoC and Provider because it is compile-safe (no runtime type errors from context lookups), handles async Supabase stream subscriptions cleanly with AsyncNotifier, and scales to the app's complexity (multiple auth tiers, real-time slot updates, add-on state in checkout) without the boilerplate overhead of BLoC.
