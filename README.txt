MIJN WERKREGISTRATIE - VERSIE 1
================================

Een aparte, gratis, mobielvriendelijke webapp (PWA).
Geen login, geen abonnement, geen externe database.
Dit project verandert niets aan Mock-Up Check.

WAT KAN DE APP?
- Tik op een grote werkknop om te starten.
- Een andere werkknop stopt de vorige en start meteen de nieuwe.
- Stop / pauze om de laatste registratie af te sluiten.
- Zelf werkzaamheden toevoegen, wijzigen, verwijderen en terughalen.
- Per werkzaamheid: overdraagbaar, deels overdraagbaar, specialistisch.
- Overzicht van vandaag, deze week en deze maand.
- Laatste registraties corrigeren of verwijderen.
- CSV-overzicht voor manager en JSON-back-up/terugzetten.
- Lokaal opslaan; na installatie ook offline bruikbaar.
- Automatische stop na 10 uur per ononderbroken registratie.

OP COMPUTER PROBEREN
Open index.html met je browser. Alle knoppen en lokale opslag werken
ook zonder webserver. De installatie/offline-functie vereist HTTPS.

ONLINE ZETTEN VIA GITHUB PAGES (GRATIS)
1. Maak op github.com/new een nieuwe PUBLIC repository,
   bijvoorbeeld 'mijn-werkregistratie'. Gebruik NIET je Mock-Up Check repo.
2. Upload alle losse bestanden uit deze map, inclusief de map 'icons',
   naar de hoofdmap van die nieuwe repository (niet alleen het ZIP-bestand).
3. Ga naar Settings > Pages > Build and deployment.
   Source: Deploy from a branch. Branch: main. Folder: /(root). Save.
4. Open de URL die onder Pages verschijnt:
   https://JOUWGEBRUIKERSNAAM.github.io/mijn-werkregistratie/
5. Open die URL in Chrome op je Android-telefoon en kies
   menu > App installeren / Toevoegen aan startscherm.

BELANGRIJK
- Data worden opgeslagen in lokale browseropslag op het toestel.
- Een andere telefoon of ander webadres heeft een aparte gegevensopslag.
- Verwijder je browsergegevens of de sitegegevens niet zonder JSON-back-up.
- Download regelmatig een JSON-back-up via tab Back-up.
- Je kunt het CSV-overzicht exporteren en delen met je manager.
- GitHub-repository en website mogen publiek zijn: er staat geen
  persoonlijke registratie in de bronbestanden. De ingevoerde gegevens
  worden niet automatisch geupload.
- Deel geen back-upbestand via een openbare repository; dit bevat wel data.
- Dit is een eerste versie; voor bedrijfskritisch gebruik en
  gegevensopslag op meerdere apparaten is een centraal systeem nodig.

BESTANDEN
index.html           Alle schermen
styles.css           Vormgeving voor telefoon
app.js               Registratie, opslag en rapportages
manifest.webmanifest Installatiegegevens
sw.js                 Offline werking
icons/               App-iconen
