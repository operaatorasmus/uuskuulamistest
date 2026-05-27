# Kuulamistesti kordaja

Ava `index.html` brauseris. Leht töötab staatiliselt ja kasutab `assets/data/tracks.js` manifesti.

GitHub Pagesi jaoks tehakse helifailidest veebikindlad koopiad kausta `assets/audio/`.
Manifest viitab nendele lühikestele ASCII failiteedele, et täpitähed, tühikud ja pikad
failinimed veebis laadimist katki ei teeks.

Kui lisad hiljem 9., 11. või 12. klassi kaustadesse uued helifailid, käivita enne lehe kasutamist:

```sh
ruby scripts/generate-manifest.rb
```

See uuendab manifesti ja loob uued `assets/audio/klass-.../track-XX.mp3` failid.

Parim failinime kuju on:

```text
01 - Helilooja - Teose nimi.mp3
```

Vastus kuvatakse alati kujul `Helilooja - teose nimi`.
