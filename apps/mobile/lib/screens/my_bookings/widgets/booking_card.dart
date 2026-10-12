import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/booking.dart';
import '../../../widgets/app_badge.dart';
import 'qr_sheet.dart';

class BookingCard extends StatelessWidget {
  const BookingCard({
    super.key,
    required this.booking,
    this.showQr = false,
    this.onCancel,
  });

  final Booking booking;
  final bool showQr;
  final VoidCallback? onCancel;

  static final _dtFmt = DateFormat('EEE d MMM · HH:mm', 'es');

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        booking.resourceName,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _dtFmt.format(booking.slotStartsAt),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: cs.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
                _statusBadge(booking.status),
              ],
            ),

            // ── Add-ons ──────────────────────────────────────
            if (booking.addons.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: booking.addons
                    .map((a) => AppBadge(
                          label: a.type.label,
                          variant: AppBadgeVariant.muted,
                        ))
                    .toList(),
              ),
            ],

            // ── Guest note ────────────────────────────────────
            if (booking.isGuestBooking && booking.guestName != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.person_outline,
                      size: 14, color: cs.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(
                    'Invitado: ${booking.guestName}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ],

            // ── Actions ──────────────────────────────────────
            if (showQr || onCancel != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (showQr &&
                      booking.status == BookingStatus.confirmed) ...[
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 36),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      onPressed: () => _showQr(context),
                      icon: const Icon(Icons.qr_code, size: 16),
                      label: const Text('Ver QR'),
                    ),
                    const SizedBox(width: 8),
                  ],
                  if (onCancel != null)
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 36),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        foregroundColor: cs.error,
                        side: BorderSide(color: cs.error),
                      ),
                      onPressed: onCancel,
                      icon: const Icon(Icons.cancel_outlined, size: 16),
                      label: const Text('Cancelar'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showQr(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => QrSheet(bookingId: booking.id),
    );
  }

  static Widget _statusBadge(BookingStatus status) {
    final (label, variant) = switch (status) {
      BookingStatus.confirmed       => ('Confirmada',  AppBadgeVariant.success),
      BookingStatus.pendingApproval => ('Pendiente',   AppBadgeVariant.warning),
      BookingStatus.checkedIn       => ('Registrado',  AppBadgeVariant.info),
      BookingStatus.cancelled       => ('Cancelada',   AppBadgeVariant.muted),
      BookingStatus.noShow          => ('No asistió',  AppBadgeVariant.danger),
    };
    return AppBadge(label: label, variant: variant);
  }
}
