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
assert.equal(p1.systems[0].measures.length, 3);
assert.equal(p1.systems[0].names.join(''), 'eBGDAE');
assert.equal(parseTab(nobars).systems[0].measures.length, 1);
assert.equal(parseTab(twoSystems).systems.length, 2);
assert.equal(parseTab('just some lyrics'), null);
const rows = layoutRows(p1, 20);
assert.ok(rows.length >= 2 && rows.every(r => r.width <= 20));
console.log('parser ok');
