import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/supabase.dart';
import '../models/booking.dart';
import '../models/price_item.dart';

// ─── My active booking ────────────────────────────────────────────────────────

/// The member's current confirmed / pending booking (there can be at most 1).
final activeBookingProvider = FutureProvider<Booking?>((ref) async {
  final data = await supabase
      .from('bookings')
      .select('''
        id, slot_id, member_id, status,
        is_guest_booking, guest_name,
        checked_in_at, cancelled_at,
        booking_addons(addon_type, price_at_booking_nio, provider_availability_id),
        slots!inner(starts_at, resources!inner(name, resource_type))
      ''')
      .inFilter('status', ['confirmed', 'pending_approval'])
      .maybeSingle();

  if (data == null) return null;
  return Booking.fromJson(data as Map<String, dynamic>);
});

// ─── Booking history ──────────────────────────────────────────────────────────

final bookingHistoryProvider = FutureProvider<List<Booking>>((ref) async {
  final data = await supabase
      .from('bookings')
      .select('''
        id, slot_id, member_id, status,
        is_guest_booking, guest_name,
        checked_in_at, cancelled_at,
        booking_addons(addon_type, price_at_booking_nio, provider_availability_id),
        slots!inner(starts_at, resources!inner(name, resource_type))
      ''')
      .order('created_at', ascending: false)
      .limit(50);

  return (data as List)
      .map((b) => Booking.fromJson(b as Map<String, dynamic>))
      .toList();
});

// ─── Price table ──────────────────────────────────────────────────────────────

final priceItemsProvider = FutureProvider<Map<String, PriceItem>>((ref) async {
  final data = await supabase
      .from('price_items')
      .select('key, label, price_nio')
      .eq('is_active', true);

  return {
    for (final row in (data as List))
      (row['key'] as String): PriceItem.fromJson(row as Map<String, dynamic>),
  };
});

// ─── Create booking ───────────────────────────────────────────────────────────

class CreateBookingParams {
  const CreateBookingParams({
    required this.slotId,
    this.addons = const [],
    this.guestName,
    this.guestEmail,
  });

  final String slotId;
  final List<Map<String, dynamic>> addons;
  final String? guestName;
  final String? guestEmail;
}

/// Calls the create-booking Edge Function.
/// Returns the response JSON map.
Future<Map<String, dynamic>> createBooking(
  WidgetRef ref,
  CreateBookingParams params,
) async {
  final session = supabase.auth.currentSession;
  if (session == null) throw Exception('Not authenticated');

  final body = <String, dynamic>{
    'slot_id': params.slotId,
    if (params.addons.isNotEmpty) 'addons': params.addons,
    if (params.guestName != null) 'guest_name': params.guestName,
    if (params.guestEmail != null) 'guest_email': params.guestEmail,
  };

  final result = await supabase.functions.invoke(
    'create-booking',
    body: body,
  );

  if (result.status != 200 && result.status != 201 && result.status != 202) {
    final error = (result.data as Map?)?['error'] ?? 'Error desconocido';
    throw Exception(error);
  }

  // Invalidate so active booking refreshes.
  ref.invalidate(activeBookingProvider);

  return result.data as Map<String, dynamic>;
}

// ─── Cancel booking ───────────────────────────────────────────────────────────

Future<void> cancelBooking(WidgetRef ref, String bookingId) async {
  final result = await supabase.functions.invoke(
    'cancel-booking',
    body: {'booking_id': bookingId},
  );

  if (result.status != 200) {
    final error = (result.data as Map?)?['error'] ?? 'Error al cancelar';
    throw Exception(error);
  }

  ref.invalidate(activeBookingProvider);
  ref.invalidate(bookingHistoryProvider);
}
