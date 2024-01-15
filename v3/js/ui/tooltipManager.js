export class TooltipManager {
    constructor() {
        this.element = document.createElement("div");
        this.element.style.position = "fixed";
        this.element.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
        this.element.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
        this.element.style.left = "0px";
        this.element.style.top = "0px";
        this.element.style.padding = "0px 5px 0px 5px";
        this.element.style.pointerEvents = "none";
        this.element.style.display = "none";
        this.element.style.zIndex = "100";

        // Add it to the DOM
        document.body.appendChild(this.element);
    }

    show() {
        this.element.style.display = "block";
    }

    update(domX, domY, gridX, gridZ) {
        this.element.style.left = `${domX + 12}px`;
        this.element.style.top = `${domY + 12}px`;
        this.element.innerHTML = `(${(gridX * 1000).toFixed(2)} mm, ${(gridZ * 1000).toFixed(2)} mm)`;
    }

    hide() {
        this.element.style.display = "none";
    }
}