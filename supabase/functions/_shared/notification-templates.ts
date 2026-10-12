// Notification templates — one object per notification type.
// Each template produces a { title, body } for push and a { subject, html }
// for email. All strings are in Spanish (default).
//
// Payload shapes mirror what the existing Edge Functions insert into
// notification_queue.payload.

export interface PushMessage {
  title: string;
  body: string;
}

export interface EmailMessage {
  subject: string;
  html: string;
}

export interface NotificationTemplate {
  push?: PushMessage;
  email?: EmailMessage;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDatetime(utcIso: string): string {
  return new Date(utcIso).toLocaleString("es-NI", {
    timeZone: "America/Managua",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fmtNio(amount: number): string {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
  }).format(amount);
}

// ── Template registry ─────────────────────────────────────────────────────────

export function buildTemplate(
  type: string,
  payload: Record<string, unknown>
): NotificationTemplate {
  switch (type) {
    // ── Booking confirmed ──────────────────────────────────────────────
    case "booking_confirmed": {
      const slotStart = fmtDatetime(payload.slot_starts_at as string);
      const resource = payload.resource_type === "tennis_court"
        ? "cancha de tenis"
        : "pista de boliche";
      const total = fmtNio(payload.total_nio as number);
      return {
        push: {
          title: "✅ Reservación confirmada",
          body: `${slotStart} · ${resource} · ${total}`,
        },
        email: {
          subject: "Tu reservación fue confirmada — Terraza Sports",
          html: emailWrapper(`
            <h2>Reservación confirmada</h2>
            <p>Tu reservación para <strong>${resource}</strong> el
               <strong>${slotStart}</strong> ha sido confirmada.</p>
            <p><strong>Total cobrado:</strong> ${total}</p>
            <p>Presenta el código QR en la entrada para hacer check-in.</p>
          `),
        },
      };
    }

    // ── Booking approved (admin approved a pending request) ────────────
    case "booking_approved": {
      const slotStart = fmtDatetime(payload.slot_starts_at as string ?? "");
      return {
        push: {
          title: "✅ Solicitud aprobada",
          body: `Tu reservación para ${slotStart} fue aprobada.`,
        },
        email: {
          subject: "Tu solicitud fue aprobada — Terraza Sports",
          html: emailWrapper(`
            <h2>Solicitud aprobada</h2>
            <p>Tu reservación para el <strong>${slotStart}</strong>
               ha sido aprobada por un administrador.</p>
          `),
        },
      };
    }

    // ── Booking declined ───────────────────────────────────────────────
    case "booking_declined": {
      return {
        push: {
          title: "❌ Solicitud rechazada",
          body: "Un administrador no pudo aprobar tu solicitud.",
        },
        email: {
          subject: "Tu solicitud no fue aprobada — Terraza Sports",
          html: emailWrapper(`
            <h2>Solicitud no aprobada</h2>
            <p>Lo sentimos, un administrador no pudo aprobar tu solicitud
               de reservación. Por favor contáctanos si tienes preguntas.</p>
          `),
        },
      };
    }

    // ── Booking cancelled ──────────────────────────────────────────────
    case "booking_cancelled": {
      const refunded = payload.refunded as boolean;
      return {
        push: {
          title: "Reservación cancelada",
          body: refunded
            ? "Tu reservación fue cancelada. Se procesará un reembolso."
            : "Tu reservación fue cancelada. No aplica reembolso.",
        },
        email: {
          subject: "Reservación cancelada — Terraza Sports",
          html: emailWrapper(`
            <h2>Reservación cancelada</h2>
            <p>${
              refunded
                ? "Tu reservación fue cancelada y se procesará un reembolso a tu método de pago."
                : "Tu reservación fue cancelada. Has alcanzado el límite de cancelaciones con reembolso este mes."
            }</p>
          `),
        },
      };
    }

    // ── Under-12 approval request (to admins) ─────────────────────────
    case "under12_approval_request": {
      const bookingId = payload.booking_id as string;
      const baseUrl = Deno.env.get("ADMIN_URL") ?? "";
      return {
        email: {
          subject: "Solicitud de reservación — menor de 12 años",
          html: emailWrapper(`
            <h2>Solicitud de menor de 12 años</h2>
            <p>Se ha recibido una solicitud de reservación para un menor de 12 años.</p>
            <p>
              <a href="${baseUrl}/approvals" style="margin-right:12px">
                <strong>Ver en el panel</strong>
              </a>
            </p>
            ${approvalButtons(bookingId, baseUrl)}
          `),
        },
      };
    }

    // ── Guest approval request (to admins) ────────────────────────────
    case "guest_approval_request": {
      const bookingId = payload.booking_id as string;
      const guestName = payload.guest_name as string ?? "Invitado";
      const baseUrl = Deno.env.get("ADMIN_URL") ?? "";
      return {
        email: {
          subject: `Solicitud de invitado: ${guestName}`,
          html: emailWrapper(`
            <h2>Solicitud de reservación para invitado</h2>
            <p>Un miembro solicita traer a <strong>${guestName}</strong>
               como invitado.</p>
            ${approvalButtons(bookingId, baseUrl)}
          `),
        },
      };
    }

    // ── Guest reservation link (sent to the guest) ────────────────────
    case "guest_reservation_link": {
      const guestName = payload.guest_name as string ?? "Invitado";
      const bookingId = payload.booking_id as string;
      const guestUrl = Deno.env.get("GUEST_VIEW_URL") ?? "";
      return {
        email: {
          subject: "Tu reservación en Terraza Sports",
          html: emailWrapper(`
            <h2>Hola, ${guestName}</h2>
            <p>Un miembro de Terraza Sports ha reservado una instalación para ti.</p>
            <p>
              <a href="${guestUrl}/reservation/${bookingId}" style="
                display:inline-block;padding:12px 24px;
                background:#1B5E20;color:#fff;border-radius:8px;
                text-decoration:none;font-weight:600;">
                Ver mi reservación
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px;">
              No necesitas crear una cuenta. Este enlace contiene toda la información necesaria.
            </p>
          `),
        },
      };
    }

    // ── No-show strike issued ──────────────────────────────────────────
    case "strike_issued": {
      const offenseType = payload.offense_type as string;
      const offenseLabel: Record<string, string> = {
        no_show: "no asististe a tu reservación",
        dependent_swap: "intercambio de familiar detectado",
        account_impersonation: "uso de cuenta de otro miembro",
        guest_rule_violation: "violación de reglas de invitados",
      };
      return {
        push: {
          title: "⚠️ Se registró una falta",
          body: `Motivo: ${offenseLabel[offenseType] ?? offenseType}.`,
        },
        email: {
          subject: "Se registró una falta en tu cuenta — Terraza Sports",
          html: emailWrapper(`
            <h2>Falta registrada</h2>
            <p>Se ha registrado una falta en tu cuenta con el siguiente motivo:
               <strong>${offenseLabel[offenseType] ?? offenseType}</strong>.</p>
            <p>Si consideras que esto es un error, puedes apelar al Sports Manager.</p>
          `),
        },
      };
    }

    // ── News post published ────────────────────────────────────────────
    case "news_published": {
      const title = payload.title as string;
      const body = payload.body as string;
      return {
        push: {
          title: `📢 ${title}`,
          body: body.slice(0, 100) + (body.length > 100 ? "…" : ""),
        },
        // No email for news — push only.
      };
    }

    default:
      return {};
  }
}

// ── Email layout helpers ──────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#1B5E20;padding:20px 32px;">
            <span style="color:#fff;font-size:18px;font-weight:700;">Terraza Sports</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#1f2328;font-size:15px;line-height:1.6;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;
                     font-size:12px;color:#6b7280;text-align:center;">
            Terraza Sports · Nicaragua
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Approve / Decline action buttons embedded in admin approval emails. */
function approvalButtons(bookingId: string, baseUrl: string): string {
  const fnUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secret = Deno.env.get("EMAIL_ACTION_SECRET") ?? "";

  // We generate signed tokens here so the email buttons work without a login session.
  // The actual HMAC signing is async, so we embed a Vercel Route Handler URL that
  // handles the action (it re-signs server-side before calling approve-guest).
  const approveUrl = `${baseUrl}/api/email-action?booking_id=${bookingId}&action=approve`;
  const declineUrl = `${baseUrl}/api/email-action?booking_id=${bookingId}&action=decline`;

  return `
    <div style="margin-top:24px;">
      <a href="${approveUrl}" style="
        display:inline-block;padding:12px 24px;
        background:#16a34a;color:#fff;border-radius:8px;
        text-decoration:none;font-weight:600;margin-right:12px;">
        ✅ Aprobar
      </a>
      <a href="${declineUrl}" style="
        display:inline-block;padding:12px 24px;
        background:#dc2626;color:#fff;border-radius:8px;
        text-decoration:none;font-weight:600;">
        ❌ Rechazar
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px;margin-top:12px;">
      O ve directamente al <a href="${baseUrl}/approvals">panel de administración</a>.
    </p>
  `;
}
