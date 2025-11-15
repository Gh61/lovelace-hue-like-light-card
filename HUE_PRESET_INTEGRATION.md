# Intégration Hue Preset pour lovelace-hue-like-light-card

## Description

Cette intégration ajoute le support des scènes Hue Preset provenant de l'addon [hass-scene_presets](https://github.com/Hypfer/hass-scene_presets) dans la carte lovelace-hue-like-light-card.

## Fonctionnalités

- **Chargement automatique** : Les presets sont chargés automatiquement depuis le JSON de l'addon hass-scene_presets
- **Affichage dans le dialogue** : Une nouvelle section "Scènes Hue Preset" apparaît sous la section des scénarios existants
- **Images des presets** : Les images associées aux presets sont affichées
- **Couleurs automatiques** : Les couleurs d'accent sont calculées automatiquement à partir des couleurs du preset
- **Support multi-cibles** : Fonctionne avec `area`, `floor`, `label`, `entity` ou `entities`

## Fichiers créés/modifiés

### Nouveaux fichiers créés :

1. **`src/types/types-hue-preset.ts`**
   - Définit les interfaces TypeScript pour les données de Hue Preset (LightColor, Category, Preset, LightingData)
   - Classe `PresetData` pour gérer les presets avec Home Assistant
   - Conversion XY vers RGB pour les couleurs
   - Méthode `activate()` pour appeler le service `scene_presets.apply_preset`

2. **`src/controls/dialog-preset-tile.ts`**
   - Composant LitElement pour afficher une tuile de preset
   - Animation au clic (similaire aux scènes)
   - Support des images et icônes
   - Gestion des couleurs d'accent

### Fichiers modifiés :

1. **`src/types/config.ts`**
   - Ajout de la propriété `_presets: PresetConfig[]`
   - Méthode `tryLoadPresets()` pour charger les presets depuis le JSON
   - Méthode `getPresetTargets()` pour déterminer les cibles (area, floor, label, entities)
   - Getter `presets` pour accéder aux presets chargés

2. **`src/controls/dialog.ts`**
   - Import du nouveau composant `HueDialogPresetTile`
   - Ajout de la section Hue Preset dans le rendu HTML
   - Méthode `afterPresetActivated()` pour gérer le scroll après activation

3. **Fichiers de traduction** :
   - `src/localize/languages/fr.json` : Ajout de "dialog.presets": "Scènes Hue Preset"
   - `src/localize/languages/en_us.json` : Ajout de "dialog.presets": "Hue Preset Scenes"
   - `src/localize/languages/en_gb.json` : Ajout de "dialog.presets": "Hue Preset Scenes"

## Configuration

### Prérequis

1. Installer l'addon [hass-scene_presets](https://github.com/Hypfer/hass-scene_presets) sur votre Home Assistant
2. Vérifier que le JSON est accessible à : `http://votre-home-assistant/assets/scene_presets/scene_presets.json`

### Utilisation

Aucune configuration supplémentaire n'est nécessaire ! Les presets sont chargés automatiquement si l'addon hass-scene_presets est installé.

Exemple de configuration de carte :

```yaml
type: custom:hue-like-light-card
area: cabine
```

Les presets s'afficheront automatiquement dans la boîte de dialogue Hue, dans une section dédiée "Scènes Hue Preset" juste en dessous des scénarios.

### Activation d'un preset

Lorsqu'un preset est cliqué, le service `scene_presets.apply_preset` est appelé avec :

```yaml
service: scene_presets.apply_preset
data:
  preset_id: "uuid-du-preset"
  targets:
    area_id: "cabine"  # ou floor_id, label_id, entity_id selon la config
  shuffle: false
  smart_shuffle: false
```

## Architecture technique

### Chargement des données

1. Au démarrage de la carte, `HueLikeLightCardConfig.init()` est appelé
2. `tryLoadPresets()` fait un fetch sur `/assets/scene_presets/scene_presets.json`
3. Les données sont parsées et converties en `PresetConfig[]`
4. Les catégories sont mappées pour affichage

### Affichage

1. Dans `dialog.ts`, les presets sont itérés de manière similaire aux scènes
2. Deux rangées de tuiles sont créées (impair/pair) pour l'affichage
3. Chaque tuile est un `HueDialogPresetTile` avec :
   - Image du preset (depuis `/assets/scene_presets/`)
   - Couleur d'accent calculée depuis les couleurs XY
   - Animation au clic

### Activation

1. Clic sur une tuile → `tileClicked()` dans `HueDialogPresetTile`
2. Appel de `preset.activate(targets)` dans `PresetData`
3. Service Home Assistant `scene_presets.apply_preset` appelé avec les bons paramètres

## Chemins des ressources

- **JSON** : `/assets/scene_presets/scene_presets.json`
- **Images** : `/assets/scene_presets/{nom-image}.{ext}`

Ces chemins correspondent à l'addon hass-scene_presets qui expose ses ressources sous `/assets/scene_presets/`.

## Personnalisation future

Pour ajouter des options de personnalisation (shuffle, smart_shuffle, etc.), vous pouvez :

1. Ajouter des propriétés dans `PresetConfig`
2. Modifier `dialog-preset-tile.ts` pour utiliser ces propriétés
3. Passer les valeurs à `activate()` dans `PresetData`

## Dépannage

### Les presets ne s'affichent pas

- Vérifier que l'addon hass-scene_presets est installé
- Vérifier que le JSON est accessible : `http://votre-ha/assets/scene_presets/scene_presets.json`
- Regarder la console du navigateur pour les erreurs de fetch

### Les images ne s'affichent pas

- Vérifier que les images sont dans `/assets/scene_presets/`
- Vérifier les permissions d'accès aux ressources de l'addon

### Le service ne fonctionne pas

- Vérifier que le service `scene_presets.apply_preset` existe dans Home Assistant
- Vérifier les paramètres passés (targets correctement configurés)

## Compilation

Pour compiler le projet après modifications :

```bash
npm run build
```

Ou pour corriger automatiquement le linting :

```bash
npm run fixnbuild
```

## Licence

Cette intégration suit la même licence que le projet principal : LGPLv2.1

