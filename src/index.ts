import {enrichSanityString, enrichSkillString} from "./enrichers.js";
import {clickInlineSanityRoll, clickInlineSkillRoll, handleInlineActions,} from "./inline.js";
import {GlobalRolls, moduleName} from "./const.js";
import {applyDamage, currentTargets, htmlClosest} from "./utils.js";
import {Settings} from "./settings.js";

Hooks.on("init", () => {
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
                clickInlineSanityRoll(event, {
                    success: a.dataset?.success,
                    failure: a.dataset?.failure,
                    source: a.dataset?.source,
                });
            } else if (type === "skill-roll") {
                clickInlineSkillRoll(event, {
                    key: a.dataset?.key,
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

Hooks.once("setup", () => {
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
});

//Add btn for roll damage
Hooks.on('renderChatMessageHTML', async (message: ChatMessage, html: HTMLElement) => {
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
            content: `Agent ${actor.name} is unconscious`,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    } else if (data?.system?.wp?.value <= 2 && data?.system?.wp?.value >= 0) {
        ChatMessage.create({
            content: `Agent ${actor.name} has a temporary emotional collapse.`,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    }
}

Hooks.on('preUpdateActor', (actor: Actor, data) => {
    if (Settings.get("dyingStatusEffect")) {
        handleDyingStatusEffect(actor, data);
    }
});