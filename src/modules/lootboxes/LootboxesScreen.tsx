import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Popup,
  ResourceList,
  configSection,
  errorText,
  grantedBy,
  outlined,
  useCatalog,
  useCelebrate,
  usePopupClose,
  useSound,
  useStagger,
  useToast,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import {
  BULK,
  canOpenBulk,
  canPay,
  lootboxName,
  lootboxOptions,
  lootboxesOpenedBy,
  openableWithItems,
  type InventoryView,
  type LootboxOption,
  type LootboxSection,
} from "./model";
import { t } from "./i18n";

// Chests (Unity LootboxOpeningPopUp): every lootbox of the title with every way to open it — once,
// or ten at a time where the ceiling and the wallet allow. The box shakes while the server rolls it,
// bursts, and the rewards fly out. The inventory hands a chest or key item over here
// (`features.open("lootboxes", { itemID })`): the screen then shows what that item opens.

export function LootboxesScreen({ args }: FeatureScreenProps): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const catalog = useCatalog();
  const stagger = useStagger();
  const section = configSection<LootboxSection>(client, "Lootbox");
  const all = useMemo(() => lootboxOptions(section), [section]);
  const itemID = typeof args?.itemID === "string" ? args.itemID : null;
  const options = itemID ? lootboxesOpenedBy(itemID, all) : all;
  const [opening, setOpening] = useState<{
    option: LootboxOption;
    count: number;
  } | null>(null);

  // Handed an item that opens exactly one chest — open its popup right away.
  useEffect(() => {
    if (itemID && options.length === 1)
      setOpening({ option: options[0]!, count: 1 });
  }, [itemID]);

  const inventory = state?.InventoryV2 as InventoryView | undefined;
  if (options.length === 0)
    return <EmptyState glyph="chest" text={t("noChests")} />;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
        gap: 12,
      }}
    >
      {options.map((o, i) => {
        const affordable = canPay(o, inventory);
        const bulk = canOpenBulk(o, inventory);
        return (
          <Card
            key={`${o.lootboxID}:${o.optionID}`}
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 8,
              ...stagger(i),
            }}
          >
            <div style={{ ...outlined, fontSize: 15, textAlign: "center" }}>
              {lootboxName(o.lootboxID, catalog.localize)}
            </div>
            <div className="idos-bounce">
              <Icon glyph={o.icon} size={64} />
            </div>
            {o.name ? (
              <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                {catalog.localize(o.name)}
              </div>
            ) : null}
            <Button
              tone="gold"
              attract={affordable}
              disabled={!affordable}
              onClick={() => setOpening({ option: o, count: 1 })}
              style={{ width: "100%" }}
              data-tutorial-anchor={`lootbox:${o.lootboxID}`}
            >
              {o.price.length === 0 ? (
                t("open")
              ) : (
                <ResourceList lines={o.price} size={20} />
              )}
            </Button>
            {bulk ? (
              <Button
                tone="blue"
                size="sm"
                onClick={() => setOpening({ option: o, count: BULK })}
                style={{ width: "100%" }}
              >
                {t("openTimes")} ×{BULK}
              </Button>
            ) : null}
          </Card>
        );
      })}
      {opening ? (
        <LootboxOpening
          option={opening.option}
          count={opening.count}
          onClose={() => setOpening(null)}
        />
      ) : null}
    </div>
  );
}

/** The box shakes while the server rolls it, bursts open, and the rewards pop out. */
function LootboxOpening({
  option,
  count,
  onClose,
}: {
  option: LootboxOption;
  count: number;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const celebrate = useCelebrate();
  const toast = useToast();
  const play = useSound();
  const kit = useUiKit();
  const boxRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const openBox = async (close: () => void) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setBusy(true);
    const started = Date.now();
    try {
      const res = await client.lootbox.open(option.lootboxID, count, option.optionID);
      // Let the shake play for a moment even on a fast server — the anticipation is the point.
      const wait = Math.max(0, (kit.motion.on ? 700 : 0) - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (!res.ok) {
        toast(errorText(res.error), "error");
        return;
      }
      play("lootbox");
      kit.fx.burst(boxRef.current);
      close();
      // `Resources` is the whole operation — every box of a bulk opening already summed by the server
      // (`Results` is the same per box; adding both would count everything twice).
      celebrate(grantedBy(res.data), { sound: "levelUp" });
    } catch {
      toast("Unable to open chest. Refresh Inventory before trying again.", "error");
    } finally {
      openingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Popup
      title={
        count > 1
          ? `${lootboxName(option.lootboxID, catalog.localize)} ×${count}`
          : lootboxName(option.lootboxID, catalog.localize)
      }
      onClose={onClose}
      variant="center"
    >
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 12,
          padding: "10px 0",
        }}
      >
        <div
          ref={boxRef}
          style={{
            animation: busy
              ? "idos-shake .35s ease-in-out infinite"
              : "idos-bounce 1.2s ease-in-out infinite",
          }}
        >
          <Icon glyph={option.icon} size={120} />
        </div>
        <ResourceList
          lines={option.price.map((l) => ({ ...l, amount: l.amount * count }))}
        />
      </div>
      <OpenButton busy={busy} onOpen={openBox} />
    </Popup>
  );
}

function OpenButton({
  busy,
  onOpen,
}: {
  busy: boolean;
  onOpen: (close: () => void) => Promise<void>;
}): ReactNode {
  const close = usePopupClose();
  return (
    <Button
      tone="gold"
      size="lg"
      attract
      busy={busy}
      onClick={() => void onOpen(close)}
    >
      {busy ? t("opening") : t("open")}
    </Button>
  );
}

/** Badge: chests the player can open right now with the items they hold (a chest item or a key). */
export function makeLootboxesWatcher(features: FeatureRegistry) {
  return function LootboxesBadge(): ReactNode {
    const client = useIDosGamesClient();
    useEffect(() => {
      const update = () =>
        features.setBadge(
          "lootboxes",
          openableWithItems(
            lootboxOptions(configSection<LootboxSection>(client, "Lootbox")),
            client.data.user.state?.InventoryV2 as InventoryView | undefined,
          ),
        );
      update();
      return client.on("user:anyUpdated", update);
    }, [client]);
    return null;
  };
}
