import { useState, useEffect } from "react";
import {
  useGetMe,
  useListRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  useListOrders,
  useListEvents,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import type { Recipe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Package, BookOpen } from "lucide-react";

interface IngredientRow {
  name: string;
  quantity: string;
  unit: string;
}

const COMMON_UNITS = ["g", "kg", "ml", "L", "pcs", "tbsp", "tsp", "pinch"];

function emptyIngredient(): IngredientRow {
  return { name: "", quantity: "", unit: "g" };
}

function RecipeCard({
  recipe,
  onSaved,
}: {
  recipe: Recipe;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const update = useUpdateRecipe();
  const del = useDeleteRecipe();

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<IngredientRow[]>(
    recipe.ingredients.length > 0
      ? recipe.ingredients.map((i) => ({ name: i.name, quantity: String(i.quantity), unit: i.unit }))
      : [emptyIngredient()]
  );

  useEffect(() => {
    setRows(
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((i) => ({ name: i.name, quantity: String(i.quantity), unit: i.unit }))
        : [emptyIngredient()]
    );
  }, [recipe.id]);

  const handleSave = () => {
    const ingredients = rows
      .filter((r) => r.name.trim() && r.quantity.trim())
      .map((r) => ({ name: r.name.trim(), quantity: parseFloat(r.quantity), unit: r.unit }));

    update.mutate(
      { id: recipe.id, data: { ingredients } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
          toast({ title: "Recipe saved" });
          onSaved();
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    del.mutate(
      { id: recipe.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
          toast({ title: "Recipe deleted" });
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  };

  const addRow = () => setRows((r) => [...r, emptyIngredient()]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof IngredientRow, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">{recipe.pizzaType}</span>
          <span className="text-xs text-muted-foreground">
            {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? "s" : ""}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t">
          <p className="text-xs text-muted-foreground mt-4 mb-3 font-medium uppercase tracking-wider">
            Ingredients per dish
          </p>

          <div className="space-y-2 mb-4">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  className="flex-1 text-sm"
                  placeholder="Ingredient"
                  value={row.name}
                  onChange={(e) => updateRow(i, "name", e.target.value)}
                />
                <Input
                  className="w-24 text-sm"
                  placeholder="Qty"
                  type="number"
                  min="0"
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(i, "quantity", e.target.value)}
                />
                <Select value={row.unit} onValueChange={(v) => updateRow(i, "unit", v)}>
                  <SelectTrigger className="w-20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add ingredient
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={del.isPending}
              >
                Delete recipe
              </Button>
              <Button size="sm" onClick={handleSave} disabled={update.isPending} className="gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewRecipeForm({
  existingTypes,
  availableTypes,
  onCreated,
}: {
  existingTypes: string[];
  availableTypes: string[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const create = useCreateRecipe();
  const [pizzaType, setPizzaType] = useState("");
  const [customType, setCustomType] = useState("");
  const [rows, setRows] = useState<IngredientRow[]>([emptyIngredient()]);

  const unused = availableTypes.filter((t) => !existingTypes.includes(t));

  const addRow = () => setRows((r) => [...r, emptyIngredient()]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof IngredientRow, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  const handleCreate = () => {
    const type = pizzaType === "__custom" ? customType.trim() : pizzaType.trim();
    if (!type) { toast({ title: "Enter a dish type", variant: "destructive" }); return; }
    const ingredients = rows
      .filter((r) => r.name.trim() && r.quantity.trim())
      .map((r) => ({ name: r.name.trim(), quantity: parseFloat(r.quantity), unit: r.unit }));

    create.mutate(
      { data: { pizzaType: type, ingredients } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
          toast({ title: `Recipe for ${type} created` });
          setPizzaType("");
          setCustomType("");
          setRows([emptyIngredient()]);
          onCreated();
        },
        onError: () => toast({ title: "Failed to create recipe", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="border rounded-xl bg-card p-5 border-dashed">
      <p className="text-sm font-semibold mb-4">New Recipe</p>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">Dish type</label>
        <div className="flex gap-2">
          <Select value={pizzaType} onValueChange={setPizzaType}>
            <SelectTrigger className="flex-1 text-sm">
              <SelectValue placeholder="Select dish type…" />
            </SelectTrigger>
            <SelectContent>
              {unused.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              <SelectItem value="__custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {pizzaType === "__custom" && (
            <Input
              className="flex-1 text-sm"
              placeholder="Type name"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
        Ingredients per dish
      </p>
      <div className="space-y-2 mb-4">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              className="flex-1 text-sm"
              placeholder="Ingredient"
              value={row.name}
              onChange={(e) => updateRow(i, "name", e.target.value)}
            />
            <Input
              className="w-24 text-sm"
              placeholder="Qty"
              type="number"
              min="0"
              step="any"
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
            />
            <Select value={row.unit} onValueChange={(v) => updateRow(i, "unit", v)}>
              <SelectTrigger className="w-20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add ingredient
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={create.isPending} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create recipe
        </Button>
      </div>
    </div>
  );
}

function InventoryPlanner() {
  const { data: recipes } = useListRecipes({});
  const { data: orders } = useListOrders({});
  const { data: events } = useListEvents({});
  const [selectedEventId, setSelectedEventId] = useState<string>("all");

  const filtered = orders?.filter((o) =>
    selectedEventId === "all" ? true : String(o.eventId) === selectedEventId
  ) ?? [];

  type IngKey = string;
  const totals: Record<IngKey, { quantity: number; unit: string }> = {};

  for (const order of filtered) {
    for (const item of order.items ?? []) {
      const recipe = recipes?.find((r) => r.pizzaType === item.pizzaChoice);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const needed = ing.quantity * item.quantity;
        const key = `${ing.name}__${ing.unit}`;
        totals[key] = { quantity: (totals[key]?.quantity ?? 0) + needed, unit: ing.unit };
      }
    }
  }

  const rows = Object.entries(totals)
    .map(([key, val]) => ({ name: key.split("__")[0], ...val }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasRecipes = (recipes?.length ?? 0) > 0;
  const hasOrders = filtered.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Inventory Plan
        </h2>
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-48 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events?.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasRecipes && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Add recipes on the left to generate an inventory plan.
        </p>
      )}

      {hasRecipes && !hasOrders && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No orders yet — nothing to plan.
        </p>
      )}

      {hasRecipes && hasOrders && rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No recipe matches found for the current orders.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-2.5">Ingredient</th>
                  <th className="text-right px-4 py-2.5">Quantity</th>
                  <th className="text-right px-4 py-2.5">Unit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-2.5 font-medium">{row.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {Number.isInteger(row.quantity) ? row.quantity : row.quantity.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Based on {filtered.length} order{filtered.length !== 1 ? "s" : ""} ·{" "}
            {filtered.reduce((acc, o) => acc + (o.items?.reduce((s, i) => s + i.quantity, 0) ?? 0), 0)} dishes total
          </p>
        </>
      )}
    </div>
  );
}

export function Recipes() {
  const { data: session, isLoading: sessionLoading } = useGetMe();
  const [, setLocation] = useLocation();
  const [showNew, setShowNew] = useState(false);
  const { data: recipes, isLoading: recipesLoading } = useListRecipes({});
  const { data: events } = useListEvents({});

  useEffect(() => {
    if (!sessionLoading && session?.role !== "admin") {
      setLocation("/");
    }
  }, [session, sessionLoading]);

  if (sessionLoading) {
    return (
      <Layout>
        <div className="space-y-4 mt-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Layout>
    );
  }

  const allPizzaTypes: string[] = Array.from(
    new Set(
      events?.flatMap((e) =>
        (e.pizzaTypes ?? []).map((pt: any) => (typeof pt === "string" ? pt : pt.name))
      ) ?? ["Chicken Karahi", "Lamb Karahi", "Beef Karahi", "Naan"]
    )
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> Recipes & Inventory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define ingredient quantities per dish, then plan your shopping list automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">Recipes</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNew((v) => !v)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {showNew ? "Cancel" : "New recipe"}
            </Button>
          </div>

          <div className="space-y-3">
            {showNew && (
              <NewRecipeForm
                existingTypes={recipes?.map((r) => r.pizzaType) ?? []}
                availableTypes={allPizzaTypes}
                onCreated={() => setShowNew(false)}
              />
            )}

            {recipesLoading && (
              <>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </>
            )}

            {!recipesLoading && recipes?.length === 0 && !showNew && (
              <div className="text-center py-10 text-sm text-muted-foreground border rounded-xl">
                No recipes yet. Click <strong>New recipe</strong> to get started.
              </div>
            )}

            {recipes?.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onSaved={() => {}} />
            ))}
          </div>
        </div>

        <div>
          <InventoryPlanner />
        </div>
      </div>
    </Layout>
  );
}
