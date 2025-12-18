/**
 * Type definitions for the application
 */

export interface DietitianProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  image: string;
  // Metadata fields (from enrollment form)
  specialization?: string;
  licenseNumber?: string;
  experience?: string;
  location?: string;
  qualifications?: string[];
  updatedAt: string | Date;
}

export interface TherapistProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  image: string;
  // Metadata fields (from enrollment form)
  specialization?: string;
  licenseNumber?: string;
  experience?: string;
  location?: string;
  qualifications?: string[];
  updatedAt: string | Date;
}
