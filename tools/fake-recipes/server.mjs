// Falsk opskriftsside til udvikling. Serverer et lille bibliotek af danske
// hverdagsretter i BEGGE schema.org-former, så importen kan afprøves uden at
// belaste rigtige sider.
//
//   node tools/fake-recipes/server.mjs [port]

import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? 5400);

const RETTER = [
  ['spaghetti-koedsovs', 'Spaghetti med kødsovs', 4, 45, ['Familiefavoritter'],
   ['500 g hakket oksekød', '1 dåse flåede tomater', '2 fed hvidløg', '300 g spaghetti', '2 spsk olivenolie', 'salt og peber']],
  ['lasagne', 'Lasagne', 4, 75, ['Familiefavoritter'],
   ['400 g hakket oksekød', '500 g lasagneplader', '3 dl mælk', '2 fed hvidløg', '1 dåse flåede tomater']],
  ['frikadeller', 'Frikadeller med kartofler', 4, 50, ['Opskrifter til børn'],
   ['500 g hakket oksekød', '1 løg', '1 dl mælk', '800 g kartofler', '2 spsk hvedemel']],
  ['kylling-i-fad', 'Kylling i fad', 4, 60, ['Nem Hverdagsmad'],
   ['1 kg kyllingelår', '800 g kartofler', '2 gulerødder', '2 spsk olivenolie']],
  ['pasta-pesto', 'Pasta med pesto', 4, 20, ['Nem Hverdagsmad', 'Vegetar'],
   ['400 g spaghetti', '1 bakke cherrytomater', '100 g parmesan', '2 spsk olivenolie']],
  ['kylling-karry', 'Kylling i karry', 4, 40, ['Familiefavoritter'],
   ['600 g kyllingebryst', '400 g ris', '4 dl kokosmælk', '2 gulerødder', '1 løg']],
  ['fiskefrikadeller', 'Fiskefrikadeller', 4, 35, ['Opskrifter til børn'],
   ['500 g torskefilet', '1 løg', '2 spsk hvedemel', '800 g kartofler']],
  ['linsegryde', 'Linsegryde', 4, 30, ['Vegetar', 'Nem Hverdagsmad'],
   ['300 g røde linser', '1 dåse flåede tomater', '2 gulerødder', '1 løg', '4 dl kokosmælk']],
];

// Halvdelen som JSON-LD, halvdelen som microdata — ligesom virkeligheden.
const jsonLd = ([slug, navn, pers, min, kat, ing]) => `<!DOCTYPE html><html lang="da"><head>
<title>${navn}</title>
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebSite', name: 'Falsk Madblog' },
  { '@type': 'Recipe', name: navn, author: { '@type': 'Person', name: 'Testkok' },
    recipeYield: `${pers} personer`, totalTime: `PT${min}M`, recipeCategory: kat,
    recipeIngredient: ing,
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Lav maden.' }] }]})}
</script></head><body><h1>${navn}</h1></body></html>`;

const microdata = ([slug, navn, pers, min, kat, ing]) => `<!DOCTYPE html><html lang="da"><head>
<title>${navn}</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"${navn}"}
</script></head><body>
<article itemscope itemtype="http://schema.org/Recipe">
<h1 itemprop="name">${navn}</h1>
<span itemprop="author">Testkok</span>
<meta itemprop="totalTime" content="PT${min}M">
<span itemprop="recipeYield">${pers} personer</span>
${kat.map(k => `<span itemprop="recipeCategory">${k}</span>`).join('')}
${ing.map(i => `<li itemprop="recipeIngredient">${i}</li>`).join('')}
<div itemprop="recipeInstructions">Lav maden.</div>
</article></body></html>`;

createServer((req, res) => {
  const path = new URL(req.url, `http://localhost:${PORT}`).pathname;
  console.log(`GET ${path}`);

  if (path === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('User-agent: *\nDisallow: /admin\n');
  }

  const slug = path.replace(/^\/opskrifter\//, '').replace(/\/$/, '');
  const idx = RETTER.findIndex(r => r[0] === slug);
  if (idx < 0) { res.writeHead(404); return res.end('ikke fundet'); }

  const html = idx % 2 === 0 ? jsonLd(RETTER[idx]) : microdata(RETTER[idx]);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(PORT, () => {
  console.log(`falske opskrifter på http://localhost:${PORT}`);
  console.log(RETTER.map(r => `  http://localhost:${PORT}/opskrifter/${r[0]}`).join('\n'));
});
