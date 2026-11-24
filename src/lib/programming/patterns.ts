// Validation patterns safe to import from both server and client code.
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
