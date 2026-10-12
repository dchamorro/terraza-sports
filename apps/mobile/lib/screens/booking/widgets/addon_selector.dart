import 'package:flutter/material.dart';

import '../../../models/booking.dart';
import '../../../models/price_item.dart';

/// Step 1 — toggle add-ons, showing price and eligibility.
class AddonSelector extends StatelessWidget {
  const AddonSelector({
    super.key,
    required this.isTennis,
    required this.isAfter17,
    required this.isWithin12h,
    required this.selected,
    required this.prices,
    required this.onToggle,
  });

  final bool isTennis;
  final bool isAfter17;
  final bool isWithin12h;
  final Set<AddonType> selected;
  final Map<String, PriceItem> prices;
  final ValueChanged<AddonType> onToggle;

  @override
  Widget build(BuildContext context) {
    final addons = _buildOptions();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Servicios adicionales',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 4),
        Text(
          'Todos los precios incluyen impuestos.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 16),
        ...addons.map((opt) => _AddonTile(
              option: opt,
              isSelected: selected.contains(opt.type),
              onToggle: opt.enabled ? () => onToggle(opt.type) : null,
            )),
      ],
    );
  }

  List<_AddonOption> _buildOptions() {
    return [
      _AddonOption(
        type: AddonType.equipmentRental,
        price: prices['equipment_rental'],
        enabled: true,
      ),
      _AddonOption(
        type: AddonType.lesson,
        price: prices['lesson'],
        enabled: true, // provider availability checked server-side
      ),
      _AddonOption(
        type: AddonType.sparring,
        price: prices['sparring'],
        enabled: isWithin12h,
        disabledReason: 'Solo disponible dentro de las 12 h previas.',
      ),
      _AddonOption(
        type: AddonType.courtLights,
        price: prices['court_lights'],
        enabled: isTennis && isAfter17,
        disabledReason: !isTennis
            ? 'Solo para canchas de tenis.'
            : 'Solo disponible desde las 17:00.',
      ),
    ];
  }
}

class _AddonOption {
  const _AddonOption({
    required this.type,
    required this.enabled,
    this.price,
    this.disabledReason,
  });
  final AddonType type;
  final PriceItem? price;
  final bool enabled;
  final String? disabledReason;
}

class _AddonTile extends StatelessWidget {
  const _AddonTile({
    required this.option,
    required this.isSelected,
    required this.onToggle,
  });

  final _AddonOption option;
  final bool isSelected;
  final VoidCallback? onToggle;

  static final _nioFmt = RegExp(r'(\d)(?=(\d{3})+(?!\d))');

  String _formatNio(double price) {
    final s = price.toStringAsFixed(2);
    return 'C\$ ${s.replaceAllMapped(_nioFmt, (m) => '${m[1]},')}';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final enabled = onToggle != null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onToggle,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? cs.primary : cs.outlineVariant,
              width: isSelected ? 1.5 : 1,
            ),
            color: isSelected
                ? cs.primaryContainer.withAlpha(80)
                : enabled
                    ? null
                    : cs.surfaceContainerHighest,
          ),
          child: Row(
            children: [
              Checkbox(
                value: isSelected,
                onChanged: enabled ? (_) => onToggle!() : null,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.type.label,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: enabled ? null : cs.onSurfaceVariant,
                      ),
                    ),
                    if (!enabled && option.disabledReason != null)
                      Text(
                        option.disabledReason!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: cs.onSurfaceVariant,
                            ),
                      ),
                  ],
                ),
              ),
              if (option.price != null)
                Text(
                  _formatNio(option.price!.priceNio),
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: enabled ? cs.primary : cs.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
