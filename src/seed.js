import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "./db.js";
import mongoose from "mongoose";
import User from "./models/User.js";
import Cafe from "./models/Cafe.js";
import MenuItem from "./models/MenuItem.js";
import Order from "./models/Order.js";

const CAFES = [
  {
    name: "Warren Coffee House", tagline: "Quiet corners, bright single-origin shots.",
    neighborhood: "Maribago", tags: ["Coffee", "Quiet"], accent: "#8B6449", soft: "#F1E6DA",
    mapPosition: { x: 90, y: 60 },
    items: [
      { name: "House Espresso", category: "Coffee", price: 95, desc: "Single-origin shot, pulled short and bright." },
      { name: "Brown Sugar Latte", category: "Coffee", price: 145, desc: "Steamed milk, house brown sugar syrup." },
      { name: "Warren Cold Brew", category: "Coffee", price: 135, desc: "Slow-steeped eighteen hours, served over ice." },
      { name: "Almond Butter Croissant", category: "Pastries", price: 120, desc: "Laminated dough, roasted almond butter." },
    ],
  },
  {
    name: "Clover & Cream", tagline: "Milk tea and soft pastries for slow afternoons.",
    neighborhood: "Gun-ob", tags: ["Milk Tea", "Sweet"], accent: "#B5715F", soft: "#F6E7E2",
    mapPosition: { x: 330, y: 55 },
    items: [
      { name: "Honey Oolong Milk Tea", category: "Non-Coffee", price: 135, desc: "Oolong steeped with wildflower honey." },
      { name: "Matcha Cream Latte", category: "Non-Coffee", price: 150, desc: "Ceremonial matcha, salted cream top." },
      { name: "Clover Butter Cookie", category: "Pastries", price: 65, desc: "Shortbread rounds, cultured butter." },
      { name: "Strawberry Cream Bun", category: "Pastries", price: 110, desc: "Milk bread, whipped cream, fresh strawberry." },
    ],
  },
  {
    name: "The Hollow Bean", tagline: "A dim little roastery for dark-roast people.",
    neighborhood: "Pusok", tags: ["Roastery", "Cozy"], accent: "#5C4632", soft: "#EAE1D6",
    mapPosition: { x: 70, y: 235 },
    items: [
      { name: "Dark Roast Drip", category: "Coffee", price: 90, desc: "Heavy-bodied, notes of cocoa and toasted nut." },
      { name: "Hollow Mocha", category: "Coffee", price: 150, desc: "Dark chocolate, espresso, steamed milk." },
      { name: "Spanish Latte", category: "Coffee", price: 140, desc: "Condensed milk sweetness, double shot." },
      { name: "Banana Walnut Loaf", category: "Pastries", price: 95, desc: "Dense-baked, toasted walnut throughout." },
    ],
  },
  {
    name: "Marigold Kitchen", tagline: "Brunch plates and garden seating.",
    neighborhood: "Agus", tags: ["Brunch", "Food"], accent: "#9C7A3C", soft: "#F2ECD9",
    mapPosition: { x: 330, y: 245 },
    items: [
      { name: "Marigold Breakfast Bowl", category: "Light Bites", price: 195, desc: "Soft egg, greens, roasted potato, herb oil." },
      { name: "Garlic Mushroom Toast", category: "Light Bites", price: 165, desc: "Sourdough, thyme butter, wild mushroom." },
      { name: "Iced Calamansi Tea", category: "Non-Coffee", price: 85, desc: "Fresh-squeezed, lightly sweetened." },
      { name: "Vanilla Bean Latte", category: "Coffee", price: 150, desc: "Espresso, vanilla bean paste, steamed milk." },
    ],
  },
];

const DEMO_USERS = [
  { name: "Ana Bautista", email: "admin@cofibunny.app", password: "adminpass123", role: "admin" },
  { name: "Mika Santos", email: "mika@warren.cafe", password: "partnerpass123", role: "partner", cafeName: "Warren Coffee House" },
  { name: "You", email: "you@example.com", password: "customerpass123", role: "customer" },
];

async function seed() {
  await connectDB();

  console.log("Clearing existing data…");
  await Promise.all([User.deleteMany({}), Cafe.deleteMany({}), MenuItem.deleteMany({}), Order.deleteMany({})]);

  console.log("Creating cafés and menu items…");
  const cafeDocsByName = {};
  for (const c of CAFES) {
    const cafe = await Cafe.create({
      name: c.name, tagline: c.tagline, neighborhood: c.neighborhood,
      tags: c.tags, accent: c.accent, soft: c.soft, mapPosition: c.mapPosition,
    });
    cafeDocsByName[c.name] = cafe;
    for (const item of c.items) {
      await MenuItem.create({ ...item, cafeId: cafe._id, approvalStatus: "approved", approvalSource: "admin" });
    }
  }

  console.log("Creating demo users…");
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const cafe = u.cafeName ? cafeDocsByName[u.cafeName] : null;
    const user = await User.create({
      name: u.name, email: u.email, passwordHash, role: u.role,
      cafeId: cafe ? cafe._id : null,
      trustTier: u.role === "partner" ? "trusted" : "new",
    });
    if (cafe) {
      cafe.ownerId = user._id;
      await cafe.save();
    }
    console.log(`  ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
  }

  console.log("\nDone. Start the API with: npm run dev");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
