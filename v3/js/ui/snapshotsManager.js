import { overriddenParams, setParams } from "/v3/js/params.js";


export class SnapshotsManager {
    constructor(app) {
        this.app = app;
        this.containerElement = app.snapshotsContainerElement;
        this.snapshotButtonElement = this.containerElement.querySelector("#takeSnapshotButton");
        this.snapshotButtonElement.addEventListener("click", this.takeSnapshot.bind(this))
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
    }

    _drawCanvas(sourceCanvas) {
        this.ctx.drawImage(sourceCanvas,
            0, 0, sourceCanvas.width, sourceCanvas.height,
            0, 0, this.canvas.width, this.canvas.height
        );
    }

    takeSnapshot() {
        const backgroundCanvas = this.app.backgroundCanvas.canvas;
        const mainSimulationCanvas = this.app.mainSimulationCanvas.canvas;
        const overlayCanvas = this.app.overlaySimulationCanvas.simulationCanvas;
        const foregroundCanvas = this.app.foregroundCanvas.canvas;

        this.canvas.width = mainSimulationCanvas.width;
        this.canvas.height = mainSimulationCanvas.height;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._drawCanvas(backgroundCanvas);
        this._drawCanvas(mainSimulationCanvas);
        this._drawCanvas(overlayCanvas);
        this._drawCanvas(foregroundCanvas);
        const imageDataURL = this.canvas.toDataURL();

        const snapshot = {
            "imageDataURL": imageDataURL,
            // Object.assign copies the object
            "overriddenParams": Object.assign({}, overriddenParams),
        };
        this.addSnapshotImageElement(snapshot);
    }

    addSnapshotImageElement(snapshot) {
        const imgContainerElement = document.createElement("div");
        imgContainerElement.classList.add("snapshotImageContainer")

        const imgElement = document.createElement("img");
        imgElement.src = snapshot.imageDataURL;
        imgElement.classList.add("snapshotImage");
        imgElement.addEventListener("click", () => setParams(snapshot.overriddenParams));

        const deleteButtonElement = document.createElement("button");
        deleteButtonElement.addEventListener(
            "click",
            (() => this.containerElement.removeChild(imgContainerElement)).bind(this)
        );
        deleteButtonElement.classList.add("snapshotImageDeleteButton");

        imgContainerElement.appendChild(imgElement);
        imgContainerElement.appendChild(deleteButtonElement);
        this.containerElement.insertBefore(imgContainerElement, this.snapshotButtonElement.nextSibling);
    }
}