// Meal plan package definitions
export interface MealPlanPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
}

export const MEAL_PLAN_PACKAGES: MealPlanPackage[] = [
  {
    id: "test",
    name: "Test Meal Plan",
    description: "Test meal plan for testing the purchase flow",
    price: 100,
    currency: "NGN",
  },
  {
    id: "7-day",
    name: "7-day meal plan",
    description: "A comprehensive 7-day meal plan tailored to your dietary needs",
    price: 10000,
    currency: "NGN",
  },
  {
    id: "14-day",
    name: "14-day meal plan",
    description: "A detailed 14-day meal plan with recipes and nutritional guidance",
    price: 16000,
    currency: "NGN",
  },
  {
    id: "1-month",
    name: "1 month meal plan",
    description: "Complete monthly meal plan with shopping lists and meal prep guides",
    price: 20000,
    currency: "NGN",
  },
];

// Helper function to get meal plan by ID
export function getMealPlanPackage(id: string): MealPlanPackage | undefined {
  return MEAL_PLAN_PACKAGES.find((pkg) => pkg.id === id);
}

