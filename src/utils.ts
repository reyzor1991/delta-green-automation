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