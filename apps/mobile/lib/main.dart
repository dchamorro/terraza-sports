import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'router.dart';
import 'services/notification_service.dart';
import 'theme.dart';

/// Global navigator key — passed to GoRouter and NotificationService so both
/// can navigate without a BuildContext.
final navigatorKey = GlobalKey<NavigatorState>();

/// True once Firebase initialised. Stays false on web (no FCM there) and on
/// iOS builds without GoogleService-Info.plist, so the app still runs for demos.
bool firebaseReady = false;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase must be initialised before anything that uses FCM.
  if (!kIsWeb) {
    try {
      await Firebase.initializeApp();
      await NotificationService.configure();
      firebaseReady = true;
    } catch (e) {
      debugPrint('Firebase unavailable, push disabled: $e');
    }
  }

  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
    authOptions: FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  runApp(const ProviderScope(child: TerrazaSportsApp()));
}

class TerrazaSportsApp extends ConsumerWidget {
  const TerrazaSportsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Terraza Sports',
      theme: buildAppTheme(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
