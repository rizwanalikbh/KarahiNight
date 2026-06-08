import { useParams } from "wouter";
import { useListOrders, useListEvents } from "@workspace/api-client-react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type PizzaType = { name: string; price: number; discountedPrice?: number };

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return dateStr; }
}

function formatNow(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function lookupPrice(pizzaChoice: string, pizzaTypes: PizzaType[]): number {
  const pt = pizzaTypes.find((p) => p.name === pizzaChoice);
  return pt?.price ?? 70;
}

export function Receipt() {
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id ?? "", 10);

  const { data: orders, isLoading: ordersLoading } = useListOrders({});
  const { data: events, isLoading: eventsLoading } = useListEvents();

  if (ordersLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const order = orders?.find((o) => o.id === orderId);
  const event = events?.find((e) => e.id === order?.eventId);

  if (!order || !event) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Receipt not found.
      </div>
    );
  }

  const items = order.items ?? [];
  const eventPizzaTypes: PizzaType[] = (event.pizzaTypes ?? []).map((pt: any) =>
    typeof pt === "string" ? { name: pt, price: 70 } : pt
  );

  const totalPrice = items.reduce((sum, item) => {
    return sum + lookupPrice(item.pizzaChoice, eventPizzaTypes) * item.quantity;
  }, 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 2cm; }
        }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50">
        <Button onClick={() => window.print()} size="sm" className="gap-2 shadow-lg">
          <Printer className="w-4 h-4" />
          Save as PDF
        </Button>
      </div>

      {/* Receipt */}
      <div className="min-h-screen bg-white flex items-start justify-center py-16 px-6">
        <div className="w-full max-w-md font-sans text-gray-800">

          {/* Header */}
          <div className="text-center mb-10 border-b-2 border-gray-200 pb-8">
            <div className="text-3xl mb-1">🍕</div>
            <h1 className="text-2xl font-bold tracking-tight mt-2">Pizza Night</h1>
            <p className="text-sm text-gray-500 mt-1">Order Receipt</p>
          </div>

          {/* Event info */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Event</h2>
            <p className="font-semibold text-lg">{event.name}</p>
            <p className="text-gray-500 text-sm">{formatDate(event.date)}</p>
          </div>

          {/* Guest */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Guest</h2>
            <p className="font-semibold text-lg">{order.userName}</p>
          </div>

          {/* Order items */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Order</h2>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {items.map((item, i) => {
                const unitPrice = lookupPrice(item.pizzaChoice, eventPizzaTypes);
                return (
                  <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-gray-100 last:border-0">
                    <span className="font-medium">{item.pizzaChoice}</span>
                    <span className="text-gray-500 text-sm">{item.quantity} × {unitPrice} DKK</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pickup */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Pickup</h2>
            <p className="font-semibold text-lg">{order.pickupSlot} <span className="text-sm font-normal text-gray-400">CET</span></p>
            <p className="text-gray-500 text-sm mt-0.5">{formatDate(event.date)}</p>
          </div>

          {order.notes && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Notes</h2>
              <p className="text-gray-600">{order.notes}</p>
            </div>
          )}

          {/* Total */}
          <div className="border-t-2 border-gray-200 pt-6 flex justify-between items-center mb-10">
            <span className="font-semibold text-gray-600">Total</span>
            <span className="text-2xl font-bold">{totalPrice} DKK</span>
          </div>

          {/* Status + paid badges */}
          <div className="text-center mb-10 flex justify-center gap-3 flex-wrap">
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-800 uppercase tracking-wide">
              ✓ Confirmed
            </span>
            {order.paid ? (
              <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 uppercase tracking-wide">
                ✓ Paid
              </span>
            ) : (
              <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 uppercase tracking-wide">
                Payment Pending
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 border-t border-gray-100 pt-6">
            <p>Generated {formatNow()}</p>
            <p className="mt-1">Private gathering — not a commercial transaction.</p>
          </div>

        </div>
      </div>
    </>
  );
}
