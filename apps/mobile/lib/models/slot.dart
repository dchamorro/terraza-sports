import 'package:flutter/foundation.dart';

enum ResourceType {
  tennisCourt,
  bowlingLane;

  static ResourceType fromString(String v) =>
      v == 'tennis_court' ? ResourceType.tennisCourt : ResourceType.bowlingLane;

  String get displayName =>
      this == ResourceType.tennisCourt ? 'Cancha de tenis' : 'Pista de boliche';
}

@immutable
class Resource {
  const Resource({
    required this.id,
    required this.name,
    required this.type,
  });

  final String id;
  final String name;
  final ResourceType type;

  factory Resource.fromJson(Map<String, dynamic> json) => Resource(
        id: json['id'] as String,
        name: json['name'] as String,
        type: ResourceType.fromString(json['resource_type'] as String),
      );
}

enum SlotStatus { available, reserved, blocked }

@immutable
class Slot {
  const Slot({
    required this.id,
    required this.resourceId,
    required this.startsAt,
    required this.endsAt,
    required this.status,
  });

  final String id;
  final String resourceId;
  final DateTime startsAt;
  final DateTime endsAt;
  final SlotStatus status;

  bool get isAvailable => status == SlotStatus.available;

  factory Slot.fromJson(Map<String, dynamic> json) => Slot(
        id: json['id'] as String,
        resourceId: json['resource_id'] as String,
        startsAt: DateTime.parse(json['starts_at'] as String).toLocal(),
        endsAt: DateTime.parse(json['ends_at'] as String).toLocal(),
        status: switch (json['status'] as String) {
          'reserved' => SlotStatus.reserved,
          'blocked'  => SlotStatus.blocked,
          _          => SlotStatus.available,
        },
      );
}
