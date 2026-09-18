# Pupun pomputtelu peli

Puhelimen pystyasentoon suunniteltu selainpeli, jossa valkoinen pupu pomppii kohti pilviä. Tietokoneella pelialue säilyttää saman pystysuuntaisen kuvasuhteen.

**Pelaa selaimessa: [ollilukkari.github.io/peli](https://ollilukkari.github.io/peli/)**

## Käynnistys

Tarvitset Node.js 22:n tai uudemman. Peli ei tarvitse npm-riippuvuuksia tai erillistä koontivaihetta.

```sh
npm start
```

Avaa selaimessa `http://127.0.0.1:4173`. Lopeta palvelin painamalla Ctrl+C. Portin voi vaihtaa komennolla `npm start -- --port 4174`. Kehityspalvelin jakaa vain pelin julkiset tiedostot ja kuuntelee oletuksena paikallista konetta.

## Pelaaminen

- **Puhelin:** kosketa pelialueen alempaa puoliskoa ja vedä sormea sivulle. Joystick ilmestyy kosketuskohtaan. Pupu pomppii automaattisesti.
- **Tietokone:** liiku vasemmalla ja oikealla nuolinäppäimellä. Pelialue pysyy pystysuuntaisena myös suurella näytöllä.
- **Satsuma:** hyppää hedelmän päälle saadaksesi kolminkertaisen hyppykorkeuden.
- **Satsumaketju:** jokainen tehohyppy varmistaa seuraavan satsuman hyppyulottuville olemassa olevalle tasolle. Kolme peräkkäistä satsumaa käynnistää kombolaskurin ja jokaisesta seuraavasta satsumasta ponnahtavan tähtitehosteen. Laskeutuminen ilman satsumaa katkaisee kombon; pisteet mittaavat edelleen matkaa.
- **Ansa:** neljä uutta napautusta vapauttaa pupun. Tietokoneella paina mitä tahansa nuolinäppäintä tai välilyöntiä neljä erillistä kertaa. Näppäimen pitäminen pohjassa ei ole useita tökkäisyjä.
- **Kakka:** liukastut tulosuunnassa; suurempi sivuttaisnopeus aiheuttaa pidemmän ja nopeamman liu'un. Esineet aktivoituvat laskeuduttaessa niiden päälle.
- **Lokki:** sik-sak lentävään lokkiin osuminen kimmottaa pupua viistosti ylöspäin ja poispäin lokista. Osuma ei katkaise satsumaketjua.
- **Tauko:** paina taukopainiketta tai Escapea. Taustalle siirtyminen keskeyttää kierroksen.

Alareunaan putoaminen päättää kierroksen. Pisteet mittaavat edettyä matkaa. Kesä, syksyinen Ruska ja sinimustaan talviyöhön sijoittuva Talvi käyttävät samaa vaikeutta ja pelimekaniikkaa. Ruskan pupulla on tummanoranssi pipo. Pelin ympäristö sävyttyy valitun maailman mukaan. Komboilmoitukset pysyvät pelialueen alapuoliskolla.

Kesän oletusmusiikki on **Summer Platformer**, Ruskan **Kalm Mjörk** ja Talven **Frozen Minor — Reduced Low End**. Musiikki vaihtuu jo päävalikossa maailmaa valittaessa ja jatkuu kierroksen alkaessa. Selain sallii äänen ensimmäisen painalluksen jälkeen. Tauko pysäyttää musiikin samaan kohtaan. Musiikki jatkuu RIP-ruudussa, uusintakierroksella ja valikkoon palatessa; kappale vaihtuu ja alkaa alusta vasta vuodenaikaa vaihdettaessa. Taukopainikkeen viereinen nuottipainike (**Music off / Music on**) mykistää vain musiikin. Äänipainike mykistää kaikki äänet. Molemmat asetukset tallentuvat selaimeen. Alkuperäinen Kvltist-maailma säilyy koodissa mutta on piilotettu valikosta; sen aiempi tallennettu valinta avaa Talven.

## Offline ja asennus

HTTPS-osoitteessa tai localhostissa peli tallentaa onnistuneen ensimmäisen latauksen jälkeen koko pelipaketin offline-käyttöön. Peli ilmoittaa, kun tallennus on varmistettu. Tuettu selain voi tarjota asennusta aloitusnäytölle. Uusi versio otetaan käyttöön pelin päivityspainikkeesta kierrosten välissä.

Ennätys ja asetukset säilyvät vain oman selaimen paikallisessa tallennustilassa. Sivustotietojen tyhjentäminen poistaa ne. Pelissä ei ole kirjautumista, analytiikkaa, yhteistä pistetaulukkoa tai pelitietoja vastaanottavaa palvelinta.

## Tarkistukset ja julkaisu

```sh
npm test
```

GitHub Pages julkaisee `main`-haaraan viedyt muutokset automaattisesti. Katso [julkaisuohje](docs/github-pages.md). Pelin tiedostopolut ovat suhteellisia ja tukevat projektin alihakemistoa. Julkaistava paketti sisältää `index.html`, `style.css`, `sw.js`, `manifest.webmanifest`, `src/`-pelimoduulit ja `assets/`-kuvakkeet sekä musiikin; kehityspalvelinta ei julkaista.

**Vaihda `sw.js`-tiedoston `RELEASE`-arvo jokaisessa pelipaketin päivityksessä.** Päivitä myös sen `APP_FILES`-lista, jos peliin lisätään tarvittavia tiedostoja. Palvelutyöntekijä pitää dokumentin ja moduulit saman version välimuistissa, ja aktivoituu odottavasta tilasta vain hyväksytyn päivityksen yhteydessä.

Tämä repository on julkinen. Lähdekoodiin, kuviin, dokumentteihin ja Git-historiaan ei saa lisätä salaisuuksia, henkilötietoja, konekohtaisia polkuja tai yksityistä aineistoa. Varmuuskopiot, lokit ja paikalliset asetukset pidetään repositoryn ulkopuolella. Grafiikka ja tehosteäänet tuotetaan pelin omalla koodilla. Taustamusiikkina käytetään projektiin toimitettuja MP3-kappaleita, jotka sisältyvät myös offline-pakettiin. Musiikki ei tarvitse ulkopuolisia palveluita.

Pelin sovittu ensimmäinen rajaus: [pelisuunnitelma](docs/game-design.md).
