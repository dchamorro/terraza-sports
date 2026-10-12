import 'package:flutter/foundation.dart';

enum BookingStatus {
  pendingApproval,
  confirmed,
  cancelled,
  noShow,
  checkedIn;

  static BookingStatus fromString(String v) => switch (v) {
        'pending_approval' => BookingStatus.pendingApproval,
        'cancelled'        => BookingStatus.cancelled,
        'no_show'          => BookingStatus.noShow,
        'checked_in'       => BookingStatus.checkedIn,
        _                  => BookingStatus.confirmed,
      };

  String get label => switch (this) {
        BookingStatus.pendingApproval => 'Pendiente',
        BookingStatus.confirmed       => 'Confirmada',
        BookingStatus.cancelled       => 'Cancelada',
        BookingStatus.noShow          => 'No asistió',
        BookingStatus.checkedIn       => 'Registrado',
      };
}

enum AddonType {
  equipmentRental,
  lesson,
  sparring,
  courtLights;

  static AddonType fromString(String v) => switch (v) {
        'lesson'           => AddonType.lesson,
        'sparring'         => AddonType.sparring,
        'court_lights'     => AddonType.courtLights,
        _                  => AddonType.equipmentRental,
      };

  String get label => switch (this) {
        AddonType.equipmentRental => 'Equipo',
        AddonType.lesson          => 'Clase',
        AddonType.sparring        => 'Sparring',
        AddonType.courtLights     => 'Luces',
      };

  String get apiKey => switch (this) {
        AddonType.equipmentRental => 'equipment_rental',
        AddonType.lesson          => 'lesson',
        AddonType.sparring        => 'sparring',
        AddonType.courtLights     => 'court_lights',
      };
}

@immutable
class BookingAddon {
  const BookingAddon({
    required this.type,
    required this.priceNio,
    this.providerAvailabilityId,
  });

  final AddonType type;
  final double priceNio;
  final String? providerAvailabilityId;

  factory BookingAddon.fromJson(Map<String, dynamic> json) => BookingAddon(
        type: AddonType.fromString(json['addon_type'] as String),
        priceNio: (json['price_at_booking_nio'] as num).toDouble(),
        providerAvailabilityId: json['provider_availability_id'] as String?,
      );
}

@immutable
class Booking {
  const Booking({
    required this.id,
    required this.slotId,
    required this.memberId,
    required this.status,
    required this.slotStartsAt,
    required this.resourceName,
    required this.resourceType,
    required this.addons,
    this.isGuestBooking = false,
    this.guestName,
    this.checkedInAt,
    this.cancelledAt,
  });

  final String id;
  final String slotId;
  final String memberId;
  final BookingStatus status;
  final DateTime slotStartsAt;
  final String resourceName;
  final String resourceType;
  final List<BookingAddon> addons;
  final bool isGuestBooking;
  final String? guestName;
  final DateTime? checkedInAt;
  final DateTime? cancelledAt;

  bool get canCancel {
    if (status != BookingStatus.confirmed) return false;
    return slotStartsAt.difference(DateTime.now()).inHours >= 2;
  }

  factory Booking.fromJson(Map<String, dynamic> json) {
    final slot = json['slots'] as Map<String, dynamic>;
    final resource = slot['resources'] as Map<String, dynamic>;
    final addonsList = (json['booking_addons'] as List<dynamic>? ?? [])
        .map((a) => BookingAddon.fromJson(a as Map<String, dynamic>))
        .toList();

    return Booking(
      id: json['id'] as String,
      slotId: json['slot_id'] as String,
      memberId: json['member_id'] as String,
      status: BookingStatus.fromString(json['status'] as String),
      slotStartsAt: DateTime.parse(slot['starts_at'] as String).toLocal(),
      resourceName: resource['name'] as String,
      resourceType: resource['resource_type'] as String,
      addons: addonsList,
      isGuestBooking: json['is_guest_booking'] as bool? ?? false,
      guestName: json['guest_name'] as String?,
      checkedInAt: json['checked_in_at'] != null
          ? DateTime.parse(json['checked_in_at'] as String).toLocal()
          : null,
      cancelledAt: json['cancelled_at'] != null
          ? DateTime.parse(json['cancelled_at'] as String).toLocal()
          : null,
    );
  }
}
