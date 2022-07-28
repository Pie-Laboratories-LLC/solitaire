export class Column {
    get length() { return this.#cards.length; }
    get downCards() { return this.#cards.length - this.#upCards; }
    get upCards() { return this.#upCards; }
    #upCards = 0;
    #cards = [];
    constructor() {}

    push(visible,...cards) {
        this.#cards.push(...cards);
        if(visible) this.#upCards += cards.length;
    }

    peekCard(offset) {
        if(typeof offset === 'undefined') offset = this.#cards.length - 1;
        if(offset < 0 || offset >= this.#cards.length) throw new Error(`Offset ${offset} is out of range [0,${this.#cards.length})`);
        if(!this.isVisible(offset)) throw new Error(`Can't peek at offset ${offset} of ${this.#cards.length} when there are only ${this.#upCards} visible cards.`);

        return this.#cards[offset];
    }

    splice(offset) {
        if(typeof offset === 'undefined') throw new Exception(`offset is a required parameter.`);
        if(offset < this.downCards || offset >= this.#cards.length) throw new Error(`Column ${SolitaireBoard.columnLetterOf(columnIndex)} has ${this.#cards.length} cards, of which ${this.#upCards} are visible; can't splice ${this.#cards.length - offset} 😢`);
        let cards = this.#cards.splice(offset);
        this.#upCards -= cards.length;
        if(!this.#upCards && this.#cards.length) this.#upCards = 1;

        return cards;
    }

    isVisible(offset) {
        return offset >= this.#cards.length - this.#upCards;
    }

    isHidden(offset) {
        return offset < this.#cards.length - this.#upCards;
    }
}

export class SolitaireBoard {
    get columnCount() { return this.#board.length; }
    #board = [];
    constructor(board) {
        if(typeof board !== 'undefined') {
            if(!Array.isArray(board)) throw new Error(`Initializer is not an array of board!`);
            if(board.length != 7) throw new Error(`Initializer does not have 7 columns!`);
            for(let index = 0; index < board.length; index++) {
                if(!board[index] instanceof Column) throw new Error(`Initializer column ${index} is not a Column!`);
            }
            this.#board = board;
            return;
        }
        // initialize the board.  There are 7 columns.  n.b.: what if we wanted
        //  to play with four decks and 15 columns?
        // The board will be an array .. of arrays.  Each column in the board
        //  is itself an array.
        for(let i = 0; i < 7; i++) this.#board.push(new Column());
    }

    deal(deck) {
        // deal the cards from the deck just like playing in vivo:
        //  up, down, down down.  Note we keep track of each card using an
        //  array, where the first element is the card, and the second is a
        //  boolean (true - the card is face up; false - the card is face down)
        // so the board is an array .. of arrays .. of an array.
        for(let i = 0; i < 7; i++) {
            for(let j = i; j < 7; j++) {
                if(j == i) this.#board[j].push(true, deck.deal());
                else this.#board[j].push(false, deck.deal());
            }
        }
    }

    peekColumnCard(index,offset) {
        if((index >= this.#board.length) || (index < 0)) throw new Error(`Invalid column index ${index}`);
        let column = this.#board[index];
        if(typeof offset === 'undefined') offset = column.length - 1;
        return column.peekCard(offset);
    }

    splice(columnIndex,offset) {
        if((columnIndex >= this.#board.length) || (columnIndex < 0)) throw new Error(`Invalid column index ${columnIndex}`);
        let column = this.#board[columnIndex];
        if(typeof offset === 'undefined') throw new Error(`You must specify a offset from which to splice.`);
        if(offset < column.downCards || offset >= column.length) throw new Error(`Column ${SolitaireBoard.columnLetterOf(columnIndex)} has ${column.length} cards, of which ${column.upCards} are visible; can't splice ${column.length - offset} 😢`);
        return column.splice(offset);
    }

    push(columnIndex,...cards) {
        if((columnIndex >= this.#board.length) || (columnIndex < 0)) throw new Error(`Invalid column index ${columnIndex}`);
        this.#board[columnIndex].push(true,...cards);
    }

    getColumnLength(index) {
        if(index < 0 || index >= this.#board.columnCount) throw new Error(`Invalid column index ${index}`);
        let column = this.#board[index];
        return [ column.length, column.downCards, column.upCards ];
    }

    cardIsVisible(index,offset) {
        if(index < 0 || index >= this.#board.columnCount) throw new Error(`Invalid column index ${index}`);
        return this.#board[index].isVisible(offset);
    }

    static columnLetterOf(columnIndex) {
        return String.fromCharCode('A'.charCodeAt(0) + columnIndex);
    }

    static columnIndexOf(columnLetter) {
        return columnLetter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    }
}
