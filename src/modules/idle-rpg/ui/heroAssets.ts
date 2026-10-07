const root = `${import.meta.env.BASE_URL}assets/ui/source/Component/`;
const revamp = `${import.meta.env.BASE_URL}assets/ui/revamp/`;

export const heroUi = {
  panel: `${root}Frame/frame_cardframe_02_front.png`,
  slot: `${revamp}slots/base.png`,
  selected: `${revamp}slots/selected.png`,
  rarityFrame: (rarity: string) => `${revamp}rarity/${rarity.toLowerCase()}.png`,
  portrait: `${root}Frame/frame_cardframe_02_front.png`,
  primary: `${root}Button/btn_rectangle_01_n_brown.png`,
  secondary: `${root}Button/btn_rectangle_01_n_dark.png`,
  navIdle: `${root}Button/btn_rectangle_01_n_dark.png`,
  navActive: `${root}Button/btn_rectangle_01_n_brown.png`,
  lock: `${root}Icon_Icons_(Original)/icon_lock.png`,
  itemIcon: (name: string) => `${root}Icon_Icons_(Original)/${name}.png`,
  functionIcon: (name: string) => `${root}Icon_FunctionIcons_(Original)/${name}.png`,
  gold: `${root}UI_Etc/status_icon_gold.png`,
  heroIcon: (id: string) => {
    const icons: Record<string, string> = {
      Knight: "knight/knight_icon.png", Archer: "archer/archer_icon.png", Mage: "mage/mage_icon.png",
    };
    return `${import.meta.env.BASE_URL}assets/ui/icons/${icons[id] ?? icons.Knight}`;
  },
};
