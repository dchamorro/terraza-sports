import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../router.dart';

/// Shell that wraps authenticated routes with a bottom navigation bar.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.child});

  final Widget child;

  static const _tabs = [
    _Tab(label: 'Reservar',    icon: Icons.sports_tennis, route: routeHome),
    _Tab(label: 'Mis reservas', icon: Icons.calendar_month, route: routeMyBookings),
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _tabs.indexWhere(
      (t) => location == t.route || location.startsWith(t.route),
    );

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex < 0 ? 0 : currentIndex,
        onDestinationSelected: (i) => context.go(_tabs[i].route),
        destinations: _tabs
            .map(
              (t) => NavigationDestination(
                icon: Icon(t.icon),
                label: t.label,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _Tab {
  const _Tab({
    required this.label,
    required this.icon,
    required this.route,
  });
  final String label;
  final IconData icon;
  final String route;
}
