/**
 * @name HelloWorld
 * @author findert
 * @description Un plugin simple qui affiche "Hello World" au démarrage.
 * @version 1.0.0
 */

module.exports = class HelloWorld {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        console.log(`[${this.meta.name}] Hello World!`);
        BdApi.UI.showToast("Hello World!", { type: "success" });
    }

    stop() {
        console.log(`[${this.meta.name}] Plugin arrêté.`);
        BdApi.UI.showToast("Bye World!", { type: "info" });
    }
};
