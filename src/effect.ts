import {moduleName} from "./const.js";

export class EffectDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new foundry.data.fields.StringField({
                required: true,
                initial: "",
                validationError: "must be a valid",
                label: "Description"
            }),
            rules: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}))
        };
    }

    prepareDerivedData() {
    }
}

export class EffectSheet extends foundry.appv1.sheets.ItemSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["deltagreen", "sheet", "item"],
            width: 520,
            height: 600,
            tabs: [
                {
                    navSelector: ".sheet-tabs",
                    contentSelector: ".sheet-body",
                    initial: "description",
                },
            ],
        });
    }

    get template() {
        return `modules/${moduleName}/templates/item-effect-sheet.html`;
    }

    async _updateObject(_event, formData) {
        if (formData?.[`system.rules`]) {
            try {
                formData[`system.rules`] = JSON.parse(formData?.[`system.rules`]);
            } catch (e) {
                console.error("Invalid JSON:", e);
            }
        }

        return super._updateObject(_event, formData);
    }

    async getData() {
        const data = super.getData();

        data.enrichedDescription =
            await foundry.applications.ux.TextEditor.implementation.enrichHTML(
                this.object.system.description,
                {async: true}
            );

        return data;
    }
}

export class EffectsForm extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
) {
    constructor(options: object) {
        super({});
        this.actor = options.actor;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: `${moduleName}-effects-form`,
        classes: [moduleName],
        window: {title: "Effects", resizable: true},
        position: {width: 500, height: 'auto'},
        actions: {},
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
    };

    static PARTS = {
        hbs: {
            template: `modules/${moduleName}/templates/effectsForm.hbs`
        }
    };

    async _prepareContext(_options) {
        let context = await super._prepareContext(_options);

        return {
            ...context,
            effects: (this.actor?.itemTypes?.[`${moduleName}.effect`] || [])
                .map(e => {
                    return {
                        id: e.id,
                        name: e.name
                    }
                })
        };
    }

    _attachPartListeners(partId: string, htmlElement: HTMLElement, options: object) {
        this.listHtmlListener(htmlElement);
    }

    listHtmlListener(htmlElement: HTMLElement) {
        const html = $(htmlElement);
        const form = this;

        html.on("click", ".remove-row", async function (event: Event) {
            event.preventDefault();
            event.stopPropagation();
            let id = $(this).closest('li').data()?.id;
            if (!id) return;
            await form.actor.items.get(id).delete()
            form.render()
        });
    }
}
