export function htmlClosest(element: Document | Element | EventTarget | null, selectors: string): HTMLElement | null {
    if (element instanceof Element) {
        return element.closest(selectors);
    }
    return null
}

export function selectText(list: { id: string, name: string }[]) {
    let options = list.map(item => `<option value="${item.id}">${item.name}</option>`);
    return `<select name="select-list">${options.join("")}</select>`;
}

export function currentTargets() {
    return game.user.targets.map((token) => {
        return {
            sceneId: token.scene.id,
            tokenId: token.id,
        };
    })
        .reduce(function (map, obj) {
            map[obj.tokenId] = obj;
            return map;
        }, {} as { [key: string]: object });
}

export type DamageData = { damageAmount: number, armorPiercing: number }

export function applyDamage(token: Token, damageData: DamageData, multiplier: number = 1) {
    let protection = token?.actor?.system?.health?.protection || 0;
    const scaledDamage = damageData.damageAmount * multiplier

    const effectiveProtection = Math.max(
        protection - damageData.armorPiercing,
        0
    );

    const damageAfterProtection = Math.max(
        scaledDamage - effectiveProtection,
        0
    );

    token?.actor?.update({
        ["system.health.value"]: Math.max(token?.actor?.system?.health?.value - damageAfterProtection, 0)
    });

    ui.notifications.info(`Damage ${damageAfterProtection} was applied to ${token.name}`);
}

export function getCurrentActor() {
    const cls = foundry.utils.getDocumentClass("ChatMessage");
    const speaker = cls.getSpeaker();
    const actor = cls.getSpeakerActor(speaker);
    return actor || null;
}

export function getCurrentSpeaker() {
    const cls = foundry.utils.getDocumentClass("ChatMessage");
    return cls.getSpeaker();
}

export function localize(text: string): string {
    return game.i18n.localize(text)
}

export function localizeFormat(text: string, data: object): string {
    return game.i18n.format(text, data);
}