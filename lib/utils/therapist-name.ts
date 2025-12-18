/**
 * Format therapist name (no suffix needed, just return as-is)
 * @param name - The therapist's name
 * @returns Formatted name
 */
export function formatTherapistName(name: string | null | undefined): string {
  if (!name || name.trim() === '') {
    return 'Therapist';
  }

  return name.trim();
}

