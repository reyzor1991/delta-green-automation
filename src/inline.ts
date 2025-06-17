import {GlobalRolls} from "./const.js";

function getCurrentActor() {
    const cls = foundry.utils.getDocumentClass("ChatMessage");
    const speaker = cls.getSpeaker();
    const actor = cls.getSpeakerActor(speaker);
    return actor || null;
}

export async function clickInclineSanityRoll(event: MouseEvent, options: { success: string, failure: string, source?: string }) {
    let actor = getCurrentActor();
    if (!actor) {
        return;
    }

    const rollOptions = {
        rollType: "sanity",
        actor,
    };
    let roll = new GlobalRolls.DGPercentileRoll("1D100", {}, rollOptions);
    if (event.shiftKey || event.which === 3) {
        const dialogData = await roll.showDialog();
        if (!dialogData) return;
        roll.modifier += dialogData.targetModifier;
        roll.options.rollMode = dialogData.rollMode;
    }
    // Evaluate the roll.
    await roll.evaluate();
    roll.toChat();
    handleSanityResult(actor, roll, options);
}

async function handleSanityResult(
    actor: Actor,
    roll: {},
    options: { success: string, failure: string, source?: string }
) {
    let formula = roll.isSuccess
        ? options.success
        : options.failure;

    let r = new Roll(formula)
    let isCritFailure = !roll.isSuccess && roll.isCritical;
    let isCritSuccess = roll.isSuccess && roll.isCritical;
    await r.evaluate({maximize: isCritFailure, minimize: isCritSuccess});
    let applySanDamage = r.total;
    const isBreakpoint = actor.system.sanity.breakingPointHit;
    const isViolenceAdapted = actor.system.sanity.adaptations.violence.isAdapted;
    const isHelplessnessAdapted = actor.system.sanity.adaptations.helplessness.isAdapted;

    let dataForUpdate = {
        "system.sanity.value": actor.system.sanity.value - applySanDamage
    }

    if (options.source && applySanDamage) {
        let targetSource = undefined
        if (options.source === "violence") {
            if (!actor.system.sanity.adaptations.violence.incident1) {
                targetSource = 'violence.incident1'
            } else if (!actor.system.sanity.adaptations.violence.incident2) {
                targetSource = 'violence.incident2'
            } else if (!actor.system.sanity.adaptations.violence.incident3) {
                targetSource = 'violence.incident3'
            }
        } else if (options.source === "helplessness") {
            if (!actor.system.sanity.adaptations.helplessness.incident1) {
                targetSource = 'helplessness.incident1'
            } else if (!actor.system.sanity.adaptations.helplessness.incident2) {
                targetSource = 'helplessness.incident2'
            } else if (!actor.system.sanity.adaptations.helplessness.incident3) {
                targetSource = 'helplessness.incident3'
            }
        }

        if (targetSource) {
            dataForUpdate[`system.sanity.adaptations.${targetSource}`] = true
        }
    }

    await actor.update(dataForUpdate);
    ui.notifications.info(`${actor.name} loses ${applySanDamage} sanity`)

    if (applySanDamage >= 5) {
        await ChatMessage.create({
            whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
            content: `${actor.name} is temporary insanity`,
            speaker: {
                alias: 'System'
            },
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
        resetAdaptation(actor, options?.source);
    }

    if (!isBreakpoint && actor.system.sanity.breakingPointHit) {
        await ChatMessage.create({
            whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
            content: `${actor.name} reaches their breaking point.`,
            speaker: {
                alias: 'System'
            },
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
        resetAdaptation(actor, options?.source);
    }

    if (!isViolenceAdapted && actor.system.sanity.adaptations.violence.isAdapted) {
        let violenceRoll = new Roll("1d6")
        await violenceRoll.evaluate();
        violenceRoll.toMessage({
            flavor: `${actor.name}'s empathy suffers, loses ${violenceRoll.total} CHA and the same amount from each Bond.`
        })

        actor.update({
            "system.statistics.cha.value": actor.system.statistics.cha.value - violenceRoll.total
        })
        actor.items.contents
            .filter(i => i.type === 'bond' && i.system.score > 0)
            .forEach(bond => {
                bond.update({
                    "system.score": Math.max(bond.system.score - violenceRoll.total, 0),
                })
            })
    }
    if (!isHelplessnessAdapted && actor.system.sanity.adaptations.helplessness.isAdapted) {
        let helplessnessRoll = new Roll("1d6")
        await helplessnessRoll.evaluate();
        helplessnessRoll.toMessage({
            flavor: `${actor.name}'s personal drive suffers and loses ${helplessnessRoll.total} POW.`
        })

        actor.update({
            "system.statistics.pow.value": actor.system.statistics.pow.value - helplessnessRoll.total
        })
    }
}

function resetAdaptation(actor: Actor, source: string | undefined) {
    if (!source) {
        return;
    }
    if (source === 'violence' && !actor.system.sanity.adaptations.violence.isAdapted) {
        actor.update({
            "system.sanity.adaptations.violence.incident1": false,
            "system.sanity.adaptations.violence.incident2": false,
            "system.sanity.adaptations.violence.incident3": false,
        });
    } else if (source === 'helplessness' && !actor.system.sanity.adaptations.helplessness.isAdapted) {
        actor.update({
            "system.sanity.adaptations.helplessness.incident1": false,
            "system.sanity.adaptations.helplessness.incident2": false,
            "system.sanity.adaptations.helplessness.incident3": false,
        });
    }
}