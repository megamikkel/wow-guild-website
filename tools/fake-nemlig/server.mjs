// Falsk nemlig-server til udvikling og manuel afprøvning.
//
// Den svarer efter de skemaer der er dokumenteret i docs/nemlig-api.md, så vi
// kan køre HELE flowet — login, søgning, mapping, priser, kurv — uden at røre
// den rigtige nemlig og uden rigtige credentials.
//
// Den beviser IKKE at nemligs API ser sådan ud. Den beviser at vores klient
// virker hvis det gør. Den rigtige verifikation er tjeklisten i
// docs/nemlig-api.md §7.
//
//   node tools/fake-nemlig/server.mjs [port]

import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? 5300);

const KATALOG = [
  // [id, navn, brand, kategori, pris, enhedspris, enhedsetiket, beskrivelse, paaLager]
  ['5070417', 'Hakket oksekød 8-12%', 'Danish Crown', 'Kød', 41.75, 83.50, 'kr/kg', '500 g / 8-12%', true],
  ['5070418', 'Økologisk hakket oksekød 4-7%', 'Änglamark', 'Kød', 54.00, 135.00, 'kr/kg', '400 g / økologisk', true],
  ['5070420', 'Kyllingebryst', 'Rose', 'Kød', 62.00, 103.33, 'kr/kg', '600 g', true],
  ['5070421', 'Kyllingelår', 'Rose', 'Kød', 39.95, 39.95, 'kr/kg', '1 kg', true],
  ['5070422', 'Torskefilet', 'Fiskeriet', 'Fisk', 74.00, 148.00, 'kr/kg', '500 g', true],
  ['4010221', 'Spaghetti', 'De Cecco', 'Kolonial', 16.95, 33.90, 'kr/kg', '500 g', true],
  ['4010222', 'Lasagneplader', 'Barilla', 'Kolonial', 21.50, 43.00, 'kr/kg', '500 g', true],
  ['4010223', 'Ris', 'Ris Fint', 'Kolonial', 18.95, 18.95, 'kr/kg', '1 kg', true],
  ['4010224', 'Røde linser', 'Urtekram', 'Kolonial', 22.00, 44.00, 'kr/kg', '500 g', true],
  ['4010225', 'Hvedemel', 'Finax', 'Kolonial', 12.95, 12.95, 'kr/kg', '1 kg', true],
  ['4030877', 'Flåede tomater', 'Mutti', 'Kolonial', 9.75, 24.38, 'kr/kg', '400 g', true],
  ['4030878', 'Kokosmælk', 'Aroy-D', 'Kolonial', 11.50, 28.75, 'kr/l', '400 ml', true],
  ['4030879', 'Pesto', 'Barilla', 'Kolonial', 19.95, 106.00, 'kr/kg', '190 g', true],
  ['3020115', 'Hvidløg', null, 'Frugt & grønt', 8.95, 8.95, 'kr/stk', '1 stk', true],
  ['3020117', 'Løg', null, 'Frugt & grønt', 4.50, 4.50, 'kr/stk', '1 stk', true],
  ['3020118', 'Kartofler', null, 'Frugt & grønt', 19.95, 9.98, 'kr/kg', '2 kg', true],
  ['3020119', 'Gulerødder', null, 'Frugt & grønt', 12.95, 12.95, 'kr/kg', '1 kg', true],
  ['3020120', 'Cherrytomater', null, 'Frugt & grønt', 16.95, 67.80, 'kr/kg', '250 g', true],
  ['2010455', 'Letmælk 1,5%', 'Arla', 'Mejeri', 12.50, 12.50, 'kr/l', '1 l', true],
  ['2010456', 'Parmesan revet', 'Castello', 'Mejeri', 27.95, 279.50, 'kr/kg', '100 g', true],
];

const kurv = new Map();

const produkt = ([Id, Name, Brand, Category, Price, UnitPriceCalc, UnitPriceLabel, Description, inStock]) => ({
  Id, Name, Brand, Category, SubCategory: Category,
  Url: `${Name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Id}`,
  Price, UnitPriceCalc, UnitPriceLabel, Description,
  PrimaryImage: `https://example.invalid/${Id}.jpg`,
  Availability: { IsDeliveryAvailable: true, IsAvailableInStock: inStock },
  DiscountItem: false, Favorite: false, Labels: [], Campaign: null,
});

const kurvSvar = () => ({
  BasketGuid: '00000000-0000-0000-0000-000000000001',
  Lines: [...kurv.entries()].flatMap(([id, qty]) => {
    const raekke = KATALOG.find(k => k[0] === id);
    if (!raekke) { console.warn(`  ukendt varenummer i kurven: ${id}`); return []; }
    const p = produkt(raekke);
    return [{ Id: id, Name: p.Name, Brand: p.Brand, Quantity: qty,
              ItemPrice: p.Price, Price: +(p.Price * qty).toFixed(2), Description: p.Description }];
  }),
  NumberOfProducts: [...kurv.values()].reduce((a, b) => a + b, 0),
  ValidationFailures: [],
  Recipes: [],
});

const svar = (res, body, code = 200) => {
  const json = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(json);
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  let body = '';
  for await (const c of req) body += c;

  console.log(`${req.method} ${path}`);

  if (path === '/webapi/AntiForgery') {
    res.setHeader('set-cookie', 'XSRF-TOKEN=fake-xsrf; Path=/');
    return svar(res, { Header: 'X-XSRF-TOKEN', Value: 'fake-xsrf' });
  }

  if (path === '/webapi/Token')
    return svar(res, { upgraded: false, access_token: 'fake.bearer.token',
                       expires_in: 300, token_type: 'Bearer' });

  if (path === '/webapi/login') {
    res.setHeader('set-cookie', '.ASPXAUTH=fake-auth; Path=/');
    return svar(res, { RedirectUrl: '/', MergeSuccessful: true,
                       TimeslotUtc: '2026082212-60-180', DeliveryZoneId: 1 });
  }

  if (path === '/webapi/v2/AppSettings/Website')
    return svar(res, { CombinedProductsAndSitecoreTimestamp: 'fake-timestamp' });

  if (path === '/' && url.searchParams.get('GetAsJson') === '1')
    return svar(res, { MetaData: { ResponseCode: 200 },
                       Settings: { TimeslotUtc: '2026082212-60-180', DeliveryZoneId: 1,
                                   UserId: 'fake-user', CombinedProductsAndSitecoreTimestamp: 'fake-timestamp' } });

  if (path === '/searchgateway/api/search') {
    const q = (url.searchParams.get('query') ?? '').toLowerCase();
    const take = Number(url.searchParams.get('take') ?? 10);
    const ord = q.split(/\s+/).filter(Boolean);
    const traef = KATALOG
      .filter(k => ord.some(o => k[1].toLowerCase().includes(o)))
      .slice(0, take)
      .map(produkt);
    return svar(res, { Products: { Products: traef, Start: 0, NumFound: traef.length },
                       Facets: { NumFound: traef.length, SortingList: [], FacetGroups: [] },
                       Recipes: [] });
  }

  // Kun til afprøvning: skru på en pris, så prisovervågningen kan demonstreres.
  if (path === '/dev/set-price') {
    const id = url.searchParams.get('id');
    const pris = Number(url.searchParams.get('price'));
    const raekke = KATALOG.find(k => k[0] === id);
    if (!raekke) return svar(res, { error: 'ukendt id' }, 404);
    const foer = raekke[4];
    raekke[4] = pris;
    console.log(`  pris ændret: ${raekke[1]} ${foer} -> ${pris}`);
    return svar(res, { id, navn: raekke[1], foer, nu: pris });
  }

  // Produktside via GetAsJson — den dokumenterede vej til produktdetaljer.
  if (url.searchParams.get('GetAsJson') === '1' && path.length > 1) {
    const id = path.split('-').pop();
    const raekke = KATALOG.find(k => k[0] === id);
    if (raekke) {
      const p = produkt(raekke);
      // NESTED-tilstand til afproevning: laeg produktet et andet sted, saa vi kan
      // se at diagnosen viser formen naar mapningen ikke finder det.
      if (process.env.NESTED) {
        return svar(res, { MetaData: { ResponseCode: 200, Name: 'Product page' },
                           Settings: { ZipCode: '1620', UserId: 'x' },
                           content: [{ TemplateName: 'productspot', Product: p }] });
      }
      return svar(res, { MetaData: { ResponseCode: 200 }, ...p,
                         Attributes: [{ Name: 'Oprindelse', Value: 'Danmark' }],
                         AlternativeProducts: [] });
    }
  }

  if (path === '/webapi/basket/GetBasket') return svar(res, kurvSvar());

  if (path === '/webapi/basket/AddToBasket') {
    const payload = JSON.parse(body || '{}');
    console.log('  payload:', body);
    // Nemligs dokumenterede skema er PascalCase. Vi accepterer kun det, netop
    // for at fange hvis vores klient sender noget andet.
    const { ProductId, quantity } = payload;
    if (ProductId === undefined)
      return svar(res, { error: 'forventede feltet ProductId (PascalCase)', fik: Object.keys(payload) }, 400);
    // Som hos nemlig: mængden er ABSOLUT, og 0 fjerner linjen.
    if (quantity === 0) kurv.delete(String(ProductId));
    else kurv.set(String(ProductId), quantity);
    return svar(res, kurvSvar());
  }

  svar(res, { error: 'ukendt endpoint', path }, 404);
}).listen(PORT, () => console.log(`falsk nemlig lytter på http://localhost:${PORT}`));
