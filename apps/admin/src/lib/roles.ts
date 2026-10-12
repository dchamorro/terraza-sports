export type AppRole =
  | "member"
  | "admin"
  | "sports_manager"
  | "committee"
  | "coach"
  | "sparring_partner";

export function isSportsManager(role: AppRole) {
  return role === "sports_manager";
}

export function isAdminOrAbove(role: AppRole) {
  return role === "admin" || role === "sports_manager";
}

export function canApproveBookings(role: AppRole) {
  return isAdminOrAbove(role);
}

export function canEditPrices(role: AppRole) {
  return isSportsManager(role);
}
