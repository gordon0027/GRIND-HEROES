# Grind Heroes — Jury Edition: отчёт

15 октября 2026 · Asia/Qyzylorda

## Результат и границы выпуска

Реализована Jury Edition в ветке `codex/grind-heroes-update`. После отдельного разрешения
пользователя опубликована на PROD как **v82** (`bld038f0b8740cb4c379b72311165eb294b`);
Title-конфигурация, экономика, GH-формулы, token supply, staking, контракты и
исторические payout-locks не изменялись. Выплаты GH и финансовые пробы не запускались.
Локальная резервная ветка: `codex/backup-pre-grind-heroes-update-20261015`, исходный commit `64569ed`.

## Интерфейс

- Inventory показывает героя, шесть слотов, экипировку, сравнения и Equip Best.
  Большая встроенная прокачка удалена; Premium Chest перемещён после экипировки.
- Inventory и Team открывают один Hero Progression Dialog: Upgrades / Skills,
  GOLD, текущие и будущие характеристики, Power, ближайший навык и подтверждение.
- Окна Hero Progression, Earnings и Stage Map используют native dialog:
  фон не интерактивен, Close доступен независимо от внутренней прокрутки.
  Общий хук удерживает Tab/Shift+Tab, стрелки переключают вкладки, Escape
  закрывает окно и возвращает фокус к исходной кнопке. Проверен и максимум Level 10.
- Play и Map показывают Team Power, Recommended Power, разницу и совет по подготовке.
  Рекомендация явно не является гарантией победы или жёстким ограничением.
- Next Step направляет к сундуку, экипировке и доступной прокачке.
- На 320 px вкладки Marketplace доступны в два ряда; вместо шести огромных
  пустых карточек загрузки — компактный подписанный индикатор. Ошибка имеет Retry.
- Сохранены оригинальные игровые изображения, кнопки, рамки и rarity-art.

В браузере обнаружен сбой чтения после подтверждённого upgrade. Исправление
повторяет только чтение состояния с ограниченными задержками. После исчерпания
попыток доступен Refresh Hero; повторная покупка заблокирована до сверки.
Тест подтвердил, что восстановление не повторяет списание GOLD.

## Прогрессия и навыки

| Hero Level | Поведение |
| --- | --- |
| 1–4 | Обычные атаки; активные способности и их боевые cooldown-полосы закрыты. |
| 5 | Crushing Blow / Rapid Fire / Meteor автоматически работают в бою. |
| 8 | Guardian's Resolve / Piercing Precision / Scorching Impact. |
| 10 | Мастерство: 275% Knight, 3.5s Archer, 200% Mage; cooldown не изменён. |

Пороги берутся из общей конфигурации. Уровни и Stage Mastery не сброшены.
У существующих героев Level 5–7 прежний пассивный навык возвращается на Level 8;
активный навык остаётся доступен. Об этом переходе написано в PROGRESSION.md.

Подтверждено тестами: атаки без навыков на 1/4, активные на 5, закрытые пассивные
на 7, пассивные на 8, shield expiry/retry, три burn ticks, mastery на 10.
В настоящем DEV-браузере Knight повышен до 10; на Level 5 боевой счётчик показал
его активные способности при нулевых активациях у Archer Level 1.
Показаны реальные class VFX в отдельном Level-8 preview. Shield/burn граничные
сценарии проверены симулятором, не выдаются за просмотр всех эффектов в браузере.

## Баланс

Использованы прочитанные из DEV определения трёх Character и всех 50 предметов,
настоящие кривые уровня и stageHeroStats. 8 профилей × 30 этапов × 3 шага времени
(25/50/100 ms) = **720 прогонов**. В движке нет RNG: доля побед означает согласие
результатов при разных шагах симуляции, а не вероятность случайной победы.

| Профиль | Результат после настройки, одинаковый при трёх шагах |
| --- | --- |
| A: Knight L1 без вещей | Победы 1-1…1-4; первое поражение 1-5. |
| B: Knight L3 / Common | Победы 1-1…1-9; поражение 1-10. |
| C: Knight L5 / Common | Первый акт пройден; поражение 2-1. |
| D: два героя L3 / Common | Поражение 2-5. |
| E: три героя L3 / Common | Поражение 2-9; слабая команда не завершает кампанию. |
| F: три героя L8 / Rare | Все 30 этапов; на 3-10 может погибнуть frontline. |
| G: три героя L10 / Epic | Все 30 этапов без смертей; без скрытых stat enhancements. |
| H: L8 / Rare + Donkey | Все 30; Donkey предотвращает смерть frontline на 3-10 при 50 ms. |

На 1-10 Knight L5/Common выигрывает за 102.5s и получает расчётно 190 GOLD/min.
С теми же характеристиками, но без signature skill, проигрывает. Без экипировки
также проигрывает. Это отдельная проверка вклада навыка и вещей.

Настройка усиливает урон поздних групп, давление Act 2 и ranged-врагов Act 3.
HP, GOLD, XP, chest pools и цены не умножались. Recommended Power перенастроен:
80–135 / 240–520 / 540–740. Серверные награды и minimum clear times остались прежними.
CloudCode проверяет run ID, unlock, серверное время, подписи группы/вещей и повторы;
он не воспроизводит весь бой. Новый client-only путь выдачи наград не добавлялся.

Полные результаты: [до](../artifacts/jury-edition/balance-before.json),
[после](../artifacts/jury-edition/balance-after.json), включая clear time, смерти,
урон, длительность босса, GOLD/min и сравнения без вещей/навыков/с питомцем.
Обе таблицы симуляций используют новые пороги 5/8/10, чтобы отдельно сравнить
изменение давления этапов. Исходный UI снят до всех изменений.

L1→5 стоит 4,063 GOLD. Первое улучшение покрывается стартовыми 500 GOLD.
L3/Common на 1-3 даёт около 153 GOLD/min: ещё ~23.3 активных минуты после стартовых
GOLD, либо ~148.5 минуты AFK при 24 GOLD/min. Это оценка без другого расходования
и без допущения удачного лута. Archer/Mage стоят в DEV 8,000/30,000, слоты —
3,000/12,000 GOLD. Полная команда и Level 5 не обещаются за две минуты.

## GH Earnings и безопасность

Earnings отделяет Remaining Reward Budget, дневной бюджет, расчётную долю,
текущий UTC-интервал, Pending Review и Confirmed Lifetime GH Received.
Бюджет не называется балансом общего пула; баланс игрока не подставляется вместо него.
Надёжного игрового метода чтения живого общего резерва среди доступных SDK/MCP
методов не найдено: показано **Live pool balance unavailable**.

Чтение PROD 2026-10-15: 36,164 GH бухгалтерского остатка, 3,616 GH дневного бюджета,
73 участника. У отдельного read-only аккаунта нет доли и подтверждённых выплат.
DEV revision 34 не разрешает getPowerRewardOverview: настоящий UI честно показывает
недоступность данных. PROD revision 14 разрешает обзор, claims gate остаётся false.
[Read-back](../artifacts/jury-edition/earnings-prod-read.json),
[аудит gate](../artifacts/jury-edition/payout-safety-audit.json).

Claim постоянно disabled. В игровом UI нет вызова claimPowerRewards или
runOneGhPayoutProbe. Выполнены только чтения overview, включая его существующий
серверный daily catch-up; ни один grant/claim handler не вызывался.
Некорректные ответы отклоняются, отсутствующие поля остаются неизвестными,
целые GH форматируются через BigInt. Ошибка refresh сохраняет старые данные с
пометкой stale. Есть in-flight guard, пауза между запросами и ручной Refresh;
опроса по таймеру нет.

В браузере проверены 10 явно помеченных offline-состояний: настоящий PROD read,
расчётная доля при закрытых выплатах, pause, отсутствие участников, snapshot not
ready, pending review, историческая выплата, stale, rate-limited refresh, отсутствие
данных. Во всех Claim выключен. Это визуальные фикстуры, не реальные переводы и
не финансовые скриншоты для README. [Результаты](../artifacts/jury-edition/earnings-visual-qa.json).

## Браузер и реальные DEV-сценарии

Проверены 320×740, 360×800, 390×844, 430×932, 768×1024, 1366×900, 1920×1080.
Сняты Inventory, Team, Play, Hero Progression, Skills, Marketplace, Earnings;
отдельно — Map, Pets, реальные подтверждения уровней и экипировки.
Сверялись реальные размеры viewport, не только отсутствие overflow.
[Геометрия](../artifacts/jury-edition/responsive-geometry.json),
[клавиатура](../artifacts/jury-edition/keyboard-qa.json),
[максимальный уровень](../artifacts/jury-edition/max-level-keyboard-qa.json).

Свежий DEV-гость прошёл 1-1, получил сундук и Traveler Boots, открыл заработанные
сундуки, экипировал вещи, повышал уровни и столкнулся с настоящим поражением/rollback
к фарму 1-4. Покупка Archer, второго слота и назначение героя подтверждены сервером.
Equip Best показал Power 86 → 96 (+10). Donkey куплен за DEV GOLD и применён на
следующем бою. Shop Supplies подтвердил обычные виртуальные покупки.

Для проверки всех уровней и покупок использованы **только отдельные DEV-аккаунты**.
В браузерном сценарии 300 стартовых DEV GEMS потрачены на две штатные покупки
GOLD (50,000 суммарно). Это тестовое финансирование; не доказательство получения
Level 10 или полной команды за первые минуты обычной бесплатной игры.
GH, production GOLD/GEMS и кошелёк не расходовались.

Отдельный SDK-тест провёл свежего гостя через настоящий 1-1 за 68s: 100 GOLD,
35 XP, один сундук; раннее и повторное получение отклонено.
[Результат](../artifacts/jury-edition/live-stage-dev.json).
Тест native upgrade проверил точные списания, ownership, concurrent absolute
targets, недостаток средств, cap, replay, reload и server/client Power parity.
[Результат](../artifacts/jury-edition/live-progression-dev.json).

В итоговом прогоне не обнаружено необработанных JS/Phaser-исключений. В DEV при
одновременных вкладках и HMR встречались штатные SDK-отказы Too soon; это не
выдаётся за чистый нулевой console-log. Повторные действия после неизвестного
результата сверялись с текущим UI. Все дальнейшие тесты велись в одной вкладке.

## До / после

Исходные снимки: 390×844 и 1366×900. Итоговые: все семь размеров.
85 JPEG-снимков занимают около 5.5 MB, шесть изображений README — около 440 KB.
[Полный индекс с размерами](../artifacts/jury-edition/screenshots.json).

| Экран | До | После |
| --- | --- | --- |
| Inventory | [390 px](../artifacts/jury-edition/before/inventory-390.jpg) | [390 px](../artifacts/jury-edition/after/inventory-390.jpg) |
| Team | [1366 px](../artifacts/jury-edition/before/team-1366.jpg) | [1366 px](../artifacts/jury-edition/after/team-1366.jpg) |
| Hero Progression | [Старый inline](../artifacts/jury-edition/before/inventory-1366.jpg) | [Отдельное окно](../artifacts/jury-edition/after/progression-confirmed-1366.jpg) |
| Play | [1366 px](../artifacts/jury-edition/before/play-1366.jpg) | [1366 px](../artifacts/jury-edition/after/play-1366.jpg) |
| Earnings | [390 px](../artifacts/jury-edition/before/earnings-390.jpg) | [390 px](../artifacts/jury-edition/after/earnings-390.jpg) |
| Marketplace | [390 px, старые loading cards](../artifacts/jury-edition/before/marketplace-390.jpg) | [390 px, загружен](../artifacts/jury-edition/after/marketplace-390.jpg) |

README использует реальные кадры текущего клиента. Кадр трёх героев явно помечен
DEV PREVIEW / NO REWARDS; это визуальная демонстрация, не поддельный прогресс гостя.

## Документация, проверки и Git

Сохранена существующая структура README, ссылки, описание архитектуры и видео.
Добавлены новые UI-снимки, навыки, честный quickstart, различие Hero Level/Stage
Mastery, ограничения выплат и статус ветки; после разрешения пользователя
README дополнен фактическим выпуском v82 на PROD.
Добавлены GAMEPLAY.md, PROGRESSION.md, ECONOMY.md, JURY_DEMO.md и этот отчёт.

Успешно выполнены:

- npm run typecheck;
- npm test, включая test:jury и Marketplace purchase regression;
- npm run build;
- native heroProgressionLiveDev с явным DEV-only opt-in;
- verifyCombatDev: настоящий stage run/reward/duplicate check;
- git diff --check;
- браузерная визуальная и клавиатурная проверка, ten-state Earnings fixture.

Build выдаёт известное предупреждение Vite о большом общем JS chunk (~2.60 MB,
~696 KB gzip). Зависимости не добавлялись. Тесты больше не переписывают исторический
combat-polish report без явного opt-in.

Коммиты реализации (английские сообщения):

| Commit | Изменение |
| --- | --- |
| 99ff9b6 | Hero Progression dialog, пороги 5/8/10. |
| 51f0e2c | Давление этапов, реальные профили и подготовка команды. |
| aa985fc | Read-only Earnings и строгая валидация данных. |
| a4f3140 | Восстановление upgrade read-back и мобильный Marketplace. |
| cbae7b4 | Клавиатурное удержание, max-level и QA coverage. |

Документация и все артефакты включены в следующий отдельный commit; его hash
указан в итоговом сообщении и истории PR. GitHub Actions workflows отсутствуют
(проверен GitHub API), локальных pre-push hooks не найдено. Публикуется отдельная
ветка/PR, не main. Merge не выполнялся. После отдельного разрешения пользователя
iDos deploy выполнен: v82 имеет статус Live, исходный код сборки — `bf2b94b`.

## Публикация на PROD

Архив самодостаточный: 119 файлов, 27,950,989 bytes ZIP, исходные изображения
сохранены. Сборка выполнена с `VITE_IDOS_ENV=prod`; все 119 ресурсов на платформе
вернули HTTP 200. Основной адрес отдаёт новый JS `index-C0YsBddY.js` и CSS
`index-B9lJOQ4_.css`. На существующем PROD-профиле загрузились бой, Inventory
и новое окно Hero Progression с порогами 5/8/10. Покупки и прокачка в smoke-check
не выполнялись. Нативный AFK popup собрал обычную награду при закрытии;
финансовых действий GH не было. При переходах отмечено одно SDK-сообщение
`Too soon. Try again in 2s`; загрузка нового UI и боя завершилась успешно.
CloudCode и Title-конфигурация при публикации не сохранялись.
На публичной странице iDos кнопка PLAY NOW загрузила экран входа игры внутри
iframe; новый вход и полный игровой сценарий внутри iframe не выполнялись.

[Аудит CDN](../artifacts/jury-edition/prod-cdn-audit.json) ·
[Данные релиза](../artifacts/jury-edition/prod-release.json) ·
[Скриншот live-прокачки](../artifacts/jury-edition/prod/live-progression.png).

## Что не проверено / осталось за пределами выпуска

- Полный игровой end-to-end сценарий нового клиента в PROD не выполнялся:
  smoke-check использовал существующий профиль без покупок и прокачки.
- Нет реальных GH переводов, claim или изменения контрактов. Без разрешённого
  платформенного источника живой pool balance остаётся неизвестен.
- DEV overview-handler не включался и CloudCode не публиковался. UI корректно
  обрабатывает существующее отсутствие данных.
- Новый реальный Marketplace trade и конкурентный multi-buyer stress-test не
  выполнялись. Browse/filter/tab UI проверен в DEV, settlement/rejection покрыты
  регрессионным тестом; код торговли сохранён.
- Все 30 этапов пройдены симулятором, не вручную в реальном времени. Нативный
  end-to-end upgrade проверен на Knight; навыки всех классов — в StageRun-тестах.
- Проверялись browser viewport, не физические iOS/Android устройства.
- Свежесть внешних демо-видео не подменяется: они записаны до Jury Edition.
