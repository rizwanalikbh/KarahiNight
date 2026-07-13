---
name: Karahi Night description fields
description: Distinguishes the three separate "description" concepts in the Karahi Night app to avoid rework when asked to add/change a "description" field.
---

The app has three separate, unrelated description fields — always confirm which one a request means before building:

1. **Event description** (`events.description`) — general blurb about the event, shown on home & order pages.
2. **Order description** (`events.orderDescription`) — per-event text informing customers about order/pickup/payment details, shown on the Order page. Seeded on event creation from the "Default Order Description" Settings value (`default_order_description` key), but never overwritten on edit.
3. **Menu-item portion description** (`PizzaType.portionDescription`) — per-dish text (e.g. "Medium Family Size..."), set individually per menu item with no global default/prefill.

**Why:** A prior request to add a "description" field was implemented as a menu-item prefill default, then had to be reworked into a per-event field because the requester meant order-level info, not per-dish info.
**How to apply:** When asked to add/rename/repurpose a "description" setting, ask (or infer from context) which of the three scopes — event, order, or dish — is meant before touching schema/settings.
