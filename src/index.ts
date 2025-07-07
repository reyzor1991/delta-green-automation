import {enrichSanityString, enrichSkillString} from "./enrichers.js";
import {clickInlineSanityRoll, clickInlineSkillRoll, handleInlineActions, InlineOptions,} from "./inline.js";
import {GlobalRolls, moduleName} from "./const.js";
import {applyDamage, currentTargets, getCurrentActor, htmlClosest, localize, localizeFormat} from "./utils.js";
import {Settings} from "./settings.js";
import {ActionDataModel, ActionsForm, ActionSheet} from "./action.js";
import {EffectDataModel, EffectsForm, EffectSheet} from "./effect.js";
import {applyRule, isValidRules, sum, VALID_RULES_TYPES} from "./rules.js";

Hooks.on("init", () => {
    Handlebars.registerHelper("json", (data: unknown): string => {
        return JSON.stringify(data);
    });

    // Register custom enricher
    CONFIG.TextEditor.enrichers.push({
        pattern: /@(Sanity)\[([^\]]+)\](?:{([^}]+)})?/g,
        enricher: (match, options) => enrichSanityString(match, options),
    });
    CONFIG.TextEditor.enrichers.push({
        pattern: /@(Skill)\[([^\]]+)\](?:{([^}]+)})?/g,
        enricher: (match, options) => enrichSkillString(match, options),
    });

    GlobalRolls.DGPercentileRoll = CONFIG.Dice.rolls.find(c => c.name === 'DGPercentileRoll');

    let superClick = TextEditor._onClickInlineRoll;
    TextEditor._onClickInlineRoll = async function (event: MouseEvent) {
        let post = htmlClosest(event.target, "span[data-post-inline]");
        if (post) {
            event.preventDefault()
            handleInlinePost(htmlClosest(post, 'a.inline-roll'))
            return
        }

        const a = event.target?.closest("a.inline-roll");
        if (a?.dataset?.checkType) {
            event.preventDefault()
            let type = a.dataset.checkType;
            if (type === "sanity-roll") {
                clickInlineSanityRoll(event, a.dataset as InlineOptions);
            } else if (type === "skill-roll") {
                clickInlineSkillRoll(event, {
                    key: a.dataset?.key,
                    secret: a.dataset?.secret,
                    specialTrainingName: a.dataset?.specialTrainingName
                });
            } else {
                console.log(`unknown inline roll type: ${type}`);
            }
            return
        }
        superClick.call(this, event);
    }

    Settings.init();
})

function handleInlinePost(post: HTMLElement | null) {
    if (!post) {
        return;
    }
    const clone = post.cloneNode(true);
    // Find and remove the <i> element with data-post-inline
    const postIcon = clone.querySelector('span[data-post-inline]');
    if (postIcon) {
        postIcon.remove();
    }

    ChatMessage.create({
        content: clone.outerHTML,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}

Hooks.once("setup", async () => {
    document.addEventListener("click", (event: MouseEvent) => {
        let btnWithAction = htmlClosest(event.target, "button[data-action]");
        // Remove empty style attribute if present
        if (btnWithAction?.getAttribute('style') === '') {
            btnWithAction.removeAttribute('style');
        }

        let message = htmlClosest(event.target, "li[data-message-id]");
        if (btnWithAction && message && message?.dataset?.messageId) {
            handleInlineActions(btnWithAction, message?.dataset?.messageId);
        }
    });

    Object.assign(CONFIG.Item.dataModels, {
        [`${moduleName}.action`]: ActionDataModel,
        [`${moduleName}.effect`]: EffectDataModel
    });

    foundry.documents.collections.Items.registerSheet(
        "deltagreen",
        ActionSheet,
        {types: [`${moduleName}.action`], makeDefault: true}
    );

    foundry.documents.collections.Items.registerSheet(
        "deltagreen",
        EffectSheet,
        {types: [`${moduleName}.effect`], makeDefault: true}
    );

    let origin = CONFIG.Item.documentClass

    class Effect extends origin {

    }

    class Action extends origin {
        async createChatMessage() {
            let enrichedDescription =
                await foundry.applications.ux.TextEditor.implementation.enrichHTML(
                    this.system.description,
                    {async: true}
                )

            return ChatMessage.create({
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                speaker: getCurrentActor(),
                content: await renderTemplate(`modules/${moduleName}/templates/basic-chat-card.hbs`, {
                    item: this,
                    enrichedDescription
                }),
            })
        }
    }

    CONFIG.Item.moduleClasses = {}
    CONFIG.Item.moduleClasses[`${moduleName}.action`] = Action;
    CONFIG.Item.moduleClasses[`${moduleName}.effect`] = Effect;

    CONFIG.Item.documentClass = new Proxy(origin, {
        construct(_target, args) {
            let source = args[0];
            if (source?.type?.startsWith(moduleName)) {
                let itemClass = CONFIG.Item.moduleClasses[source.type];
                if (itemClass) {
                    return new itemClass(...args);
                }
            }
            return new origin(...args);
        },
    });

    let oriding_prepareAgentData = CONFIG.Actor.documentClass.prototype._prepareAgentData;
    CONFIG.Actor.documentClass.prototype._prepareAgentData = function (agent) {
        oriding_prepareAgentData.call(this, agent);
        let allRules = agent?.itemTypes?.[`${moduleName}.effect`]
            .filter(e => e.system.rules.length)
            .map(e => e.system.rules)
            .flat();

        let validRules = allRules
            .filter(r => VALID_RULES_TYPES.includes(r.type))
            .filter(r => isValidRules(r));

        validRules.forEach(r => {
            applyRule(agent, r);
        })

        Object.values(agent.system.skills).filter(skill => skill?.modifications).forEach(skill => {
            //TODO: logic about combat action max +40 for bonus any penalties
            // for other possible any bonus any penalties
            let modificationValue = sum(skill?.modifications);
            skill.targetProficiency = skill.proficiency + modificationValue
        })
    }
});

//Add btn for roll damage
Hooks.on('renderChatMessageHTML', async (message: ChatMessage, html: HTMLElement) => {
    if (message.getFlag(moduleName, "needToHide") && !game.user.isGM) {
        html.style.display = "none";
    }
    if (!message.isAuthor && !message?.isOwner) {
        return
    }
    let speakerActor = message?.speakerActor;
    if (!message?.isRoll || !speakerActor) {
        return;
    }
    let roll = message.rolls[0];
    if (roll?.type !== 'weapon' || !roll?.item?._id || !roll.isSuccess) {
        return
    }

    // Create the button
    const btn = document.createElement("button");
    btn.textContent = "Roll damage";
    btn.className = "item-roll-damage";
    btn.dataset.action = "item-roll-damage";

    // Append to the message-content
    html.querySelector('.message-content')?.appendChild(btn);
})

function isDamage(message: ChatMessage) {
    return message.isRoll && message.rolls[0]?.type === 'damage';
}

function getMessageDamage(message: ChatMessage): number {
    return message?.rolls?.[0].total || 0;
}

//Add targets to damage
Hooks.on('renderChatMessage', async (message: ChatMessage, $html: JQuery<HTMLElement>) => {
    if (!game.user.isActiveGM || !isDamage(message)) {
        return;
    }
    let damageAmount = getMessageDamage(message);
    if (!damageAmount) {
        return;
    }

    let targetsLayer = $(`<div class="target-layer"><label>Targets</label></div>`);
    let spanAddTarget = $("<span>", {
        class: "add-update-target fa-solid fa-crosshairs-simple fa-fw target",
        "data-tooltip": "<p>Shift + Click - Update Targets</p><p>Click - Add Targets</p><p>Shift + DbClick - Delete Target</p>",
    });
    addListenerClickTargetBtn(spanAddTarget, message);
    targetsLayer.prepend(spanAddTarget);

    let targetsBlock = $(`<div class="target-block"></div>`);
    targetsBlock.append(targetsLayer);

    let targets = message.getFlag(moduleName, "targets");
    if (Object.keys(targets || {}).length) {
        Object.values(targets).forEach((element) => {
            let token = game.scenes.get(element.sceneId)?.tokens.get(element.tokenId);
            if (!token) {
                return;
            }
            let targetRow = $(`<section class="target-row" data-sceneId="${element.sceneId}" data-tokenId="${element.tokenId}"></section>`)
            targetRow.append(`
                <div class="image" style="background-image:url(${token?.texture?.src})"></div>
                <div class="name">${token.name}</div>
                <span class="target-row-btns"></span>
            `);
            let damageIcon = $(`<i class="fas fa-user-minus fa-fw" data-tooltip="Apply Damage"></i>`);

            damageIcon.on("click", async () => {
                applyDamage(token, damageAmount)
                ui.notifications.info('Damage was applied');
            });

            targetRow.find(".target-row-btns").append(damageIcon);
            targetsBlock.append(targetRow);
        });
        addListenerDeleteFromTargets(targetsBlock, message)
    }

    $html.find('.message-content').append(targetsBlock);
})

function addListenerClickTargetBtn(spanAddTarget, message) {
    spanAddTarget.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        let newTargets = currentTargets();

        if (event.shiftKey) {
            await message.unsetFlag(moduleName, 'targets');
            message.setFlag(moduleName, 'targets', newTargets);
        } else {
            message.setFlag(moduleName, 'targets', newTargets);
        }
    })
}

function addListenerDeleteFromTargets(row, message) {
    row.on("dblclick", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!event.shiftKey) return;

        let tokenid = $(event.target).closest(".target-row").data()?.tokenid;
        if (!tokenid) return;
        message.update({
            [`flags.${moduleName}.targets.-=${tokenid}`]: null,
        });
    })
}

function handleDyingStatusEffect(actor: Actor, data: object) {
    if (actor.statuses.has("dead")) {
        return;
    }

    if (data?.system?.health?.value === 0) {
        actor.toggleStatusEffect('dead', {active: true})
        actor.toggleStatusEffect('unconscious', {active: false})

        ChatMessage.create({
            content: `Agent ${actor.name} is dead`,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    } else if (!actor.statuses.has("unconscious") && (data?.system?.health?.value <= 2 || data?.system?.wp?.value === 0)) {
        actor.toggleStatusEffect('unconscious', {active: true})

        ChatMessage.create({
            content: localizeFormat(`${moduleName}.messages.damage.unconscious`, {actorname: actor.name,}),
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    } else if (data?.system?.wp?.value <= 2 && data?.system?.wp?.value >= 0) {
        ChatMessage.create({
            content: localizeFormat(`${moduleName}.messages.damage.collapse`, {actorname: actor.name,}),
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    }
}

Hooks.on('preUpdateActor', (actor: Actor, data) => {
    if (Settings.get("dyingStatusEffect")) {
        handleDyingStatusEffect(actor, data);
    }
});

Hooks.on('getActorSheetHeaderButtons', async (sheet: object, buttons: object[]) => {
    buttons.unshift({
        label: "Effects",
        icon: "fa-regular fa-circle-dot",
        class: ["effects"],
        onclick: () => {
            new EffectsForm({actor: sheet.object}).render(true);
        },
    }, {
        label: "Actions",
        icon: "fa-regular fa-circle-dot",
        class: ["actions"],
        onclick: () => {
            new ActionsForm({actor: sheet.object}).render(true);
        },
    });
});

Hooks.on('preCreateChatMessage', (message: ChatMessage) => {
    if (!Settings.get("failureSkills")) {
        return;
    }
    let actor = message.speakerActor;
    if (!game.user.isActiveGM || !message.isRoll || !actor) {
        return;
    }
    let roll = message.rolls[0]
    if (!roll || roll?.isSuccess) {
        return;
    }
    if (roll?.options?.rollType !== 'skill') {
        return
    }

    let isSkill = actor.system.skills[roll?.options?.key];
    let skill = isSkill ? actor.system.skills[roll?.options?.key] : actor.system.typedSkills[roll?.options?.key];
    if (!skill || skill?.failure) {
        return;
    }

    let keyForUpdate = 'system.' + (isSkill ? 'skills.' : 'typedSkills.') + `${roll?.options?.key}.failure`;

    let rollbacks = {}
    rollbacks[keyForUpdate] = false;

    actor.update({
        [keyForUpdate]: true,
    })

    let text = localize(`${moduleName}.messages.skillsmark.marked`);
    let btnText = localize(`${moduleName}.messages.skillsmark.undo`);
    message.updateSource({
        flags: {
            [moduleName]: {
                rollbacks
            }
        },
        content: message.content
            +`<div class="rollback-section"><br/><label>${text}</label><button type="button" data-action="rollback-skill-failure-state">${btnText} <i class="fa fa-undo" aria-hidden="true"></i></button></div>`
    })
})