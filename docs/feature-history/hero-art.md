# Hero art and battle visuals V1

The supplied Knight, Archer and Mage sheets live in `public/assets/heroes/<id>/spritesheet.png`.
Each is a transparent 3072×1024 PNG with 12 columns and four rows of 256×256 frames.
All three share the same layout: row 0 idle, row 1 running, row 2 attack, row 3
falling/death. There is no distinct hit row, so damage briefly tints the sprite.
The standing feet are near source-frame y=188; one origin and scale keep the body
grounded across animation changes. `heroVisuals.ts` holds the reusable mappings
and small class-specific screen offsets. Combat events only select animations;
they never determine damage or movement.

`GrindScene` uses the 3840×2160 forest PNG for Stage 1. It preserves the image
aspect ratio and repeats it with alternating mirrored copies because the two
source edges are not seamless. The horizontal offset comes from the existing
logical stage distance, so it stops at encounters and resumes afterward. Other
stages retain temporary drawn backgrounds until their own art is supplied.
Enemies and bosses remain simple drawn placeholders. Small HP bars, damage
numbers and fade-outs provide combat feedback without changing StageRun.

The DEV runtime preview can display all three supplied heroes even though only
Knight is currently unlocked for the test account. It does not grant rewards or
change persistent player data.
