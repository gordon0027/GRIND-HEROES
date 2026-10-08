import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { configSection } from "@idosgames/react/ui";
import { chestRewardItemID } from "../game/chestReward";
import type { GearItem } from "../game/equipment";
import {
  createPremiumOpenGate, hasPremiumOption, premiumChestCount, waitForPremiumReward,
  PREMIUM_CHEST_ITEM_ID, PREMIUM_LOOTBOX_ID, PREMIUM_OPTION_ID,
} from "../game/premiumChest";
import type { PremiumLootboxDefinition } from "../game/premiumChest";
import type { IdleSession } from "../game/session";
import { EquipmentArt } from "../../../shared/ui/EquipmentArt";
import { rarityColors } from "./inventoryPresentation";
import { gearImage } from "./itemImage";
import { GearStatRows } from "./GearStatRows";
import "./premium-chest.css";

const chestArt = `${import.meta.env.BASE_URL}assets/ui/chests/Epic Purple Enchanted Treasure Chest.png`;
type Phase = "idle" | "opening" | "syncing" | "revealed";

export function PremiumChestPanel({ session }: { session: IdleSession }): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const gate = useRef(createPremiumOpenGate());
  const [configured, setConfigured] = useState(() =>
    hasPremiumOption(configSection<PremiumLootboxDefinition>(client, "Lootbox")));
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<GearItem | null>(null);
  const rewardID = useRef<string | null>(null);
  const previousIDs = useRef<Set<string>>(new Set());
  const previousCount = useRef(0);
  const count = premiumChestCount(state?.InventoryV2);

  useEffect(() => {
    void client.lootbox.getDefinitions().then(() => {
      setConfigured(hasPremiumOption(configSection<PremiumLootboxDefinition>(client, "Lootbox")));
    }).catch(() => setConfigured(false));
    void client.user.getUserInventory().catch(() => {});
  }, [client]);

  const refreshReward = (): Promise<GearItem | null> => waitForPremiumReward({
    read: async () => {
      const fetched = await client.user.getUserInventory();
      if (fetched.ok) session.refreshHero();
      return fetched.ok;
    },
    items: () => session.gearItems,
    count: () => premiumChestCount(client.data.user.state?.InventoryV2),
    previousIDs: previousIDs.current,
    previousCount: previousCount.current,
    rewardItemID: rewardID.current,
  });

  const openOne = async () => {
    if (phase !== "idle" || gate.current.isPending() || !configured || count < 1) return;
    await gate.current.run(async () => {
      previousIDs.current = new Set(session.gearItems.map((item) => item.instanceID));
      previousCount.current = count;
      rewardID.current = null;
      setReward(null);
      setError(null);
      setPhase("opening");
      try {
        const opened = await client.lootbox.open(PREMIUM_LOOTBOX_ID, 1, PREMIUM_OPTION_ID);
        if (!opened.ok) {
          setError(String(opened.error ?? "Unable to open Premium Chest."));
          setPhase("idle");
          // A rejected request never changes local quantities; reconcile an already-spent chest.
          void client.user.getUserInventory().catch(() => {});
          return;
        }
        rewardID.current = chestRewardItemID(opened.data);
        setPhase("syncing");
        const item = await refreshReward();
        if (item) { setReward(item); setPhase("revealed"); }
        else setError("Chest opened. Inventory is still syncing; retry the refresh to see your reward.");
      } catch (cause) {
        setError(`${cause instanceof Error ? cause.message : "Connection lost."} Refresh Inventory before opening another chest.`);
        // A transport error can arrive after a committed open. Keep OPEN locked until reconciled.
        setPhase("syncing");
      }
    });
  };

  const retryRefresh = async () => {
    if (gate.current.isPending()) return;
    await gate.current.run(async () => {
      setError(null);
      try {
        const item = await refreshReward();
        if (item) { setReward(item); setPhase("revealed"); }
        else setError("The reward has not appeared in Inventory yet. Try refreshing again.");
      } catch {
        setError("Inventory refresh failed. Try again.");
      }
    });
  };

  return <section className="gh-premium-chest" aria-label="Premium Chest">
    <img className="gh-premium-chest__image" src={chestArt} alt="Premium Chest" />
    <div className="gh-premium-chest__copy">
      <strong>Premium Chest</strong>
      <span>Rare, Epic or Legendary equipment · one item per chest</span>
      <small>Owned: ×{count}</small>
    </div>
    <button type="button" className="gh-premium-chest__button" onClick={() => void openOne()}
      disabled={!configured || count < 1 || phase !== "idle"}>
      {phase === "opening" ? "OPENING…" : phase === "syncing" ? "SYNCING…" : "OPEN"}
    </button>
    {error && phase === "idle" ? <p className="gh-premium-chest__error" role="alert">{error}</p> : null}
    {phase !== "idle" ? <div className="gh-premium-reveal__overlay">
      <section className={`gh-premium-reveal${reward ? ` gh-premium-reveal--${reward.rarity.toLowerCase()}` : ""}`}
        role="dialog" aria-modal="true" aria-label="Premium Chest opening"
        style={{ "--gh-rarity": reward ? rarityColors[reward.rarity] : rarityColors.Rare } as CSSProperties}>
        {phase === "revealed" && reward ? <>
          <span className="gh-premium-reveal__eyebrow">PREMIUM CHEST OPENED</span>
          <EquipmentArt icon={gearImage(reward)} rarity={reward.rarity} size={132} />
          <strong className="gh-premium-reveal__rarity">{reward.rarity.toUpperCase()}</strong>
          <h3>{reward.name}</h3>
          <p>{reward.slot} · Level {reward.level} · Requires Lv {reward.requiredLevel}</p>
          <GearStatRows item={reward} relevantOnly />
          <button type="button" className="gh-premium-chest__button" onClick={() => {
            setPhase("idle"); setReward(null); setError(null);
          }}>CONTINUE</button>
        </> : <>
          <img src={chestArt} alt="" />
          <strong>{phase === "opening" ? "Opening Premium Chest…" : "Updating Inventory…"}</strong>
          {error ? <p role="alert">{error}</p> : null}
          {phase === "syncing" && error ? <div className="gh-premium-reveal__actions">
            <button type="button" onClick={() => void retryRefresh()} disabled={gate.current.isPending()}>RETRY REFRESH</button>
          </div> : null}
        </>}
      </section>
    </div> : null}
  </section>;
}
