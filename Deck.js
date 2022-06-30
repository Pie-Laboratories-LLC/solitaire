import { CardValues, CardSuit, Card } from './Card.js';

export default class Deck {
    get length() { return this.#deck.length; }
    #deck;
    constructor(aceHigh) {
        if(typeof aceHigh === 'undefined') aceHigh = true;

        this.#deck = [];
        
        const cardValues = new CardValues(aceHigh);

        // initialize deck
        for(let suit of CardSuit.allSuits) {
            for(let value of cardValues.values) {
                this.#deck.push(new Card(value,suit,cardValues));
            }
        }
    }

    shuffle() {
        // shuffle deck.  15 times the deck length swaps of cards.  This is
        //  what it's like when I give a couple shuffles of the deck what with
        //  my darren brown-ian digital dexterity.  I'm a natty dresser, too,
        //  but that's neither here nor there.
        for(let i = 0; i < this.#deck.length * 15; i++) {
            let c1 = getRandomInt(this.#deck.length);
            let c2;
            do {
                c2 = getRandomInt(this.#deck.length);
            } while(c2 == c1);
            if(c1 < c2) {
                let temp = c2;
                c2 = c1;
                c1 = temp;
            }
            let firstCard = this.#deck.splice(c1, 1);
            let secondCard = this.#deck.splice(c2, 1, firstCard[0]);
            this.#deck.splice(c1,0,secondCard[0]);
        }
    }

    deal() {
        if(!this.#deck.length) throw new Error(`Deck is empty - can't deal 😢`);
        return this.#deck.shift();
    }

    push(card) {
        // meh.  we'll blindly trust that this is one of the cards that came
        //  from us.  But let's at least verify it's a card
        if(!(card instanceof Card)) throw new Error(`Can't push a thing that isn't a card onto the deck!`);
        this.#deck.push(card);
    }
}

// n.b.: interesting topic, but beyond the scope here.  One interesting problem
//  is that random number generators can be "seeded," which has led to a number
//  of notorious hacking incidents.  One nice thing about seeded random number
//  generators is that if this solitaire used a PRNG, and I found a
//  particularly interesting deck using a particular seed, I could give you
//  the same seed and you could generate the same game.
// Random number generators in computers are an interesting topic with a long
//  history, in which I have precious little experience, because I've had so
//  little need.  This is one of those areas, unlike Angular or React or
//  anything I do day in and day out, where it would actually make sense to
//  consult an expert.
// https://stackoverflow.com/a/47593316 is an example of stackoverflow at its
//  best
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
