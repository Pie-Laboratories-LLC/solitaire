export class CardValues {
    // performance - don't call this too often; we only need it to initialize
    //  the deck.  It would be expensive to call this 6,000 times a second
    get values() { return [...this.#values]; }
    get length() { return this.#values.length; }
    #values;
    constructor(aceHigh) {
        if(typeof aceHigh === 'undefined') aceHigh = true;
        this.#values = [ '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K' ]
        if(aceHigh) this.#values.push('A');
        else this.#values.unshift('A');
    }

    getValueIndex(value) {
        let valueIndex = this.#values.indexOf(value);
        if(valueIndex == -1) throw new Error(`Can't find index of ${value} in ${this.#values}`);
        return valueIndex;
    }

    getIndexOf(value) {
        let indexOf = this.#values.indexOf(value);
        if(indexOf == -1) throw new Error(`Card demonination ${value} is not among ${this.#values}`);
        return indexOf;
    }

    getValue(index) {
        if(index >= this.#values.length || index < 0) throw new Error(`Card index ${index} doesn't exist!`);
        return this.#values[index];
    }
}

export class CardSuit {
    static CLUB = '♣';
    static SPADE = '♠';
    static DIAMOND = '♦';
    static HEART = '♥';
    static allSuits = [ '♦', '♥', '♣', '♠' ];

    static redSuits = [ '♦', '♥' ];
    static blackSuits = [ '♣', '♠' ];

    static isRedSuit(suit) {
        if(this.allSuits.indexOf(suit) == -1) throw new Error(`Invalid suit ${suit}`);
        return this.redSuits.indexOf(suit) != -1;
    }

    static isBlackSuit(suit) {
        if(this.allSuits.indexOf(suit) == -1) throw new Error(`Invalid suit ${suit}`);
        return this.blackSuits.indexOf(suit) != -1;
    }
}

export class Card {
    get suit() { return this.#suit; }
    get value() { return this.#value; }
    get valueIndex() { return this.#values.getValueIndex(this.#value); }
    get maxValueIndex() { return this.#values.length - 1; }
    get values() { return this.#values; }
    #suit;
    #value;
    #values;
    constructor(value,suit,values) {
        if(value instanceof Card) {
            // "copy constructor".  Unforunately we can't provide different
            //  versions of the constructor, in which case we could provide
            //  a constructor that accepted the card to copy.  So let's
            //  at least make sure they didn't accidentally pass us other
            //  parameters
            if(typeof suit !== 'undefined' || typeof values !== 'undefined') throw new Error(`Invalid use of copy constructor; can't specify suit or values.`);
            this.#suit = value.#suit;
            this.#value = value.#value;
            this.#values = value.#values;
            return;
        }
        this.#suit = suit;
        this.#value = value;
        this.#values = values;
    }

    toString() {
        return `${this.value}${this.suit}`;
    }
}
