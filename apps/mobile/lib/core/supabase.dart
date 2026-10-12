import 'package:supabase_flutter/supabase_flutter.dart';

/// Singleton accessor for the Supabase client.
SupabaseClient get supabase => Supabase.instance.client;
