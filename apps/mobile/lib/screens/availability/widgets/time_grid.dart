import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/slot.dart';

/// Scrollable grid of hour slots for a single resource + date.
class TimeGrid extends StatelessWidget {
  const TimeGrid({
    super.key,
    required this.slots,
    required this.onSlotTapped,
  });

  final List<Slot> slots;
  final ValueChanged<Slot> onSlotTapped;

  static final _timeFmt = DateFormat('HH:mm');

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) {
      return const Center(
        child: Text('Sin horarios disponibles para este día.'),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: slots.length,
      itemBuilder: (context, i) {
        final slot = slots[i];
        return _SlotTile(slot: slot, onTap: () => onSlotTapped(slot));
      },
    );
  }
}

class _SlotTile extends StatelessWidget {
  const _SlotTile({required this.slot, required this.onTap});

  final Slot slot;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final available = slot.isAvailable;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: available ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: available ? cs.primary : cs.outlineVariant,
              width: available ? 1.5 : 1,
            ),
            color: available
                ? cs.primaryContainer.withAlpha(60)
                : cs.surfaceContainerHighest,
          ),
          child: Row(
            children: [
              Text(
                TimeGrid._timeFmt.format(slot.startsAt),
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: available ? cs.primary : cs.onSurfaceVariant,
                    ),
              ),
              const SizedBox(width: 8),
              Text(
                '– ${TimeGrid._timeFmt.format(slot.endsAt)}',
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: cs.onSurfaceVariant),
              ),
              const Spacer(),
              if (available)
                FilledButton.tonal(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(80, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  onPressed: onTap,
                  child: const Text('Reservar'),
                )
              else
                Text(
                  slot.status == SlotStatus.blocked ? 'Bloqueado' : 'Ocupado',
                  style: TextStyle(
                    fontSize: 12,
                    color: cs.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
