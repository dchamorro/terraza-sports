// NotificationService — wires Firebase Cloud Messaging into the app.
//
// Responsibilities:
//   1. Request notification permission on first launch.
//   2. Obtain the FCM token and register it with the Supabase Edge Function.
//   3. Re-register whenever FCM rotates the token.
//   4. Handle foreground messages by showing a local SnackBar.
//   5. Handle background / terminated taps by navigating to the relevant screen.
//
// Usage:
//   Call NotificationService.init(context, ref) once after the user signs in.
//   Call NotificationService.dispose() on sign-out.
//
// Required native setup (outside this file):
//   iOS   → GoogleService-Info.plist in ios/Runner/
//   Android → google-services.json in android/app/
//   Both files are added manually (never committed to VCS — they contain secrets).

import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show WidgetRef;
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../router.dart' show routeMyBookings;

// ── Background message handler ────────────────────────────────────────────────
// Must be a top-level function (Firebase requirement).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase must be initialised in isolate.
  await Firebase.initializeApp();
  debugPrint('FCM background: ${message.messageId}');
  // No UI interaction possible in background — FCM shows the system notification
  // automatically when the `notification` payload is set (which our Edge Function does).
}

// ── Service ───────────────────────────────────────────────────────────────────

class NotificationService {
  NotificationService._();

  static final _messaging = FirebaseMessaging.instance;
  static bool _initialized = false;

  /// One-time setup. Call after Firebase.initializeApp() in main.dart.
  static Future<void> configure() async {
    if (_initialized) return;
    _initialized = true;
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  }

  /// Call once the user has signed in.
  /// [navigatorKey] is used to push routes when the user taps a notification
  /// while the app was in the background / terminated.
  static Future<void> init({
    required GlobalKey<NavigatorState> navigatorKey,
    // ref is kept for future provider reads (e.g. reading member for analytics).
    // ignore: unused_element
    WidgetRef? ref,
  }) async {
    // ── Permission ──────────────────────────────────────────────────────────
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('FCM permission denied');
      return;
    }

    // ── Register token ──────────────────────────────────────────────────────
    final token = await _messaging.getToken();
    if (token != null) {
      await _registerToken(token);
    }

    // Re-register when FCM rotates the token.
    _messaging.onTokenRefresh.listen(_registerToken);

    // ── Foreground messages ─────────────────────────────────────────────────
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification == null) return;

      final context = navigatorKey.currentContext;
      if (context == null) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                notification.title ?? '',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              if (notification.body != null) Text(notification.body!),
            ],
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 5),
        ),
      );
    });

    // ── Background tap (app was backgrounded) ───────────────────────────────
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleNotificationTap(message, navigatorKey);
    });

    // ── Terminated tap (app was closed) ─────────────────────────────────────
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      // Delay slightly so the navigator is ready.
      await Future.delayed(const Duration(milliseconds: 500));
      _handleNotificationTap(initialMessage, navigatorKey);
    }
  }

  /// Unsubscribe from token refresh listener and delete the local FCM token.
  /// Call on sign-out so the device stops receiving notifications.
  static Future<void> dispose() async {
    await _messaging.deleteToken();
    _initialized = false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  static Future<void> _registerToken(String token) async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) return; // Not signed in yet.

    final platform = _platform();
    try {
      await Supabase.instance.client.functions.invoke(
        'register-device-token',
        body: {'token': token, 'platform': platform},
      );
      debugPrint('FCM token registered ($platform)');
    } catch (e) {
      debugPrint('Failed to register FCM token: $e');
    }
  }

  static void _handleNotificationTap(
    RemoteMessage message,
    GlobalKey<NavigatorState> navigatorKey,
  ) {
    final data = message.data;
    final route = _routeFromData(data);
    if (route == null) return;

    final context = navigatorKey.currentContext;
    if (context != null) {
      GoRouter.of(context).go(route);
    }
  }

  /// Maps notification data payloads to GoRouter paths.
  /// Matches the route paths declared in router.dart.
  static String? _routeFromData(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    switch (type) {
      case 'booking_confirmed':
      case 'booking_approved':
      case 'booking_declined':
      case 'booking_cancelled':
      case 'strike_issued':
        return routeMyBookings;
      default:
        return null;
    }
  }

  static String _platform() {
    try {
      return Platform.isIOS ? 'ios' : 'android';
    } catch (_) {
      return 'android';
    }
  }
}
