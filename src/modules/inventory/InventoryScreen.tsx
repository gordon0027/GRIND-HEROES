import { useEffect, useState, type ReactNode } from "react";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  EmptyState,
  Icon,
  ItemTile,
  Popup,
  Tabs,
  outlined,
  useCatalog,
  useGameLayout,
  usePopupClose,
  useStagger,
  v,
} from "@idosgames/react/ui";
import {
  categoryOf,
  isChestOrKey,
  ownedItems,
  type Category,
  type InventoryView,
} from "./model";
import { t } from "./i18n";

// What the player owns, from the SDK's cached inventory (every purchase and claim updates it — no
// request of its own). Tabs by category, rarest first; a tap opens the item card. Equipment hands off
// to the heroes screen, a chest or a key to the chests screen (the lootboxes system).

export function makeInventoryScreen(features: FeatureRegistry) {
  return function InventoryScreen(_: FeatureScreenProps): ReactNode {
    return <Inventory features={features} />;
  };
}

function Inventory({ features }: { features: FeatureRegistry }): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const catalog = useCatalog();
  const layout = useGameLayout();
  const stagger = useStagger();
  const [tab, setTab] = useState<Category>("all");
  const [open, setOpen] = useState<string | null>(null);

  // The inventory (instances included) comes with the login state and every reply keeps it fresh;
  // opening the screen re-checks it through the central cache (a gift, another device).
  useEffect(() => {
    void client.cache.ensureState(["InventoryV2"], { maxAgeMs: 60_000 });
  }, [client]);

  const inventory = state?.InventoryV2 as InventoryView | undefined;
  const owned = ownedItems(inventory, catalog.items);
  const shown =
    tab === "all"
      ? owned
      : owned.filter((o) => categoryOf(catalog.items.get(o.itemID)) === tab);
  const tile = layout === "desktop" ? 100 : layout === "tablet" ? 90 : 76;

  const tabs: Array<{ id: Category; label: string }> = [
    { id: "all", label: t("all") },
    { id: "equipment", label: t("equipment") },
    { id: "consumable", label: t("consumable") },
    { id: "other", label: t("other") },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {catalog.items.size === 0 ? (
        <EmptyState glyph="box" text={t("noItems")} />
      ) : shown.length === 0 ? (
        <EmptyState
          glyph="chest"
          text={t("empty")}
          action={
            features.get("store") ? (
              <Button onClick={() => features.open("store")}>
                {t("toShop")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          data-resource-counter="inventory"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${tile + 8}px, 1fr))`,
            gap: layout === "phone" ? 12 : 16,
            justifyItems: "center",
          }}
        >
          {shown.map((o, i) => (
            <div
              key={o.itemID}
              data-resource-counter={`item:${o.itemID}`}
              style={stagger(i)}
            >
              <ItemTile
                itemID={o.itemID}
                count={o.count}
                level={o.instances[0]?.level}
                size={tile}
                onClick={() => setOpen(o.itemID)}
              />
            </div>
          ))}
        </div>
      )}
      {open ? (
        <ItemCard
          itemID={open}
          owned={owned.find((o) => o.itemID === open)}
          canOpenChest={
            features.get("lootboxes")?.available === true &&
            isChestOrKey(catalog.items.get(open))
          }
          canEquip={
            features.get("character") !== undefined &&
            categoryOf(catalog.items.get(open)) === "equipment"
          }
          onEquip={(instanceID) =>
            features.open("character", {
              itemID: open,
              itemInstanceID: instanceID,
            })
          }
          onOpenChest={() => features.open("lootboxes", { itemID: open })}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function ItemCard({
  itemID,
  owned,
  canOpenChest,
  canEquip,
  onEquip,
  onOpenChest,
  onClose,
}: {
  itemID: string;
  owned: ReturnType<typeof ownedItems>[number] | undefined;
  canOpenChest: boolean;
  canEquip: boolean;
  onEquip: (instanceID: string | undefined) => void;
  onOpenChest: () => void;
  onClose: () => void;
}): ReactNode {
  const catalog = useCatalog();
  const def = catalog.items.get(itemID);
  const rarity = def?.Metadata?.RarityID ?? "Common";
  const color = catalog.rarityColor(rarity);
  const description = catalog.localize(def?.Description);
  return (
    <Popup title={catalog.itemName(itemID)} onClose={onClose}>
      <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
        <div
          className="idos-glow"
          style={{
            width: 120,
            height: 120,
            borderRadius: 26,
            display: "grid",
            placeItems: "center",
            border: `4px solid ${color}`,
            background: `radial-gradient(circle at 50% 35%, ${color}66 0%, ${v.panelDeep} 72%)`,
          }}
        >
          <Icon
            glyph={catalog.iconOf({ kind: "item", id: itemID, amount: 1 })}
            size={78}
          />
        </div>
        <div style={{ ...outlined, color, fontSize: 15 }}>
          {t("rarity")}: {rarity}
        </div>
        {description ? (
          <div
            style={{
              ...outlined,
              fontWeight: 600,
              color: v.textDim,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {description}
          </div>
        ) : null}
        <div style={{ ...outlined, fontSize: 15 }}>
          {t("quantity")}: {owned?.count ?? 0}
          {owned?.instances[0] && owned.instances[0].level > 0
            ? ` · ${t("level")} ${owned.instances[0].level}`
            : ""}
        </div>
      </div>
      {canEquip ? (
        <CloseThen onClick={() => onEquip(owned?.instances[0]?.id)} tone="blue">
          {t("equip")}
        </CloseThen>
      ) : null}
      {canOpenChest ? (
        <CloseThen onClick={onOpenChest} tone="green">
          {t("open")}
        </CloseThen>
      ) : null}
    </Popup>
  );
}

function CloseThen({
  onClick,
  tone,
  children,
}: {
  onClick: () => void;
  tone: "blue" | "green";
  children: ReactNode;
}): ReactNode {
  const close = usePopupClose();
  return (
    <Button
      tone={tone}
      onClick={() => {
        close();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}
