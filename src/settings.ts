import {moduleName} from "./const.js";
import {localize} from "./utils.js";
import {rerenderTime} from "./index.js";

abstract class SubSettings extends FormApplication {

    static _namespace;

    static get namespace() {
        return this.constructor._namespace
    };

    static get settings() {
        return {}
    }

    static init() {
        const settings = this.settings;
        for (const setting of Object.keys(settings)) {
            game.settings.register(moduleName, setting, {
                scope: "world",
                config: false,
                ...settings[setting],
            });
        }
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.classes.push("settings-menu", "sheet");

        return {
            ...options,
            title: `${moduleName}.SETTINGS.Menu.${this._namespace}.name`,
            id: `${this.namespace}-settings`,
            template: `modules/${moduleName}/templates/settings.hbs`,
            width: 550,
            height: "auto",
            tabs: [{navSelector: ".sheet-tabs", contentSelector: "form"}],
            closeOnSubmit: true,
            submitOnChange: false,
        };
    }

    async getData() {
        const data = Object.entries(this.constructor.settings).reduce(function (obj, [key, setting]) {
            obj[key] = {
                ...setting,
                key,
                value: game.settings.get(moduleName, key),
                isSelect: !!setting.choices,
                isNumber: setting.type === Number,
                isString: setting.type === String,
                isCheckbox: setting.type === Boolean,
            };
            return obj;
        }, {});

        return {
            settings: data,
        };
    }

    async _updateObject(event, formData) {
        for (const k in formData) {
            await game.settings.set(moduleName, k, formData[k]);
        }

    }
}


class AutomationSettings extends SubSettings {

    static _namespace = "automation";

    static get settings() {
        return {
            dyingStatusEffect: {
                name: `${moduleName}.SETTINGS.dyingStatusEffect.name`,
                hint: `${moduleName}.SETTINGS.dyingStatusEffect.hint`,
                default: false,
                type: Boolean,
            },
            failureSkills: {
                name: `${moduleName}.SETTINGS.failureSkills.name`,
                hint: `${moduleName}.SETTINGS.failureSkills.hint`,
                default: false,
                type: Boolean,
            },
        };
    }
}


class CalendarSettings extends SubSettings {

    static _namespace = "calendar";

    static get settings() {
        return {
            showCalendar: {
                name: `${moduleName}.SETTINGS.showCalendar.name`,
                hint: `${moduleName}.SETTINGS.showCalendar.hint`,
                default: false,
                type: Boolean,
                onChange: (_value: any) => {
                    rerenderTime(ui.players.element)
                },
            },
            calendarFormatStyle: {
                name: `${moduleName}.SETTINGS.calendarFormatStyle.name`,
                hint: `${moduleName}.SETTINGS.calendarFormatStyle.hint`,
                type: String,
                choices: {
                    "en-US": game.i18n.localize(`${moduleName}.SETTINGS.calendarFormatStyle.us`),
                    "en-GB": game.i18n.localize(`${moduleName}.SETTINGS.calendarFormatStyle.eu`),
                },
                default: "en-GB",
                onChange: (_value: any) => {
                    rerenderTime(ui.players.element)
                },
            },
            currentTimeZone: {
                name: `${moduleName}.SETTINGS.currentTimeZone.name`,
                hint: `${moduleName}.SETTINGS.currentTimeZone.hint`,
                type: Number,
                default: 0,
                onChange: (_value: any) => {
                    rerenderTime(ui.players.element)
                },
            }
        };
    }
}

export class Settings {

    static get(name: string) {
        return game.settings.get(moduleName, name);
    };

    static init() {

        game.settings.registerMenu(moduleName, "automation", {
            name: localize(`${moduleName}.SETTINGS.Menu.automation.name`),
            label: localize(`${moduleName}.SETTINGS.Menu.automation.label`),
            hint: "",
            icon: "fa-solid fa-dice",
            type: AutomationSettings,
            restricted: true
        });
        AutomationSettings.init();

        game.settings.registerMenu(moduleName, "calendar", {
            name: localize(`${moduleName}.SETTINGS.Menu.calendar.name`),
            label: localize(`${moduleName}.SETTINGS.Menu.calendar.label`),
            hint: "",
            icon: "fa-solid fa-clock",
            type: CalendarSettings,
            restricted: true
        });
        CalendarSettings.init();
    }
}