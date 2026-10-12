import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/availability/availability_screen.dart';
import 'screens/booking/booking_flow_screen.dart';
import 'screens/my_bookings/my_bookings_screen.dart';

// Route names
const String routeLogin        = '/login';
const String routeHome         = '/';
const String routeAvailability = '/availability';
const String routeBookingFlow  = '/book';
const String routeMyBookings   = '/my-bookings';

final routerProvider = Provider<GoRouter>((ref) {
  // Listenable that rebuilds the redirect when auth state changes.
  final notifier = _AuthNotifier(ref);

  return GoRouter(
    initialLocation: routeHome,
    refreshListenable: notifier,
    redirect: (context, state) {
      final isAuthenticated = notifier.isAuthenticated;
      final isLoginRoute = state.matchedLocation == routeLogin;

      if (!isAuthenticated && !isLoginRoute) return routeLogin;
      if (isAuthenticated && isLoginRoute) return routeHome;
      return null;
    },
    routes: [
      GoRoute(
        path: routeLogin,
        builder: (_, __) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => HomeScreen(child: child),
        routes: [
          GoRoute(
            path: routeHome,
            builder: (_, __) => const AvailabilityScreen(),
          ),
          GoRoute(
            path: routeAvailability,
            builder: (_, __) => const AvailabilityScreen(),
          ),
          GoRoute(
            path: routeMyBookings,
            builder: (_, __) => const MyBookingsScreen(),
          ),
        ],
      ),
      // Full-screen booking flow — outside the shell (no bottom nav).
      GoRoute(
        path: routeBookingFlow,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          return BookingFlowScreen(
            slotId: extra['slot_id'] as String,
            resourceName: extra['resource_name'] as String,
            resourceType: extra['resource_type'] as String,
            startsAt: extra['starts_at'] as DateTime,
          );
        },
      ),
    ],
  );
});

/// ChangeNotifier that watches the Supabase auth session and notifies
/// go_router's [refreshListenable] when authentication state changes.
class _AuthNotifier extends ChangeNotifier {
  _AuthNotifier(this._ref) {
    _ref.listen(authSessionProvider, (_, next) {
      _isAuthenticated = next.valueOrNull != null;
      notifyListeners();
    });
    // Seed the initial state synchronously from the cached value.
    _isAuthenticated =
        _ref.read(authSessionProvider).valueOrNull != null;
  }

  final Ref _ref;
  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;
}
