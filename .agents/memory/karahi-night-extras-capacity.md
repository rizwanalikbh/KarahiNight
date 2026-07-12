---
name: Karahi Night extras vs capacity
description: How order capacity accounting treats Main-category dishes vs addon categories (Staples/Sides/Drinks/Dessert) in the pizza-night (Karahi Night) app.
---

Decision: slot capacity, total event capacity, and per-guest limits only count quantity of items whose menu `category` is `"Main"` (or missing category, which defaults to Main). Addon categories (Staples, Sides, Drinks, Dessert — e.g. Naan) can be ordered up to 50 each per order but never consume slot/event/guest capacity.

**Why:** capacity limits exist to manage kitchen throughput for the karahi mains; add-on sides like Naan aren't capacity-constrained the same way, and letting them count would let a guest exhaust a slot by ordering only extras.

**How to apply:** any future change to order capacity/validation logic (in the API server's order routes) must compute the "counted" quantity by filtering items to `category === "Main"` via the event's `pizzaTypes` list, not by summing all item quantities. The stored `orders.quantity` column reflects this Main-only sum, not the total item count.
