import { HomeAssistant } from 'custom-card-helpers';

import * as cs from './languages/cs.json';
import * as da from './languages/da.json';
import * as de from './languages/de.json';
import * as en from './languages/en_us.json';
import * as en_gb from './languages/en_gb.json';
import * as es from './languages/es.json';
import * as fi from './languages/fi.json';
import * as fr from './languages/fr.json';
import * as it from './languages/it.json';
import * as ja from './languages/ja.json';
import * as ko from './languages/ko.json';
import * as nb from './languages/nb.json';
import * as nl from './languages/nl.json';
import * as pl from './languages/pl.json';
import * as pt_br from './languages/pt_br.json';
import * as ru from './languages/ru.json';
import * as sv from './languages/sv.json';
import * as tr from './languages/tr.json';
import * as zh_hans from './languages/zh_hans.json';
import * as zh_hant from './languages/zh_hant.json';

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