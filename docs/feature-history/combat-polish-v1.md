# Combat Polish V1 — release, 2026-10-11

## Release state

Локальная игра: `http://127.0.0.1:5180/`, Title `98JRCAKG-DEV`.
DEV CloudCode **34**, SHA-256 `0c7fe34a773fc7bb8c415d389256e96fb01f2a8ac6d60f4e81e495da4e5bc471`.
Store, Reward, Character и CloudCode прочитаны обратно. Сохранены 15 handlers,
ResourcePolicy и токеновые предложения. Загружен и проверен hosted DEV **v66**,
`bld683870c6163a49c185c78cf3d2f80cb7`:119 files,11,218,300 bytes, ZIP9,143,648.
Существующий `optimize-deploy-pngs.py` сокращает палитру38 PNG до256 цветов,
не меняет frame geometry и source PNG. Backgrounds сохраняют true colour.
Полные исходные PNG отклонены квотой в v65 и v67 (после очистки пользователя тоже).
v66 содержит все ресурсы и не зависит от файлов старых версий.
Пользователь отдельно разрешил PROD в конце работы и повторно попросил выпуск.
План PROD сохраняет21 существующий handler, добавляет getPetState/selectPet,
обычные Donkey/Pug offers/items и protected pet key. Watchdog GH offer не создаётся:
токеновая покупка остаётся недоступной, как на исходном PROD. Статус выпуска ниже.

## 1. Выравнивание персонажей

Позиция задаётся точкой опоры ног, а не центром PNG. Проверены alpha bounds всех
19 sheets ×48 кадров; нижняя точка оружия исключена из определения ног.
Knight, Archer, Mage и обычные двуногие враги: feetY=183 в кадрах 256 px.
Боссы: Ogre 234/260, Orange Ogre 237/261, Zombie Ogre 237/260.
Убраны разные Y offsets Archer/Mage. Глубина сцены: герои -8/0/+6 px по слоту,
враги двумя линиями -12/+14 px, пет +12 px. Sprite depth=`4+feetY/1000`, HP bars выше.

| Пет | Scale before → after | Базовые feetY before → after | Кадр |
|---|---|---|---|
| Donkey | .57 → .52 | 121 → 125 | 157×128 |
| Pug | .86 → .65 | 73 → 75 | 91×77 |
| Watchdog | .62 → .58 | 108 → 107 | 142×118 |

Каждый пет имеет 48 индивидуальных anchors. ANIMATION_UPDATE изменяет origin,
сохраняя groundY, включая перекатывающийся Pug. Следование плавное, атака подходит
до 28 мировых метров впереди героя; поворот определяется живой целью.
При поражении пет прекращает движение, проигрывает death один раз и исчезает.
Подтверждённая сервером смена пета видна сразу; passive stats остаются snapshot текущего run.

## 2. Тени и combat polish

ContactShadow создаёт общую 64×24 текстуру из десяти вложенных полупрозрачных
эллипсов. Один Image на персонажа, без realtime blur и новых Graphics каждый кадр.
Тень следует за ногами, у босса шире, depth=2. При смерти fade 400 ms.
Sprites/listeners/tweens/shadows удаляются при завершении или reset.
Hit flash использует Phaser 4 `setTintMode(FILL)`, отдачу 3–5 px и ограниченные
impact/death эффекты. Сильный shake не добавлялся; подходящего звука среди ресурсов нет.
Death проигрывает все 12 кадров, затем fade 240 ms. Мгновенное убийство в первом
кадре видимости сохраняет formation slot. Исходные PNG и pixel-art rendering сохранены.

## 3. Плотность

| Этап | Всего before | Всего after | Обычная группа after | Волн after |
|---|---:|---:|---|---:|
| 1-1 | 10 | 10 | 1–2 | 5 |
| 1-5 | 11 | 14 | 2–3 | 5 |
| 1-10 | 11 | 22 | 3–4 | 6 |
| 2-1 | 10 | 25 | 3–5 | 6 |
| 2-5 | 12 | 26 | 3–5 | 6 |
| 2-10 | 13 | 29 | 4–5 | 6 |
| 3-1 | 10 | 36 | 4–6 | 7 |
| 3-5 | 12 | 37 | 4–6 | 7 |
| 3-10 | 13 | 42 | 5–6 | 7 |

Первая группа легче, без лучников; дальше растут количество, HP и доля heavy/ranged.
Используются существующие Goblin, Orange, Fat, Heavy и Undead. Лучники позади melee,
до двух heavy. Удалён clamp spawnX=.90, создававший наложения. formationIndex сохраняет
X/Y slot после смерти соседа. Collision, damage, aggro и targeting остаются в StageRun.
Карты не удлинялись: волны на 12–86% дистанции, boss в конце.
Act 2 с этапа 5 — один guard; Act 3 с этапа 5 — один, с этапа 6 — два.
Только первый враг является boss. Пока жив хотя бы один guard, clear не наступает.

## 4. Боевой баланс

| Герой | Base HP | Damage до роли | Speed до роли | Платный шаг HP / Damage |
|---|---:|---:|---:|---|
| Knight | 120 | 10 | 1 | +24 / +2 |
| Archer | 90 | 9 | 1.4 | +18 / +1.8 |
| Mage | 80 | 22 | .8 | +16 / +4.4 |

Роль Archer: hit .9, cadence 1.2; Mage: hit 1.35, cadence .8; Knight 1/1.
Base Defence=0. RankStatCurve Health/Damage +25% за paid rank сохранён.
Stage-earned Hero Level открывает предметы, сам не увеличивает combat stats:
XP до следующего уровня `50+30*(level-1)`, cap=30. Шесть equipment slots сохранены.
Полный комплект Knight Common/Uncommon/Rare/Epic даёт +85/137/200/285 HP,
+6/11/18/29 Damage, +4/7/10/14 Defence и .03/.05/.07/.10 speed.
Оружие 5/9/15/24/36, item upgrades +6%, матрица 50 предметов — без изменений.

Симулятор исполняет настоящий StageRun шагом .25s до clear/failed, максимум 1200s.
54 конфигурации: 9 этапов ×6 профилей. Fixtures: rank=1, item level=1,
платные Health/Damage уровни 0/3/8/14 для Common/Uncommon/Rare/Epic,
без дополнительных Crit/AttackSpeed upgrades. Power: bare 80, Common Knight 114,
Uncommon duo 314, Rare trio 748, Epic trio 1032. Donkey +20 HP каждому герою.
Pug +3 Attack и Watchdog +5 Attack/+30 HP сохранены; анимации не наносят отдельный урон.

Recommended Power Act 1 80–220→80–300; Act 2 240–420→340–680;
Act 3 450–680→740–1100. Это ориентир, не серверный допуск; состав и Defence влияют на исход.
Защищённая формула Team Power сохранена. HP на одного врага уменьшены с учётом
плотности; AttackSpeed Act 2/3 ×.88. Первый boss HP85→70, Attack3→2.
Act 3 получает дополнительно `2+floor((stage-1)/3)` Attack, включая boss.
Полные реальные HP/Attack/Power/boss stats: [balance-tables.json](../../artifacts/combat-polish/balance-tables.json).

Bare Knight проходит 1-1 за 68s, остаток 44/120 HP. Common Knight проходит 1-10 за 117s.
Uncommon duo: 2-10 clear 100s; 3-5 clear 133s, Knight погиб, Archer 13 HP;
3-10 defeat 73s. Rare trio: 3-10 clear 123s, Knight 134 HP. Epic trio: clear 113s,
Knight 630 HP. Donkey увеличивает запас HP, время боя сохраняется.
Одинаковые item fixtures before→after: Common Knight 1-1 54→53s,
Uncommon duo 1-10 64→73s, Rare trio 2-10 81→92s.
Fixtures с полным комплектом одной редкости не моделируют RNG сундуков живых игроков.

## 5. Обычные цены — DEV и проверенный план PROD

Before — фактический DEV. Локальный старый source слотов содержал 50,000/250,000,
хотя сервер реально взимал 5,000/25,000. Клиент берёт цены из CloudCode/Character/Storefront.

| Item | Current price | Applied price | Reason |
|---|---:|---:|---|
| Party slot 2 | 5,000 GOLD | 3,000 GOLD | Первый доступный шаг к паре |
| Party slot 3 | 25,000 GOLD | 12,000 GOLD | Полная команда в Act 2 |
| Archer | 25,000 GOLD | 8,000 GOLD | Согласован с ценой второго слота |
| Mage | 100,000 GOLD | 30,000 GOLD | Достижим без GEMS/GH |
| Donkey | 100 GOLD | 100 GOLD | Скромный стартовый +20 HP |
| Pug | 20 GEMS | 20 GEMS | Скромный опциональный +3 Attack |
| Watchdog | 1 GH/Main | без изменений | Токеновые покупки вне scope |
| GOLD 5,000 | 50 GEMS | 40 GEMS | 125 GOLD/GEM, опциональное ускорение |
| GOLD 25,000 | 200 GEMS | 150 GEMS | 167 GOLD/GEM, выгода большого пакета |
| Legacy starter_sword | 150 GEMS | 150 GEMS | Старая скрытая полка |
| gear_summon | 100 GEMS | 100 GEMS | Опциональный старый summon |
| Daily gift | free→30 GEMS/day | без изменений | Источник обычной редкой валюты |
| PROD Premium Chest | 20 GH/Main | без изменений | Только аудит |
| PROD GH GEMS packs | 5/12/30 GH→500/1200/3000 GEMS | без изменений | Только аудит |

AFK .3→.4 GOLD/sec: 1,080→1,440 в час; cap 8 часов 8,640→11,520 GOLD.
PowerCoefficient=0, cap времени, minimum collect и first-claim mode сохранены.
Один Stage Chest за clear; ещё Boss Chest на 5/10 каждого акта. Lootbox odds,
tradeability и 50 предметов не менялись. Act 1 Stage 78/20/2% Common/Uncommon/Rare;
Act 2 Stage 22/52/23/3%; Act 3 Stage 8/25/48/18/1%; boss pools лучше stage pools.
Дополнительные враги не выдают отдельные награды: только результат этапа.

| Покупка | Ориентир | Побед только за stage GOLD | Время активного фарма | Только AFK |
|---|---|---:|---:|---:|
| Donkey 100 | 1-1, bare 68s | 1 | 1.1 min | 4.2 min |
| Slot 2 3,000 | 1-1, bare 68s | 30 | 34 min | 2.1 h |
| Archer 8,000 | 1-5, Common 81s | 40 | 54 min | 5.6 h |
| Slot 3 12,000 | 2-5, duo 89s | 21 | 31 min | 8.3 h |
| Mage 30,000 | 2-10, duo 100s | 39 | 65 min | 20.8 h |

Оценки без стартового баланса/трат. AFK дополнительно работает во время игры.
Больше восьми часов AFK нужно собирать в нескольких сеансах. Archer+slot2 и Mage+slot3
требуются вместе; upgrades конкурируют за GOLD. 40 GEMS — два дневных gift по 30,
150 GEMS — пять, Pug — один. Это ориентир, не обещание времени живому игроку.
Marketplace GEMS-only: min1, без max price, commission0, до10 listings, 24/72/168h,
escrow tradable item. Цены назначают игроки; GOLD/XP не создают GEMS.
GH/Solana/Main, GH earnings, payouts, pools, caps, балансы и токеновые pet offers
не менялись ни в DEV, ни в PROD. Токеновые транзакции не выполнялись.

## 6. Все награды и симуляции

[BEFORE/AFTER таблицы всех 30 этапов и 54 симуляций](../../artifacts/combat-polish/tables.md).
[Исходные результаты с HP и продолжительностью](../../artifacts/combat-polish/profile-simulations.json).
GOLD Act 1 `100+25*(stage-1)`, Act 2 `420+40*(stage-1)`, Act 3 `900+60*(stage-1)`;
XP `35+7*ordinal`. Сервер и клиент проверены на одинаковые GOLD/XP всех 30 этапов.
Пересоздание: `npm run test:polish`, затем
`node --experimental-strip-types scripts/report-combat-balance.mjs`.

## 7. Реальный визуальный QA / performance

Локальный Phaser с DEV: desktop1280×720 и viewport390×844, Knight/Archer/Mage,
Donkey/Pug/Watchdog, этапы 1-1,1-5,1-10,2-5,2-10,3-5,3-10. Проверены живые группы,
ground alignment, масштаб, тени, плотная группа6 и boss+2guards.
Локальная DEV-only QA-панель использует настоящий StageRun и fixture gear, без покупки
ownership и без progression/reward/leaderboard writes. В production build панели нет.
Стоп-кадры снимаются на паузе; прохождение ускоряется 4× только в local QA.
Обычная игра сохраняет 1×. Скриншоты и `qa-observations.json`:
[artifacts/combat-polish](../../artifacts/combat-polish).

Загрузка всех 19 sheets+3 backgrounds: примерно303 MiB RGBA. Теперь 3heroes+3pets+
только текущий акт: runtime estimate126–139 MiB,18–19 textures. Это размер RGBA,
не измерение VRAM. Старые актовые sheets/animations/backgrounds освобождаются.
Один общий shadow, transient VFX limit24. После clear 3-10:0 enemies/corpses/VFX/
projectiles, desktop16 объектов, mobile14 (разное число background tiles).
FPS/objects берутся из настоящего Phaser loop, наблюдения сохранены в JSON.
IAB работает с uncapped FPS; mobile — viewport на этом desktop, **не физический
телефон**. Hardware-mobile/GC benchmark не выполнен. Pixel-art PNG не размываются.

## 8. Проверки и безопасность

`npm test`, `npm run typecheck`, `npm run build` успешно. Сохраняется предупреждение
о JS chunk>500kB. Новые тесты: density ranges/max6, monotonic totals/Power,
boss в конце, уникальные spawn/ground slots, лучники сзади, смерть всех guards,
48 anchors каждого pet,54 боевых профиля, обычные цены и сохранение token offers.
Существующие shop dialog, GH earnings/payout protection, progression, ranged,
aggro, Team Power, XP eligibility и pet selection тесты проходят.
`npm run verify` создаёт свежего гостя толькоDEV, сохраняет штатную стартовую
формацию и исполняет настоящий бой1-1 в реальном времени:68s,100 GOLD,35XP Knight,
один chest. Ранняя/повторная выдача отклонены. Minimum `7+floor(ordinal/3)`,
maximum1200s сохранены. Сначала clear, затем server confirmation.
Существующая серверная проверка времени/run marker сохранена; серверное
воспроизведение самого боя этим изменением не вводилось.

Hosted DEV v66 проверен с реальной покупкой Donkey за100 GOLD и выбором пета.
`scripts/prod-combat-plan.mjs` строит объединение от фактического PROD13, сравнивает
все функции: разрешены только startStageRun и две функции серверного pet Power;
token handlers, GH rewards/payout implementation и все существующие остальные
функции остаются byte-identical. Ordinary reward/price formulas меняются отдельно.
Сохранены ResourcePolicy, GH sections/offers, Reward Claims и hero stat curves.
Shop confirmation v64 сохранён. Итоговый release audit хранится в artifacts.
