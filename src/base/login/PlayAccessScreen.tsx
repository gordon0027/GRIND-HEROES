import type { ReactNode } from "react";
import {
  DefaultPlayAccessScreen,
  type PlayAccessScreenProps,
} from "@idosgames/app-shell";

// The play-access screen. The host shows it INSTEAD of the game while the title's login mode
// (platform setting: Blockchain -> login mode) requires a token balance the player has not confirmed
// yet — no linked wallet, balance too low, or the pass expired. The server re-checks the balance on
// every login and session refresh; this screen is the manual path in between.
//
// Kept for a future Web3 Title. The initial Grind Heroes Title uses open/Web2 access;
// wallet linking can be restored when the wallet dependency stack builds cleanly.
export function PlayAccessScreen(props: PlayAccessScreenProps): ReactNode {
  return <DefaultPlayAccessScreen {...props} />;
}
