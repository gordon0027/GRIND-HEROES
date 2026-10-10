import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StageRun } from "../game/stageRun";

type Notice = { kind: "opening" | "clear" | "failed"; stage: string; key: number };
type RewardNotice = { text: string; key: number };

/** Presentation only: the StageRun and its farming timer continue underneath. */
export function StagePresentation({ run, visible, confirmedReward }: {
  run: StageRun; visible: boolean; confirmedReward: string | null;
}): ReactNode {
  const previous = useRef<{ run: StageRun; state: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardedRun = useRef<StageRun | null>(null);
  const sequence = useRef(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reward, setReward] = useState<RewardNotice | null>(null);
  const state = run.state;

  useEffect(() => {
    const before = previous.current;
    previous.current = { run, state };
    let kind: Notice["kind"] | null = null;
    if (!before || before.run !== run) kind = "opening";
    else if (before.state !== state && (state === "clear" || state === "failed")) kind = state;
    if (!kind) return;
    if (timer.current) clearTimeout(timer.current);
    const next = { kind, stage: `${run.stage.chapter}-${run.stage.stage}`, key: ++sequence.current };
    setNotice(next);
    timer.current = setTimeout(() => setNotice((current) => current?.key === next.key ? null : current),
      kind === "opening" ? 850 : 1150);
  }, [run, state]);

  useEffect(() => {
    if (!confirmedReward || run.state !== "clear" || rewardedRun.current === run) return;
    rewardedRun.current = run;
    const next = { text: confirmedReward, key: ++sequence.current };
    setReward(next);
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = setTimeout(() =>
      setReward((current) => current?.key === next.key ? null : current), 2500);
  }, [run, confirmedReward]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
  }, []);
  if (!visible || (!notice && !reward)) return null;
  return <>{notice ? <div key={notice.key} className={`gh-stage-transition gh-stage-transition--${notice.kind}`}
    role="status" aria-live="polite">
    {notice.kind === "opening" ? <><span className="gh-stage-transition__shutter gh-stage-transition__shutter--left" />
      <span className="gh-stage-transition__shutter gh-stage-transition__shutter--right" /></> : null}
    {notice.kind === "clear" ? <span className="gh-stage-transition__victory-glow" /> : null}
    <strong>{notice.kind === "opening" ? `STAGE ${notice.stage}` : notice.kind === "clear" ? "CLEARED" : "DEFEATED"}</strong>
  </div> : null}
    {reward ? <div key={reward.key} className="gh-stage-reward" role="status">{reward.text}</div> : null}
  </>;
}
