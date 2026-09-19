# Pikku Pupun Pomputtelu Peli

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
- **Välipalat:** kesällä mansikka, syksyllä puolukkaterttu ja talvella satsuma. Jokainen antaa kolminkertaisen hyppykorkeuden. Mansikka hehkuu korallinpunaisena, puolukat rubiininpunaisina ja satsuma lämpimän oranssina; kimallustähdet ilmestyvät ja katoavat rauhallisesti.
- **Välipalaketju:** jokainen tehohyppy varmistaa seuraavan välipalan hyppyulottuville olemassa olevalle tasolle. Kolme peräkkäistä välipalaa käynnistää kombolaskurin ja jokaisesta seuraavasta välipalasta ponnahtavan tähtitehosteen. Laskeutuminen ilman välipalaa katkaisee kombon; pisteet mittaavat edelleen matkaa.
- **Ansa:** kahdeksan uutta napautusta vapauttaa pupun. Tietokoneella paina mitä tahansa nuolinäppäintä tai välilyöntiä kahdeksan erillistä kertaa. Näppäimen pitäminen pohjassa ei ole useita tökkäisyjä.
- **Kakka:** liukastut tulosuunnassa; suurempi sivuttaisnopeus aiheuttaa pidemmän ja nopeamman liu'un. Esineet aktivoituvat laskeuduttaessa niiden päälle.
- **Linnut:** kesällä lokkeja, syksyllä sorsia ja talvella harakoita. Sik-sak lentävään lintuun osuminen kimmottaa pupua viistosti ylöspäin ja poispäin lokista. Osuma ei katkaise välipalaketjua.
- **Koira:** tepastelee tasolla 1 000–2 000 metrin välein. Viereen laskeutuminen pysäyttää pelin siksi aikaa, että silität koiraa 10 pyyhkäisyllä. Koira näkyy suurennettuna himmennetyn pelin edessä, ja jokainen pyyhkäisy synnyttää sydämiä. Tietokoneella voit paijata myös kymmenellä erillisellä vasemman tai oikean nuolinäppäimen painalluksella. Pohjassa pitäminen lasketaan vain kerran. Hiirellä pidä painike pohjassa ja vedä edestakaisin.
- **Tauko:** paina taukopainiketta tai Escapea. Taustalle siirtyminen keskeyttää kierroksen.

Alareunaan putoaminen päättää kierroksen kolmisäveliseen, noin sekunnin mittaiseen ”di-dy-dyy”-ääniefektiin. Pisteet mittaavat edettyä matkaa. Tasojen leveys pienenee aina 10 % edellisestä leveydestä 250 metrin välein (100 %, 90 %, 81 %, …), vähintään 70 pikseliin. Kavennus määräytyy tason korkeudesta; jo luodut tasot eivät kutistu kesken hypyn.

Kesä, syksyinen Ruska ja sinimustaan talviyöhön sijoittuva Talvi käyttävät samaa vaikeutta ja pelimekaniikkaa. Ruskan pupulla on tummanoranssi pipo. Talvipupulla on musta pipo ja kaulahuivi sekä paljaat tassut. Pupuilla on vieno hymy. Corpse paint säilyy koodissa tulevaa skinivalikkoa varten. Pelin ympäristö sävyttyy valitun maailman mukaan. Hyppytasoissa vaihtelevat maasaarekkeet, lohkareet, kerrokselliset kielekkeet ja juurakkoiset pohjat. Kaikissa on samanlainen selkeä laskeutumisreuna.

Isoja taustakoristeita näkyy enintään noin joka kolmannella tasolla, yksi kerrallaan ja epäsäännöllisin välein. Koristeiden koko, suunta ja paikka vaihtelevat, ja tavaroiden viereen jätetään tilaa. Kesässä on saniaisia, päivänkakkaroita, sieniä, kiviä ja kantoja. Ruskassa on pensaita, kurpitsoja, lehtikasoja, kärpässieniä, oranssilehtisiä pihlajapensaita punaisine marjaterttuineen ja sammaleisia kantoja. Talvessa on lumiukkoja, lumilyhtyjä, pieniä lumikuusia, lumikiviä, jääkiteitä ja lyhtypylväitä. Koristeet ja tasojen runkomuodot eivät muuta törmäyksiä tai esineiden toimintaa. Komboilmoitukset pysyvät pelialueen alapuoliskolla.

Kesän oletusmusiikki on **Summer Platformer**, Ruskan **Kalm Mjörk** ja Talven **Frozen Minor — Reduced Low End**. Musiikki vaihtuu jo päävalikossa maailmaa valittaessa lyhyellä ulos- ja sisäänhäivytyksellä ja jatkuu kierroksen alkaessa. Selain sallii äänen ensimmäisen painalluksen jälkeen. Tauko pysäyttää musiikin samaan kohtaan. Musiikki jatkuu RIP-ruudussa, uusintakierroksella ja valikkoon palatessa; kappale vaihtuu ja alkaa alusta vasta vuodenaikaa vaihdettaessa. Taukopainikkeen viereinen nuottipainike (**Music off / Music on**) mykistää vain musiikin. Ääniefektipainike mykistää vain tehosteäänet. Musiikin ja tehosteiden asetukset toimivat toisistaan riippumatta ja tallentuvat selaimeen. Alkuperäinen Kvltist-maailma säilyy koodissa mutta on piilotettu valikosta; sen aiempi tallennettu valinta avaa Talven.

Aloitusvalikon ennätyksen alla oleva **Pelin ohjeet** -painike avaa samat ohjeet, jotka näkyvät tietokoneella pelin sivuilla. Ohjeissa näytetään vain laitteen ensisijaiselle osoittimelle sopivat kosketus- tai näppäimistö- ja hiiriohjeet. Ohjeita voi vierittää myös pienellä puhelimella ja sulkea Sulje-painikkeella tai Escapella.

## Offline ja asennus

HTTPS-osoitteessa tai localhostissa peli tallentaa onnistuneen ensimmäisen latauksen jälkeen koko pelipaketin offline-käyttöön. Tuettu selain voi tarjota asennusta aloitusnäytölle. Valmiista päivityksestä kerrotaan näytön yläreunan ilmoituspalkissa, joka näkyy ilman vierittämistä. Kierroksen aikana ilmoitus on tiedoksi; uusi versio otetaan käyttöön päivityspainikkeesta kierrosten välissä.

Ennätys ja asetukset säilyvät vain oman selaimen paikallisessa tallennustilassa. Sivustotietojen tyhjentäminen poistaa ne. Pelissä ei ole kirjautumista, analytiikkaa, yhteistä pistetaulukkoa tai pelitietoja vastaanottavaa palvelinta.

## Tarkistukset ja julkaisu

Piirtäjä käyttää uudelleen muistissa olevia kuvia taivaasta, maisemista, tasoista ja koristeista. Välimuistin kuvapuskureiden laskennallinen enimmäiskoko on 8 MiB pelin canvasia kohti; selain voi käyttää lisäksi omaa grafiikkamuistia. Vanhimmat kuvat poistuvat tarpeen mukaan, joten pitkä kierros ei kasvata välimuistia rajatta. Liikkuvat hahmot ja tehosteet sekä pelin fysiikka päivittyvät entiseen tapaan.

```sh
npm test
```

GitHub Pages julkaisee `main`-haaraan viedyt muutokset automaattisesti. Katso [julkaisuohje](docs/github-pages.md). Pelin tiedostopolut ovat suhteellisia ja tukevat projektin alihakemistoa. Julkaistava paketti sisältää `index.html`, `style.css`, `sw.js`, `manifest.webmanifest`, `src/`-pelimoduulit ja `assets/`-kuvakkeet sekä musiikin; kehityspalvelinta ei julkaista.

**Vaihda `sw.js`-tiedoston `RELEASE`-arvo jokaisessa pelipaketin päivityksessä.** Päivitä myös sen `APP_FILES`-lista, jos peliin lisätään tarvittavia tiedostoja. Palvelutyöntekijä pitää dokumentin ja moduulit saman version välimuistissa, ja aktivoituu odottavasta tilasta vain hyväksytyn päivityksen yhteydessä.

Tämä repository on julkinen. Lähdekoodiin, kuviin, dokumentteihin ja Git-historiaan ei saa lisätä salaisuuksia, henkilötietoja, konekohtaisia polkuja tai yksityistä aineistoa. Varmuuskopiot, lokit ja paikalliset asetukset pidetään repositoryn ulkopuolella. Grafiikka ja tehosteäänet tuotetaan pelin omalla koodilla. Taustamusiikkina käytetään projektiin toimitettuja MP3-kappaleita, jotka sisältyvät myös offline-pakettiin. Musiikki ei tarvitse ulkopuolisia palveluita.

Pelin sovittu ensimmäinen rajaus: [pelisuunnitelma](docs/game-design.md).
