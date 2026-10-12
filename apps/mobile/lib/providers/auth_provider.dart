import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/supabase.dart';
import '../main.dart' show navigatorKey;
import '../models/member.dart';
import '../services/notification_service.dart';

// ─── Auth session stream ──────────────────────────────────────────────────────

/// Emits the current Supabase [Session] (or null when signed out).
final authSessionProvider = StreamProvider<Session?>((ref) {
  return supabase.auth.onAuthStateChange.map((event) => event.session);
});

// ─── Current Member ───────────────────────────────────────────────────────────

/// Resolves the [Member] row for the signed-in auth user.
/// Returns null when unauthenticated or the row hasn't loaded yet.
final currentMemberProvider = FutureProvider<Member?>((ref) async {
  final session = await ref.watch(authSessionProvider.future);
  if (session == null) return null;

  final data = await supabase
      .from('members')
      .select(
        'id, household_id, full_name, email, age_tier, role, '
        'is_dependent, parent_id, date_of_birth',
      )
      .eq('auth_user_id', session.user.id)
      .single();

  return Member.fromJson(data);
});

// ─── Auth actions ─────────────────────────────────────────────────────────────

final authProvider = Provider<AuthActions>((ref) => AuthActions(ref));

class AuthActions {
  AuthActions(this._ref);
  final Ref _ref;

  Future<void> signIn({required String email, required String password}) async {
    await supabase.auth.signInWithPassword(email: email, password: password);
    // Invalidate cached member so it re-fetches after login.
    _ref.invalidate(currentMemberProvider);
    // Register FCM token now that a session exists.
    await NotificationService.init(navigatorKey: navigatorKey);
  }

  Future<void> signOut() async {
    // Delete the FCM token before clearing the session.
    await NotificationService.dispose();
    await supabase.auth.signOut();
    _ref.invalidate(currentMemberProvider);
  }
}
