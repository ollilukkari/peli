# Pupun ponppu peli — ensimmäinen peliversio

## Sovittu tavoite

Linkillä jaettava yksinpeli puhelimen pystyasentoon. Sama pystysuuntainen pelialue säilyy tietokoneella. Kevyt selainpeli toimii ilman käyttäjätiliä ja voidaan asentaa PWA:na. GitHub Pagesin käyttöönotto on erillinen julkaisutehtävä.

## Pelin kulku

Valkoinen pupu pomppii automaattisesti laskeuduttuaan tasolle. Sivuseinät rajaavat liikkumisen. Tasot kulkevat ylhäältä alaspäin, ja pelialueen alareunan koskettaminen päättää kierroksen. Pisteitä saa etenemästä; oma ennätys tallennetaan samaan selaimeen.

Pupu saa nousta tasojen läpi ja laskeutuu niiden päälle vain alaspäin liikkuessaan. Kamera seuraa korkeaa hyppyä. Vaikeus kasvaa vähitellen, mutta peräkkäisten tasojen perusreitti pidetään normaalihypyn ulottuvilla.

## Ohjaus

Puhelimella pelialueen alempi puolisko hyväksyy kosketuskohdasta ilmestyvän joystickin. Sen keskipiste pysyy alkuperäisessä kosketuskohdassa sormen nostamiseen saakka. Vaakasuuntainen veto säätelee sivuttaisliikettä; pystysuuntaa ei ohjata. Tietokoneella käytetään vasenta ja oikeaa nuolinäppäintä. Taukopainike ja Escape keskeyttävät pelin. Taustalle siirtyminen pysäyttää kierroksen.

## Esineet

Kaikki kolme esinettä ovat mukana ensimmäisessä versiossa. Ne aktivoituvat vain laskeutumalla niiden päälle ja kuluvat käytettäessä.

| Esine | Vaikutus |
| --- | --- |
| Satsuma | Kolminkertainen hyppykorkeus ja jokin puhekuplista: ”Hyvää”, ”Nam”, ”Njömps”, ”Njömpsis”. |
| Ansa | Pupu jää tason mukana liikkuvaan ansaan. Neljä erillistä napautusta, nuolinäppäimen tai välilyönnin painallusta vapauttaa sen ja käynnistää pompun. Pohjassa pitäminen ei tuota lisätökkäisyjä. |
| Kakka | Normaali pomppu jää hetkeksi pois. Pupu liukuu tulosuuntaan; nopeus ja kesto riippuvat sivuttaisnopeudesta osumahetkellä. |

Jokainen satsumahyppy varmistaa seuraavan satsuman saavutettavalle korkeudelle. Jos sopiva satsuma on jo olemassa, sitä käytetään eikä lisätä tarpeetonta uutta hedelmää. Kolme peräkkäistä satsumaa tuo näkyviin laskurin ”3× KOMBO”, joka kasvaa seuraavista satsumista. Laskeutuminen tasolle ilman satsumaa, myös ansaan tai kakkaan, katkaisee ketjun. Kombo ei muuta matkapisteiden laskentaa.

Ketjun seuraava satsuma sijoitetaan valmiille saavutettavalle tasolle: ketju ei luo toisten tasojen sisään uusia tasoja. Nykyinen kolminkertainen hyppykorkeus säilyy. Esineet piirretään tasojen eteen. Ansan päällä näytetään ”TÖKI!” ja etenemispisteet ilman jäljellä olevien painallusten ohjelausetta.

Kolmannesta peräkkäisestä satsumasta alkaen jokainen satsuma tuo ruudulle hetkellisen, suurenevan komboilmoituksen tähtitehosteineen. Ilmoituksen paikka vaihtelee hieman. Vähennetyn liikkeen asetuksella käytetään paikallaan pysyvää ilmoitusta.

## Esitystapa

Perusteema on söpöä pikseligrafiikkaa. Kvltist mode vaihtaa maailman synkäksi gootti- ja metallihenkiseksi. Kvltist Winter on sinimusta talviyö, jossa kuu valaisee lumisia tasoja. Kaikki teemat käyttävät samaa fysiikkaa, esineitä ja vaikeutta. Mukana ovat koodilla tuotetut tehosteäänet ja äänten mykistys. Puhekuplatekstit eivät tarkoita ääninäyttelyä.

Pelin otsikko on isoilla kirjaimilla kolmella rivillä: PUPUN / PONPPU / PELI. Käyttöliittymässä säilytetään pelaamiseen liittyvät ohjeet ja karsitaan koristeelliset alaotsikot ja iskulauseet. Tasojen sivusijainnit ja korkeuserot vaihtelevat selvästi; tavallisella hypyllä saavutettava perusreitti säilyy.

Kaikkien teemojen pupuilla on suuremmat, ilmeikkäät silmät. Niityn vakiohahmo on pyöreä, lyhytvartaloinen pupu, jolla on sirot ripset. Kvltist- ja Kvltist Winter -tiloissa pupu käyttää samaa pyöreää muotoa ja mustaa corpse paintia ilman kaulapantaa; myös kakoilla on corpse paint. Mahdollinen hahmoasun valikko jää myöhempään kehitykseen. Muut vartalomallit, piikkipantaluonnos ja aiempi piirto säilytetään [ulkoasuarkistossa](skins/README.md).

Pupun korvat ja tassut liikkuvat, vartalo venyy noustessa ja litistyy lyhyesti laskeutuessa. Oikea maakosketus nostattaa niityllä pölyä, Kvltistissä tummaa savua ja Winterissä lunta. Visuaaliset tehosteet eivät muuta osuma-alueita tai fysiikkaa; tauko pysäyttää animaatiot ja selaimen vähennetyn liikkeen asetus huomioidaan.

Pelin päättyessä otsikko on ”RIP” ja uusintapainikkeen teksti ”Ponpi lisää”.

## Tallennus ja jakelu

Ennätys ja asetukset tallentuvat paikallisesti. Palvelin, kirjautuminen, moninpeli ja yhteinen pistetaulukko eivät kuulu tähän versioon. Offline-valmius ilmoitetaan vasta, kun koko pelipaketti on tallennettu onnistuneesti. Päivitys otetaan käyttöön kierrosten välissä käyttäjän valinnalla.

Repository ja myöhemmin jaettava peli ovat julkisia. Aineistoon tai historiaan ei tallenneta salaisuuksia, henkilötietoja, yksityisiä keskusteluja tai konekohtaisia polkuja. Julkisuus ei itsessään valtuuta julkaisemaan keskeneräistä kehitystyötä.

## Kokeilussa säädettävät asiat

Joystickin herkkyys, sivuttaisliikkeen kiihtyvyys ja jarrutus, liu'un tuntuma, kentän rullaus, tasovälit ja esineiden yleisyys arvioidaan pelaamalla. Ensimmäinen versio on pohja näille säädöille.
