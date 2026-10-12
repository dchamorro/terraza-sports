import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/supabase.dart';
import '../models/slot.dart';

// ─── Resources ────────────────────────────────────────────────────────────────

final resourcesProvider = FutureProvider<List<Resource>>((ref) async {
  final data = await supabase
      .from('resources')
      .select('id, name, resource_type')
      .eq('is_active', true)
      .order('name');
  return (data as List).map((r) => Resource.fromJson(r as Map<String, dynamic>)).toList();
});

// ─── Slots for a resource on a given date ─────────────────────────────────────

final slotsProvider = FutureProvider.family<List<Slot>, ({String resourceId, DateTime date})>(
  (ref, params) async {
    // Day window in UTC (Managua is UTC-6).
    final localMidnight = DateTime(params.date.year, params.date.month, params.date.day);
    final utcStart = localMidnight.toUtc();
    final utcEnd = localMidnight.add(const Duration(days: 1)).toUtc();

    final data = await supabase
        .from('slots')
        .select('id, resource_id, starts_at, ends_at, status')
        .eq('resource_id', params.resourceId)
        .gte('starts_at', utcStart.toIso8601String())
        .lt('starts_at', utcEnd.toIso8601String())
        .order('starts_at');

    return (data as List)
        .map((s) => Slot.fromJson(s as Map<String, dynamic>))
        .toList();
  },
);
