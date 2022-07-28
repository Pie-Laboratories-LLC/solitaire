import GameMessage from './GameMessage.js';
import GameResponse from './GameResponse.js';
import Deck from './Deck.js';
import { Card,CardSuit } from './Card.js';
import { Column,SolitaireBoard } from './SolitaireBoard.js';
import { Location,LocationType } from './Location.js';

export default class SolitaireGame {
    // how player can specify the location:
    // 1) kitty 2) u1-u4 for upSuit 3) a-g for column, or a1 to mean
    //  "the second face-up card in column a," or b3 to mean "the fourth
    //  face-up card in column b".
    // we put this in a variable to reuse in the regular expression;
    //  the player moves from one location to another.
    // n.b.: support negative values for column moves, which is easier
    //  if you just want to count from the bottom.
    static LOCATION_PATTERN = 'k(?:itty)?|u\\s*[1-4]|[a-g]\\s*-?\\d{0,2}';
    // this is what a move looks like: "from -> to" or "from, to", or
    //  even "from to".
    static MOVE_REGEX = new RegExp(`^\\s*(${SolitaireGame.LOCATION_PATTERN})\\s*(?:->|to|,)?\\s*(${SolitaireGame.LOCATION_PATTERN})`,'i');
    // number of columns on the board
    get columnCount() { return this.#board.columnCount; }
    // number of upsuit columns
    get upSuitCount() { return this.#upSuits.length; }
    // number of cards that can be visible in kitty: kittyLength is the number
    //  of cards actually in the kitty
    get kittyCount() { return 3; }
    get deckLength() { return this.#deck.length; }
    get kittyLength() { return this.#kitty.length; }
    get kitty() {
        let kitty = [];
        let kittyIndex = this.#kitty.length - 1;
        while(kitty.length < 3 && kittyIndex >= 0) {
            kitty.unshift(new Card(this.#kitty[kittyIndex]));
            kittyIndex--;
        }
        return kitty;
    }
    get wholeKitty() {
        return [...this.#kitty];
    }
    get anyCard() {
        if(this.#deck.length) return this.#deck.peek;
        if(this.#kitty.length) return this.#kitty[this.#kitty.length - 1];
        for(let index = 0; index < this.upSuitCount; index++) if(this.#upSuits[index].length) return this.#upSuits[index].peekCard();
        for(let index = 0; index < this.#board.columnCount; index++) {
            let length = this.#board.getColumnLength(index);
            if(!length[2]) continue;
            return this.#board.peekColumnCard(index);
        }
        throw new Error(`I can't seem to find a card to return :(`);
    }
    #deck;
    #board;
    #kitty;
    #upSuits;
    get renderCard() { return this.#renderCardCallback; }
    #renderCardCallback;
    get renderSuit() { return this.#renderSuitCallback; }
    #renderSuitCallback;

    constructor(renderCard,renderSuit,deck,kitty,board,upSuits) {
        // create a deck & shuffle it
        if(!deck) {
            deck = new Deck(false);
            deck.shuffle();
        }
        else if(!(deck instanceof Deck)) throw new Error(`someone's trying to pass something off as a deck!`);
        this.#deck = deck;

        // initialize the board and deal the first set of cards.
        if(!board) {
            board = new SolitaireBoard();
            board.deal(deck);
        }
        else if(!(board instanceof SolitaireBoard)) throw new Error(`someone's trying to pass something off as a board!`);
        this.#board = board;

        // I dunno what the face up cards dealt from the left over deck is
        //  called in your professional vegas solitaire circles, but based on
        //  every movie & series about con men that I've seen, I'm going with
        //  kitty! 😸
        if(!kitty) kitty = [];
        this.#kitty = kitty;

        // upSuits is where we keep the cards ace to king of each suit.  an
        //  array of an array for each suit.  Each of that array will just be
        //  the card, e.g., AC, 2C, etc.
        if(!upSuits) {
            upSuits = [];
            for(let index = 0; index < CardSuit.allSuits.length; index++) upSuits.push(new Column());
        }
        this.#upSuits = upSuits;

        this.#renderCardCallback = renderCard;
        this.#renderSuitCallback = renderSuit;
    }

    isWinner() {
        // player wins if all the board columns are empty...
        for(let columnIndex = 0; columnIndex < this.#board.columnCount; columnIndex++) {
            let columnLength = this.#board.getColumnLength(columnIndex);
            if(columnLength[0]) return false;
        }
        // ...and if the deck and kitty are both empty...
        if(this.#deck.length || this.#kitty.length) return false;
        // ...we infer the cards must all be in upSuits.
        // let's go ahead and validate the upSuits have 13 cards each
        for(let upSuitIndex in this.#upSuits) if(this.#upSuits[upSuitIndex].length != 13) throw `upSuit ${upSuitIndex} does not have length 13!`;

        return true;
    }

    dealToKitty() {
        // deal to the kitty
        let response = [ ];
        if(!this.#deck.length) {
            response.push(new GameMessage(`Empty deck, can't deal; are you some kind of dirty hacker??!`));
            return new GameResponse(false, response);
        }

        // deal three cards from the deck, or as many as may be left if
        //  less than three
        for(let i = 0; i < this.kittyCount && this.#deck.length; i++) this.#kitty.push(this.#deck.deal());
        return new GameResponse(true,response);
    }

    cheeseKitty() {
        while(this.#deck.length) this.#kitty.push(this.#deck.deal());
    }

    redeal() {
        let response = [];
        if(this.#deck.length) response.push(new GameMessage(`Deck is not empty.`));
        if(!this.#kitty.length) response.push(new GameMessage(`Kitty is empty.`));
        if(response.length) return new GameResponse(false, response);

        // this restores the deck, without shuffling.
        while(this.#kitty.length) this.#deck.push(this.#kitty.shift());
        return new GameResponse(true, response);
    }

    doFini() {
        // a "closure;" a little bit of reusable code to determine if a card
        //  can go in an upsuit
        let upSuitMatch = (card) => {
            // loop through the upSuits until we find the same suit as this card
            for(let index in this.#upSuits) {
                let upSuit = this.#upSuits[index];

                if(!upSuit.length) {
                    // special case: can move ace to an empty upSuit column.
                    if(card.valueIndex == 0) {
                        return [ true, index, undefined ];
                    }
                    continue;
                }

                let upSuitCard = upSuit.peekCard();
                if(upSuitCard.suit != card.suit) continue;
                return [ true, index, upSuitCard ];
            }
            return [ false ];
        };

        // loop through each column, check if its last card can be moved to an
        //  upSuit
        for(let columnIndex = 0; columnIndex < this.#board.columnCount; columnIndex++) {
            let columnLength = this.#board.getColumnLength(columnIndex);
            if(!columnLength[0]) continue;

            // take the last card from the column
            let columnCard = this.#board.peekColumnCard(columnIndex);

            // see if the card in the column matches what's in the up suit
            let upSuitMatchResult = upSuitMatch(columnCard);
            if(!upSuitMatchResult[0]) continue;

            // get the card that matched, if it's not an empty column
            let upSuitIndex = upSuitMatchResult[1];
            let upSuitCard = upSuitMatchResult[2];

            // verify that the card from the board is one higher than the upSuit
            // NOTE - upSuitCard will not be set if upSuit is empty
            if(upSuitCard && (columnCard.valueIndex != upSuitCard.valueIndex + 1)) continue;
            return [
                new Location(LocationType.COLUMN,columnIndex,-1),
                new Location(LocationType.UPSUIT,upSuitIndex),
            ];
        }

        if(!this.#kitty.length && this.#deck.length) return 'deal';

        if(this.#kitty.length) {
            let kittyCard = this.#kitty[this.#kitty.length - 1];

            // see if the card in the kitty matches what's in an up suit
            let upSuitMatchResult = upSuitMatch(kittyCard);
            if(upSuitMatchResult[0]) {
                // get the card that matched, if it's not an empty column
                let upSuitIndex = upSuitMatchResult[1];
                let upSuitCard = upSuitMatchResult[2];

                // verify that the card from the board is one higher than the upSuit
                // NOTE - upSuitCard will not be set if upSuit is empty
                if(!upSuitCard || (kittyCard.valueIndex == upSuitCard.valueIndex + 1)) return [
                    new Location(LocationType.KITTY),
                    new Location(LocationType.UPSUIT,upSuitIndex),
                ];
            }

            // see if we can deal from kitty to any column
            for(let columnIndex = 0; columnIndex < this.#board.columnCount; columnIndex++) {
                let columnLength = this.#board.getColumnLength(columnIndex);
                if(!columnLength[0]) continue;

                // take the last card from the column
                let columnCard = this.#board.peekColumnCard(columnIndex);

                if(CardSuit.isRedSuit(kittyCard.suit) && CardSuit.isRedSuit(columnCard.suit)) continue;
                if(CardSuit.isBlackSuit(kittyCard.suit) && CardSuit.isBlackSuit(columnCard.suit)) continue;

                // verify that the card from the board is one higher than the upSuit
                // NOTE - upSuitCard will not be set if upSuit is empty
                if(columnCard.valueIndex != kittyCard.valueIndex + 1) continue;
                return [
                    new Location(LocationType.KITTY),
                    new Location(LocationType.COLUMN,columnIndex,-1)
                ];
            }
        }

        if(this.#kitty.length && !this.#deck.length) return 'redeal';
        else if(this.#deck.length) return 'deal';

        return undefined;
    }

    validateMove(fromCard,to) {
        let column;
        let response = [];
        if(to.type == LocationType.UPSUIT) {
            // they are moving to upSuits.
            let upSuit = this.#upSuits[to.index];
            if(!upSuit.length) {
                if(fromCard.valueIndex == 0) return new GameResponse(true, response);
                response.push(new GameMessage(`You can only move an ace to an empty stack, not ${this.#renderCard(fromCard)} (${fromCard.valueIndex})!`));
                return new GameResponse(false,response);
            }
            let upSuitCard = upSuit.peekCard();
            // make sure the suit matches
            if(fromCard.suit != upSuitCard.suit) {
                response.push(new GameMessage(`You can't move a ${this.#renderSuit(fromCard)} in ${this.#renderCard(fromCard)} to a stack of ${this.#renderSuit(upSuitCard)}`));
                return new GameResponse(false,response);
            }
            // make sure the card being moved is the next card for this suit.
            //  little surprising it's as difficult as it is to do this.
            if(fromCard.valueIndex != upSuitCard.valueIndex + 1) {
                response.push(new GameMessage(`Can't put ${this.#renderCard(fromCard)} (${fromCard.valueIndex}) on ${this.#renderCard(upSuitCard)} (${upSuitCard.valueIndex})`));
                return new GameResponse(false,response);
            }
            return new GameResponse(true,response);
        }

        // they're moving to a column on the board.  get the column to which
        //  they're moving
        let boardColumnLength = this.#board.getColumnLength(to.index);
        if(!boardColumnLength[0]) {
            if(fromCard.valueIndex == fromCard.maxValueIndex) return new GameResponse(true, response);
            response.push(new GameMessage(`Can only move a King to empty column ${to}, not ${this.#renderCard(fromCard)} :(`));
            return new GameResponse(false,response);
        }

        // make sure they alternate suits
        let columnCard = this.#board.peekColumnCard(to.index);
        if(CardSuit.isBlackSuit(fromCard.suit)) {
            if(CardSuit.isBlackSuit(columnCard.suit)) {
                response.push(new GameMessage(`Can't move black suit ${this.#renderSuit(fromCard)} of ${this.#renderCard(fromCard)} onto black suit ${this.#renderSuit(columnCard)} of ${this.#renderCard(columnCard)}`));
                return new GameResponse(false,response);
            }
            // this is a supremely paranoid check; but what if we add
            //  green suits?
            if(!CardSuit.isRedSuit(columnCard.suit)) throw `LOGIC ERROR! columnCard ${columnCard} of ${this.#renderCard(columnCard)} isn't a redSuit or a blackSuit! :(`;
        }
        else if(CardSuit.isRedSuit(fromCard.suit)) {
            if(CardSuit.isRedSuit(columnCard.suit)) {
                response.push(new GameMessage(`Can't move red suit ${this.#renderSuit(fromCard)} of ${this.#renderCard(fromCard)} onto red suit ${this.#renderSuit(columnCard)} of ${this.#renderCard(columnCard)}`));
                return new GameResponse(false,response);
            }
            // this is a really paranoid check
            if(!CardSuit.isBlackSuit(columnCard.suit)) throw `LOGIC ERROR! columnCard ${columnCard} of ${this.#renderCard(columnCard)} isn't a redSuit or a blackSuit! :(`;
        }
        else throw `LOGIC ERROR! fromCard ${fromCard} of ${this.#renderCard(fromCard)} isn't a blackSuit or a redSuit! :(`;

        // now validate that the card being moved is the next lower card to
        //  what's on the destination: e.g., 8 can go on 9
        // NOTE - this is the _opposite_ logic we checked when moving to
        //  upSuits, because upSuits increase but moving to a column on the
        //  board, the card values decrease.
        if(columnCard.valueIndex != fromCard.valueIndex + 1) {
            response.push(new GameMessage(`Can't put ${this.#renderCard(fromCard)} (${fromCard.valueIndex}) on ${this.#renderCard(columnCard)} (${columnCard.valueIndex})`));
            return new GameResponse(false,response);
        }
        return new GameResponse(true,response);
    }

    performMove(from,to) {
        let response = [];

        // do some validation.
        if(to.type == LocationType.COLUMN && (to.offset > 0 || to.offset < -1)) {
            response.push(new GameMessage(`You can't specify offset in the column to which you're moving!`));
            return new GameResponse(false, response);
        }

        if(to.type == LocationType.KITTY) {
            response.push(new GameMessage(`You can't move _to_ the kitty!`));
            return new GameResponse(false, response);
        }

        if(from.type == LocationType.KITTY && to.type == LocationType.COLUMN && SolitaireBoard.columnLetterOf(to.index) == 'G') {
            response.push(new GameMessage('PICK OF DESTINY!!!!'));
        }

        // perform the move
        let fromCard;
        let validationResult;
        if(from.type == LocationType.KITTY) {
            // moving from the kitty
            if(!this.#kitty.length) {
                response.push(new GameMessage(`You can't move _from_ an empty kitty!`));
                if(this.#deck.length) response.push(new GameMessage(`Try dealing first!`));
                return new GameResponse(false, response);
            }

            fromCard = this.#kitty[this.#kitty.length - 1];

            // make sure it's a valid move
            validationResult = this.validateMove(fromCard,to);
            if(!validationResult.success) {
                response.push(...validationResult.messages);
                return new GameResponse(false, response);
            }

            // remove the card from the kitty
            this.#kitty.pop();

            // perform the move.  Note we have a nice method so when we
            //  go to move we don't have to go through the same logic over
            //  and over and over.
            this.#moveTo([ fromCard ],to,response);
            return new GameResponse(true, response);
        }

        if(from.type == LocationType.UPSUIT) {
            // moving from the upSuit
            let upSuitColumn = this.#upSuits[from.index];
            if(!upSuitColumn.length) {
                response.push(new GameMessage(`upSuits ${from.index + 1} is empty!`));
                return new GameResponse(false, response);
            }
            fromCard = upSuitColumn.peekCard();
            validationResult = this.validateMove(fromCard,to);
            if(!validationResult.success) {
                response.push(...validationResult.messages);
                return new GameResponse(false, response);
            }
            upSuitColumn.splice(upSuitColumn.length - 1);
            this.#moveTo([ fromCard ],to,response);
            return new GameResponse(true, response);
        }

        // moving from a column
        if(from.type != LocationType.COLUMN) {
            // this shouldn't happen.  it's nice to throw an exception here,
            //  but that rudely terminates the program. with thousands of
            //  dollars riding in your professional vegas solitaire match,
            //  people gonna get sued.  So we'll print a nice message and
            //  continue.
            throw new Exception(`LOGIC ERROR! Oops, the from location ${from} is different from what I expected`);
        }

        // get the specified column from the board.
        let fromColumnLength = this.#board.getColumnLength(from.index);;

        if(!fromColumnLength[0]) {
            response.push(new GameMessage(`There are no cards in column ${SolitaireBoard.columnLetterOf(from.index)}`));
            return new GameResponse(false, response);
        }

        // locate index of the card we're moving in the column
        let fromOffset = 0;

        // if they're moving card to upSuits, it can *only* be the last
        //  card visible in the column (we validated above...)
        if(to.type == LocationType.UPSUIT) fromOffset = fromColumnLength[0] - 1;
        else if(from.offset < 0) {
            // i.e., the column offset is negative, they're counting from the
            //  last visible card in the column
            fromOffset = fromColumnLength[0] +  from.offset;
            // make sure the new index doesn't exceed the number of cards in
            //  the column
            if(fromOffset < 0) {
                response.push(new GameMessage(`There aren't as many cards in column ${SolitaireBoard.columnLetterOf(from.index)} as indicated by index ${from.offset}`));
                return new GameResponse(false, response);
            }
            // make sure the specified card is visible in the column
            if(!this.#board.cardIsVisible(from.index,fromOffset)) {
                response.push(new GameMessage(`The card at index ${from.offset} in column ${SolitaireBoard.columnLetterOf(from.index)} is not visible.`));
                return new GameResponse(false, response);
            }
        }
        else {
            // they're not moving the card to the upSuit, assume they're
            //  moving all the the visible cards in the column
            fromOffset = fromColumnLength[0] - fromColumnLength[2];
            if(fromOffset >= fromColumnLength[0]) {
                response.push(new GameMessage(`There are no visible cards in column ${fromMatch[1]}`));
                return new GameResponse(false, response);
            }

            // if they specified an offset, make sure there are enough
            //  visible cards to accomodate the request.
            if(fromOffset + from.offset >= fromColumnLength[0]) {
                response.push(new GameMessage(`Index ${from.offset} exceeds the number of visible cards (${fromColumnLength[0] - fromOffset}) in column ${columnLetterOf(from.index)}`));
                return new GameResponse(false, response);
            }
            fromOffset += from.offset;
        }

        fromCard = this.#board.peekColumnCard(from.index,fromOffset);
        if(from.type == LocationType.COLUMN && SolitaireBoard.columnLetterOf(from.index) == 'F' && to.type == LocationType.OFFSET && to.index == 1) response.push(new GameMessage('RUDE!!!!!!!'));

        // make sure the move is valid
        validationResult = this.validateMove(fromCard,to);
        if(!validationResult.success) {
            response.push(...validationResult.messages);
            return new GameResponse(false, response);
        }

        // extract all of the indicated cards from the column
        let cards = this.#board.splice(from.index,fromOffset);

        this.#moveTo(cards,to,response);

        return new GameResponse(true, response);
    }

    getColumnLength(index) {
        if(index < 0 || index >= this.#board.columnCount) throw new Error(`Invalid column index ${index}`);
        return this.#board.getColumnLength(index);
    }

    getUpSuitLength(index) {
        if(index < 0 || index >= this.#upSuits.length) throw new Error(`Invalid upSuit index ${index}`);
        return this.#upSuits[index].length;
    }

    peekColumnCard(index,offset) {
        return this.#board.peekColumnCard(index,offset);
    }

    peekUpSuit(index) {
        if(index < 0 || index >= 4) throw new Error(`Invalid upsuit index ${index}`);
        return this.#upSuits[index].peekCard();
    }

    #renderCard(card) {
        if(this.#renderCardCallback) return this.#renderCardCallback(card);
        return card.toString();;
    }

    #renderSuit(card) {
        if(this.#renderSuitCallback) return this.#renderSuitCallback(card);
        return card.suit;
    }

    #moveTo(fromCards,to,response) {
        if(fromCards[0].suit == '♥' && fromCards[0].value == 'Q') response.push(new GameMessage('The joker is the only foo-hoo-hoo, who\'ll do anything with you!'));

        if(to.type == LocationType.UPSUIT) {
            // moving to an upSuit?
            if(fromCards.length != 1) throw new Error(`LOGIC ERROR! - can't move ${fromCards.length} card(s) to upSuit!`);

            this.#upSuits[to.index].push(true,fromCards[0]);

            return;
        }

        // moving to a board column.
        this.#board.push(to.index,...fromCards);
    }
}
