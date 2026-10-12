// Shared formatting utilities

const NIO_FORMATTER = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "NIO",
  minimumFractionDigits: 2,
});

export function formatNio(amount: number | string): string {
  return NIO_FORMATTER.format(Number(amount));
}

export function formatDateTime(utcIso: string): string {
  return new Date(utcIso).toLocaleString("es-NI", {
    timeZone: "America/Managua",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatDate(utcIso: string): string {
  return new Date(utcIso).toLocaleDateString("es-NI", {
    timeZone: "America/Managua",
    dateStyle: "medium",
  });
}

export function formatTime(utcIso: string): string {
  return new Date(utcIso).toLocaleTimeString("es-NI", {
    timeZone: "America/Managua",
    timeStyle: "short",
  });
}
