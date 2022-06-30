import { SolitaireBoard } from './SolitaireBoard.js';

export class LocationType {
    static COLUMN = 'COLUMN';
    static UPSUIT = 'UPSUIT';
    static KITTY = 'KITTY';
}

export class Location {
    get type() { return this.#type; }
    get index() { if(this.#type != LocationType.COLUMN && this.#type != LocationType.UPSUIT) throw new Error(`Location type ${this.#type} doesn't have a column index.`); return this.#index; }
    get offset() { if(this.#type != LocationType.COLUMN) throw new Error(`Location type ${this.#type} doesn't have a column offset.`); return this.#offset; }
    #type;
    #index;
    #offset;
    constructor(move) {
        let localMove = move.replaceAll(/\s+/g,'').toLowerCase();
        let localMoveMatch = localMove.match(/^([a-g])\s*(-?\d*)$/);
        if(localMoveMatch) {
            // determine the index of the column; ascii magic: subtract the
            //  character code of 'a' from the character code of the column.
            let index = SolitaireBoard.columnIndexOf(localMoveMatch[1]);
            // they may not explicitly specify the offset in the column
            let offset = 0;
            // assume 0; if they put a number in there, parse it.
            if(localMoveMatch[2].length) offset = parseInt(localMoveMatch[2]);
            this.#type = LocationType.COLUMN;
            this.#index = index;
            this.#offset = offset;
            return;
        }
        localMoveMatch = localMove.match(/^u\s*([1-4])$/);
        if(localMoveMatch) {
            this.#type = LocationType.UPSUIT;
            this.#index = parseInt(localMoveMatch[1]) - 1;
            return;
        }
        if(localMove.match(/^k(?:itty)?$/)) {
            this.#type = LocationType.KITTY;
            return;
        }
        throw new Error(`LOGIC ERROR - couldn't parse ${move}`);
    }
}
