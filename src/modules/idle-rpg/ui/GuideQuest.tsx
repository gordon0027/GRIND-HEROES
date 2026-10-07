import { useEffect, useState, type ReactNode } from "react";
import type { ResourceGrant } from "@idosgames/core";
import type { FeatureRegistry } from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Icon,
  ResourceList,
  configSection,
  errorText,
  grantLines,
  grantedBy,
  outlined,
  useCatalog,
  useCelebrate,
  useNotify,
  v,
} from "@idosgames/react/ui";
import {
  pickGuide,
  type QuestConfigView,
  type QuestStateView,
} from "../game/guide";
import { t } from "../i18n";

/** The quest strip: name, progress, reward and "Claim" — a tap elsewhere opens the quests screen. */
export function GuideQuest({
  features,
}: {
  features: FeatureRegistry;
}): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const celebrate = useCelebrate();
  const catalog = useCatalog();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Quest progress comes with the login; a new cycle is the only reason to ask the server.
    void client.cache.ensureState(["Quest"]);
  }, [client]);

  const guide = pickGuide(
    configSection<QuestConfigView>(client, "Quest"),
    state?.Quest as QuestStateView | undefined,
  );
  if (!guide) return null;

  const claim = async () => {
    setBusy(true);
    const res = await client.quest.claimQuestReward(
      guide.questID,
      guide.cycleID,
    );
    setBusy(false);
    if (!res.ok)
      return void notify.toast({
        level: "error",
        message: errorText(res.error),
      });
    celebrate(grantedBy(res.data));
  };
  const reward = grantLines(guide.grant as ResourceGrant | null | undefined);
  const quests = features.get("quests");

  return (
    <div
      role={quests?.available ? "button" : undefined}
      onClick={() => {
        if (quests?.available && !guide.claimable) features.open("quests");
      }}
      data-tutorial-anchor="idle:guide"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px 6px 10px",
        borderRadius: 12,
        background: guide.claimable
          ? `linear-gradient(90deg, color-mix(in srgb, ${v.gold} 35%, ${v.panelDeep}), ${v.panelDeep})`
          : v.panelDeep,
        border: `2px solid ${guide.claimable ? v.gold : v.panelEdge}`,
        cursor: quests?.available ? "pointer" : "default",
        minWidth: 0,
      }}
    >
      <Icon glyph="quest" size={22} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...outlined,
            fontSize: 13,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {catalog.localize(guide.name)}
        </div>
        <div style={{ ...outlined, fontSize: 11, color: v.textDim }}>
          {guide.current} / {guide.target}
        </div>
      </div>
      {reward.length > 0 ? <ResourceList lines={reward} size={16} /> : null}
      {guide.claimable ? (
        <Button
          size="sm"
          tone="gold"
          attract
          busy={busy}
          onClick={() => void claim()}
        >
          {t("claim")}
        </Button>
      ) : null}
    </div>
  );
}
