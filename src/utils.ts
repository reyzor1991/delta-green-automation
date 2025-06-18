export function htmlClosest(element: Document | Element | EventTarget | null, selectors: string): HTMLElement | null {
    if (element instanceof Element) {
        return element.closest(selectors);
    }
    return null
}