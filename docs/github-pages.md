# GitHub Pages

Pelin osoite on <https://ollilukkari.github.io/peli/>.

## Julkaisu

Repositoryn **Settings → Pages → Build and deployment → Source** -asetuksena
on **GitHub Actions**. `github-pages`-ympäristö sallii julkaisut vain
`main`-haarasta. Osoite käyttää HTTPS:ää eikä tarvitse omaa verkkotunnusta.

Työnkulku `.github/workflows/pages.yml` käynnistyy, kun `main`-haaraan
pusketaan muutos. Sen voi käynnistää myös valitsemalla **Actions → Deploy
GitHub Pages → Run workflow → main**. Muiden haarojen käsiajot ohitetaan.

Peli ei tarvitse asennettavia riippuvuuksia tai build-vaihetta. Työnkulku
kopioi selaimen tarvitsemat tiedostot julkaisupakettiin ja julkaisee sen.
Jos juuren `index.html` puuttuu, ajo onnistuu mutta julkaisu ohitetaan:
infran käyttöönotto ei julkaise paikkamerkkisivua tai keskeneräistä peliä.
Ensimmäinen sivusto tulee saataville, kun valmis ja tarkistettu peli
yhdistetään erikseen `main`-haaraan ja sen julkaisuajo onnistuu.

## Julkaistavat tiedostot

Julkaisu poimii vain Gitin seuraamat tiedostot repositoryn juuresta sekä
hakemistoista `assets/`, `icons/`, `audio/`, `css/`, `js/` ja `src/`:

- HTML, CSS, JavaScript (`.js`, `.mjs`) ja `.webmanifest`.
- Kuvat (`.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.ico`).
- Äänet (`.mp3`, `.ogg`, `.wav`) ja fontit (`.woff`, `.woff2`).
- Juuren `manifest.json` sekä edellä mainittujen hakemistojen JSON-tiedostot.

Piilotiedostot, piilohakemistot, kehitysohjeet, dokumentaatio ja muut
tiedostotyypit eivät kuulu sivustoon. Symboliset linkit hylätään.
Jos peli tarvitsee uuden tiedostotyypin tai hakemiston, lisää se työnkulun
julkaisulistaan ja tarkista julkaistavan paketin sisältö ennen julkaisua.

Repository ja sivusto ovat julkisia. Älä lisää salaisuuksia, tunnuksia,
henkilötietoja, paikallisia konepolkuja tai sisäisiä aineistoja mihinkään
repositoryn tiedostoihin tai Git-historiaan. Julkaisulista ei korvaa tätä
tarkistusta. Työnkulku käyttää GitHubin lyhytikäistä julkaisutunnistusta;
omaa salasanaa tai pysyvää käyttöavainta ei tarvita pelissä tai työnkulussa.

## Polut ja PWA

Sivusto sijaitsee `/peli/`-polussa. Käytä pelin resursseissa suhteellisia
osoitteita, esimerkiksi `./assets/kuva.png`. PWA-manifestin `start_url` ja
`scope` sekä service workerin rekisteröinti täytyy rajata tähän sovellukseen.
Juuren service workerin voi rekisteröidä suhteellisella osoitteella
`./sw.js`. Pelin toteutus vastaa välimuistin versioinnista ja päivityksistä.

Julkaisun jälkeen tarkista puhelimella ja tietokoneella pelin lataus,
resurssien polut sekä PWA-asennus ja offline-käyttö. Pagesin käyttöönotto
yksin ei varmista pelin tai offline-välimuistin toimintaa.

## Tarkistus ja vianhaku

Seuraa ajoa repositoryn **Actions**-välilehdellä. `prepare` valmistaa
tiedostot ja `deploy` julkaisee ne. Puuttuvasta `index.html`-tiedostosta
kerrotaan ajon yhteenvedossa. Ennen ensimmäistä onnistunutta julkaisua
pelin osoitteessa voi näkyä 404-virhe.

Jos julkaisu epäonnistuu, tarkista ajon loki, Pagesin lähdeasetus sekä
`github-pages`-ympäristön `main`-haararajaus. Työnkulku antaa lähdekoodin
valmistelulle vain `contents: read` -oikeuden ja julkaisulle vain
`pages: write`- sekä `id-token: write` -oikeudet.

GitHubin ohjeet:

- [Oman Pages-työnkulun käyttö](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Julkaisulähteen määrittäminen](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
