import MessageSeverity from './MessageSeverity.js';

export default class GameMessage {
    get message() { return this.#message; }
    get severity() { return this.#severity; }
    #message;
    #severity;
    constructor(message,severity) {
        this.#message = message;
        if(typeof severity === 'undefined') severity = MessageSeverity.INFO;
        this.#severity = severity;
    }
}
