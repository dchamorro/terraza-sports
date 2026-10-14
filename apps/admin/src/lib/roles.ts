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

/**
 * Roles allowed to open the admin panel at all.
 * Members, coaches and sparring partners use the mobile app only.
 * Committee is read-only: pages render, but every mutating route handler
 * checks for admin / sports_manager explicitly.
 */
export function canAccessAdminPanel(role: AppRole) {
  return isAdminOrAbove(role) || role === "committee";
}
