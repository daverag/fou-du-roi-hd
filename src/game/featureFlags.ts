function isEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export const ENABLE_SYMMETRIC_LAYOUTS = isEnabled(import.meta.env.VITE_ENABLE_SYMMETRIC_LAYOUTS);
