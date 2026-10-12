import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../models/booking.dart';
import '../../models/price_item.dart';
import '../../models/slot.dart';
import '../../providers/booking_provider.dart';
import '../../widgets/loading_overlay.dart';
import '../../widgets/error_view.dart';
import 'widgets/addon_selector.dart';
import 'widgets/checkout_summary.dart';

/// Multi-step booking flow: add-ons → guest? → checkout → confirm.
class BookingFlowScreen extends ConsumerStatefulWidget {
  const BookingFlowScreen({
    super.key,
    required this.slotId,
    required this.resourceName,
    required this.resourceType,
    required this.startsAt,
  });

  final String slotId;
  final String resourceName;
  final String resourceType;
  final DateTime startsAt;

  @override
  ConsumerState<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends ConsumerState<BookingFlowScreen> {
  int _step = 0; // 0 = add-ons, 1 = guest?, 2 = checkout
  bool _loading = false;
  String? _error;

  // Add-on state
  final Set<AddonType> _selectedAddons = {};

  // Guest state
  bool _isGuestBooking = false;
  final _guestNameCtrl = TextEditingController();
  final _guestEmailCtrl = TextEditingController();
  final _guestFormKey = GlobalKey<FormState>();

  bool get _isTennis => widget.resourceType == 'tennis_court';
  bool get _isAfter17 => widget.startsAt.hour >= 17;
  bool get _isWithin12h =>
      widget.startsAt.difference(DateTime.now()).inHours < 12;

  @override
  void dispose() {
    _guestNameCtrl.dispose();
    _guestEmailCtrl.dispose();
    super.dispose();
  }

  // ── Step helpers ────────────────────────────────────────────────

  void _nextStep() => setState(() => _step = (_step + 1).clamp(0, 2));
  void _prevStep() {
    if (_step == 0) {
      context.pop();
    } else {
      setState(() => _step--);
    }
  }

  Future<void> _confirm(Map<String, PriceItem> prices) async {
    if (_isGuestBooking && !_guestFormKey.currentState!.validate()) return;

    setState(() { _loading = true; _error = null; });

    final addonsList = _selectedAddons.map((a) => <String, dynamic>{
          'addon_type': a.apiKey,
        }).toList();

    try {
      final result = await createBooking(
        ref,
        CreateBookingParams(
          slotId: widget.slotId,
          addons: addonsList,
          guestName:  _isGuestBooking ? _guestNameCtrl.text.trim() : null,
          guestEmail: _isGuestBooking ? _guestEmailCtrl.text.trim() : null,
        ),
      );

      if (!mounted) return;
      final status = result['status'] as String?;
      _showConfirmation(isPending: status == 'pending_approval');
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showConfirmation({required bool isPending}) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        icon: Icon(
          isPending ? Icons.hourglass_top : Icons.check_circle,
          size: 48,
          color: isPending
              ? Theme.of(context).colorScheme.tertiary
              : Theme.of(context).colorScheme.primary,
        ),
        title: Text(isPending ? 'Solicitud enviada' : '¡Reservación confirmada!'),
        content: Text(
          isPending
              ? 'Tu solicitud fue enviada. Un administrador la confirmará pronto.'
              : 'Tu reservación fue confirmada. Recibirás un correo de confirmación.',
        ),
        actions: [
          FilledButton(
            onPressed: () {
              context.go('/');
            },
            child: const Text('Listo'),
          ),
        ],
      ),
    );
  }

  // ── Build ────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final pricesAsync = ref.watch(priceItemsProvider);

    return pricesAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: ErrorView(message: 'No se pudo cargar la tabla de precios.'),
      ),
      data: (prices) => LoadingOverlay(
        loading: _loading,
        child: Scaffold(
          appBar: AppBar(
            leading: BackButton(onPressed: _prevStep),
            title: Text(_stepTitle),
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(4),
              child: LinearProgressIndicator(
                value: (_step + 1) / 3,
                borderRadius: BorderRadius.zero,
              ),
            ),
          ),
          body: SafeArea(
            child: Column(
              children: [
                // Slot info banner
                _SlotBanner(
                  resourceName: widget.resourceName,
                  startsAt: widget.startsAt,
                ),
                Expanded(
                  child: switch (_step) {
                    0 => AddonSelector(
                        isTennis: _isTennis,
                        isAfter17: _isAfter17,
                        isWithin12h: _isWithin12h,
                        selected: _selectedAddons,
                        prices: prices,
                        onToggle: (type) => setState(
                          () => _selectedAddons.contains(type)
                              ? _selectedAddons.remove(type)
                              : _selectedAddons.add(type),
                        ),
                      ),
                    1 => _GuestStep(
                        isGuestBooking: _isGuestBooking,
                        onToggle: (v) => setState(() => _isGuestBooking = v),
                        nameCtrl: _guestNameCtrl,
                        emailCtrl: _guestEmailCtrl,
                        formKey: _guestFormKey,
                      ),
                    _ => CheckoutSummary(
                        resourceName: widget.resourceName,
                        startsAt: widget.startsAt,
                        addons: _selectedAddons,
                        isGuestBooking: _isGuestBooking,
                        guestName: _guestNameCtrl.text.trim(),
                        prices: prices,
                        error: _error,
                      ),
                  },
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: FilledButton(
                    onPressed: _loading
                        ? null
                        : _step < 2
                            ? _nextStep
                            : () => _confirm(prices),
                    child: Text(_step < 2 ? 'Continuar' : 'Confirmar y pagar'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String get _stepTitle => switch (_step) {
        0 => 'Agregar servicios',
        1 => '¿Invitado?',
        _ => 'Resumen',
      };
}

// ── Slot info banner ─────────────────────────────────────────────────────────

class _SlotBanner extends StatelessWidget {
  const _SlotBanner({required this.resourceName, required this.startsAt});

  final String resourceName;
  final DateTime startsAt;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final fmt = DateFormat('EEEE d MMMM · HH:mm', 'es');
    return Container(
      color: cs.surfaceContainerLow,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          const Icon(Icons.place_outlined, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '$resourceName  ·  ${fmt.format(startsAt)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Guest step ───────────────────────────────────────────────────────────────

class _GuestStep extends StatelessWidget {
  const _GuestStep({
    required this.isGuestBooking,
    required this.onToggle,
    required this.nameCtrl,
    required this.emailCtrl,
    required this.formKey,
  });

  final bool isGuestBooking;
  final ValueChanged<bool> onToggle;
  final TextEditingController nameCtrl;
  final TextEditingController emailCtrl;
  final GlobalKey<FormState> formKey;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SwitchListTile(
              value: isGuestBooking,
              onChanged: onToggle,
              title: const Text('Esta reservación es para un invitado'),
              subtitle: const Text(
                'El administrador deberá aprobarla antes de que sea válida.',
              ),
              contentPadding: EdgeInsets.zero,
            ),
            if (isGuestBooking) ...[
              const SizedBox(height: 16),
              TextFormField(
                controller: nameCtrl,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Nombre del invitado'),
                validator: (v) =>
                    (v?.isNotEmpty ?? false) ? null : 'Requerido',
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Correo del invitado',
                  helperText: 'Recibirá un enlace con su reservación al aprobarse.',
                ),
                validator: (v) =>
                    (v?.contains('@') ?? false) ? null : 'Correo inválido',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
