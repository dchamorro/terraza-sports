import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/slot.dart';
import '../../../providers/slot_provider.dart';
import '../../../widgets/error_view.dart';

/// Horizontal scrollable list of resource chips.
class ResourcePicker extends ConsumerWidget {
  const ResourcePicker({
    super.key,
    required this.selectedId,
    required this.onSelected,
  });

  final String? selectedId;
  final ValueChanged<Resource> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resourcesAsync = ref.watch(resourcesProvider);

    return resourcesAsync.when(
      loading: () => const SizedBox(
        height: 56,
        child: Center(child: LinearProgressIndicator()),
      ),
      error: (e, _) => ErrorView(message: 'No se pudieron cargar los recursos.'),
      data: (resources) => SizedBox(
        height: 56,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          itemCount: resources.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, i) {
            final r = resources[i];
            final selected = r.id == selectedId;
            return ChoiceChip(
              label: Text(r.name),
              selected: selected,
              onSelected: (_) => onSelected(r),
            );
          },
        ),
      ),
    );
  }
}
