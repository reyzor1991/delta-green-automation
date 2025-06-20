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

export function applyDamage(token: Token, damageAmount: number, multiplier: number = 1) {
    let protection = token?.actor?.system?.health?.protection || 0;
    let damageAfterProtection = Math.max(damageAmount - protection, 0)

    token?.actor?.update({
        ["system.health.value"]: Math.max(token?.actor?.system?.health?.value - damageAfterProtection, 0)
    });
}