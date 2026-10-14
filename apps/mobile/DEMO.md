# Demoing Terraza Sports

There are two ways to demo the app:

- **TestFlight:** the real app installed on an iPhone.
- **Web link:** the same Flutter app in a browser, for anyone who isn't on an iPhone.

Both builds read the backend settings from `.env.demo`. Copy `.env.demo.example` and fill in the values. The file is gitignored.

> The anon key is meant to be public (RLS protects the data), so it is fine for it to end up inside the web bundle and the app binary.

---

## 1. Backend (one-time)

1. Link and migrate the hosted project:
   ```sh
   supabase link --project-ref <ref>
   supabase db push
   ```
2. In the SQL editor, run `supabase/seed.sql` and then `supabase/demo_data.sql`.
3. Create a demo login under Authentication → Users, for example `demo@terrazasports.com`. Then link it to a member row (see the comments at the end of `seed.sql`):
   ```sql
   update members set auth_user_id = '<auth user uuid>' where email = '<member email>';
   ```
4. Set the function secrets and deploy the functions:
   ```sh
   supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" \
     RESEND_API_KEY=… EMAIL_FROM=… ADMIN_EMAIL=… ADMIN_URL=… \
     EMAIL_ACTION_SECRET=… GUEST_VIEW_URL=… BAC_WEBHOOK_SECRET=…
   supabase functions deploy
   ```

## 2. Web link

```sh
cd apps/mobile
flutter build web --release --dart-define-from-file=.env.demo
cp vercel.json build/web/
vercel deploy build/web --prod
```

The first deploy asks you to create a project. Name it `terraza-sports-demo` so it stays separate from the admin app.

Then add the resulting URL under Supabase → Authentication → URL Configuration.

Push notifications are turned off on web. Everything else works.

## 3. TestFlight (iPhone)

Bundle ID: **`com.terrazasports.app`**

### One-time Apple setup
1. Enroll at <https://developer.apple.com/programs/> ($99/yr). Approval can take 1–2 days.
2. Go to Certificates, Identifiers & Profiles → Identifiers → `+`. Register the App ID `com.terrazasports.app` and tick **Push Notifications**.
3. Go to Keys → `+` and create an APNs key. Download the `.p8` file and note the Key ID and your Team ID.
4. In App Store Connect, go to Apps → `+` and create a new app with bundle ID `com.terrazasports.app`.

### One-time Firebase setup (push)
1. Create a Firebase project and add an **iOS app** with bundle ID `com.terrazasports.app`.
2. Download `GoogleService-Info.plist` to `apps/mobile/ios/Runner/` (gitignored).
3. In Xcode, drag the file into the `Runner` group and tick "Copy items if needed" and the Runner target. If you skip this step, the app still runs but push stays off.
4. Go to Project settings → Cloud Messaging → Apple app configuration and upload the `.p8` APNs key.
5. Go to Project settings → Service accounts → Generate new private key. That file is the `FIREBASE_SERVICE_ACCOUNT_JSON` secret from step 1.4.

### Build and upload (on a Mac with Xcode)
```sh
cd apps/mobile
flutter pub get
open ios/Runner.xcworkspace   # Signing & Capabilities → pick your Team (first time only)
flutter build ipa --release --dart-define-from-file=.env.demo
```

Upload `build/ios/ipa/*.ipa` with Apple's **Transporter** app.

Bump `version:` in `pubspec.yaml` before each new upload. The `+N` build number must always go up.

### Share it
In App Store Connect → TestFlight:
- **Internal testing:** add yourself and your team (up to 100). Builds are available right away.
- **External testing:** create a group and turn on the **public link**. Anyone with the link can install it (up to 10,000 people). The first build needs a short beta review.

Builds expire after 90 days, so upload a fresh one before a big demo.

## 4. Backup

Record a 60–90 s run-through with the iPhone's built-in screen recorder and keep it on your phone. Use it when there's no signal or the backend is down.
