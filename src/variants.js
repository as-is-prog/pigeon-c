'use strict';
// 15種の羽色。ドバト13＋キジバト2。
// pattern: bar / checker / dark / barless / kiji
// weight: 出現しやすさ。kiji は場所で倍率が変わる。
const VARIANTS = [
  {
    id: 'bluebar', name: 'ブルーバー', species: 'dove', weight: 22, pattern: 'bar',
    head: '#7b8495', neckG: '#4f9c78', neckP: '#8b5c98', body: '#8e97a8', wing: '#a9b1bf',
    mark: '#25272c', prim: '#4d525c', tail: '#7f8797', band: '#2a2c31', rump: '#b9bfca',
    eye: '#d4582a', leg: '#c9605d',
    desc: '野生のカワラバトと同じ二本線。街でいちばんよく見る、いわば鳩の標準形。',
  },
  {
    id: 'bluecheck', name: 'ブルーチェッカー', species: 'dove', weight: 20, pattern: 'checker',
    head: '#78808f', neckG: '#4c9874', neckP: '#875a95', body: '#8a93a3', wing: '#a0a8b6',
    mark: '#353840', prim: '#4a4f58', tail: '#7b8392', band: '#282a2f', rump: '#a8afba',
    eye: '#d4582a', leg: '#c9605d',
    desc: '翼に市松もよう。都市の鳩はこちらが多数派という調査もある。',
  },
  {
    id: 'darkcheck', name: 'ダークチェッカー', species: 'dove', weight: 14, pattern: 'dark',
    head: '#5d6371', neckG: '#3f8a66', neckP: '#7a4d86', body: '#6c7382', wing: '#545a67',
    mark: '#8f97a6', prim: '#373a42', tail: '#626977', band: '#222328', rump: '#7a8190',
    eye: '#d4582a', leg: '#c45a58',
    desc: 'もようが詰まりすぎて黒っぽく見えるチェッカー。T字もようとも。',
  },
  {
    id: 'barless', name: 'バーレス', species: 'dove', weight: 4, pattern: 'barless',
    head: '#7e8798', neckG: '#53a07c', neckP: '#8d5f9a', body: '#9199a9', wing: '#adb4c1',
    mark: '#adb4c1', prim: '#5a5f69', tail: '#848c9b', band: '#34363b', rump: '#b5bbc6',
    eye: '#d4582a', leg: '#c9605d',
    desc: '翼の線が消えたもの。のっぺりした灰色で、どこか眠そうに見える。',
  },
  {
    id: 'black', name: 'ブラック', species: 'dove', weight: 8, pattern: 'barless',
    head: '#2e3035', neckG: '#2f7457', neckP: '#5a3a68', body: '#33363c', wing: '#3a3d44',
    mark: '#3a3d44', prim: '#24262a', tail: '#303338', band: '#1d1e21', rump: '#33363c',
    eye: '#e0732c', leg: '#b9504f',
    desc: '全身すす色。光の加減で首だけ緑に燃える。',
  },
  {
    id: 'redbar', name: 'レッドバー', species: 'dove', weight: 4, pattern: 'bar',
    head: '#c0a9a2', neckG: '#b97c78', neckP: '#a0708f', body: '#cbbab2', wing: '#dccfc8',
    mark: '#9c4a33', prim: '#b49c93', tail: '#cfc2bb', band: '#b9a196', rump: '#d8ccc6',
    eye: '#d86a2e', leg: '#d06b66',
    desc: '灰色の代わりに赤茶の線。群れの中で妙に目立つ、ちょっとした有名人。',
  },
  {
    id: 'redcheck', name: 'レッドチェッカー', species: 'dove', weight: 3, pattern: 'checker',
    head: '#b39189', neckG: '#b0706c', neckP: '#97627f', body: '#bea197', wing: '#caa597',
    mark: '#8a3c28', prim: '#a7877c', tail: '#c1aaa1', band: '#a98d82', rump: '#cdb8b0',
    eye: '#d86a2e', leg: '#d06b66',
    desc: '赤茶の市松。遠目にはレンガ色のかたまりに見える。',
  },
  {
    id: 'brown', name: 'ブラウン', species: 'dove', weight: 4, pattern: 'bar',
    head: '#6a5143', neckG: '#5f7f5c', neckP: '#6e4c60', body: '#735848', wing: '#866955',
    mark: '#3b2a21', prim: '#4a372c', tail: '#6c5444', band: '#33251e', rump: '#7c6050',
    eye: '#d8692c', leg: '#c35c56',
    desc: 'チョコレート色。黒系の色素が茶色に置き換わった珍しい型。',
  },
  {
    id: 'white', name: 'ホワイト', species: 'dove', weight: 3, pattern: 'barless',
    head: '#efece6', neckG: '#e8e6df', neckP: '#ebe5e3', body: '#f1eee8', wing: '#f6f4ef',
    mark: '#f6f4ef', prim: '#e4e1da', tail: '#ece9e3', band: '#e2dfd8', rump: '#f1eee8',
    eye: '#3b221a', leg: '#d97470',
    desc: '真っ白。目が黒いことが多い。どこにいても一羽だけ写真映えする。',
  },
  {
    id: 'pied', name: 'パイド', species: 'dove', weight: 8, pattern: 'bar', pied: 0.55,
    head: '#7b8495', neckG: '#4f9c78', neckP: '#8b5c98', body: '#8e97a8', wing: '#a9b1bf',
    mark: '#25272c', prim: '#4d525c', tail: '#7f8797', band: '#2a2c31', rump: '#b9bfca',
    eye: '#d4582a', leg: '#c9605d',
    desc: '白いぶちが入る。ぶちの位置は一羽ずつ違うので、見分けやすい。',
  },
  {
    id: 'grizzle', name: 'グリズル', species: 'dove', weight: 4, pattern: 'checker', grizzle: 0.45,
    head: '#c9ccd2', neckG: '#7ea592', neckP: '#9a83a3', body: '#9aa2b0', wing: '#a9b0bc',
    mark: '#454952', prim: '#6a6f79', tail: '#9299a6', band: '#4a4d54', rump: '#c8ccd3',
    eye: '#d4582a', leg: '#c9605d',
    desc: '白と灰のごま塩。近くで見るほど細かい。',
  },
  {
    id: 'silver', name: 'シルバー', species: 'dove', weight: 3, pattern: 'bar',
    head: '#aaa59d', neckG: '#8fa897', neckP: '#a291a0', body: '#b9b4ab', wing: '#cbc6be',
    mark: '#776b5f', prim: '#8c8277', tail: '#b0aaa1', band: '#857a6f', rump: '#c9c4bc',
    eye: '#d86a2e', leg: '#cd6762',
    desc: '色を薄めたブルーバー。線が焦げ茶になって、全体に砂っぽい。',
  },
  {
    id: 'whitehead', name: '白頭パイド', species: 'dove', weight: 3, pattern: 'dark', whiteHead: true, whitePrim: true,
    head: '#f0ede7', neckG: '#3f8a66', neckP: '#7a4d86', body: '#6c7382', wing: '#545a67',
    mark: '#8f97a6', prim: '#f1eee9', tail: '#626977', band: '#222328', rump: '#7a8190',
    eye: '#d4582a', leg: '#c45a58',
    desc: '頭と風切羽だけ白い。帽子をかぶっているように見える。',
  },
  {
    id: 'kiji', name: 'キジバト', species: 'kiji', weight: 6, pattern: 'kiji',
    head: '#a99aa0', neckG: '#2f3448', neckP: '#a9b6c7', body: '#b8968a', wing: '#9b6a4d',
    mark: '#3e2a22', prim: '#4b3a33', tail: '#5a5250', band: '#e9e4dc', rump: '#867a7c',
    eye: '#e07b25', leg: '#b8665f',
    desc: '在来の野鳩。うろこ模様の翼と、首の青黒いしましまが目印。群れずに二羽でいることが多い。',
  },
  {
    id: 'kijijuv', name: 'キジバト（幼鳥）', species: 'kiji', weight: 2, pattern: 'kiji', juvenile: true,
    head: '#a39388', neckG: '#a39388', neckP: '#a39388', body: '#ae9184', wing: '#8f6d58',
    mark: '#5a4337', prim: '#4e3f37', tail: '#5d5552', band: '#ddd6cc', rump: '#857a78',
    eye: '#9a6a3c', leg: '#b07067',
    desc: '首のしましまがまだない若い個体。うろこもぼんやりしていて、どこか頼りない。',
  },
];

// 色をRGB配列に変換しておく
for (const v of VARIANTS) {
  v.c = {};
  for (const k of ['head', 'neckG', 'neckP', 'body', 'wing', 'mark', 'prim', 'tail', 'band', 'rump', 'eye', 'leg']) {
    v.c[k] = U.hex(v[k]);
  }
  v.c.beak = v.species === 'kiji' ? U.hex('#4a3f3c') : U.hex('#3d393a');
  v.c.cere = v.species === 'kiji' ? U.hex('#8c7b78') : U.hex('#ebe6de');
  v.c.white = U.hex('#f3f1ec');
}
const VARIANT_BY_ID = Object.fromEntries(VARIANTS.map((v) => [v.id, v]));
