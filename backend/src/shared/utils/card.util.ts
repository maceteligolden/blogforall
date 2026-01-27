/**
 * Check if a card is expired based on expiry date
 * @param expireDate - Format: "MM/YYYY" or "MM/YY"
 * @returns boolean indicating if card is expired
 */
export function isCardExpired(expireDate: string): boolean {
  if (!expireDate) return false;

  try {
    // Handle both "MM/YYYY" and "MM/YY" formats
    const [month, year] = expireDate.split("/");
    if (!month || !year) return false;

    // Convert 2-digit year to 4-digit year
    const fullYear = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
    const expiryMonth = parseInt(month, 10) - 1; // JavaScript months are 0-indexed
    const expiryDate = new Date(fullYear, expiryMonth + 1, 0); // Last day of expiry month

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  } catch (error) {
    console.error("Error parsing expiry date:", error);
    return false;
  }
}
