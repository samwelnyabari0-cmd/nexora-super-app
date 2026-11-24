const PAYMENT_RETURN_PARAMS = ["reference", "trxref", "payment"] as const;

/**
 * Remove Paystack return parameters without changing the route currently
 * displaying the creator who received the payment.
 */
export function paymentReturnCleanupPath(currentUrl: string): string {
  const url = new URL(currentUrl);
  for (const parameter of PAYMENT_RETURN_PARAMS) {
    url.searchParams.delete(parameter);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
