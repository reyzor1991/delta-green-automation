import {moduleName} from "./const.js";

export class ActionDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new foundry.data.fields.StringField({
                required: true,
                validationError: "must be a valid",
                label: "Description"
            })
        };
    }

    prepareDerivedData() {
    }
}

export class ActionSheet extends foundry.appv1.sheets.ItemSheet {
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
        return `modules/${moduleName}/templates/item-action-sheet.html`;
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

export class ActionsForm extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
) {
    constructor(options: object) {
        super({});
        this.actor = options.actor;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: `${moduleName}-actions-form`,
        classes: [moduleName],
        window: {title: "Actions", resizable: true},
        position: {width: 500, height: 'auto'},
        actions: {},
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
    };

    static PARTS = {
        hbs: {
            template: `modules/${moduleName}/templates/actionsForm.hbs`
        }
    };

    async _prepareContext(_options) {
        let context = await super._prepareContext(_options);

        return {
            ...context,
            actions: (this.actor?.itemTypes?.[`${moduleName}.action`] || [])
                .map(e => {
                    return {
                        id: e.id,
                        img: e.img,
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

        console.log('add')

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