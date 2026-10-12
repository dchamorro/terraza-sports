// Supabase database types for Terraza Sports.
// Regenerate after migrations with:
//   supabase gen types typescript --local > packages/types/src/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enum helpers ─────────────────────────────────────────────────────────────

export type ResourceType = "tennis_court" | "bowling_lane";
export type SlotStatus = "available" | "reserved" | "blocked";
export type AgeTier = "under_12" | "minor" | "adult";
export type BookingStatus =
  | "pending_approval"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "checked_in";
export type AddonType =
  | "equipment_rental"
  | "lesson"
  | "sparring"
  | "court_lights";
export type OffenseType =
  | "no_show"
  | "dependent_swap"
  | "account_impersonation"
  | "guest_rule_violation";
export type StrikeStatus = "active" | "erased" | "waived";
export type SanctionType =
  | "warning"
  | "block_7d"
  | "block_14d"
  | "block_30d"
  | "block_60d"
  | "committee_review";
export type IdeasInboxStatus = "new" | "under_review" | "adopted" | "declined";
export type IdeasSubmitterRole = "member" | "admin" | "sports_manager" | "committee";
export type NotificationChannel = "push" | "email";
export type AppRole =
  | "member"
  | "admin"
  | "sports_manager"
  | "committee"
  | "coach"
  | "sparring_partner";
export type NewsAudience = "all" | "tennis" | "bowling";

// ─── Row types ────────────────────────────────────────────────────────────────

export interface HouseholdRow {
  id: string;
  name: string;
  created_at: string;
}

export interface MemberRow {
  id: string;
  auth_user_id: string | null;
  household_id: string;
  external_ref: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  age_tier: AgeTier;
  role: AppRole;
  is_dependent: boolean;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceRow {
  id: string;
  name: string;
  resource_type: ResourceType;
  is_active: boolean;
  created_at: string;
}

export interface HolidayCalendarRow {
  id: string;
  date: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface SlotRow {
  id: string;
  resource_id: string;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
}

export interface PriceItemRow {
  id: string;
  key: string;
  label: string;
  price_nio: number;
  is_active: boolean;
  updated_by: string;
  updated_at: string;
}

export interface PriceItemAuditRow {
  id: string;
  price_item_id: string;
  old_price_nio: number | null;
  new_price_nio: number;
  changed_by: string;
  changed_at: string;
}

export interface ProviderAvailabilityRow {
  id: string;
  provider_id: string;
  slot_id: string;
  addon_type: AddonType;
  is_booked: boolean;
}

export interface BookingRow {
  id: string;
  slot_id: string;
  member_id: string;
  is_guest_booking: boolean;
  guest_name: string | null;
  guest_email: string | null;
  status: BookingStatus;
  approved_by: string | null;
  approved_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  cancelled_at: string | null;
  cancellation_refund: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface BookingAddonRow {
  id: string;
  booking_id: string;
  addon_type: AddonType;
  provider_availability_id: string | null;
  price_at_booking_nio: number;
  created_at: string;
}

export interface ChargeRow {
  id: string;
  booking_id: string;
  amount_nio: number;
  bac_transaction_id: string | null;
  status: string;
  captured_at: string | null;
  created_at: string;
}

export interface RefundRow {
  id: string;
  charge_id: string;
  amount_nio: number;
  bac_refund_id: string | null;
  status: string;
  processed_at: string | null;
  created_at: string;
}

export interface CancellationQuotaRow {
  id: string;
  member_id: string;
  month: string;
  refunded_count: number;
}

export interface StrikeRow {
  id: string;
  member_id: string;
  offense_type: OffenseType;
  booking_id: string | null;
  status: StrikeStatus;
  issued_at: string;
  erased_at: string | null;
  waived_at: string | null;
  waived_by: string | null;
  waiver_reason: string | null;
}

export interface SanctionRow {
  id: string;
  member_id: string;
  offense_type: OffenseType;
  sanction_type: SanctionType;
  strike_id: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AbuseFlagRow {
  id: string;
  member_id: string;
  offense_type: OffenseType;
  booking_id: string | null;
  related_booking_id: string | null;
  detected_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  dismissed_by: string | null;
  dismissed_at: string | null;
}

export interface NewsPostRow {
  id: string;
  author_id: string;
  title: string;
  body: string;
  audience: NewsAudience;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeasInboxRow {
  id: string;
  submitted_by: string | null;
  submitter_role: IdeasSubmitterRole;
  title: string;
  body: string;
  status: IdeasInboxStatus;
  triaged_by: string | null;
  triaged_at: string | null;
  triage_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdPlacementRow {
  id: string;
  surface_key: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationQueueRow {
  id: string;
  type: string;
  payload: Json;
  channel: NotificationChannel;
  processed: boolean;
  created_at: string;
}

// ─── Database type (used by the Supabase client generic) ─────────────────────

export interface Database {
  public: {
    Tables: {
      households: {
        Row: HouseholdRow;
        Insert: Omit<HouseholdRow, "id" | "created_at"> & Partial<Pick<HouseholdRow, "id" | "created_at">>;
        Update: Partial<HouseholdRow>;
      };
      members: {
        Row: MemberRow;
        Insert: Omit<MemberRow, "id" | "created_at" | "updated_at"> & Partial<Pick<MemberRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<MemberRow>;
      };
      resources: {
        Row: ResourceRow;
        Insert: Omit<ResourceRow, "id" | "created_at"> & Partial<Pick<ResourceRow, "id" | "created_at">>;
        Update: Partial<ResourceRow>;
      };
      holiday_calendar: {
        Row: HolidayCalendarRow;
        Insert: Omit<HolidayCalendarRow, "id" | "created_at"> & Partial<Pick<HolidayCalendarRow, "id" | "created_at">>;
        Update: Partial<HolidayCalendarRow>;
      };
      slots: {
        Row: SlotRow;
        Insert: Omit<SlotRow, "id" | "ends_at"> & Partial<Pick<SlotRow, "id">>;
        Update: Partial<Omit<SlotRow, "ends_at">>;
      };
      price_items: {
        Row: PriceItemRow;
        Insert: Omit<PriceItemRow, "id" | "updated_at"> & Partial<Pick<PriceItemRow, "id" | "updated_at">>;
        Update: Partial<PriceItemRow>;
      };
      price_item_audit: {
        Row: PriceItemAuditRow;
        Insert: Omit<PriceItemAuditRow, "id" | "changed_at"> & Partial<Pick<PriceItemAuditRow, "id" | "changed_at">>;
        Update: Partial<PriceItemAuditRow>;
      };
      provider_availability: {
        Row: ProviderAvailabilityRow;
        Insert: Omit<ProviderAvailabilityRow, "id"> & Partial<Pick<ProviderAvailabilityRow, "id">>;
        Update: Partial<ProviderAvailabilityRow>;
      };
      bookings: {
        Row: BookingRow;
        Insert: Omit<BookingRow, "id" | "created_at" | "updated_at"> & Partial<Pick<BookingRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<BookingRow>;
      };
      booking_addons: {
        Row: BookingAddonRow;
        Insert: Omit<BookingAddonRow, "id" | "created_at"> & Partial<Pick<BookingAddonRow, "id" | "created_at">>;
        Update: Partial<BookingAddonRow>;
      };
      charges: {
        Row: ChargeRow;
        Insert: Omit<ChargeRow, "id" | "created_at"> & Partial<Pick<ChargeRow, "id" | "created_at">>;
        Update: Partial<ChargeRow>;
      };
      refunds: {
        Row: RefundRow;
        Insert: Omit<RefundRow, "id" | "created_at"> & Partial<Pick<RefundRow, "id" | "created_at">>;
        Update: Partial<RefundRow>;
      };
      cancellation_quota: {
        Row: CancellationQuotaRow;
        Insert: Omit<CancellationQuotaRow, "id"> & Partial<Pick<CancellationQuotaRow, "id">>;
        Update: Partial<CancellationQuotaRow>;
      };
      strikes: {
        Row: StrikeRow;
        Insert: Omit<StrikeRow, "id" | "issued_at"> & Partial<Pick<StrikeRow, "id" | "issued_at">>;
        Update: Partial<StrikeRow>;
      };
      sanctions: {
        Row: SanctionRow;
        Insert: Omit<SanctionRow, "id" | "starts_at" | "created_at"> & Partial<Pick<SanctionRow, "id" | "starts_at" | "created_at">>;
        Update: Partial<SanctionRow>;
      };
      abuse_flags: {
        Row: AbuseFlagRow;
        Insert: Omit<AbuseFlagRow, "id" | "detected_at"> & Partial<Pick<AbuseFlagRow, "id" | "detected_at">>;
        Update: Partial<AbuseFlagRow>;
      };
      news_posts: {
        Row: NewsPostRow;
        Insert: Omit<NewsPostRow, "id" | "created_at" | "updated_at"> & Partial<Pick<NewsPostRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<NewsPostRow>;
      };
      ideas_inbox: {
        Row: IdeasInboxRow;
        Insert: Omit<IdeasInboxRow, "id" | "created_at" | "updated_at"> & Partial<Pick<IdeasInboxRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<IdeasInboxRow>;
      };
      ad_placements: {
        Row: AdPlacementRow;
        Insert: Omit<AdPlacementRow, "id" | "created_at"> & Partial<Pick<AdPlacementRow, "id" | "created_at">>;
        Update: Partial<AdPlacementRow>;
      };
      notification_queue: {
        Row: NotificationQueueRow;
        Insert: Omit<NotificationQueueRow, "id" | "created_at"> & Partial<Pick<NotificationQueueRow, "id" | "created_at">>;
        Update: Partial<NotificationQueueRow>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_booking_atomic: {
        Args: {
          p_slot_id: string;
          p_member_id: string;
          p_status: BookingStatus;
          p_is_guest_booking: boolean;
          p_guest_name: string | null;
          p_guest_email: string | null;
          p_total_nio: number;
          p_addons: Json;
        };
        Returns: Json;
      };
      cancel_booking_atomic: {
        Args: { p_booking_id: string; p_will_refund: boolean };
        Returns: Json;
      };
      decline_booking_atomic: {
        Args: { p_booking_id: string };
        Returns: void;
      };
    };
    Enums: {
      resource_type: ResourceType;
      slot_status: SlotStatus;
      age_tier: AgeTier;
      booking_status: BookingStatus;
      addon_type: AddonType;
      offense_type: OffenseType;
      strike_status: StrikeStatus;
      sanction_type: SanctionType;
      ideas_inbox_status: IdeasInboxStatus;
      app_role: AppRole;
      news_audience: NewsAudience;
      notification_channel: NotificationChannel;
    };
  };
}
