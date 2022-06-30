export default class GameResponse {
    get success() { return this.#success; }
    get messages() { return this.#messages; }
    #success;
    #messages;
    constructor(success,messages) {
        this.#success = success;
        this.#messages = [...messages];
    }
}
