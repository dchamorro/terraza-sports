import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/booking.dart';
import '../../providers/booking_provider.dart';
import '../../widgets/error_view.dart';
import 'widgets/booking_card.dart';

class MyBookingsScreen extends ConsumerWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeAsync  = ref.watch(activeBookingProvider);
    final historyAsync = ref.watch(bookingHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mis reservaciones')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(activeBookingProvider);
          ref.invalidate(bookingHistoryProvider);
        },
        child: CustomScrollView(
          slivers: [
            // ── Active booking ─────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                child: Text(
                  'Reservación activa',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: activeAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => ErrorView(
                  message: 'No se pudo cargar la reservación activa.',
                  onRetry: () => ref.invalidate(activeBookingProvider),
                ),
                data: (booking) => booking == null
                    ? const Padding(
                        padding: EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        child: Text(
                          'No tienes reservaciones activas.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    : Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: BookingCard(
                          booking: booking,
                          showQr: true,
                          onCancel: booking.canCancel
                              ? () => _confirmCancel(context, ref, booking)
                              : null,
                        ),
                      ),
              ),
            ),

            // ── History ────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
                child: Text(
                  'Historial',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
            ),
            historyAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: ErrorView(
                  message: 'No se pudo cargar el historial.',
                  onRetry: () => ref.invalidate(bookingHistoryProvider),
                ),
              ),
              data: (history) => SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList.separated(
                  itemCount: history.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => BookingCard(
                    booking: history[i],
                    showQr: false,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmCancel(
    BuildContext context,
    WidgetRef ref,
    Booking booking,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancelar reservación'),
        content: const Text(
          '¿Estás seguro? Si usaste tus 2 cancelaciones gratuitas este mes, no habrá reembolso.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Volver'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancelar reservación'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await cancelBooking(ref, booking.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}
