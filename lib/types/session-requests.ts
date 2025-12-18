// Type definitions for session requests

export interface MealPlanPurchaseData {
  reference: string;
  status: 'success' | 'failed' | 'pending';
  amount: number;
  currency: string;
  [key: string]: any; // For additional payment provider data
}

export interface MealPlanPurchase {
  dietitianId: string;
  packageName: string;
  price: number;
  currency: string;
  paymentData: MealPlanPurchaseData;
}

export interface SessionRequestCreate {
  dietitianId: string;
  requestType: 'MEAL_PLAN' | 'CONSULTATION' | 'RESCHEDULE_REQUEST';
  mealPlanType?: string;
  notes?: string;
  price?: number;
  currency?: string;
  paymentData?: MealPlanPurchaseData;
  packageName?: string; // Alias for mealPlanType
}

export interface SessionRequest {
  id: string;
  requestType: 'CONSULTATION' | 'MEAL_PLAN' | 'RESCHEDULE_REQUEST';
  clientName: string;
  clientEmail: string;
  message?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESCHEDULE_REQUESTED';
  eventType?: {
    id: string;
    title: string;
  };
  mealPlanType?: string;
  price?: number;
  currency?: string;
  duration?: number;
  dietitian: {
    id: string;
    name: string;
    email: string;
  };
  originalBookingId?: string;
  createdAt: string;
  requestedDate?: string;
}

