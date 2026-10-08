# Battle render resolution (2026-10-08)

The live PROD battle is drawn by Phaser into one WebGL canvas. Backgrounds, heroes,
enemies, projectiles and health bars are Phaser objects; the overlaid chest, progress,
stage and control UI is React DOM. At a 390 × 844 CSS viewport with browser DPR 1,
the live canvas measured 390 × 794 backing pixels and 390 × 794 CSS pixels. At
1920 × 1080, it measured 1920 × 1032 for both. The canvas computed
`image-rendering: pixelated`; Phaser's `pixelArt: true` also disabled texture
interpolation and rounded sprite positions. The browser test rig cannot emulate a
mobile DPR above 1, so its DPR 2–3 behavior is covered by the sizing helper test,
not claimed as a physical-device measurement.

The battle uses the full source PNGs: Knight sheet 3072 × 1024 with 256 × 256
frames and about 215 × 215 displayed sprite bounds; Goblin sheet 3072 × 1024
with 256 × 256 frames and about 230 × 230 displayed bounds; Meadow Road image
3840 × 2160 displayed as repeat tiles at about 620 × 349 on the 390-pixel layout
and 764 × 430 on desktop. Opaque art within those transparent character frames
is smaller than the frame (Knight frame zero about 85 × 110, Goblin about
83 × 84), so the original sprite art still sets an upper bound on detail.
There is no low-resolution battle composite or CSS transform on the battle parent.

`battleRenderSize` now keeps logical layout in CSS pixels and scales the physical
canvas backing and Phaser camera together. A 390 × 794 CSS canvas at DPR 3 uses
effective DPR 2 and 780 × 1588 backing pixels; the cap avoids a 1170 × 2382
surface. A 1920 × 1032 DPR 2 canvas uses 3840 × 2064. A further 3840 × 2160
pixel-area ceiling controls large desktops. `ResizeObserver` and window resize
update the backing on layout, orientation and viewport changes; unchanged sizes
are ignored. Phaser uses linear texture interpolation and normal browser canvas
interpolation. At DPR 1 the backing stays unchanged, and the improvement is from
removing nearest-neighbor pixelation. The 107 PNG files are unchanged.

The full 113-file build was deployed directly to PROD as v49
(`bld87d4e6a2bd944a669b319da9d34db6e9`); DEV was not deployed. The live
PROD guest showed the battle at 390 × 844 (canvas 390 × 796, DPR 1) and after
resizing to 1920 × 1080 (canvas 1920 × 1030, DPR 1). Both had computed
`image-rendering: auto`, filled their CSS host correctly, and displayed the hero,
mob and background. The new bundle is 27,304,710 unpacked bytes, 1,718 more
than v48; no PNG changed. The mobile DPR 2–3 and FPS on physical devices remain
unmeasured by the available browser viewport emulator.
