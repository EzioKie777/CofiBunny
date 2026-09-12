// Same formula as the frontend prototype: the rider hops from café to café
// (in the order items were added) and finally to the customer's pin.
// Swap the /90 scale factor and the CAFE mapPosition fields for real
// geocoded distances once you're plugging in Google Maps or Mapbox.
export function computeDelivery(cafePositions, pin) {
  const points = [...cafePositions, pin];
  let units = 0;
  for (let i = 0; i < points.length - 1; i++) {
    units += Math.hypot(points[i].x - points[i + 1].x, points[i].y - points[i + 1].y);
  }
  const km = Math.max(0.3, units / 90);
  const extraStops = Math.max(0, cafePositions.length - 1);
  const fee = Math.round(35 + extraStops * 25 + km * 18);
  const etaMinutes = Math.round(12 + km * 4 + extraStops * 5);
  return { km, fee, etaMinutes };
}
