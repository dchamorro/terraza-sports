import 'package:flutter/material.dart';

enum AppBadgeVariant { success, warning, danger, muted, info }

/// Small coloured chip — mirrors the admin panel Badge component.
class AppBadge extends StatelessWidget {
  const AppBadge({
    super.key,
    required this.label,
    this.variant = AppBadgeVariant.info,
  });

  final String label;
  final AppBadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }

  (Color, Color) _colors(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return switch (variant) {
      AppBadgeVariant.success => (const Color(0xFFDCFCE7), const Color(0xFF15803D)),
      AppBadgeVariant.warning => (const Color(0xFFFEF9C3), const Color(0xFF854D0E)),
      AppBadgeVariant.danger  => (cs.errorContainer, cs.onErrorContainer),
      AppBadgeVariant.muted   => (cs.surfaceContainerHighest, cs.onSurfaceVariant),
      AppBadgeVariant.info    => (cs.primaryContainer, cs.onPrimaryContainer),
    };
  }
}
