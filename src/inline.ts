import {GlobalRolls, moduleName} from "./const.js";
import {getCurrentActor, getCurrentSpeaker, selectText} from "./utils.js";

export type InlineOptions = { success: string, failure: string, source?: string, secret?: boolean }

async function processPercentileRoll(event: MouseEvent, rollOptions: {}) {
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

    return roll;
}

export async function clickInlineSkillRoll(event: MouseEvent, options: { key: string, specialTrainingName?: string, secret?: string }) {
    let actor = getCurrentActor();
    if (!actor) {
        return;
    }

    const rollOptions = {
        rollType: "skill",
        actor,
        key: options.key,
        specialTrainingName: options.specialTrainingName
    };

    if (options?.secret) {
        rollOptions.rollMode = "blindroll";
    }

    await processPercentileRoll(event, rollOptions);
}

export async function clickInlineSanityRoll(event: MouseEvent, options: InlineOptions) {
    let speaker = getCurrentSpeaker();
    let actor = getCurrentActor();
    if (!actor) {
        return;
    }

    const rollOptions = {
        rollType: "sanity",
        actor,
    };
    if (options?.secret) {
        rollOptions.rollMode = "blindroll";
    }
    let roll = await processPercentileRoll(event, rollOptions);

    handleSanityResult(speaker, roll, options);
}

function createHtmlTags(tags: (string | undefined)[]) {
    let filtered = tags.filter(t => !!t) as string[];
    if (!filtered.length) {
        return ``;
    }
    let htmlTags = filtered.map(t => {
        return `<span class="tag">${t.toUpperCase()}</span>`;
    });

    return `<div class="tags">${htmlTags.join("")}</div>`;
}

async function handleSanityResult(
    speaker: {},
    roll: {},
    inlineOptions: InlineOptions
) {
    // speaker.alias = 'System'

    let formula = roll.isSuccess
        ? inlineOptions.success
        : inlineOptions.failure;

    let r = new Roll(formula)
    let isCritFailure = !roll.isSuccess && roll.isCritical;
    let isCritSuccess = roll.isSuccess && roll.isCritical;
    await r.evaluate({maximize: isCritFailure, minimize: isCritSuccess});
    if (r.total > 0) {
        const privateSanSetting = game.settings.get("deltagreen", "keepSanityPrivate");
        let options = {}
        let flags = {}
        if ((privateSanSetting || inlineOptions?.secret) && !game.user.isGM) {
            options.rollMode = "blindroll";
            flags = {
                [moduleName]: {
                    needToHide: true
                }
            }
        }
        r.toMessage({
            flags,
            speaker,
            flavor: `<p class="fs1r">Sanity Loss Roll</p>${createHtmlTags([inlineOptions.source])}<button type="button" data-action="apply-sanity-loses" data-isSuccess=${roll.isSuccess} ${inlineOptions.source ? `data-source="${inlineOptions.source}"` : ""}>Apply Loses</button><br/>`
        }, options);
    }

    // if (!isViolenceAdapted && actor.system.sanity.adaptations.violence.isAdapted) {
    //     let violenceRoll = new Roll("1d6")
    //     await violenceRoll.evaluate();
    //     violenceRoll.toMessage({
    //         speaker,
    //         flavor: `${actor.name}'s empathy suffers, loses ${violenceRoll.total} CHA and the same amount from each Bond.<br/><button type="button" data-action="apply-violence-suffering">Apply Suffering</button>`
    //     })
    // }
    // if (!isHelplessnessAdapted && actor.system.sanity.adaptations.helplessness.isAdapted) {
    //     let helplessnessRoll = new Roll("1d6")
    //     await helplessnessRoll.evaluate();
    //     helplessnessRoll.toMessage({
    //         speaker,
    //         flavor: `${actor.name}'s personal drive suffers and loses ${helplessnessRoll.total} POW.<br/><button type="button" data-action="apply-helplessness-suffering">Apply Suffering</button>`
    //     })
    // }
}

export async function handleInlineActions(btnWithAction: HTMLElement, messageId: string) {
    let action = btnWithAction.dataset?.action;
    let message = game.messages.get(messageId);
    let actor = message?.speakerActor;
    let roll = message.rolls[0];
    if (!action || !message || !actor) {
        return;
    }

    if (action === 'item-roll-damage') {
        let isCritical = roll?.isCritical || false;
        let weapon = actor.items.get(roll?.item?._id);
        if (!weapon) {
            return;
        }

        weapon.roll(isCritical);
    } else if (action === 'apply-violence-suffering') {
        let total = message.rolls[0].total
        actor.update({
            "system.statistics.cha.value": Math.max(actor.system.statistics.cha.value - total, 0)
        })
        actor.items.contents
            .filter(i => i.type === 'bond' && i.system.score > 0)
            .forEach(bond => {
                bond.update({
                    "system.score": Math.max(bond.system.score - total, 0),
                })
            })
        message.update({
            flavor: message.flavor.replace(btnWithAction.outerHTML, '<label class="suffering-applied">Suffering was applied</label>')
        })
    } else if (action === 'apply-helplessness-suffering') {
        actor.update({
            "system.statistics.pow.value": Math.max(actor.system.statistics.pow.value - message.rolls[0].total, 0)
        })
        message.update({
            flavor: message.flavor.replace(btnWithAction.outerHTML, '<label class="suffering-applied">Suffering was applied</label>')
        })
    } else if (action === 'apply-sanity-loses') {
        let activeBonds = actor.itemTypes.bond.filter(b => b.system.score > 0)

        let applySanDamage = message.rolls[0].total;
        let source = btnWithAction.dataset?.source;
        const isBreakpoint = actor.system.sanity.breakingPointHit;
        const isSuccessRoll = btnWithAction.dataset?.issuccess === 'true'

        let dataForUpdate = {}
        let rollbacks = {}
        let bondForUpdate = {}
        let rollbackBonds = {}

        if (actor.system.wp.value > 0 && activeBonds.length) {
            let isWPUsing = await foundry.applications.api.DialogV2.confirm({
                window: {title: "Using WP"},
                content: `do you want to project your sanity loss onto your bond?<br/>Doing so will cost you 1d4 willpower<br/>${selectText(activeBonds)}`,
                yes: {
                    callback: (event: PointerEvent, htmlBtn: HTMLElement, dialog: object) => {
                        let el = dialog.element as HTMLElement;
                        return el?.querySelector(`[name="select-list"]`)?.value || false
                    }
                }
            });

            if (isWPUsing) {
                let wpRoll = new Roll("1d4")
                await wpRoll.evaluate();

                let wpDecrease = Math.min(wpRoll.total, actor.system.wp.value);

                dataForUpdate["system.wp.value"] = actor.system.wp.value - wpDecrease;
                rollbacks["system.wp.value"] = actor.system.wp.value;

                let selectedBond = actor.items.get(isWPUsing);
                let score = selectedBond.system.score;

                let wpDecreaseSanLoss = Math.min(wpDecrease, score);

                bondForUpdate = {
                    [`${isWPUsing}`]: {
                        ["system.score"]: selectedBond.system.score - wpDecreaseSanLoss,
                    },
                }
                rollbackBonds = {
                    [`${isWPUsing}`]: {
                        ["system.score"]: score
                    },
                }
                applySanDamage = Math.max(0, applySanDamage - wpDecreaseSanLoss);
            }
        }
        let newSanityValue = actor.system.sanity.value - applySanDamage

        // const isViolenceAdapted = actor.system.sanity.adaptations.violence.isAdapted;
        // const isHelplessnessAdapted = actor.system.sanity.adaptations.helplessness.isAdapted;

        dataForUpdate["system.sanity.value"] = newSanityValue;
        rollbacks["system.sanity.value"] = actor.system.sanity.value;

        if (source && !isSuccessRoll) {
            let targetSource = undefined
            if (source === "violence") {
                if (!actor.system.sanity.adaptations.violence.incident1) {
                    targetSource = 'violence.incident1'
                } else if (!actor.system.sanity.adaptations.violence.incident2) {
                    targetSource = 'violence.incident2'
                } else if (!actor.system.sanity.adaptations.violence.incident3) {
                    targetSource = 'violence.incident3'
                }
            } else if (source === "helplessness") {
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
                rollbacks[`system.sanity.adaptations.${targetSource}`] = false
            }
        }

        let isTempInsane = applySanDamage >= 5;
        let isBrokenPoint = !isBreakpoint && newSanityValue <= actor.system.sanity.currentBreakingPoint;

        if (isBrokenPoint || isTempInsane) {
            if (source) {
                if (source === 'violence' && !actor.system.sanity.adaptations.violence.isAdapted) {
                    rollbacks[`system.sanity.adaptations.violence.incident1`] = actor.system.sanity.adaptations.violence.incident1
                    rollbacks[`system.sanity.adaptations.violence.incident2`] = actor.system.sanity.adaptations.violence.incident2
                    rollbacks[`system.sanity.adaptations.violence.incident3`] = actor.system.sanity.adaptations.violence.incident3

                    dataForUpdate[`system.sanity.adaptations.violence.incident1`] = false
                    dataForUpdate[`system.sanity.adaptations.violence.incident2`] = false
                    dataForUpdate[`system.sanity.adaptations.violence.incident3`] = false
                } else if (source === 'helplessness' && !actor.system.sanity.adaptations.helplessness.isAdapted) {
                    rollbacks[`system.sanity.adaptations.helplessness.incident1`] = actor.system.sanity.adaptations.helplessness.incident1
                    rollbacks[`system.sanity.adaptations.helplessness.incident2`] = actor.system.sanity.adaptations.helplessness.incident2
                    rollbacks[`system.sanity.adaptations.helplessness.incident3`] = actor.system.sanity.adaptations.helplessness.incident3

                    dataForUpdate[`system.sanity.adaptations.helplessness.incident1`] = false
                    dataForUpdate[`system.sanity.adaptations.helplessness.incident2`] = false
                    dataForUpdate[`system.sanity.adaptations.helplessness.incident3`] = false
                }
            }
        }

        await actor.update(dataForUpdate);

        for (let k in bondForUpdate) {
            await actor.items.get(k).update(bondForUpdate[k]);
        }

        ui.notifications.info(`${actor.name} loses ${applySanDamage} sanity`)

        message.update({
            flags: {
                [moduleName]: {
                    rollbacks,
                    rollbackBonds
                }
            },
            flavor: message.flavor.replace(btnWithAction.outerHTML, '<button type="button" data-action="rollback-sanity-loses">Loses were applied <i class="fa fa-undo" aria-hidden="true"></i></button>')
        })


        if (isTempInsane) {
            ChatMessage.create({
                whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
                content: `${actor.name} is temporary insanity`,
                speaker: message.speaker,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER
            });
        }

        if (isBrokenPoint) {
            ChatMessage.create({
                whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
                content: `${actor.name} reaches their breaking point.`,
                speaker: message.speaker,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER
            });
        }
    } else if (action === 'rollback-sanity-loses') {
        await actor.update(message.getFlag(moduleName, "rollbacks"));
        let rollbackBonds = (message.getFlag(moduleName, "rollbackBonds") || {})

        for (let k in rollbackBonds) {
            await actor.items.get(k).update(rollbackBonds[k]);
        }

        message.update({
            [`flags.${moduleName}.-=rollbacks`]: null,
            [`flags.${moduleName}.-=rollbackBonds`]: null,
            flavor: message.flavor.replace(btnWithAction.outerHTML, '<label class="strike">Loses were applied</label>')
        })
    } else if (action === 'rollback-skill-failure-state') {
        let rollbackFlag = message.getFlag(moduleName, "rollbacks");
        await actor.update(rollbackFlag);

        toggleAllSkillFailures(rollbackFlag)

        let text = btnWithAction.outerHTML?.includes("unmarked")
            ? "You are learning from your mistakes, the checkbox was marked"
            : "The checkbox was unmarked"

        message.update({
            [`flags.${moduleName}.rollbacks`]: rollbackFlag,
            content: message.content.replace(btnWithAction.outerHTML, `<button type="button" data-action="rollback-skill-failure-state">${text} <i class="fa fa-undo" aria-hidden="true"></i></button>`)
        })
    }
}

function toggleAllSkillFailures(data) {
    for (const skill of Object.values(data.system.skills)) {
        skill.failure = !skill.failure;
    }
}