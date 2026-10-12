import 'package:flutter/foundation.dart';

enum AppRole {
  member,
  admin,
  sportsManager,
  committee,
  coach,
  sparringPartner;

  static AppRole fromString(String value) => switch (value) {
        'sports_manager'   => AppRole.sportsManager,
        'admin'            => AppRole.admin,
        'committee'        => AppRole.committee,
        'coach'            => AppRole.coach,
        'sparring_partner' => AppRole.sparringPartner,
        _                  => AppRole.member,
      };
}

enum AgeTier {
  under12,
  minor,
  adult;

  static AgeTier fromString(String value) => switch (value) {
        'under_12' => AgeTier.under12,
        'minor'    => AgeTier.minor,
        _          => AgeTier.adult,
      };
}

@immutable
class Member {
  const Member({
    required this.id,
    required this.householdId,
    required this.fullName,
    required this.email,
    required this.ageTier,
    required this.role,
    required this.isDependent,
    this.parentId,
    this.dateOfBirth,
  });

  final String id;
  final String householdId;
  final String fullName;
  final String email;
  final AgeTier ageTier;
  final AppRole role;
  final bool isDependent;
  final String? parentId;
  final String? dateOfBirth;

  factory Member.fromJson(Map<String, dynamic> json) => Member(
        id: json['id'] as String,
        householdId: json['household_id'] as String,
        fullName: json['full_name'] as String,
        email: json['email'] as String,
        ageTier: AgeTier.fromString(json['age_tier'] as String),
        role: AppRole.fromString(json['role'] as String),
        isDependent: json['is_dependent'] as bool,
        parentId: json['parent_id'] as String?,
        dateOfBirth: json['date_of_birth'] as String?,
      );
}
