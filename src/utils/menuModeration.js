const MIN_PRICE = 20;
const MAX_PRICE = 1000;
const HIGH_PRICE = 500;
const MIN_DESCRIPTION_LENGTH = 12;
const BLOCKED_TERMS = ["scam", "poison", "fake", "kill", "weapon", "drugs"];

export function validateMenuItem({ name, category, price, desc }) {
  const errors = [];
  const riskFlags = [];
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedCategory = typeof category === "string" ? category.trim() : "";
  const normalizedDesc = typeof desc === "string" ? desc.trim() : "";

  if (normalizedName.length < 2 || normalizedName.length > 80) errors.push("name must be 2 to 80 characters");
  if (normalizedCategory.length < 2 || normalizedCategory.length > 40) errors.push("category must be 2 to 40 characters");
  if (typeof price !== "number" || !Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
    errors.push(`price must be between ${MIN_PRICE} and ${MAX_PRICE}`);
  } else if (price > HIGH_PRICE) {
    riskFlags.push("high-price");
  }
  if (normalizedDesc.length < MIN_DESCRIPTION_LENGTH || normalizedDesc.length > 300) {
    errors.push(`description must be ${MIN_DESCRIPTION_LENGTH} to 300 characters`);
  }

  const text = `${normalizedName} ${normalizedCategory} ${normalizedDesc}`.toLowerCase();
  if (BLOCKED_TERMS.some((term) => text.includes(term))) errors.push("name, category, or description contains blocked text");

  return { errors, riskFlags, normalizedName, normalizedCategory, normalizedDesc };
}

export function approvalForSubmission({ isAdmin, trustTier, riskFlags }) {
  if (isAdmin) return { approvalStatus: "approved", approvalSource: "admin" };
  if (trustTier === "trusted" && riskFlags.length === 0) {
    return { approvalStatus: "approved", approvalSource: "automated" };
  }
  return { approvalStatus: "pending", approvalSource: "automated" };
}