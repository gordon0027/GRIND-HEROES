// Pure release plan: preserve the current PROD code/config, add ordinary pets,
// and carry the DEV-tested combat economy. This file performs no network writes.
import ts from 'typescript';
import { ordinaryEconomyPlan } from './dev-economy-plan.mjs';
const copy = value => JSON.parse(JSON.stringify(value));
function nodes(source) {
  const file = ts.createSourceFile('cloud.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (file.parseDiagnostics.length) throw new Error('CloudCode parse failed');
  return new Map(file.statements.map(node => [ts.isFunctionDeclaration(node) ? node.name?.text :
    ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) ? node.expression.left.getText(file) : '',
    node.getText(file)]).filter(([name]) => name));
}
export function prodCombatPlan(before, dev, devCode, petCode) {
  const current = before.cloud_code;
  const result = ordinaryEconomyPlan({ store: before.store, reward: before.reward,
    character: before.character, cloudCode: current.ActiveRevision.Code });
  const old = nodes(result.cloudCode), tested = nodes(devCode);
  const changed = ['handlers.startStageRun', 'ghPowerForHero', 'ghCalculateTeamPower'];
  for (const name of changed) {
    if (!old.has(name) || !tested.has(name)) throw new Error('Missing release function: ' + name);
    result.cloudCode = result.cloudCode.replace(old.get(name), tested.get(name));
  }
  if (result.cloudCode.includes('var GH_PET_KEY')) throw new Error('Pets already installed: review baseline');
  result.cloudCode += '\n' + petCode;
  const merged = nodes(result.cloudCode), original = nodes(current.ActiveRevision.Code);
  for (const [name, code] of original) {
    if (!changed.includes(name) && merged.get(name) !== code) throw new Error('Protected function changed: ' + name);
  }
  result.handlers = current.Handlers.map(({ Name, Description }) => ({ Name, Description }));
  for (const Name of ['getPetState', 'selectPet']) result.handlers.push({ Name, Description: 'Server-owned pet selection' });
  result.item = copy(before.item);
  result.user_custom_data = copy(before.user_custom_data);
  result.user_custom_data.Keys.grind_pets_v1 = copy(dev.user_custom_data.Keys.grind_pets_v1);
  const section = copy(dev.store.Stores.shop.Layout.Sections.pets);
  delete section.Slots.slot_pet_gh_v1;
  result.store.Stores.shop.Layout.Sections.pets = section;
  // No GH pet offer/item/slot is created. Existing token purchases stay byte-identical.
  for (const id of ['pet_gold_v1', 'pet_gems_v1']) {
    if (before.store.StoreOffers[id] || before.item.Catalogs.Item.Items[id]) throw new Error('Pet baseline changed: ' + id);
    result.store.StoreOffers[id] = copy(dev.store.StoreOffers[id]);
    result.item.Catalogs.Item.Items[id] = copy(dev.item.Catalogs.Item.Items[id]);
    result.item.Catalogs.Item.Items[id].DisplayName = id === 'pet_gold_v1' ? 'Donkey' : 'Pug';
  }
  for (const [id, offer] of Object.entries(before.store.StoreOffers)) {
    if (!['gold_bag_small', 'gold_bag_big'].includes(id) &&
      JSON.stringify(result.store.StoreOffers[id]) !== JSON.stringify(offer)) throw new Error('Protected offer changed: ' + id);
  }
  return result;
}
