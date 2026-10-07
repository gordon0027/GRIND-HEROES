import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { QuestPointsTrackView } from "@idosgames/core";
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
  ProgressBar,
  ResourceList,
  SectionTitle,
  Tabs,
  Timer,
  configSection,
  errorText,
  grantedBy,
  mergeLines,
  outlined,
  panel,
  useCatalog,
  useCelebrate,
  useNow,
  usePopupClose,
  useStagger,
  useToast,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import {
  claimableRewards,
  cycleResetAt,
  questRows,
  questTabs,
  questsBadge,
  trackMilestones,
  type QuestRow,
  type QuestSection,
  type QuestStateView,
} from "./model";
import { t } from "./i18n";

// Quests (Unity Runtime/UI/Quests): the title's quests by cycle — daily, weekly, achievements — with
// the quest points track on top. A quest's goals and reward open in a popup; "Claim all" collects
// every finished quest.

export function QuestsScreen(_: FeatureScreenProps): ReactNode {
  return <Quests />;
}

function Quests(): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const catalog = useCatalog();
  const celebrate = useCelebrate();
  const toast = useToast();
  const stagger = useStagger();
  const now = useNow();
  const [tracks, setTracks] = useState<Record<string, QuestPointsTrackView>>(
    {},
  );
  const [tab, setTab] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuestRow | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const load = useCallback(async () => {
    const res = await client.quest.getUserQuestState();
    if (res.ok)
      setTracks(
        (res.data.PointsTracks ?? {}) as Record<string, QuestPointsTrackView>,
      );
  }, [client]);
  useEffect(() => {
    void load();
  }, [load]);

  const section = configSection<QuestSection>(client, "Quest");
  const questState = (state?.Quest ?? null) as QuestStateView | null;
  const rows = questRows(section, questState);
  if (rows.length === 0)
    return <EmptyState glyph="quest" text={t("noQuests")} />;

  const tabs = questTabs(section, rows);
  const current =
    tab !== null && tabs.some((x) => x.id === tab) ? tab : (tabs[0]?.id ?? "");
  const shown = rows.filter((r) => (r.cycleID ?? "") === current);
  const cycleEnd = cycleResetAt(questState, current);
  const ready = shown.filter((r) => r.status === "Completed");

  const claimAll = async () => {
    setBusyAll(true);
    const res = await client.quest.claimQuestRewardsBatch(
      ready.map((r) => ({ QuestID: r.questID, CycleID: r.cycleID })),
    );
    setBusyAll(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    celebrate(
      mergeLines(
        res.data.flatMap((item) => (item.Success ? grantedBy(item.Data) : [])),
      ),
    );
    void load();
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SectionTitle
        right={<Timer at={cycleEnd} now={now} label={t("questsReset")} />}
      >
        {t("quests")}
      </SectionTitle>
      <Tabs
        tabs={tabs.map((x) => ({
          id: x.id,
          label: x.id ? catalog.localize(x.name) : t("permanent"),
          badge: rows.filter(
            (r) => (r.cycleID ?? "") === x.id && r.status === "Completed",
          ).length,
        }))}
        value={current}
        onChange={setTab}
      />
      {current ? (
        <PointsTrack
          cycleID={current}
          section={section}
          track={tracks[current]}
          onClaimed={load}
        />
      ) : null}
      {ready.length >= 2 ? (
        <Button
          tone="gold"
          attract
          busy={busyAll}
          onClick={() => void claimAll()}
        >
          {t("claimAll")}{" "}
          <ResourceList lines={claimableRewards(ready)} size={18} />
        </Button>
      ) : null}
      <div style={{ display: "grid", gap: 10 }}>
        {shown.map((row, i) => (
          <Card
            key={`${row.cycleID ?? ""}:${row.questID}`}
            highlight={row.status === "Completed"}
            onClick={() => setDetail(row)}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: 12,
              opacity: row.status === "Claimed" ? 0.6 : 1,
              ...stagger(i),
            }}
          >
            <Icon glyph="quest" size={38} />
            <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <div style={{ ...outlined, fontSize: 15 }}>
                {catalog.localize(row.name)}
              </div>
              <ProgressBar
                value={row.progress}
                max={row.target}
                tone={row.status === "Completed" ? "gold" : "green"}
              />
              <ResourceList lines={row.reward} />
            </div>
            {row.status === "Claimed" ? (
              <Icon glyph="check" size={34} />
            ) : row.status === "Completed" ? (
              <Icon glyph="gift" size={34} />
            ) : (
              <span />
            )}
          </Card>
        ))}
      </div>
      {detail ? (
        <QuestDetail
          row={
            rows.find(
              (r) =>
                r.questID === detail.questID && r.cycleID === detail.cycleID,
            ) ?? detail
          }
          onClose={() => setDetail(null)}
          onClaimed={load}
        />
      ) : null}
    </div>
  );
}

function QuestDetail({
  row,
  onClose,
  onClaimed,
}: {
  row: QuestRow;
  onClose: () => void;
  onClaimed: () => Promise<void>;
}): ReactNode {
  const catalog = useCatalog();
  return (
    <Popup title={catalog.localize(row.name)} onClose={onClose}>
      {row.description ? (
        <div
          style={{
            ...outlined,
            fontWeight: 600,
            color: v.textDim,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {catalog.localize(row.description)}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
          {t("objectives")}
        </div>
        {row.objectives.map((o) => (
          <div key={o.id} style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                ...outlined,
                fontSize: 14,
              }}
            >
              <span>{catalog.localize(o.name)}</span>
              {o.done ? <Icon glyph="check" size={20} /> : null}
            </div>
            <ProgressBar
              value={o.progress}
              max={o.target}
              tone={o.done ? "gold" : "green"}
            />
          </div>
        ))}
        <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
          {t("reward")}
        </div>
        <ResourceList lines={row.reward} size={26} gap={14} />
      </div>
      {row.status === "Completed" ? (
        <ClaimQuest row={row} onClaimed={onClaimed} />
      ) : row.status === "Claimed" ? (
        <div style={{ ...outlined, textAlign: "center", color: v.green }}>
          {t("done")}
        </div>
      ) : null}
    </Popup>
  );
}

function ClaimQuest({
  row,
  onClaimed,
}: {
  row: QuestRow;
  onClaimed: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const close = usePopupClose();
  const celebrate = useCelebrate();
  const toast = useToast();
  const kit = useUiKit();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div ref={ref}>
      <Button
        tone="gold"
        size="lg"
        attract
        busy={busy}
        style={{ width: "100%" }}
        onClick={() => {
          setBusy(true);
          void client.quest
            .claimQuestReward(row.questID, row.cycleID)
            .then((res) => {
              setBusy(false);
              if (!res.ok) return toast(errorText(res.error), "error");
              kit.fx.burst(ref.current);
              close();
              const granted = grantedBy(res.data);
              celebrate(granted.length > 0 ? granted : row.reward);
              void onClaimed();
            });
        }}
      >
        {t("claim")}
      </Button>
    </div>
  );
}

function PointsTrack({
  cycleID,
  section,
  track,
  onClaimed,
}: {
  cycleID: string;
  section: QuestSection | undefined;
  track: QuestPointsTrackView | undefined;
  onClaimed: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const celebrate = useCelebrate();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const cycle = section?.Cycles?.[cycleID];
  const points = Number(track?.PointsCurrent ?? track?.PointsTotalEarned ?? 0);
  const milestones = trackMilestones(
    cycle,
    points,
    track?.ClaimedPointMilestoneIDs ?? [],
  );
  if (milestones.length === 0) return null;
  const max = milestones[milestones.length - 1]?.required ?? 1;
  const picked = milestones.find((m) => m.id === open);

  return (
    <div style={{ ...panel, padding: "12px 14px", display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          ...outlined,
          fontSize: 13,
        }}
      >
        <span>{t("points")}</span>
        <span style={{ color: v.gold }}>
          {points} / {max}
        </span>
      </div>
      <div style={{ position: "relative", height: 44 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 16 }}>
          <ProgressBar
            value={Math.min(points, max)}
            max={max}
            tone="gold"
            label=""
            height={12}
          />
        </div>
        {milestones.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`idos-press ${m.state === "ready" ? "idos-bounce" : ""}`}
            onClick={() => setOpen(m.id)}
            aria-label={catalog.localize(m.name)}
            style={{
              position: "absolute",
              left: `calc(${(m.required / max) * 100}% - 20px)`,
              top: 0,
              width: 40,
              height: 40,
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              opacity: m.state === "claimed" ? 0.55 : 1,
            }}
          >
            <Icon glyph={m.state === "claimed" ? "check" : "chest"} size={36} />
          </button>
        ))}
      </div>
      {picked ? (
        <Popup
          title={catalog.localize(picked.name)}
          onClose={() => setOpen(null)}
          width={360}
        >
          <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
            <Icon glyph="chest" size={72} />
            <ResourceList lines={picked.reward} size={26} gap={14} />
            <ProgressBar
              value={Math.min(points, picked.required)}
              max={picked.required}
              tone="gold"
            />
          </div>
          {picked.state === "ready" ? (
            <ClaimMilestone
              onClaim={async () => {
                const res = await client.quest.claimMilestoneReward(
                  cycleID,
                  picked.id,
                );
                if (!res.ok) {
                  toast(errorText(res.error), "error");
                  return false;
                }
                celebrate(
                  grantedBy(res.data).length > 0
                    ? grantedBy(res.data)
                    : picked.reward,
                );
                await onClaimed();
                return true;
              }}
            />
          ) : null}
        </Popup>
      ) : null}
    </div>
  );
}

function ClaimMilestone({
  onClaim,
}: {
  onClaim: () => Promise<boolean>;
}): ReactNode {
  const close = usePopupClose();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      tone="gold"
      attract
      busy={busy}
      onClick={() => {
        setBusy(true);
        void onClaim().then((ok) => {
          setBusy(false);
          if (ok) close();
        });
      }}
    >
      {t("claim")}
    </Button>
  );
}

// ── Always-on: the badge ─────────────────────────────────────────────────────────────────────

/**
 * Keeps the badge of the quests screen (finished quests) from the cached state. Registered only on
 * a title with quests, so a title without them makes no quest request on start.
 */
export function makeQuestsWatcher(features: FeatureRegistry) {
  return function QuestsWatcher(): ReactNode {
    const client = useIDosGamesClient();
    useEffect(() => {
      // Subscribed directly: the cache patches the quest state in place, so an effect keyed on the
      // state object would not re-run after a claim and the badge would stay lit.
      const update = () => {
        const rows = questRows(
          configSection<QuestSection>(client, "Quest"),
          (client.data.user.state?.Quest ?? null) as QuestStateView | null,
        );
        features.setBadge("quests", questsBadge(rows, 0));
      };
      update();
      const off = client.on("user:anyUpdated", update);
      // From the login state; the server only when a quest cycle has ended (the central cache's
      // rule for Quest). The check is local, so it runs every minute: a day that turns mid-session
      // brings the new quests (and the badge) without reopening anything.
      const check = () => void client.cache.ensureState(["Quest"]);
      check();
      const id = setInterval(check, 60_000);
      return () => {
        off();
        clearInterval(id);
      };
    }, [client]);
    return null;
  };
}
