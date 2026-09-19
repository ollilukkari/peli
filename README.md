# Pikku Pupun Pomputtelu Peli

Puhelimen pystyasentoon suunniteltu selainpeli, jossa valkoinen pupu pomppii kohti pilviä. Tietokoneella pelialue säilyttää saman pystysuuntaisen kuvasuhteen.

**Pelaa selaimessa: [ollilukkari.github.io/peli](https://ollilukkari.github.io/peli/)**

## Käynnistys

Tarvitset Node.js 22:n tai uudemman. Peli ei tarvitse npm-riippuvuuksia tai erillistä koontivaihetta.

```sh
npm start
```

Avaa selaimessa `http://127.0.0.1:4173`. Lopeta palvelin painamalla Ctrl+C. Portin voi vaihtaa komennolla `npm start -- --port 4174`. Kehityspalvelin jakaa vain pelin julkiset tiedostot ja kuuntelee oletuksena paikallista konetta.

**Zab-testiversio:** avaa `http://127.0.0.1:4173/?creature=test`. Pieni vihreä hamsteri ilmestyy 200–300 nousumetrin välein, ja pelin alla näkyy testiversion merkintä. Ilman testiparametria väli on julkaisuun tarkoitettu 2 000–3 000 metriä. Valinta säilyy uusilla kierroksilla ja valikossa; sitä ei tallenneta selaimen asetuksiin. Molemmat käyttävät samaa taputtelumekaniikkaa. Kehitysmuutos ei itsessään julkaise peliä.

## Ohjaaminen

- **Puhelin:** vedä sormea pelialueen alemmalla puoliskolla ohjataksesi vasemmalle tai oikealle.
- **Tietokone:** ohjaa vasemmalla ja oikealla nuolinäppäimellä. Escape avaa tauon.
- **Napautukset:** napauta ruutua, klikkaa hiirellä tai paina ohjeen mukaisia näppäimiä erikseen. Pohjassa pitäminen ja pyyhkäisy eivät lisää napautuksia.

Tasojen reunoille ilmestyy trampoliineja: laskeutuminen matolle ampaisee pupun
50 metriä ylöspäin maton korkeudelta. Trampoliinit seisovat tason päällä.
Sivuttaisohjaus toimii myös ampaisun aikana. Trampoliini kasvattaa herkkukomboa
yhdellä ja tarjoaa seuraavan herkun kombon jatkamiseen. Välipalat
keinuvat kevyesti. Vähennetyn liikkeen asetuksella keinunta pysähtyy.
Kombon poimintaääni voimistuu hieman tasoilla 3–10 ja pysyy sen jälkeen samalla
voimakkuudella. Kakkaan astuttaessa pupu sanoo ”Hyi!”, ”Kääk!” tai ”Oivoi!”.
Vähintään kymmenen herkun tai trampoliinin kombon päättyessä ylimääräinen Zab
liukuu sivusta peliruudun yläreunassa saapuvalle vapaalle tasolle 0,55 sekunnissa.
Liuku alkaa vasta tason saavuttaessa yläreunan, joten se näkyy kokonaan.
Taputeltava koira keinahtelee iloisesti, heiluttaa häntäänsä ja läähättää.
Animaatio käyttää taputtelun omaa kelloa muun kentän ollessa pysähdyksissä,
ja vähennetyn liikkeen asetuksella koiran asento pysyy paikallaan.

Tasojen lähtöleveydet ovat 20 % aiempaa pienemmät. Tasot kapenevat edelleen
10 % aina 250 nousumetrin välein, 70 pikselin vähimmäisleveyteen saakka.
Vierimisnopeus kiihtyy korkeuden mukana 30 % aiempaa nopeammin: sama
enimmäisnopeus saavutetaan noin 769 metrissä entisen 1 000 metrin sijaan.

Taustattomat kombonumerot käyttävät tietokoneelle asennettua Cooper Black
-fonttia, josta myös otsikon grafiikka on tehty. Fonttitiedostoa ei jaeta pelin
mukana; ilman asennettua fonttia numerot näkyvät selaimen oletusfontilla.

## Offline ja asennus

**Androidin asennuslinkki: [Asenna peli puhelimeen](https://ollilukkari.github.io/peli/?install=1)**

Linkki avaa koko ruudun asennusnäkymän pelin otsikkografiikalla. Selainpeliä
ei näytetä taustalla eikä sen animaatiota käynnistetä. Pelaajaa ohjataan avaamaan
asennettu peli sovellusvalikosta. Androidin tuetussa selaimessa (esimerkiksi Chrome)
**Asenna peli** aktivoituu, kun selain tarjoaa asennusta. Painike avaa selaimen
vahvistuksen; linkki ei voi asentaa peliä ilman käyttäjän hyväksyntää.
Viestisovelluksen sisäisestä selaimesta linkki voi olla tarpeen avata Chromessa.
Jo asennettu peli avataan puhelimen sovellusvalikosta. Sovelluksena avattuna
asennusnäkymää ei näytetä. Tavallinen pelilinkki toimii kuten ennenkin.

HTTPS-osoitteessa tai localhostissa peli tallentaa onnistuneen ensimmäisen latauksen jälkeen koko pelipaketin offline-käyttöön. Tuettu selain voi tarjota asennusta aloitusnäytölle. Valmiista päivityksestä kerrotaan näytön yläreunan ilmoituspalkissa, joka näkyy ilman vierittämistä. Kierroksen aikana ilmoitus on tiedoksi; uusi versio otetaan käyttöön päivityspainikkeesta kierrosten välissä.

Ennätys ja asetukset säilyvät vain oman selaimen paikallisessa tallennustilassa. Sivustotietojen tyhjentäminen poistaa ne. Pelissä ei ole kirjautumista, analytiikkaa, yhteistä pistetaulukkoa tai pelitietoja vastaanottavaa palvelinta.

## Tarkistukset ja julkaisu

Piirtäjä käyttää uudelleen muistissa olevia kuvia taivaasta, maisemista, tasoista ja koristeista. Välimuistin kuvapuskureiden laskennallinen enimmäiskoko on 8 MiB pelin canvasia kohti; selain voi käyttää lisäksi omaa grafiikkamuistia. Vanhimmat kuvat poistuvat tarpeen mukaan, joten pitkä kierros ei kasvata välimuistia rajatta. Liikkuvat hahmot ja tehosteet sekä pelin fysiikka päivittyvät entiseen tapaan.

```sh
npm test
```

GitHub Pages julkaisee `main`-haaraan viedyt muutokset automaattisesti. Katso [julkaisuohje](docs/github-pages.md). Pelin tiedostopolut ovat suhteellisia ja tukevat projektin alihakemistoa. Julkaistava paketti sisältää `index.html`, `style.css`, `sw.js`, `manifest.webmanifest`, `src/`-pelimoduulit ja `assets/`-kuvakkeet sekä musiikin; kehityspalvelinta ei julkaista.

**Vaihda `sw.js`-tiedoston `RELEASE`-arvo jokaisessa pelipaketin päivityksessä.** Päivitä myös sen `APP_FILES`-lista, jos peliin lisätään tarvittavia tiedostoja. Palvelutyöntekijä pitää dokumentin ja moduulit saman version välimuistissa, ja aktivoituu odottavasta tilasta vain hyväksytyn päivityksen yhteydessä.

Tämä repository on julkinen. Lähdekoodiin, kuviin, dokumentteihin ja Git-historiaan ei saa lisätä salaisuuksia, henkilötietoja, konekohtaisia polkuja tai yksityistä aineistoa. Varmuuskopiot, lokit ja paikalliset asetukset pidetään repositoryn ulkopuolella. Grafiikka ja muut tehosteäänet tuotetaan pelin omalla koodilla; Zab-ääni on toimitetun videon äänileike ([lähdemerkintä](assets/audio/zab-petting-source.md)). Taustamusiikkina käytetään projektiin toimitettuja MP3-kappaleita, jotka sisältyvät myös offline-pakettiin. Musiikki ei tarvitse ulkopuolisia palveluita.

Pelin sovittu ensimmäinen rajaus: [pelisuunnitelma](docs/game-design.md).
