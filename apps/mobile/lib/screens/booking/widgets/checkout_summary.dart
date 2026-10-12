import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/booking.dart';
import '../../../models/price_item.dart';

/// Step 3 — order summary before payment confirmation.
class CheckoutSummary extends StatelessWidget {
  const CheckoutSummary({
    super.key,
    required this.resourceName,
    required this.startsAt,
    required this.addons,
    required this.isGuestBooking,
    required this.guestName,
    required this.prices,
    this.error,
  });

  final String resourceName;
  final DateTime startsAt;
  final Set<AddonType> addons;
  final bool isGuestBooking;
  final String guestName;
  final Map<String, PriceItem> prices;
  final String? error;

  static final _dtFmt = DateFormat('EEEE d MMMM · HH:mm', 'es');

  String _formatNio(double v) => 'C\$ ${v.toStringAsFixed(2)}';

  double get _total {
    final courtKey = resourceName.toLowerCase().contains('boliche')
        ? 'bowling_lane'
        : 'tennis_court';
    double total = prices[courtKey]?.priceNio ?? 0;
    for (final a in addons) {
      total += prices[a.apiKey]?.priceNio ?? 0;
    }
    return total;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final courtKey = resourceName.toLowerCase().contains('boliche')
        ? 'bowling_lane'
        : 'tennis_court';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Resumen del pedido',
              style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 16),

          // ── Line items ──────────────────────────────────────
          _LineItem(
            label: resourceName,
            sublabel: _dtFmt.format(startsAt),
            price: prices[courtKey]?.priceNio ?? 0,
          ),
          ...addons.map((a) => _LineItem(
                label: a.label,
                price: prices[a.apiKey]?.priceNio ?? 0,
              )),
          if (isGuestBooking)
            _LineItem(label: 'Invitado: $guestName', price: 0),

          const Divider(height: 24),

          // ── Total ──────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              Text(
                _formatNio(_total),
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: cs.primary,
                    ),
              ),
            ],
          ),

          if (isGuestBooking) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cs.tertiaryContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline,
                      color: cs.onTertiaryContainer, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Esta reservación requiere aprobación del administrador.',
                      style: TextStyle(
                          color: cs.onTertiaryContainer, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ── Payment note ───────────────────────────────────
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cs.surfaceContainerLow,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Icon(Icons.credit_card_outlined,
                    color: cs.onSurfaceVariant, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'El pago se procesará a través de BAC Credomatic (NIO).',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),

          if (error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cs.errorContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(error!,
                  style: TextStyle(color: cs.onErrorContainer)),
            ),
          ],
        ],
      ),
    );
  }
}

class _LineItem extends StatelessWidget {
  const _LineItem({
    required this.label,
    required this.price,
    this.sublabel,
  });

  final String label;
  final String? sublabel;
  final double price;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                if (sublabel != null)
                  Text(sublabel!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurfaceVariant,
                          )),
              ],
            ),
          ),
          Text(
            price > 0 ? 'C\$ ${price.toStringAsFixed(2)}' : '',
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
