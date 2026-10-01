export const businessCategories = ["Confeitaria", "Tatuagem", "Outra"] as const;
export type BusinessCategory = (typeof businessCategories)[number];

export const paymentMethods = [
  "full_upfront",
  "deposit_then_final",
  "full_on_delivery",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const weekDays = [
  { key: "monday", column: "monday_hours", label: "Segunda-feira" },
  { key: "tuesday", column: "tuesday_hours", label: "Terça-feira" },
  { key: "wednesday", column: "wednesday_hours", label: "Quarta-feira" },
  { key: "thursday", column: "thursday_hours", label: "Quinta-feira" },
  { key: "friday", column: "friday_hours", label: "Sexta-feira" },
  { key: "saturday", column: "saturday_hours", label: "Sábado" },
  { key: "sunday", column: "sunday_hours", label: "Domingo" },
] as const;

export type WeekDayKey = (typeof weekDays)[number]["key"];
export type HoursColumn = (typeof weekDays)[number]["column"];

export type BusinessSettings = {
  seller_id: string;
  public_slug: string;
  business_name: string;
  description: string;
  category: BusinessCategory;
  payment_method: PaymentMethod;
  deposit_percent: number | null;
} & Record<HoursColumn, number>;
