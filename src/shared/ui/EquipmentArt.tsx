import type { CSSProperties, ReactNode } from "react";
import { equipmentRarityColors } from "./equipmentRarity";
import "./equipment-art.css";

const assetRoot = `${import.meta.env.BASE_URL}assets/ui/`;

/** Item definitions use paths relative to public/, while older art uses symbolic icon names. */
export function equipmentImageSource(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (/^(https?:|data:|blob:)/i.test(ref)) return ref;
  if (ref.startsWith("/")) return ref;
  if (ref.startsWith("function_"))
    return `${assetRoot}source/Component/Icon_FunctionIcons_(Original)/${ref.replace(/\.png$/, "")}.png`;
  if (ref.startsWith("icon_"))
    return `${assetRoot}source/Component/Icon_Icons_(Original)/${ref.replace(/\.png$/, "")}.png`;
  return `${import.meta.env.BASE_URL}${ref.replace(/^\/+/, "")}`;
}

export function EquipmentArt({
  icon,
  rarity,
  size = 100,
  className = "",
}: {
  icon: string | null | undefined;
  rarity: string;
  size?: number | string;
  className?: string;
}): ReactNode {
  const src = equipmentImageSource(icon);
  const visibleRarity = rarity in equipmentRarityColors ? rarity : "Common";
  return <span className={`gh-equipment-art ${className}${rarity === "Common" ? " gh-equipment-art--common" : ""}`}
    style={{ width: size, height: size, "--gh-rarity": equipmentRarityColors[visibleRarity],
      backgroundImage: `url("${assetRoot}revamp/slots/base.png")` } as CSSProperties}>
    <img className="gh-equipment-art__frame" src={`${assetRoot}revamp/rarity/${visibleRarity.toLowerCase()}.png`} alt="" />
    {src ? <img className="gh-equipment-art__icon" src={src} alt="" /> : null}
  </span>;
}
