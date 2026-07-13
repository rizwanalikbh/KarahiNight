import { useState, useRef, useEffect } from "react";
import {
  useGetMe, useGetSummary, useListOrders, useUpdateOrder, useDeleteOrder,
  useListUsers, useUpdateUser, useDeleteUser,
  useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent,
  useListAdminUsers, useCreateAdminUser, useDeleteAdminUser,
  getListAdminUsersQueryKey,
  getListOrdersQueryKey, getListUsersQueryKey, getGetSummaryQueryKey,
  getListEventsQueryKey,
} from "@workspace/api-client-react";
import type { Event } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BannerPicker } from "../components/BannerPicker";
import { EventPreviewCard } from "../components/EventPreviewCard";
import { DEFAULT_BANNER_ID } from "../lib/banners";
import { computeVolumeNumber, generateRegularEventName, getWeekdayName, type EventTypeLite } from "../lib/eventNaming";
import {
  Loader2, Trash2, Plus, CalendarDays,
  ChevronDown, ChevronUp, Pencil, X, Check, FileText, Mail, Phone, ShieldCheck, Copy, Link,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OrderUpdateStatus } from "@workspace/api-client-react";

type PizzaType = { name: string; price: number; discountedPrice?: number; category?: string; description?: string };

const DEFAULT_SLOTS = ["16:00-16:30","16:30-17:00","17:00-17:30","17:30-18:00","18:00-18:30","18:30-19:00"];
const DEFAULT_PIZZA_TYPES: PizzaType[] = [
  { name: "Lamb Karahi", price: 429, category: "Main", description: "Premium Danish lamb leg, bone-in for deep flavour — slow-simmered, then finished on high flame." },
  { name: "Chicken Karahi", price: 279, category: "Main", description: "Whole welfare-certified Danish chicken, cut karahi-style — juicy, tender, cooked fresh on high flame." },
  { name: "Beef Karahi", price: 339, category: "Main", description: "Lean, boneless beef — high-protein cut, flame-cooked in fresh masala." },
  { name: "Plain Naan", price: 15, category: "Staples", description: "Freshly baked naan from Royal Naan — the perfect companion to your karahi." },
];

// Default new-event date: the first Saturday that is at least 7 days out.
function getDefaultEventDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const daysUntilSaturday = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilSaturday);
  return d.toISOString().slice(0, 10);
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function computeOrderTotal(items: { pizzaChoice: string; quantity: number }[], pizzaTypes: PizzaType[]): number {
  return items.reduce((sum, item) => {
    const pt = pizzaTypes.find((p) => p.name === item.pizzaChoice);
    return sum + (pt?.price ?? 90) * item.quantity;
  }, 0);
}

// ── Tag editor for slots ──────────────────────────────────────────────────────
function TagEditor({
  label, tags, onChange, placeholder,
}: { label: string; tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1 text-xs">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-destructive ml-1">×</button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

const MENU_CATEGORIES = ["Main", "Staples", "Sides", "Drinks", "Dessert"] as const;
type MenuCategory = typeof MENU_CATEGORIES[number];

// ── Menu item editor with pricing ────────────────────────────────────────────
function PizzaTypeEditor({
  pizzaTypes,
  onChange,
}: { pizzaTypes: PizzaType[]; onChange: (types: PizzaType[]) => void }) {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("90");
  const [newDiscounted, setNewDiscounted] = useState("");
  const [newCategory, setNewCategory] = useState<MenuCategory>("Main");
  const [newDescription, setNewDescription] = useState("");

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDiscounted, setEditDiscounted] = useState("");
  const [editCategory, setEditCategory] = useState<MenuCategory>("Main");
  const [editDescription, setEditDescription] = useState("");

  const startEdit = (index: number, pt: PizzaType) => {
    setEditingIndex(index);
    setEditName(pt.name);
    setEditPrice(String(pt.price));
    setEditDiscounted(pt.discountedPrice !== undefined ? String(pt.discountedPrice) : "");
    setEditCategory((pt.category as MenuCategory) ?? "Main");
    setEditDescription(pt.description ?? "");
  };

  const cancelEdit = () => setEditingIndex(null);

  const saveEdit = (index: number) => {
    const name = editName.trim();
    const price = parseInt(editPrice, 10);
    if (!name || isNaN(price)) return;
    const discountedPrice = editDiscounted !== "" ? parseInt(editDiscounted, 10) : undefined;
    const description = editDescription.trim();
    const next = [...pizzaTypes];
    next[index] = {
      name, price, category: editCategory,
      ...(discountedPrice !== undefined && !isNaN(discountedPrice) ? { discountedPrice } : {}),
      ...(description ? { description } : {}),
    };
    onChange(next);
    setEditingIndex(null);
  };

  const add = () => {
    const name = newName.trim();
    const price = parseInt(newPrice, 10);
    if (!name || isNaN(price)) return;
    const discountedPrice = newDiscounted !== "" ? parseInt(newDiscounted, 10) : undefined;
    const description = newDescription.trim();
    onChange([...pizzaTypes, {
      name, price, category: newCategory,
      ...(discountedPrice !== undefined && !isNaN(discountedPrice) ? { discountedPrice } : {}),
      ...(description ? { description } : {}),
    }]);
    setNewName("");
    setNewPrice("90");
    setNewDiscounted("");
    setNewCategory("Main");
    setNewDescription("");
  };

  const remove = (index: number) => onChange(pizzaTypes.filter((_, i) => i !== index));

  const grouped = MENU_CATEGORIES.map((cat) => ({
    category: cat,
    items: pizzaTypes.map((pt, i) => ({ pt, i })).filter(({ pt }) => (pt.category ?? "Main") === cat),
  })).filter((g) => g.items.length > 0);

  // Move an item up/down relative to its neighbors within the same category
  // group (display order), swapping positions in the underlying array.
  const moveWithinGroup = (groupItems: { pt: PizzaType; i: number }[], position: number, direction: -1 | 1) => {
    const targetPosition = position + direction;
    if (targetPosition < 0 || targetPosition >= groupItems.length) return;
    const indexA = groupItems[position]!.i;
    const indexB = groupItems[targetPosition]!.i;
    const next = [...pizzaTypes];
    [next[indexA], next[indexB]] = [next[indexB]!, next[indexA]!];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">Menu Items & Prices</Label>
      <div className="space-y-3">
        {grouped.map(({ category, items }) => (
          <div key={category} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
            {items.map(({ pt, i }, position) => (
              editingIndex === i ? (
                <div key={i} className="flex gap-2 items-end flex-wrap px-3 py-2 border rounded-lg bg-secondary/20">
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input className="h-8 text-sm" value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(i); } if (e.key === "Escape") cancelEdit(); }} />
                  </div>
                  <div className="w-32 space-y-1">
                    <label className="text-xs text-muted-foreground">Category</label>
                    <Select value={editCategory} onValueChange={(v) => setEditCategory(v as MenuCategory)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MENU_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-xs text-muted-foreground">Price (DKK)</label>
                    <Input type="number" min={0} className="h-8 text-sm" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-xs text-muted-foreground">Discounted (opt.)</label>
                    <Input type="number" min={0} className="h-8 text-sm" placeholder="—" value={editDiscounted} onChange={(e) => setEditDiscounted(e.target.value)} />
                  </div>
                  <div className="flex-1 min-w-[220px] space-y-1">
                    <label className="text-xs text-muted-foreground">Description (opt.)</label>
                    <Input className="h-8 text-sm" placeholder="e.g. Lean, boneless beef — high-protein cut, flame-cooked in fresh masala."
                      value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(i); } if (e.key === "Escape") cancelEdit(); }} />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" size="sm" className="h-8" onClick={() => saveEdit(i)} disabled={!editName.trim()}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-8" onClick={cancelEdit}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background text-sm">
                  <div className="flex flex-col -my-1">
                    <button
                      type="button"
                      onClick={() => moveWithinGroup(items, position, -1)}
                      disabled={position === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWithinGroup(items, position, 1)}
                      disabled={position === items.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button type="button" onClick={() => startEdit(i, pt)} className="flex-1 text-left min-w-0">
                    <span className="block font-medium hover:text-primary transition-colors truncate">{pt.name}</span>
                    {pt.description && (
                      <span className="block text-xs text-muted-foreground truncate italic">{pt.description}</span>
                    )}
                  </button>
                  <span className="text-muted-foreground shrink-0">{pt.price} DKK</span>
                  {pt.discountedPrice !== undefined && (
                    <span className="text-xs text-accent shrink-0">({pt.discountedPrice} DKK discounted)</span>
                  )}
                  <button type="button" onClick={() => startEdit(i, pt)} className="text-muted-foreground hover:text-primary transition-colors ml-1" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors ml-1" title="Remove">×</button>
                </div>
              )
            ))}
          </div>
        ))}
        {pizzaTypes.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">No menu items yet.</p>
        )}
      </div>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[120px] space-y-1">
          <label className="text-xs text-muted-foreground">Name</label>
          <Input className="h-8 text-sm" placeholder="e.g. Chana Masala" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        </div>
        <div className="w-32 space-y-1">
          <label className="text-xs text-muted-foreground">Category</label>
          <Select value={newCategory} onValueChange={(v) => setNewCategory(v as MenuCategory)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MENU_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-24 space-y-1">
          <label className="text-xs text-muted-foreground">Price (DKK)</label>
          <Input type="number" min={0} className="h-8 text-sm" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        </div>
        <div className="w-28 space-y-1">
          <label className="text-xs text-muted-foreground">Discounted (opt.)</label>
          <Input type="number" min={0} className="h-8 text-sm" placeholder="—" value={newDiscounted} onChange={(e) => setNewDiscounted(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[220px] space-y-1">
          <label className="text-xs text-muted-foreground">Description (opt.)</label>
          <Input className="h-8 text-sm" placeholder="e.g. Lean, boneless beef — high-protein cut, flame-cooked in fresh masala."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        </div>
        <Button type="button" size="sm" className="h-8 shrink-0" onClick={add} disabled={!newName.trim()}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

// ── Inline event editor ──────────────────────────────────────────────────────
function EventEditPanel({ event, allEvents, onClose }: { event: Event; allEvents: Event[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateEvent = useUpdateEvent();

  const [eventType, setEventType] = useState<EventTypeLite>((event.eventType as EventTypeLite) ?? "special");
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date);
  const [volumeNumber, setVolumeNumber] = useState<number>(event.volumeNumber ?? 1);
  const [volumeTouched, setVolumeTouched] = useState(false);

  // Other regular events, excluding this one, used to compute the volume number.
  const otherRegularEvents = allEvents.filter((e) => e.id !== event.id);

  useEffect(() => {
    if (eventType !== "regular" || volumeTouched) return;
    setVolumeNumber(computeVolumeNumber(date, otherRegularEvents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, date, volumeTouched]);

  useEffect(() => {
    if (eventType !== "regular") return;
    setName(generateRegularEventName(volumeNumber, date));
  }, [eventType, volumeNumber, date]);
  const [totalCap, setTotalCap] = useState(String(event.totalCapacity));
  const [slotCap, setSlotCap] = useState(String(event.slotCapacity));
  const [maxPerGuest, setMaxPerGuest] = useState(event.maxPerGuest != null ? String(event.maxPerGuest) : "");
  const [description, setDescription] = useState(event.description ?? "");
  const [orderDescription, setOrderDescription] = useState(event.orderDescription ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [locationUrl, setLocationUrl] = useState(event.locationUrl ?? "");
  const [bannerVariant, setBannerVariant] = useState<string | null>(event.bannerVariant ?? DEFAULT_BANNER_ID);
  const [customBannerUrl, setCustomBannerUrl] = useState<string | null>(event.customBannerUrl ?? null);
  const [orderDeadline, setOrderDeadline] = useState<string>(() => {
    if (!event.orderDeadline) return "";
    const d = new Date(event.orderDeadline);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [slots, setSlots] = useState<string[]>(event.slots ?? DEFAULT_SLOTS);
  const [pizzaTypes, setPizzaTypes] = useState<PizzaType[]>(() => {
    const raw = event.pizzaTypes ?? [];
    if (raw.length === 0) return DEFAULT_PIZZA_TYPES;
    if (typeof raw[0] === "string") {
      return (raw as unknown as string[]).map((n) => ({ name: n, price: 90 }));
    }
    return raw as unknown as PizzaType[];
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateEvent.mutate(
      {
        id: event.id,
        data: {
          name, date,
          eventType,
          volumeNumber: eventType === "regular" ? volumeNumber : null,
          totalCapacity: parseInt(totalCap, 10) || 10,
          slotCapacity: parseInt(slotCap, 10) || 3,
          maxPerGuest: maxPerGuest === "" ? null : (parseInt(maxPerGuest, 10) || null),
          description: description || undefined,
          orderDescription: orderDescription || null,
          orderDeadline: orderDeadline || null,
          location: location || null,
          locationUrl: locationUrl || null,
          bannerVariant,
          customBannerUrl,
          slots,
          pizzaTypes: pizzaTypes as any,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Event updated" });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
          onClose();
        },
        onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={handleSave} className="border rounded-xl p-5 bg-secondary/10 space-y-4 mt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Event Type</Label>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border p-0.5 bg-secondary/20">
              <button
                type="button"
                onClick={() => setEventType("regular")}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${eventType === "regular" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => setEventType("special")}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${eventType === "special" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Special
              </button>
            </div>
            {eventType === "regular" && (
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Vol.</Label>
                <Input
                  type="number"
                  min={1}
                  className="w-16 h-8 text-sm"
                  value={volumeNumber}
                  onChange={(e) => {
                    setVolumeTouched(true);
                    setVolumeNumber(parseInt(e.target.value, 10) || 1);
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-sm">Event Name</Label>
          {eventType === "regular" ? (
            <Input value={name} readOnly disabled className="bg-secondary/30" />
          ) : (
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Total Capacity</Label>
          <Input type="number" min={1} value={totalCap} onChange={(e) => setTotalCap(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Main Items per Slot</Label>
          <Input type="number" min={1} value={slotCap} onChange={(e) => setSlotCap(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Max Dishes per Guest <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input type="number" min={1} placeholder="No limit" value={maxPerGuest} onChange={(e) => setMaxPerGuest(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Order Deadline</Label>
          <Input type="datetime-local" value={orderDeadline} onChange={(e) => setOrderDeadline(e.target.value)} />
          <p className="text-xs text-muted-foreground">After this time, no new orders or edits are accepted.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="resize-none"
          rows={2}
          placeholder="Shown on home & order pages..."
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Order Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          value={orderDescription}
          onChange={(e) => setOrderDescription(e.target.value)}
          className="resize-none"
          rows={2}
          placeholder="Shown to customers on the order page..."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Pickup Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input placeholder="e.g. Elm Street 12, 2nd floor" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Google Maps URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input type="url" placeholder="https://maps.google.com/..." value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TagEditor label="Pickup Slots" tags={slots} onChange={setSlots} placeholder="e.g. 17:00-17:30" />
        <PizzaTypeEditor pizzaTypes={pizzaTypes} onChange={setPizzaTypes} />
      </div>
      <BannerPicker
        value={{ bannerVariant, customBannerUrl }}
        onChange={(next) => { setBannerVariant(next.bannerVariant); setCustomBannerUrl(next.customBannerUrl); }}
      />
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={updateEvent.isPending}>
          {updateEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" />Save Changes</>}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4 mr-1.5" />Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Inline order editor ─────────────────────────────────────────────────────
function OrderEditPanel({
  order, event, onClose, onSave,
}: {
  order: any;
  event: any | undefined;
  onClose: () => void;
  onSave: (id: number, data: { items?: any[]; pickupSlot?: string; notes?: string; paid?: boolean }) => void;
}) {
  const slots: string[] = event?.slots ?? [];
  const eventPizzaTypes: PizzaType[] = (event?.pizzaTypes ?? []).map((pt: any) =>
    typeof pt === "string" ? { name: pt, price: 90 } : pt
  );
  const pizzaNames = eventPizzaTypes.map((pt) => pt.name);
  const maxPizzas: number = event?.slotCapacity ?? 3;

  const [items, setItems] = useState<{ pizzaChoice: string; quantity: number }[]>(
    () => {
      const raw = order.items ?? [];
      return raw.length > 0 ? raw.map((i: any) => ({ pizzaChoice: i.pizzaChoice, quantity: i.quantity })) : [{ pizzaChoice: pizzaNames[0] ?? "", quantity: 1 }];
    }
  );
  const [pickupSlot, setPickupSlot] = useState<string>(order.pickupSlot ?? "");
  const [notes, setNotes] = useState<string>(order.notes ?? "");
  const [paid, setPaid] = useState<boolean>(order.paid ?? false);

  const updateChoice = (index: number, choice: string) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, pizzaChoice: choice } : it)));

  const addPizza = () => {
    if (items.length >= maxPizzas) return;
    setItems((prev) => [...prev, { pizzaChoice: pizzaNames[0] ?? "", quantity: 1 }]);
  };

  const removePizza = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = computeOrderTotal(items, eventPizzaTypes);

  return (
    <div className="border-t bg-secondary/10 px-4 py-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Pickup Slot</Label>
          <Select value={pickupSlot} onValueChange={setPickupSlot}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {slots.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
          <Input
            className="h-8 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, preferences..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">
            Dishes ({items.length}/{maxPizzas} max)
          </Label>
          <Button
            type="button" size="sm" variant="outline"
            className="h-6 px-2 text-xs gap-1"
            onClick={addPizza}
            disabled={items.length >= maxPizzas}
          >
            <Plus className="w-3 h-3" /> Add dish
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {items.length > 1 && (
                <span className="text-xs text-muted-foreground w-5 shrink-0">#{index + 1}</span>
              )}
              <div className="flex flex-wrap gap-1.5 flex-1">
                {eventPizzaTypes.map((pt) => (
                  <button
                    key={pt.name}
                    type="button"
                    onClick={() => updateChoice(index, pt.name)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer
                      ${item.pizzaChoice === pt.name
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-secondary/50 text-foreground"
                      }`}
                  >
                    {pt.name}
                    <span className="ml-1 text-muted-foreground">{pt.price} kr</span>
                  </button>
                ))}
              </div>
              <Button
                type="button" size="icon" variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removePizza(index)}
                disabled={items.length <= 1}
                title="Remove this dish"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">Total: <span className="font-semibold text-foreground">{total} DKK</span></p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1 border-t">
        <Switch id={`paid-${order.id}`} checked={paid} onCheckedChange={setPaid} />
        <Label htmlFor={`paid-${order.id}`} className="text-sm cursor-pointer select-none">
          {paid ? "Payment received" : "Payment pending"}
        </Label>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(order.id, { items, pickupSlot, notes, paid })}>
          <Check className="w-3.5 h-3.5 mr-1.5" />Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="w-3.5 h-3.5 mr-1.5" />Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Guest inline edit panel ──────────────────────────────────────────────────
function GuestEditPanel({ user, onClose }: { user: any; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user.email ?? "");
  const [mobile, setMobile] = useState(user.mobile ?? "");

  const updateUser = useUpdateUser();

  const handleSave = () => {
    updateUser.mutate({
      id: user.id,
      data: { email: email.trim() || null, mobile: mobile.trim() || null },
    }, {
      onSuccess: () => {
        toast({ title: "Guest updated" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to update guest";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  return (
    <div className="mt-3 p-4 border rounded-xl bg-secondary/20 space-y-4">
      <p className="text-sm font-medium">{user.name}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Mobile</Label>
          <Input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={updateUser.isPending}>
          <Check className="w-3 h-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="w-3 h-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ── CSV upload card ───────────────────────────────────────────────────────────

// ── Admin Users tab ───────────────────────────────────────────────────────────
function AdminUsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMobile, setNewMobile] = useState("");

  const { data: adminUsers, isLoading } = useListAdminUsers();
  const createAdminUser = useCreateAdminUser();
  const deleteAdminUser = useDeleteAdminUser();

  const handleAdd = () => {
    const mobile = newMobile.trim();
    if (!mobile) return;
    createAdminUser.mutate(
      { data: { mobile } },
      {
        onSuccess: () => {
          toast({ title: "Admin added" });
          setNewMobile("");
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Could not add admin.";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this admin user?")) return;
    deleteAdminUser.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Admin removed" });
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Could not remove admin.";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Add Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Mobile Number</Label>
              <div className="flex items-center gap-2">
                <span className="h-10 px-3 flex items-center rounded-md border border-input bg-muted text-sm font-medium text-muted-foreground shrink-0">+45</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="31 70 53 42"
                  className="h-10"
                  maxLength={8}
                />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={newMobile.length !== 8 || createAdminUser.isPending} className="h-10">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mobile</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
              )}
              {adminUsers?.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-mono">{admin.mobile}</TableCell>
                  <TableCell>
                    {admin.isSuperuser
                      ? <Badge variant="default" className="text-xs">Superuser</Badge>
                      : <Badge variant="secondary" className="text-xs">Admin</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(admin.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      disabled={admin.isSuperuser || deleteAdminUser.isPending}
                      title={admin.isSuperuser ? "Superuser cannot be removed" : "Remove admin"}
                      onClick={() => handleDelete(admin.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────
export function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useGetMe();
  const { data: events } = useListEvents();
  const { data: orders } = useListOrders({});
  const { data: users } = useListUsers();

  const [summaryEventId, setSummaryEventId] = useState<number | undefined>(undefined);
  const activeEventId = summaryEventId ?? events?.[0]?.id;
  const { data: summary } = useGetSummary(
    { eventId: activeEventId },
    { query: { enabled: !!activeEventId, queryKey: getGetSummaryQueryKey({ eventId: activeEventId }) } }
  );

  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const updateEvent = useUpdateEvent();

  // Event creation form state
  const [newEventType, setNewEventType] = useState<EventTypeLite>("regular");
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState(getDefaultEventDate);
  const [newEventVolume, setNewEventVolume] = useState<number>(1);
  const [newEventVolumeTouched, setNewEventVolumeTouched] = useState(false);
  const [newEventCapacity, setNewEventCapacity] = useState("10");
  const [newEventSlot, setNewEventSlot] = useState("3");
  const [newEventMaxPerGuest, setNewEventMaxPerGuest] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventOrderDescription, setNewEventOrderDescription] = useState("");
  const [newEventDeadline, setNewEventDeadline] = useState("");
  const [newEventSlots, setNewEventSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [newEventPizzaTypes, setNewEventPizzaTypes] = useState<PizzaType[]>(DEFAULT_PIZZA_TYPES);
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventLocationUrl, setNewEventLocationUrl] = useState("");
  const [newEventBannerVariant, setNewEventBannerVariant] = useState<string | null>(DEFAULT_BANNER_ID);
  const [newEventCustomBannerUrl, setNewEventCustomBannerUrl] = useState<string | null>(null);

  // Event editing state
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<number | null>(null);

  const handleCopyEventLink = (event: Event) => {
    const slug = event.slug ?? String(event.id);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${window.location.origin}${base}/?event=${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedEventId(event.id);
      toast({ title: "Link copied!", description: url });
      setTimeout(() => setCopiedEventId(null), 2000);
    });
  };

  // Order editing state
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [consentUserId, setConsentUserId] = useState<number | null>(null);
  const [filterEventId, setFilterEventId] = useState<string>("all");
  const [consentTextDraft, setConsentTextDraft] = useState("");
  const [consentTextOriginal, setConsentTextOriginal] = useState("");
  const [consentTextSaving, setConsentTextSaving] = useState(false);
  const [orderTermsDraft, setOrderTermsDraft] = useState("");
  const [orderTermsOriginal, setOrderTermsOriginal] = useState("");
  const [orderTermsSaving, setOrderTermsSaving] = useState(false);
  const [termsOrderId, setTermsOrderId] = useState<number | null>(null);
  const [defaultEventDescriptionDraft, setDefaultEventDescriptionDraft] = useState("");
  const [defaultEventDescriptionOriginal, setDefaultEventDescriptionOriginal] = useState("");
  const [defaultEventDescriptionSaving, setDefaultEventDescriptionSaving] = useState(false);
  const [defaultOrderDescriptionDraft, setDefaultOrderDescriptionDraft] = useState("");
  const [defaultOrderDescriptionOriginal, setDefaultOrderDescriptionOriginal] = useState("");
  const [defaultOrderDescriptionSaving, setDefaultOrderDescriptionSaving] = useState(false);

  useEffect(() => {
    if (!sessionLoading && (!session?.authenticated || session.role !== "admin")) {
      setLocation("/admin");
    }
  }, [sessionLoading, session, setLocation]);

  // Auto-compute the volume number for the "Create Event" form whenever the
  // date changes or events load, unless the admin has manually overridden it.
  useEffect(() => {
    if (newEventType !== "regular" || newEventVolumeTouched) return;
    setNewEventVolume(computeVolumeNumber(newEventDate, events ?? []));
  }, [newEventType, newEventDate, events, newEventVolumeTouched]);

  // Auto-generate the display name for "Regular" events in the Create form.
  useEffect(() => {
    if (newEventType !== "regular") return;
    setNewEventName(generateRegularEventName(newEventVolume, newEventDate));
  }, [newEventType, newEventVolume, newEventDate]);

  useEffect(() => {
    fetch("/api/settings/consent-text")
      .then((r) => r.json())
      .then((d: { value?: string }) => {
        if (typeof d.value === "string") {
          setConsentTextDraft(d.value);
          setConsentTextOriginal(d.value);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/order-terms")
      .then((r) => r.json())
      .then((d: { value?: string }) => {
        if (typeof d.value === "string") {
          setOrderTermsDraft(d.value);
          setOrderTermsOriginal(d.value);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/default-event-description")
      .then((r) => r.json())
      .then((d: { value?: string }) => {
        if (typeof d.value === "string") {
          setDefaultEventDescriptionDraft(d.value);
          setDefaultEventDescriptionOriginal(d.value);
          setNewEventDescription(d.value);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/default-order-description")
      .then((r) => r.json())
      .then((d: { value?: string }) => {
        if (typeof d.value === "string") {
          setDefaultOrderDescriptionDraft(d.value);
          setDefaultOrderDescriptionOriginal(d.value);
          setNewEventOrderDescription(d.value);
        }
      })
      .catch(() => {});
  }, []);

  if (sessionLoading) return <Layout><div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div></Layout>;
  if (!session?.authenticated || session.role !== "admin") return null;

  const handleSaveConsentText = async () => {
    if (!consentTextDraft.trim() || consentTextDraft === consentTextOriginal) return;
    setConsentTextSaving(true);
    try {
      const r = await fetch("/api/settings/consent-text", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: consentTextDraft.trim() }),
      });
      if (!r.ok) throw new Error("Failed");
      const d: { value?: string } = await r.json();
      if (typeof d.value === "string") {
        setConsentTextOriginal(d.value);
        setConsentTextDraft(d.value);
        toast({ title: "Consent text saved" });
      }
    } catch {
      toast({ title: "Failed to save consent text", variant: "destructive" });
    } finally {
      setConsentTextSaving(false);
    }
  };

  const handleSaveDefaultEventDescription = async () => {
    if (defaultEventDescriptionDraft === defaultEventDescriptionOriginal) return;
    setDefaultEventDescriptionSaving(true);
    try {
      const r = await fetch("/api/settings/default-event-description", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: defaultEventDescriptionDraft }),
      });
      if (!r.ok) throw new Error("Failed");
      const d: { value?: string } = await r.json();
      if (typeof d.value === "string") {
        setDefaultEventDescriptionOriginal(d.value);
        setDefaultEventDescriptionDraft(d.value);
        // If the Create Event form's description still matches the old default
        // (i.e. the admin hasn't started customizing it for this event), keep it in sync.
        setNewEventDescription((current) => (current === defaultEventDescriptionOriginal ? d.value! : current));
        toast({ title: "Default event description saved" });
      }
    } catch {
      toast({ title: "Failed to save default event description", variant: "destructive" });
    } finally {
      setDefaultEventDescriptionSaving(false);
    }
  };

  const handleSaveDefaultOrderDescription = async () => {
    if (defaultOrderDescriptionDraft === defaultOrderDescriptionOriginal) return;
    setDefaultOrderDescriptionSaving(true);
    try {
      const r = await fetch("/api/settings/default-order-description", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: defaultOrderDescriptionDraft }),
      });
      if (!r.ok) throw new Error("Failed");
      const d: { value?: string } = await r.json();
      if (typeof d.value === "string") {
        setDefaultOrderDescriptionOriginal(d.value);
        setDefaultOrderDescriptionDraft(d.value);
        toast({ title: "Default order description saved" });
      }
    } catch {
      toast({ title: "Failed to save default order description", variant: "destructive" });
    } finally {
      setDefaultOrderDescriptionSaving(false);
    }
  };

  const handleSaveOrderTerms = async () => {
    if (!orderTermsDraft.trim() || orderTermsDraft === orderTermsOriginal) return;
    setOrderTermsSaving(true);
    try {
      const r = await fetch("/api/settings/order-terms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: orderTermsDraft.trim() }),
      });
      if (!r.ok) throw new Error("Failed");
      const d: { value?: string } = await r.json();
      if (typeof d.value === "string") {
        setOrderTermsOriginal(d.value);
        setOrderTermsDraft(d.value);
        toast({ title: "Order terms saved" });
      }
    } catch {
      toast({ title: "Failed to save order terms", variant: "destructive" });
    } finally {
      setOrderTermsSaving(false);
    }
  };

  const handleStatusChange = (id: number, status: OrderUpdateStatus) => {
    updateOrder.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
    });
  };

  const handleTogglePaid = (id: number, paid: boolean) => {
    updateOrder.mutate({ id, data: { paid } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
    });
  };

  const handleSaveOrderEdit = (id: number, data: { items?: any[]; pickupSlot?: string; notes?: string; paid?: boolean }) => {
    updateOrder.mutate({ id, data: { items: data.items, pickupSlot: data.pickupSlot, notes: data.notes, paid: data.paid } }, {
      onSuccess: () => {
        toast({ title: "Order updated" });
        setEditingOrderId(null);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
      onError: () => toast({ title: "Failed to update order", variant: "destructive" }),
    });
  };

  const handleDeleteOrder = (id: number) => {
    if (!confirm("Delete this order?")) return;
    deleteOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order deleted" });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  const handleToggleUser = (id: number, active: boolean) => {
    updateUser.mutate({ id, data: { active } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;
    createEvent.mutate(
      {
        data: {
          name: newEventName,
          date: newEventDate,
          eventType: newEventType,
          volumeNumber: newEventType === "regular" ? newEventVolume : undefined,
          totalCapacity: parseInt(newEventCapacity, 10) || 10,
          slotCapacity: parseInt(newEventSlot, 10) || 3,
          maxPerGuest: newEventMaxPerGuest === "" ? undefined : (parseInt(newEventMaxPerGuest, 10) || undefined),
          description: newEventDescription || undefined,
          orderDescription: newEventOrderDescription || undefined,
          orderDeadline: newEventDeadline || undefined,
          location: newEventLocation || undefined,
          locationUrl: newEventLocationUrl || undefined,
          bannerVariant: newEventBannerVariant ?? undefined,
          customBannerUrl: newEventCustomBannerUrl ?? undefined,
          slots: newEventSlots,
          pizzaTypes: newEventPizzaTypes as any,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Event created" });
          setNewEventType("regular");
          setNewEventName("");
          setNewEventVolumeTouched(false);
          setNewEventDescription(defaultEventDescriptionOriginal);
          setNewEventOrderDescription(defaultOrderDescriptionOriginal);
          setNewEventDeadline("");
          setNewEventDate(getDefaultEventDate());
          setNewEventSlots(DEFAULT_SLOTS);
          setNewEventPizzaTypes(DEFAULT_PIZZA_TYPES);
          setNewEventLocation("");
          setNewEventLocationUrl("");
          setNewEventBannerVariant(DEFAULT_BANNER_ID);
          setNewEventCustomBannerUrl(null);
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        },
      }
    );
  };

  const handleToggleEvent = (id: number, active: boolean) => {
    updateEvent.mutate({ id, data: { active } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      },
    });
  };

  const handleDeleteEvent = (id: number) => {
    if (!confirm("Delete this event and all its orders?")) return;
    deleteEvent.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Event deleted" });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
    });
  };

  const filteredOrders = filterEventId === "all"
    ? (orders ?? [])
    : (orders ?? []).filter((o) => o.eventId === parseInt(filterEventId, 10));

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Kitchen Dashboard</h1>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="users">Guests</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* SUMMARY */}
          <TabsContent value="summary" className="space-y-4 pt-4">
            {events && events.length > 1 && (
              <div className="flex items-center gap-3">
                <Label className="shrink-0 text-sm font-medium">Event</Label>
                <Select
                  value={summaryEventId ? String(summaryEventId) : String(events[0]?.id ?? "")}
                  onValueChange={(v) => setSummaryEventId(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-64 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Booked</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif text-primary">{summary?.totalBooked || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">out of {summary?.totalCapacity ?? "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-serif text-accent">{summary?.totalRemaining ?? "—"}</div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Slot Breakdown{summary ? ` — ${summary.eventName}` : ""}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary?.slots.map((slot) => (
                    <div key={slot.slot} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div className="font-medium">{slot.slot}</div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-primary font-bold">{slot.booked} booked</span>
                        <span className="text-muted-foreground w-20 text-right">{slot.available} available</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="pt-4 space-y-3">
            {events && events.length > 1 && (
              <div className="flex items-center gap-3">
                <Label className="shrink-0 text-sm font-medium">Filter by event</Label>
                <Select value={filterEventId} onValueChange={setFilterEventId}>
                  <SelectTrigger className="w-52 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Code</TableHead>
                      {events && events.length > 1 && <TableHead>Event</TableHead>}
                      <TableHead>Dishes</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders yet.</TableCell>
                      </TableRow>
                    )}
                    {filteredOrders.map((order) => {
                      const orderEvent = events?.find((e) => e.id === order.eventId);
                      const eventPizzaTypes: PizzaType[] = (orderEvent?.pizzaTypes ?? []).map((pt: any) =>
                        typeof pt === "string" ? { name: pt, price: 90 } : pt
                      );
                      const orderTotal = computeOrderTotal(order.items ?? [], eventPizzaTypes);
                      const isEditing = editingOrderId === order.id;
                      return (
                        <>
                          <TableRow key={order.id} className={isEditing ? "bg-secondary/20" : undefined}>
                            <TableCell className="font-medium">{order.userName}</TableCell>
                            <TableCell className="font-mono text-xs text-primary/80 font-semibold">
                              {order.orderCode ? `#${order.orderCode}` : "—"}
                            </TableCell>
                            {events && events.length > 1 && (
                              <TableCell className="text-xs text-muted-foreground">{order.eventName}</TableCell>
                            )}
                            <TableCell>
                              <div className="space-y-0.5">
                                {(order.items ?? []).map((item: any, i: number) => (
                                  <div key={i} className="text-sm">{item.pizzaChoice}</div>
                                ))}
                                {orderTotal > 0 && (
                                  <div className="text-xs text-muted-foreground">{orderTotal} DKK</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{order.pickupSlot}</TableCell>
                            <TableCell className="max-w-[220px] text-xs">
                              {order.notes ? (
                                <span className="inline-block px-2 py-1 rounded-md bg-amber-100 text-amber-900 font-bold leading-snug">
                                  {order.notes}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={order.status}
                                onValueChange={(val) => handleStatusChange(order.id, val as OrderUpdateStatus)}
                              >
                                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="declined">Declined</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={order.paid}
                                onCheckedChange={(v) => handleTogglePaid(order.id, v)}
                                title={order.paid ? "Mark as unpaid" : "Mark as paid"}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {order.termsText && (
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                    onClick={() => setTermsOrderId(order.id)}
                                    title="View accepted terms"
                                  >
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                )}
                                {order.status === "confirmed" && (
                                  <a
                                    href={`/receipt/${order.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open receipt (save as PDF)"
                                  >
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-700 hover:bg-green-50">
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </a>
                                )}
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-8 w-8 ${isEditing ? "text-primary bg-primary/10" : ""}`}
                                  onClick={() => setEditingOrderId(isEditing ? null : order.id)}
                                  title="Edit order"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isEditing && (
                            <TableRow key={`${order.id}-edit`}>
                              <TableCell colSpan={events && events.length > 1 ? 9 : 8} className="p-0">
                                <OrderEditPanel
                                  order={order}
                                  event={orderEvent}
                                  onClose={() => setEditingOrderId(null)}
                                  onSave={handleSaveOrderEdit}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVENTS */}
          <TabsContent value="events" className="pt-4 space-y-4">
            {/* Create form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Create Event</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Date</Label>
                        <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Event Type</Label>
                        <div className="flex items-center gap-3">
                          <div className="inline-flex rounded-lg border p-0.5 bg-secondary/20">
                            <button
                              type="button"
                              onClick={() => setNewEventType("regular")}
                              className={`px-3 py-1 text-sm rounded-md transition-colors ${newEventType === "regular" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            >
                              Regular
                            </button>
                            <button
                              type="button"
                              onClick={() => { setNewEventType("special"); setNewEventName(""); }}
                              className={`px-3 py-1 text-sm rounded-md transition-colors ${newEventType === "special" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            >
                              Special
                            </button>
                          </div>
                          {newEventType === "regular" && (
                            <div className="flex items-center gap-1.5">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">Vol.</Label>
                              <Input
                                type="number"
                                min={1}
                                className="w-16 h-8 text-sm"
                                value={newEventVolume}
                                onChange={(e) => {
                                  setNewEventVolumeTouched(true);
                                  setNewEventVolume(parseInt(e.target.value, 10) || 1);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-sm">Event Name</Label>
                        {newEventType === "regular" ? (
                          <Input value={newEventName} readOnly disabled className="bg-secondary/30" />
                        ) : (
                          <Input placeholder="e.g. Friday Karahi Night" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Total Capacity</Label>
                        <Input type="number" min={1} value={newEventCapacity} onChange={(e) => setNewEventCapacity(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Main Items per Slot</Label>
                        <Input type="number" min={1} value={newEventSlot} onChange={(e) => setNewEventSlot(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Max Dishes per Guest <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input type="number" min={1} placeholder="No limit" value={newEventMaxPerGuest} onChange={(e) => setNewEventMaxPerGuest(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Order Deadline <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input type="datetime-local" value={newEventDeadline} onChange={(e) => setNewEventDeadline(e.target.value)} />
                        <p className="text-xs text-muted-foreground">After this time, no new orders or edits.</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Description</Label>
                      <Textarea
                        placeholder="Shown on home & order pages..."
                        value={newEventDescription}
                        onChange={(e) => setNewEventDescription(e.target.value)}
                        className="resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Order Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Textarea
                        placeholder="Shown to customers on the order page..."
                        value={newEventOrderDescription}
                        onChange={(e) => setNewEventOrderDescription(e.target.value)}
                        className="resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Pickup Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input placeholder="e.g. Elm Street 12, 2nd floor" value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Google Maps URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input type="url" placeholder="https://maps.google.com/..." value={newEventLocationUrl} onChange={(e) => setNewEventLocationUrl(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TagEditor label="Pickup Slots" tags={newEventSlots} onChange={setNewEventSlots} placeholder="e.g. 17:00-17:30" />
                      <PizzaTypeEditor pizzaTypes={newEventPizzaTypes} onChange={setNewEventPizzaTypes} />
                    </div>
                    <BannerPicker
                      value={{ bannerVariant: newEventBannerVariant, customBannerUrl: newEventCustomBannerUrl }}
                      onChange={(next) => { setNewEventBannerVariant(next.bannerVariant); setNewEventCustomBannerUrl(next.customBannerUrl); }}
                    />
                    <Button type="submit" disabled={createEvent.isPending || !newEventName.trim() || !newEventDate}>
                      <Plus className="w-4 h-4 mr-2" /> Create Event
                    </Button>
                  </form>
                  <div className="lg:sticky lg:top-4 lg:self-start">
                    <EventPreviewCard
                      name={newEventName}
                      date={newEventDate}
                      description={newEventDescription}
                      location={newEventLocation}
                      pizzaTypes={newEventPizzaTypes}
                      banner={{ bannerVariant: newEventBannerVariant, customBannerUrl: newEventCustomBannerUrl }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Events list */}
            <div className="space-y-3">
              {(!events || events.length === 0) && (
                <p className="text-center py-8 text-muted-foreground">No events yet.</p>
              )}
              {events?.map((event) => {
                const eventPizzaTypes: PizzaType[] = (event.pizzaTypes ?? []).map((pt: any) =>
                  typeof pt === "string" ? { name: pt, price: 90 } : pt
                );
                return (
                  <Card key={event.id} className={!event.active ? "opacity-60" : ""}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{event.name}</span>
                            <Badge variant={event.active ? "default" : "secondary"} className="text-xs">
                              {event.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                            <span>{formatEventDate(event.date)}</span>
                            <span>{event.totalCapacity} dishes total · {event.slotCapacity}/slot{event.maxPerGuest != null ? ` · max ${event.maxPerGuest}/guest` : ""}</span>
                            {event.orderDeadline && (
                              <span className={new Date() > new Date(event.orderDeadline) ? "text-destructive" : ""}>
                                Orders close {new Date(event.orderDeadline).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">{event.description}</p>
                          )}
                          {event.location && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                              📍 {event.locationUrl
                                ? <a href={event.locationUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">{event.location}</a>
                                : event.location}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(event.slots ?? []).map((s) => (
                              <Badge key={s} variant="outline" className="text-xs font-normal">{s}</Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {eventPizzaTypes.map((pt) => (
                              <Badge key={pt.name} variant="secondary" className="text-xs font-normal">
                                {pt.name} · {pt.price} DKK{pt.discountedPrice !== undefined ? ` (${pt.discountedPrice} disc.)` : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch checked={event.active} onCheckedChange={(v) => handleToggleEvent(event.id, v)} />
                          <Button
                            variant="ghost" size="icon" className={`h-8 w-8 ${copiedEventId === event.id ? "text-green-600" : ""}`}
                            onClick={() => handleCopyEventLink(event)}
                            title="Copy event link"
                          >
                            {copiedEventId === event.id
                              ? <Check className="h-4 w-4" />
                              : <Link className="h-4 w-4" />
                            }
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => setEditingEventId(editingEventId === event.id ? null : event.id)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteEvent(event.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {editingEventId === event.id && (
                        <EventEditPanel event={event} allEvents={events ?? []} onClose={() => setEditingEventId(null)} />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ADMINS */}
          <TabsContent value="admins" className="pt-4 space-y-4">
            <AdminUsersTab />
          </TabsContent>

          {/* GUESTS */}
          <TabsContent value="users" className="pt-4 space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <>
                          <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.email ? (
                                <a href={`mailto:${user.email}`} className="hover:text-foreground transition-colors">{user.email}</a>
                              ) : <span className="text-xs">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.mobile ?? <span className="text-xs">—</span>}
                            </TableCell>
                            <TableCell className="font-mono tracking-widest">{user.code}</TableCell>
                            <TableCell>
                              <Switch checked={user.active} onCheckedChange={(v) => handleToggleUser(user.id, v)} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {user.mobile && (() => {
                                  const digits = user.mobile.replace(/^\+45/, "").replace(/\D/g, "");
                                  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                                  const link = `${window.location.origin}${base}/login?mobile=${digits}`;
                                  return (
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                      title="Copy login link"
                                      onClick={() => {
                                        navigator.clipboard.writeText(link).then(() =>
                                          toast({ title: "Login link copied!", description: `Share this link with ${user.name}` })
                                        );
                                      }}
                                    >
                                      <Link className="h-4 w-4" />
                                    </Button>
                                  );
                                })()}
                                {user.consentAcceptedAt && (
                                  <Button variant="ghost" size="icon" onClick={() => setConsentUserId(user.id)} className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="View consent record">
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-8 w-8 ${isEditing ? "text-primary bg-primary/10" : ""}`}
                                  onClick={() => setEditingUserId(isEditing ? null : user.id)}
                                  title="Edit guest"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { if (!confirm("Delete this guest?")) return; deleteUser.mutate({ id: user.id }, { onSuccess: () => { toast({ title: "Guest deleted" }); queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); } }); }} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Delete guest">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isEditing && (
                            <TableRow key={`${user.id}-edit`}>
                              <TableCell colSpan={6} className="p-0 pb-2">
                                <div className="px-4">
                                  <GuestEditPanel
                                    user={user}
                                    onClose={() => setEditingUserId(null)}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="pt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> GDPR Consent Text
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This text is shown to new guests during registration. They must read and accept it before receiving their verification code. Changes take effect immediately for new sign-ups.
                </p>
                <Textarea
                  value={consentTextDraft}
                  onChange={(e) => setConsentTextDraft(e.target.value)}
                  rows={6}
                  className="text-sm"
                  placeholder="Enter consent text…"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {consentTextDraft !== consentTextOriginal ? "Unsaved changes" : "Saved"}
                  </p>
                  <div className="flex gap-2">
                    {consentTextDraft !== consentTextOriginal && (
                      <Button variant="outline" size="sm" onClick={() => setConsentTextDraft(consentTextOriginal)}>
                        Reset
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveConsentText}
                      disabled={consentTextSaving || !consentTextDraft.trim() || consentTextDraft === consentTextOriginal}
                    >
                      {consentTextSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Save</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Order Terms &amp; Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Guests must accept these terms before placing an order. The exact text is stored with each order. Changes take effect for new orders immediately.
                </p>
                <Textarea
                  value={orderTermsDraft}
                  onChange={(e) => setOrderTermsDraft(e.target.value)}
                  rows={8}
                  className="text-sm font-mono"
                  placeholder="Enter order terms and conditions…"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {orderTermsDraft !== orderTermsOriginal ? "Unsaved changes" : "Saved"}
                  </p>
                  <div className="flex gap-2">
                    {orderTermsDraft !== orderTermsOriginal && (
                      <Button variant="outline" size="sm" onClick={() => setOrderTermsDraft(orderTermsOriginal)}>
                        Reset
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveOrderTerms}
                      disabled={orderTermsSaving || !orderTermsDraft.trim() || orderTermsDraft === orderTermsOriginal}
                    >
                      {orderTermsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Save</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" /> Default Event Description
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pre-fills the Description field when creating a new event. It's fully editable per event and never affects existing events.
                </p>
                <Textarea
                  value={defaultEventDescriptionDraft}
                  onChange={(e) => setDefaultEventDescriptionDraft(e.target.value)}
                  rows={4}
                  className="text-sm"
                  placeholder="Enter default event description…"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {defaultEventDescriptionDraft !== defaultEventDescriptionOriginal ? "Unsaved changes" : "Saved"}
                  </p>
                  <div className="flex gap-2">
                    {defaultEventDescriptionDraft !== defaultEventDescriptionOriginal && (
                      <Button variant="outline" size="sm" onClick={() => setDefaultEventDescriptionDraft(defaultEventDescriptionOriginal)}>
                        Reset
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveDefaultEventDescription}
                      disabled={defaultEventDescriptionSaving || defaultEventDescriptionDraft === defaultEventDescriptionOriginal}
                    >
                      {defaultEventDescriptionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Save</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Default Order Description
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pre-fills the "Order Description" field (shown to customers on the order page) when creating a new event. It's fully editable per event and never affects existing events.
                </p>
                <Textarea
                  value={defaultOrderDescriptionDraft}
                  onChange={(e) => setDefaultOrderDescriptionDraft(e.target.value)}
                  rows={2}
                  className="text-sm"
                  placeholder="Enter default order description…"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {defaultOrderDescriptionDraft !== defaultOrderDescriptionOriginal ? "Unsaved changes" : "Saved"}
                  </p>
                  <div className="flex gap-2">
                    {defaultOrderDescriptionDraft !== defaultOrderDescriptionOriginal && (
                      <Button variant="outline" size="sm" onClick={() => setDefaultOrderDescriptionDraft(defaultOrderDescriptionOriginal)}>
                        Reset
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveDefaultOrderDescription}
                      disabled={defaultOrderDescriptionSaving || defaultOrderDescriptionDraft === defaultOrderDescriptionOriginal}
                    >
                      {defaultOrderDescriptionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Save</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {(() => {
        const consentUser = consentUserId != null ? (users ?? []).find((u) => u.id === consentUserId) : null;
        if (!consentUser) return null;
        const acceptedAt = consentUser.consentAcceptedAt
          ? new Date(consentUser.consentAcceptedAt).toLocaleString("da-DK", { dateStyle: "long", timeStyle: "short" })
          : null;
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) setConsentUserId(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  GDPR Consent — {consentUser.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Accepted on</p>
                  <p className="text-sm text-foreground">{acceptedAt ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consent text accepted</p>
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <p className="text-sm text-foreground leading-relaxed">{consentUser.consentText ?? "—"}</p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {(() => {
        const termsOrder = termsOrderId != null ? (orders ?? []).find((o) => o.id === termsOrderId) : null;
        if (!termsOrder) return null;
        const acceptedAt = termsOrder.termsAcceptedAt
          ? new Date(termsOrder.termsAcceptedAt).toLocaleString("da-DK", { dateStyle: "long", timeStyle: "short" })
          : null;
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) setTermsOrderId(null); }}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  Accepted Terms — {termsOrder.userName}
                  {termsOrder.orderCode && (
                    <span className="ml-1 font-mono text-sm text-muted-foreground">#{termsOrder.orderCode}</span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Accepted on</p>
                  <p className="text-sm text-foreground">{acceptedAt ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terms text accepted</p>
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{termsOrder.termsText ?? "—"}</p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </Layout>
  );
}
