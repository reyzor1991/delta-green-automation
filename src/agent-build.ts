import {moduleName} from "./const.js";
import {localize} from "./utils.js";

export function agentBuilder(): void {
    (new AgentBuilderForm()).render(true)
}

class AgentBuilderForm extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
) {
    PROFESSIONS = [
        {value: "anthropologist", label: "Anthropologist"},
        {value: "historian", label: "Historian"},
        {value: "engineer", label: "Computer Scientist or Engineer"},
        {value: "federal-agent", label: "Federal Agent"},
        {value: "physician", label: "Physician"},
        {value: "scientist", label: "Scientist"},
        {value: "special-operator", label: "Special Operator"},
    ]

    PROFESSION_SKILLS = {
        "anthropologist": {
            skills: [
                {key: "anthropology", value: 50},
                {key: "bureaucracy", value: 40},
                {key: "history", value: 60},
                {key: "occult", value: 40},
                {key: "persuade", value: 40}
            ],
            typedSkills: [
                {label: "???", group: localize("DG.TypeSkills.ForeignLanguage"), value: 50},
                {label: "???", group: localize("DG.TypeSkills.ForeignLanguage"), value: 30}
            ]
        },
        "historian": {
            skills: [
                {key: "archaeology", value: 50},
                {key: "bureaucracy", value: 40},
                {key: "history", value: 60},
                {key: "occult", value: 40},
                {key: "persuade", value: 40}
            ],
            typedSkills: [
                {label: "???", group: localize("DG.TypeSkills.ForeignLanguage"), value: 50},
                {label: "???", group: localize("DG.TypeSkills.ForeignLanguage"), value: 30}
            ]
        },
        "engineer": {
            skills: [
                {key: "computer_science", value: 60},
                {key: "sigint", value: 40}
            ],
            typedSkills: [
                {label: "Electrician", group: localize("DG.TypeSkills.Craft"), value: 30},
                {label: "Mechanic", group: localize("DG.TypeSkills.Craft"), value: 30},
                {label: "Microelectronics", group: localize("DG.TypeSkills.Craft"), value: 40},
                {label: "Mathematics", group: localize("DG.TypeSkills.Science"), value: 40}
            ]
        },
        "federal-agent": {
            skills: [
                {key: "alertness", value: 50},
                {key: "bureaucracy", value: 40},
                {key: "criminology", value: 50},
                {key: "drive", value: 50},
                {key: "firearms", value: 50},
                {key: "forensics", value: 30},
                {key: "humint", value: 60},
                {key: "law", value: 30},
                {key: "persuade", value: 50},
                {key: "search", value: 50},
                {key: "unarmed_combat", value: 60}
            ],
            typedSkills: []
        },
        "physician": {
            skills: [
                {key: "bureaucracy", value: 50},
                {key: "first_aid", value: 60},
                {key: "medicine", value: 60},
                {key: "persuade", value: 40},
                {key: "pharmacy", value: 50},
                {key: "search", value: 40},
            ],
            typedSkills: [
                {label: "Biology", group: localize("DG.TypeSkills.Science"), value: 60}
            ]
        },
        "scientist": {
            skills: [
                {key: "bureaucracy", value: 40},
                {key: "computer_science", value: 40},
            ],
            typedSkills: [
                {label: "???", group: localize("DG.TypeSkills.Science"), value: 60},
                {label: "???", group: localize("DG.TypeSkills.Science"), value: 50},
                {label: "???", group: localize("DG.TypeSkills.Science"), value: 50}
            ]
        },
        "special-operator": {
            skills: [
                {key: "alertness", value: 60},
                {key: "athletics", value: 60},
                {key: "demolitions", value: 40},
                {key: "firearms", value: 60},
                {key: "heavy_weapons", value: 50},
                {key: "melee_weapons", value: 50},
                {key: "navigate", value: 50},
                {key: "stealth", value: 50},
                {key: "survival", value: 50},
                {key: "swim", value: 50},
                {key: "unarmed_combat", value: 60}
            ],
            typedSkills: [
                {label: "Land", group: localize("DG.TypeSkills.MilitaryScience"), value: 60},
            ]
        }
    }

    allSteps;

    currentStep;
    hasPrevious;
    hasNext;
    isFinish;

    actorData;

    constructor() {
        super();
        this.currentStep = 'setBio';
        this.hasNext = true;
        this.hasPrevious = false;
        this.isFinish = false;
        this.actorData = {};
        this.allSteps = ['setBio', 'selectProfession'];
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: `${moduleName}-agent-builder-form`,
        classes: [moduleName],
        window: {title: "Agent Builder", resizable: true},
        position: {width: 500, height: 500},
        actions: {},
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
    };

    static PARTS = {
        hbs: {
            template: `modules/${moduleName}/templates/agentBuilder.hbs`
        }
    };

    async _prepareContext(_options: {}) {
        let context = await super._prepareContext(_options);

        return {
            ...context,
            actorData: this.actorData,
            currentStep: this.currentStep,
            hasPrevious: this.hasPrevious,
            isFinish: this.isFinish,
            hasNext: this.hasNext,
            professions: this.PROFESSIONS
        };
    }

    toNextStep() {
        const index = this.allSteps.indexOf(this.currentStep);
        if (index >= 0 && index < this.allSteps.length - 1) {
            this.currentStep = this.allSteps[index + 1];
        }
        this.hasPrevious = this.currentStep !== this.allSteps[0];
        this.isFinish = this.currentStep === this.allSteps[this.allSteps.length - 1];
    }

    toPreviousStep() {
        const index = this.allSteps.indexOf(this.currentStep);
        if (index > 0) {
            this.currentStep = this.allSteps[index - 1];
        }
        this.hasPrevious = this.currentStep !== this.allSteps[0];
        this.isFinish = this.currentStep === this.allSteps[this.allSteps.length - 1];
    }

    basicValidation(): boolean {
        if (this.currentStep === 'setBio') {
            if (!this.actorData?.name) {
                ui.notifications.warn("Need to set name of actor")
                return false;
            }
        } else if (this.currentStep === 'selectProfession') {
            if (!this.actorData?.profession) {
                ui.notifications.warn("Need to select profession of actor")
                return false;
            }
        }
        return true
    }

    setFields(fields: { [key: string]: any }) {
        this.actorData = foundry.utils.mergeObject(this.actorData, fields);
    }

    refreshDependencies() {
        if (this.actorData.profession) {
            this.refreshSkills();
        }
    }

    refreshSkills() {
        this.actorData.skills = {
            system: {
                skills: (this.PROFESSION_SKILLS[this.actorData.profession] || {skills: []}).skills
                    .reduce((acc, row) => {
                        acc[row.key] = {
                            label: localize(`DG.Skills.${row.key}`),
                            proficiency: row.value,
                            failure: false
                        };
                        return acc;
                    }, {}),
                typedSkills: (this.PROFESSION_SKILLS[this.actorData.profession] || {typedSkills: []}).typedSkills
                    .reduce((acc, row, index) => {
                        const key = `tskill_${String(index + 1).padStart(2, '0')}`;
                        acc[key] = {
                            label: row.label,
                            group: row.group,
                            proficiency: row.value,
                            failure: false
                        };
                        return acc;
                    }, {})
            }
        };
    }

    _attachPartListeners(partId: string, htmlElement: HTMLElement, options: object) {
        const form = this;

        const previousButton = htmlElement.querySelector('.bottom-buttons [data-button="previousStep"]');
        const nextButton = htmlElement.querySelector('.bottom-buttons [data-button="nextStep"]');

        previousButton?.addEventListener('click', (event) => {
            form.setFields((new foundry.applications.ux.FormDataExtended(form.element)).object);
            form.toPreviousStep();
            form.render();
        });
        nextButton?.addEventListener('click', (event) => {
            form.setFields((new foundry.applications.ux.FormDataExtended(form.element)).object);
            form.refreshDependencies();

            if (!form.basicValidation()) {
                return;
            }
            if (form.isFinish) {
                CONFIG.Actor.documentClass.create({
                    type: "agent",
                    name: form.actorData.name,
                    ...form.actorData.skills,
                    "system.biography.profession": form.PROFESSIONS.find(p => p.value === form.actorData.profession)?.label,
                })

                form.close()
            } else {
                form.toNextStep();
                form.render();
            }
        });
    }
}
