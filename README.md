# Kuulamistesti kordaja

Ava `index.html` brauseris. Leht töötab staatiliselt ja kasutab `assets/data/tracks.js` manifesti.

Kui lisad hiljem 9., 11. või 12. klassi kaustadesse uued helifailid, käivita enne lehe kasutamist:

```sh
ruby scripts/generate-manifest.rb
```

Parim failinime kuju on:

```text
01 - Helilooja - Teose nimi.mp3
```

Vastus kuvatakse alati kujul `Helilooja - teose nimi`.
