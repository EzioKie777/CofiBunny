export function platformMarkup(price) {
  if (price < 100) return 5;
  if (price >= 500) return 15;
  return 10;
}

export function customerPrice(price) {
  return price + platformMarkup(price);
}