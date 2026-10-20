import { useEffect, useRef, useState } from "react";
import "./phantom-panel.css";

interface PublicKey { toString(): string }
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey | null;
  isConnected?: boolean;
  connect(options?: { onlyIfTrusted: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  on(event: "accountChanged" | "disconnect", listener: (key?: PublicKey | null) => void): void;
  removeListener(event: "accountChanged" | "disconnect", listener: (key?: PublicKey | null) => void): void;
}
function getProvider(): PhantomProvider | null {
  const provider = (window as Window & { phantom?: { solana?: PhantomProvider } }).phantom?.solana;
  return provider?.isPhantom ? provider : null;
}

/** Optional connection only: no signatures, holdings, payments or game-account linking. */
export function PhantomPanel() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const generation = useRef(0);
  const gate = useRef(false);

  useEffect(() => {
    let active = true;
    const provider = getProvider();
    const id = generation.current;
    if (provider?.isConnected && provider.publicKey) setAddress(provider.publicKey.toString());
    else if (provider) void provider.connect({ onlyIfTrusted: true }).then(result => {
      if (active && id === generation.current) setAddress(result.publicKey.toString());
    }).catch(() => { /* An untrusted origin waits for an explicit Connect click. */ });
    const change = (key?: PublicKey | null) => {
      generation.current++; gate.current = false;
      setBusy(false); setError(null); setAddress(key?.toString() ?? null);
    };
    const disconnect = () => change(null);
    provider?.on("accountChanged", change); provider?.on("disconnect", disconnect);
    return () => {
      active = false; generation.current++;
      provider?.removeListener("accountChanged", change); provider?.removeListener("disconnect", disconnect);
    };
  }, []);

  const connect = async () => {
    const provider = getProvider();
    if (!provider) { setFallback(true); setError(null); return; }
    if (gate.current) return;
    const id = ++generation.current;
    gate.current = true; setBusy(true); setError(null); setFallback(false);
    try {
      const result = await provider.connect();
      if (id === generation.current) setAddress(result.publicKey.toString());
    } catch (e) {
      if (id !== generation.current) return;
      const cancelled = (e as { code?: number })?.code === 4001;
      setError(cancelled ? "Connection cancelled. You can try again." :
        "Phantom could not connect here. Open the game directly and try again.");
      if (!cancelled) setFallback(true);
    } finally { if (id === generation.current) { gate.current = false; setBusy(false); } }
  };
  const disconnect = async () => {
    if (gate.current) return;
    const id = ++generation.current;
    gate.current = true; setBusy(true); setError(null);
    try {
      await getProvider()?.disconnect();
      if (id === generation.current) setAddress(null);
    } catch { if (id === generation.current) setError("Could not disconnect Phantom. Please retry."); }
    finally { if (id === generation.current) { gate.current = false; setBusy(false); } }
  };
  return <section className="gh-phantom" aria-label="Phantom wallet">
    <div className="gh-phantom__intro"><span className="gh-phantom__icon" aria-hidden="true">◈</span>
      <div><strong>PHANTOM WALLET</strong><p>Optional wallet connection. Your game account stays the same.</p></div></div>
    {address ? <div className="gh-phantom__address" role="status"><span>CONNECTED</span><strong title={address}>{address}</strong></div> : null}
    <div className="gh-phantom__actions"><button type="button" disabled={busy}
      onClick={() => void (address ? disconnect() : connect())}>{busy ? "WAITING FOR PHANTOM…" : address ? "DISCONNECT" : "CONNECT PHANTOM"}</button></div>
    {fallback ? <div className="gh-phantom__fallback"><p>Phantom is not available in this browser frame. Open the game directly in a browser with Phantom, or in Phantom’s mobile browser. Sign in with your usual game account.</p>
      <a href="https://98jrcakg.idos.games/" target="_blank" rel="noopener noreferrer">OPEN GAME DIRECTLY</a>{" · "}
      <a href="https://phantom.com/" target="_blank" rel="noopener noreferrer">GET PHANTOM</a>
    </div> : null}
    {error ? <p className="gh-phantom__error" role="alert">{error}</p> : null}
  </section>;
}
