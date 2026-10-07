import type { CSSProperties, ReactNode } from "react";
import { Popup } from "@idosgames/react/ui";

const panelStyle: CSSProperties = {
  background: "#202023",
  border: "18px solid transparent",
  borderImageSource: `url("${import.meta.env.BASE_URL}assets/ui/source/Component/Frame/frame_cardframe_02_front.png")`,
  borderImageSlice: "29 fill",
  borderImageWidth: "18px",
  borderRadius: 0,
  boxShadow: "0 18px 48px #000c",
  color: "#edddbc",
  fontFamily: 'Georgia, "Times New Roman", serif',
};

export function MarketPopup({ title, onClose, width, children }: {
  title: ReactNode;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}): ReactNode {
  return <Popup title={<span className="gh-market__popup-title">{title}</span>}
    onClose={onClose} width={width} panelStyle={panelStyle}>
    <span className="gh-market__popup-marker" hidden />
    {children}
  </Popup>;
}
