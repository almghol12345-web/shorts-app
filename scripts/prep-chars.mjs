// Prepares the KayKit characters (CC0, Kay Lousberg, www.kaylousberg.com) for the game.
// Source packs: github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 and ...-Skeletons-1.0
//   node scripts/prep-chars.mjs <folder that holds both clones>
// Writes assets/chars/<name>.glb (mesh, skin and a small texture, no animations) and two animation libraries.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize } from '@gltf-transform/functions';
// drop accessors nothing uses any more (left over from the removed animations)
const dropOrphans = doc => doc.getRoot().listAccessors().forEach(a => { if (a.listParents().every(p => p.propertyType === 'Root')) a.dispose(); });

const src = process.argv[2]; if (!src) throw new Error('pass the folder with the KayKit clones');
const A = path.join(src, 'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf');
const K = path.join(src, 'KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf');
const out = 'assets/chars'; fs.mkdirSync(out, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const chars = { knight: [A, 'Knight'], barbarian: [A, 'Barbarian'], mage: [A, 'Mage'], rogue: [A, 'Rogue'], rogue_hooded: [A, 'Rogue_Hooded'], skel_minion: [K, 'Skeleton_Minion'], skel_warrior: [K, 'Skeleton_Warrior'] };
const KEEP_A = ['Idle', 'Walking_A', 'Walking_B', 'Running_A', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Chop', '2H_Melee_Idle', 'Dualwield_Melee_Attack_Stab', '1H_Ranged_Shoot', '2H_Ranged_Shoot', 'Spellcast_Shoot', 'Spellcast_Raise', 'Cheer', 'Hit_A', 'Death_A', 'Unarmed_Melee_Attack_Punch_A', 'Interact', 'Block'];
const KEEP_S = ['Walking_D_Skeletons', 'Running_C', 'Spawn_Ground_Skeletons', 'Death_C_Skeletons', 'Idle_Combat', 'Taunt'];
for (const [name, [dir, file]] of Object.entries(chars)) {
  const doc = await io.read(path.join(dir, file + '.glb'));
  doc.getRoot().listAnimations().forEach(a => { a.listSamplers().forEach(x => x.dispose()); a.listChannels().forEach(x => x.dispose()); a.dispose(); });
  dropOrphans(doc);
  await doc.transform(prune(), dedup());
  await io.write(path.join(out, name + '.glb'), doc);
}
for (const [lib, dir, file, keep] of [['anims_a', A, 'Knight', KEEP_A], ['anims_s', K, 'Skeleton_Minion', KEEP_S]]) {
  const doc = await io.read(path.join(dir, file + '.glb'));
  doc.getRoot().listAnimations().forEach(a => { if (!keep.includes(a.getName())) { a.listSamplers().forEach(x => x.dispose()); a.listChannels().forEach(x => x.dispose()); a.dispose(); } });
  doc.getRoot().listNodes().forEach(n => { if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); } });
  doc.getRoot().listTextures().forEach(t => t.dispose()); doc.getRoot().listMaterials().forEach(m => m.dispose());
  dropOrphans(doc);
  await doc.transform(resample({ tolerance: 2e-4 }), prune({ keepLeaves: true }), dedup());
  dropOrphans(doc);
  await io.write(path.join(out, lib + '.glb'), doc);
}
fs.copyFileSync(path.join(A, '../../LICENSE.txt'), path.join(out, 'LICENSE-KayKit.txt'));
for (const f of fs.readdirSync(out)) console.log(f.padEnd(22), (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB');
