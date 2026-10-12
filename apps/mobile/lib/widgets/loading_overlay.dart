import 'package:flutter/material.dart';

/// Full-screen loading overlay — wraps [child] and shows a
/// translucent scrim with a spinner when [loading] is true.
class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({
    super.key,
    required this.loading,
    required this.child,
  });

  final bool loading;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (loading)
          const Positioned.fill(
            child: ColoredBox(
              color: Color(0x80000000),
              child: Center(
                child: CircularProgressIndicator(),
              ),
            ),
          ),
      ],
    );
  }
}
