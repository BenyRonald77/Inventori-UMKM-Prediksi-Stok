export const StockTransactionType = {
  IN: "IN",
  OUT: "OUT",
} as const;
export type StockTransactionType =
  (typeof StockTransactionType)[keyof typeof StockTransactionType];
