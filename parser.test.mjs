import assert from 'node:assert';
import { parseTab, layoutRows } from './parser.js';

const standard = `Intro
e|--0--3--|--5--0--|--3--|
B|--1--0--|--1--3--|--0--|
G|--0--0--|--2--0--|--0--|
D|--2--2--|--2--0--|--0--|
A|--3--2--|--0--2--|--2--|
E|-------0|--------|-----|
`;
const nobars = `e|---0---3---5---0---3---|
B|---1---0---1---3---0---|
G|---0---0---2---0---0---|
D|---2---2---2---0---0---|
A|---3---2---0---2---2---|
E|-----------------------|
`;
const twoSystems = `E|-0-1-|-2-3-|
B|-0-1-|-2-3-|
G|-0-1-|-2-3-|
D|-0-1-|-2-3-|

E|-5-|-7-|
B|-5-|-7-|
G|-5-|-7-|
D|-5-|-7-|
`;
const p1 = parseTab(standard);
assert.equal(p1.blocks[1].measures.length, 3);
assert.equal(p1.blocks[1].names.join(''), 'eBGDAE');
assert.equal(parseTab(nobars).blocks[0].measures.length, 1);
assert.equal(parseTab(twoSystems).blocks.filter(b => b.type === 'tab').length, 2);
assert.equal(parseTab('just some lyrics'), null);
const rows = layoutRows(p1, 20).filter(r => !r.text);
assert.ok(rows.length >= 2 && rows.every(r => r.width <= 20));
const mixed = `[Verse]
Em       G
e|--0--3--|--5--| x2
B|--0--0--|--5--|
G|--0--0--|--4--|
D|--2--0--|--5--|
A|--2--2--|--7--|
E|--0--3--|--5--|
la la la
`;
const odd = `[tab]e||--0--3--||--5--|
B||--0--0--||--5--|
G||--0--0--||--4--|
D||--2--0--||--5--|
[/tab]`;
assert.equal(parseTab(odd).blocks.find(b => b.type === 'tab').measures.length, 2);
const barless = `e-----0---3---5---0---3---5---0---3---5---0---
B-----1---0---1---3---0---1---3---0---1---3---
G-----0---0---2---0---0---2---0---0---2---0---
D-----2---2---2---0---2---2---0---2---2---0---
A-----3---2---0---2---2---0---2---2---0---2---
E-------------------------------------------
Chorus`;
const bl = parseTab(barless);
assert.equal(bl.blocks[0].type, 'tab');
const brows = layoutRows(bl, 30).filter(r => !r.text);
assert.ok(brows.length >= 2 && brows.every(r => r.width <= 30));
assert.equal(parseTab('The end -- not a tab\nE is for everything'), null);
const pm = parseTab(mixed);
assert.deepEqual(pm.blocks.map(b => b.type), ['text', 'tab', 'text']);
assert.equal(pm.blocks[1].measures.length, 3);
console.log('parser ok');
