import 'package:flutter/foundation.dart';

@immutable
class PriceItem {
  const PriceItem({
    required this.key,
    required this.label,
    required this.priceNio,
  });

  final String key;
  final String label;
  final double priceNio;

  factory PriceItem.fromJson(Map<String, dynamic> json) => PriceItem(
        key: json['key'] as String,
        label: json['label'] as String,
        priceNio: (json['price_nio'] as num).toDouble(),
      );
}
