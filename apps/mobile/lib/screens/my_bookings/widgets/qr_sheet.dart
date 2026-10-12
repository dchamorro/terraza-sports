import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// Bottom sheet that displays the QR code for check-in.
/// The QR data is the booking UUID — scanned by the front-desk scanner.
class QrSheet extends StatelessWidget {
  const QrSheet({super.key, required this.bookingId});

  final String bookingId;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: cs.outlineVariant,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Text(
            'Check-in QR',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'Muestra este código en recepción o escanéalo en la entrada.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: cs.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cs.outlineVariant),
            ),
            child: QrImageView(
              data: bookingId,
              version: QrVersions.auto,
              size: 220,
              backgroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            bookingId.substring(0, 8).toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  letterSpacing: 2,
                  color: cs.onSurfaceVariant,
                  fontFamily: 'monospace',
                ),
          ),
        ],
      ),
    );
  }
}
