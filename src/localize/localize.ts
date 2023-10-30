import { HomeAssistant } from 'custom-card-helpers';

import cs from './languages/cs.json';
import da from './languages/da.json';
import de from './languages/de.json';
import en from './languages/en_us.json';
import en_gb from './languages/en_gb.json';
import es from './languages/es.json';
import fi from './languages/fi.json';
import fr from './languages/fr.json';
import it from './languages/it.json';
import ja from './languages/ja.json';
import ko from './languages/ko.json';
import nb from './languages/nb.json';
import nl from './languages/nl.json';
import pl from './languages/pl.json';
import pt_br from './languages/pt_br.json';
import ru from './languages/ru.json';
import sv from './languages/sv.json';
import tr from './languages/tr.json';
import zh_hans from './languages/zh_hans.json';
import zh_hant from './languages/zh_hant.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: any = {
    cs,
    da,
    de,
    en,
    en_gb,
    es,
    fi,
    fr,
    it,
    ja,
    ko,
    nb,
    nl,
    pl,
    pt_br,
    ru,
    sv,
    tr,
    zh_hans,
    zh_hant
};

const defaultLang = 'en';

export function localize(hassOrLanguage:HomeAssistant | string, resource: keyof typeof en, search = '', replace = ''): string {
    let lang: string;
    if (typeof hassOrLanguage == 'string') {
        lang = hassOrLanguage;
    } else {
        lang = hassOrLanguage.language || defaultLang;
    }

    lang = lang.replace('-', '_').toLowerCase();
    const langBase = lang.split('_')[0];

    let translated = 
        (languages[lang] ?? {})[resource] ||
        (languages[langBase] ?? {})[resource] ||
        (languages[defaultLang])[resource];

    if (search !== '' && replace !== '') {
        translated = translated.replace(search, replace);
    }

    return translated;
}