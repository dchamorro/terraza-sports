import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../models/slot.dart';
import '../../providers/slot_provider.dart';
import '../../router.dart';
import '../../widgets/error_view.dart';
import 'widgets/resource_picker.dart';
import 'widgets/time_grid.dart';

class AvailabilityScreen extends ConsumerStatefulWidget {
  const AvailabilityScreen({super.key});

  @override
  ConsumerState<AvailabilityScreen> createState() => _AvailabilityScreenState();
}

class _AvailabilityScreenState extends ConsumerState<AvailabilityScreen> {
  DateTime _selectedDate = DateTime.now();
  String? _selectedResourceId;
  String? _selectedResourceName;
  String? _selectedResourceType;

  void _previousDay() {
    final yesterday = _selectedDate.subtract(const Duration(days: 1));
    if (yesterday.isBefore(DateTime.now().subtract(const Duration(days: 1)))) return;
    setState(() => _selectedDate = yesterday);
  }

  void _nextDay() {
    final tomorrow = _selectedDate.add(const Duration(days: 1));
    final limit = DateTime.now().add(const Duration(days: 7));
    if (tomorrow.isAfter(limit)) return;
    setState(() => _selectedDate = tomorrow);
  }

  void _onSlotTapped(Slot slot) {
    if (!slot.isAvailable) return;
    context.push(
      routeBookingFlow,
      extra: {
        'slot_id': slot.id,
        'resource_name': _selectedResourceName ?? '',
        'resource_type': _selectedResourceType ?? '',
        'starts_at': slot.startsAt,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reservar'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today_outlined),
            tooltip: 'Elegir fecha',
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 7)),
              );
              if (picked != null) setState(() => _selectedDate = picked);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Resource picker ──────────────────────────────────
          ResourcePicker(
            selectedId: _selectedResourceId,
            onSelected: (r) => setState(() {
              _selectedResourceId   = r.id;
              _selectedResourceName = r.name;
              _selectedResourceType = r.type.name;
            }),
          ),

          // ── Date navigator ───────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: _previousDay,
                ),
                Text(
                  DateFormat('EEEE d MMMM', 'es').format(_selectedDate),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: _nextDay,
                ),
              ],
            ),
          ),

          // ── Time grid ────────────────────────────────────────
          Expanded(
            child: _selectedResourceId == null
                ? const Center(
                    child: Text(
                      'Selecciona una cancha o pista',
                      style: TextStyle(color: Colors.grey),
                    ),
                  )
                : _TimeGridLoader(
                    resourceId: _selectedResourceId!,
                    date: _selectedDate,
                    onSlotTapped: _onSlotTapped,
                  ),
          ),
        ],
      ),
    );
  }
}

class _TimeGridLoader extends ConsumerWidget {
  const _TimeGridLoader({
    required this.resourceId,
    required this.date,
    required this.onSlotTapped,
  });

  final String resourceId;
  final DateTime date;
  final ValueChanged<Slot> onSlotTapped;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slotsAsync = ref.watch(
      slotsProvider((resourceId: resourceId, date: date)),
    );

    return slotsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorView(
        message: 'No se pudo cargar la disponibilidad.',
        onRetry: () => ref.invalidate(
          slotsProvider((resourceId: resourceId, date: date)),
        ),
      ),
      data: (slots) => TimeGrid(slots: slots, onSlotTapped: onSlotTapped),
    );
  }
}
