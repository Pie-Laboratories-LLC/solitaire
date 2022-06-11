const readline = require('readline-sync');


const suits = [ 'C', 'S', 'D', 'H' ];
const redSuits = [ 'D', 'H' ];
const blackSuits = [ 'C', 'S' ];
// n.b. - is the ace high or low?
const values = [ 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K' ];
const suitCharacterMap = {
    C: '♣'
   ,S: '♠'
   ,D: '♦'
   ,H: '♥'
};

// main menu!
while(1) {
    console.log('1) new game');
    console.log('2) quit');
    let input = readline.question('-> ');
    if(input == '2') {
        console.log('buhbye');
        process.exit();
    }
    if(input == '1') {
        playGame();
        continue;
    }
    // it's empowering to have a nice message to indicate that where the
    //  game respects you, you somehow managed to enter something that
    //  isn't recognized.  It's important to let the user know you're on
    //  their side and want them to succeed.
    console.log('try again, fathead');
}

function playGame() {
    let deck = [];
    // initialize deck
    for(let suit of suits) {
        for(let value of values) {
            deck.push([value,suit]);
        }
    }
    // shuffle deck.  15 times the deck length swaps of cards.  This is
    //  what it's like when I give a couple shuffles of the deck what with
    //  my darren brown-ian digital dexterity.  I'm a natty dresser, too,
    //  but that's neither here nor there.
    console.log('shuffling');
    for(let i = 0; i < deck.length * 15; i++) {
        let c1 = getRandomInt(deck.length);
        let c2;
        do {
            c2 = getRandomInt(deck.length);
        } while(c2 == c1);
        if(c1 < c2) {
            let temp = c2;
            c2 = c1;
            c1 = temp;
        }
        let firstCard = deck.splice(c1, 1);
        let secondCard = deck.splice(c2, 1, firstCard[0]);
        deck.splice(c1,0,secondCard[0]);
    }
    // initialize the board.  There are 7 columns.  n.b.: what if we wanted
    //  to play with four decks and 15 columns?
    // The board will be an array .. of arrays.  Each column in the board
    //  is itself an array.
    let board = [];
    for(let i = 0; i < 7; i++) {
        board.push([]);
    }
    // deal the cards from the deck just like playing in vivo:
    //  up, down, down down.  Note we keep track of each card using an
    //  array, where the first element is the card, and the second is a
    //  boolean (true - the card is face up; false - the card is face down)
    // so the board is an array .. of arrays .. of an array.
    for(let i = 0; i < 7; i++) {
        for(let j = i; j < 7; j++) {
            if(j == i) board[j].push([deck.shift(), true]);
            else board[j].push([deck.shift(), false]);
        }
    }
    // I dunno what the face up cards dealt from the left over deck is
    //  called in your professional vegas solitaire circles, but based on
    //  every movie & series about con men that I've seen, I'm going with
    //  kitty! 😸
    let kitty = [];
    // upSuits is where we keep the cards ace to king of each suit.  an
    //  array of an array for each suit.  Each of that array will just be
    //  the card, e.g., AC, 2C, etc.
    let upSuits = [[],[],[],[]];

    // game loop!
    while(true) {
        // draw the board
        renderBoard(board,deck,kitty,upSuits);
        // if the player's won the game, it's game over!
        if(checkWinner(board,deck,kitty,upSuits)) return;

        // if there are cards on the deck still, player can deal to the
        //  kitty
        if(deck.length) console.log('1) deal to kitty');
        // if there are no cards on the deck and cards in the kitty, the
        //  player can reset the kitty to the deck
        else if(kitty.length) console.log('2) redeal');
        // when life gives you lemons, give up in existential despair
        console.log('3) quit');
        console.log('Or, enter move');
        // get input from player
        let input = readline.question('-> ');
        if(input == '3') {
            // one hates to overstate things, but one can't help but wonder
            //  if this is what Picasso was thinking of when he invented
            //  cubism
            console.log('|');
            console.log('||');
            console.log('||');
            console.log('||            OSER!!!!!!!!!!!!');
            console.log('||');
            console.log('++---------');
            console.log(' +----------');
            console.log('');
            return;
        }
        if(input == '1') {
            // deal to the kitty
            if(!deck.length) {
                console.log(`Empty deck, can't deal; are you some kind of dirty hacker??!`);
                continue;
            }
            // deal three cards from the deck, or as many as may be left if
            //  less than three
            for(let i = 0; i < 3 && deck.length; i++) kitty.push(deck.shift());
            continue;
        }
        if(input == '2') {
            // restore the deck.
            if(deck.length || !kitty.length) {
                console.log(`${deck.length ? "Deck is not empty; ":""}${!kitty.length ? "Upstack is empty; ": ""}can't redeal; something's broken, it's probably you!`);
                continue;
            }
            // this restores the deck, without shuffling.
            while(kitty.length) deck.push(kitty.shift());
            continue;
        }

        if(input == 'fini') {
            while(doFini(board,upSuits)) ;
            console.log('Fini finished.');
            continue;
        }

        // how player can specify the location:
        // 1) kitty 2) u1-u4 for upSuit 3) a-g for column, or a1 to mean
        //  "the second face-up card in column a," or b3 to mean "the fourth
        //  face-up card in column b".
        // we put this in a variable to reuse in the regular expression;
        //  the player moves from one location to another.
        let locationPattern = 'k(?:itty)?|u\\s*[1-4]|[a-g]\\s*\\d{0,2}';
        // this is what a move looks like: "from -> to" or "from, to", or
        //  even "from to".
        let moveRegex = new RegExp(`^\\s*(${locationPattern})\\s*(?:->|to|,)?\\s*(${locationPattern})`,'i');
        let moveMatch = input.match(moveRegex);
        // make sure it's a valid move
        if(!moveMatch) {
            console.log(`That's not a valid move.  Try again, fathead!`);
            continue;
        }
        if(input.match(/^k.*g$/)) console.log('PICK OF DESTINY!!!!');

        // clean up the input, e.g., change "a  3" -> "a3".
        let from = parseMove(moveMatch[1]);
        let to = parseMove(moveMatch[2]);
        // do some validation.
        if(moveIsColumn(to) && moveColumnOffset(to) > 0) {
            console.log(`You can't specify offset, moving to a column!`);
            continue;
        }
        if(moveIsUpSuit(to) && moveIsColumn(from) && moveColumnOffset(from) != 0) {
            console.log(`You can't specify offset moving from column to upstack!`);
            continue;
        }
        if(moveIsKitty(to)) {
            console.log(`You can't move _to_ the kitty!`);
            continue;
        }
        // perform the move
        let fromCard;
        if(moveIsKitty(from)) {
            // moving from the kitty
            if(!kitty.length) {
                console.log(`You can't move _from_ an empty kitty!`);
                if(deck.length) console.log(`Try dealing first!`);
                continue;
            }
            fromCard = kitty[kitty.length - 1];
            // make sure it's a valid move
            if(!validateMove(fromCard,to,upSuits,board)) continue;
            // remove the card from the kitty
            kitty.pop();
            // perform the move.  Note we have a nice method so when we
            //  go to move we don't have to go through the same logic over
            //  and over and over.
            moveTo([ [ fromCard, true ] ],to,upSuits,board);
            continue;
        }
        if(moveIsUpSuit(from)) {
            // moving from the upSuit
            let fromColumn = moveUpSuitColumn(from);
            if(!upSuits[fromColumn].length) {
                console.log(`upSuits ${fromMatch[1]} is empty!`);
                continue;
            }
            let upSuitColumn = upSuits[fromColumn];
            fromCard = upSuitColumn[upSuitColumn.length - 1];
            if(!validateMove(fromCard,to,upSuits,board)) continue;
            upSuits[fromColumn].pop();
            moveTo([ [ fromCard, true ] ],to,upSuits,board);
            continue;
        }

        // moving from a column
        if(!moveIsColumn(from)) {
            // this shouldn't happen.  it's nice to throw an exception here,
            //  but that rudely terminates the program. with thousands of
            //  dollars riding in your professional vegas solitaire match,
            //  people gonna get sued.  So we'll print a nice message and
            //  continue.
            console.log `LOGIC ERROR! Oops, can't match from ${from}`;
            continue;
        }

        // get the specified column from the board.
        let fromColumn = board[moveColumnColumn(from)];

        if(!fromColumn.length) {
            console.log(`There are no cards in column ${columnLetterOf(moveColumnColumn(from))}`);
            continue;
        }

        // locate index of the card we're moving in the column
        let fromIndex = 0;

        // if they're moving card to upSuits, it can *only* be the last
        //  card visible in the column (we validated above...)
        if(moveIsUpSuit(to)) fromIndex = fromColumn.length - 1;
        else {
            // they're not moving the card to the upSuit, assume they're
            //  moving the visible card in the column
            while(fromIndex < fromColumn.length && !fromColumn[fromIndex][1]) fromIndex++;
            if(fromIndex >= fromColumn.length) {
                console.log(`There are no visible cards in column ${fromMatch[1]}`);
                continue;
            }

            // if they specified an offset, make sure there are enough
            //  visible cards to accomodate the request.
            if(fromIndex + moveColumnOffset(from) >= fromColumn.length) {
                    console.log(`Index ${visibleIndex} exceeds the number of visible cards (${fromColumn.length - fromIndex}) in column ${fromMatch[1]}`);
                }
            fromIndex += moveColumnOffset(from);
        }

        fromCard = fromColumn[fromIndex][0];
        if(fromCard == 'QH') console.log('The joker is the only foo-oo-ool, to do anything with you!');

        // make sure the card is valid
        if(!validateMove(fromCard,to,upSuits,board)) continue;

        // they might be moving a whack of cards
        let cards = fromColumn.splice(fromIndex,fromColumn.length - fromIndex);

        // if there're any cards left, be sure to turn the top one over by
        //  setting it's boolean value to true
        if(fromColumn.length && !fromColumn[fromColumn.length - 1][1]) fromColumn[fromColumn.length - 1][1] = true;

        moveTo(cards,to,upSuits,board);
    }
}

function parseMove(move) {
    let localMove = move.replaceAll(/\s+/g,'').toLowerCase();
    let localMoveMatch = localMove.match(/^([a-g])(\d*)$/);
    if(localMoveMatch) {
        // determine the index of the column; ascii magic: subtract the
        //  character code of 'a' from the character code of the column.
        let fromColumnIndex = columnIndexOf(localMoveMatch[1]);
        // they may not explicitly specify the offset in the column
        let index = 0;
        // assume 0; if they put a number in there, parse it.
        if(localMoveMatch[2].length) index = parseInt(localMoveMatch[2]);
        return [ 'column', fromColumnIndex, index ];
    }
    localMoveMatch = localMove.match(/^u([1-4])/);
    if(localMoveMatch) {
        return [ 'upSuit', parseInt(localMoveMatch[1]) - 1 ];
    }
    if(localMove.match(/^k(?:itty)?$/)) {
        return [ 'kitty' ];
    }
    throw `LOGIC ERROR - couldn't parse ${move}`;
}

function moveIsColumn(move) {
    return move[0] == 'column';
}

function moveColumnColumn(move) {
    if(move[0] != 'column') throw `LOGIC ERROR - move ${move} is not a column!`;
    return move[1];
}

function moveColumnOffset(move) {
    if(move[0] != 'column') throw `LOGIC ERROR - move ${move} is not a column!`;
    return move[2];
}

function moveIsUpSuit(move) {
    return move[0] == 'upSuit';
}

function moveUpSuitColumn(move) {
    if(move[0] != 'upSuit') throw `LOGIC ERROR - move ${move} is not an upSuit!`;
    return move[1];
}

function moveIsKitty(move) {
    return move[0] == 'kitty';
}

function validateMove(fromCard,to,upSuits,board) {
    let column;
    let fromValue;
    let toValue;
    let fromIndexOf;
    let toIndexOf;
    if(moveIsUpSuit(to)) {
        // they are moving to upSuits.
        let upSuit = upSuits[moveUpSuitColumn(to)];
        let fromCardValue = cardGetValue(fromCard);
        if(!upSuit.length) {
            if(fromCardValue == 0) return true;
            console.log(`You can only move an ace to an empty stack, not ${renderCard(fromCard)}!`);
            return false;
        }
        let upSuitCard = upSuit[upSuit.length - 1];
        // make sure the suit matches
        if(cardGetSuit(fromCard) != cardGetSuit(upSuitCard)) {
            console.log(`You can't move a ${renderSuit(fromCard)} in ${renderCard(fromCard)} to a stack of ${renderSuit(upSuitCard)}`);
            return false;
        }
        // make sure the card being moved is the next card for this suit.
        //  little surprising it's as difficult as it is to do this.
        let upSuitCardValue = cardGetValue(upSuitCard);
        if(fromCardValue != upSuitCardValue+ 1) {
            console.log(`Can't put ${renderCard(fromCard)} (${fromCardValue}) on ${renderCard(upSuit[upSuit.length - 1])} (${upSuitCardValue})`);
            return false;
        }
        return true;
    }

    // they're moving to a column on the board.  get the column to which
    //  they're moving
    let boardColumn = board[moveColumnColumn(to)];
    if(!boardColumn.length) {
        if(cardGetValue(fromCard) == values.length - 1) return true;
        console.log(`Can only move a King to empty column ${to}, not ${renderCard(fromCard)} :(`);
        return false;
    }
    if(!boardColumn[boardColumn.length - 1][1]) throw `Logic error - last card in ${to} is not visible :(`;

    // make sure they alternate suits
    let columnCard = boardColumn[boardColumn.length - 1][0];
    if(cardIsBlack(fromCard)) {
        if(cardIsBlack(columnCard)) {
            console.log(`Can't move black suit ${renderSuit(fromCard)} of ${renderCard(fromCard)} onto black suit ${renderSuit(columnCard)} of ${renderCard(columnCard)}`);
            return false;
        }
        // this is a really paranoid check
        if(!cardIsRed(columnCard)) throw `LOGIC ERROR! columnCard ${columnCard} of ${renderCard(columnCard)} isn't a blackSuit or a redSuit! :(`;
    }
    else if(cardIsRed(fromCard)) {
        if(cardIsRed(columnCard)) {
            console.log(`Can't move red suit ${renderSuit(fromCard)} of ${renderCard(fromCard)} onto red suit ${renderSuit(columnCard)} of ${renderCard(columnCard)}`);
            return false;
        }
        // this is a really paranoid check
        if(!cardIsBlack(columnCard)) throw `LOGIC ERROR! columnCard ${columnCard} of ${renderCard(columnCard)} isn't a redSuit or a blackSuit! :(`;
    }
    else throw `LOGIC ERROR! fromCard ${fromCard} of ${renderCard(fromCard)} isn't a blackSuit or a redSuit! :(`;

    // now validate that the card being moved is the next lower card to
    //  what's on the destination: e.g., 8 can go on 9
    fromValue = cardGetValue(fromCard);
    toValue = cardGetValue(columnCard);
    // NOTE - this is the _opposite_ logic we checked when moving to
    //  upSuits, because upSuits increase but moving to a column on the
    //  board, the card values decrease.
    if(toValue != fromValue + 1) {
        console.log(`Can't put ${renderCard(fromCard)} (${fromValue}) on ${renderCard(columnCard)} (${toValue})`);
        return false;
    }
    return true;
}

function checkWinner(board,deck,kitty,upSuits) {
    // player wins if all the board columns are empty...
    for(let column of board) {
        if(column.length) return false;
    }
    // ...and if the deck and kitty are both empty...
    if(deck.length || kitty.length) return false;
    // ...we infer the cards must all be in upSuits.
    // let's go ahead and validate the upSuits have 13 cards each
    for(let upSuitIndex in upSuits) if(upSuits[upSuitIndex].length != 13) throw `upSuit ${upSuitIndex} does not have length 13!`;
    // n.b.: how this ugly thing works to produce a pretty picture is a
    //  trade secret, I'm afraid, and is the sort of thing which
    //  distinguishes your bush league hackers from your professional
    //  implementors of solitaire.
    console.log('\\\\              //');
    console.log(' \\\\            //');
    console.log('  \\\\    /\\    //    INNER!');
    console.log('   \\\\  //\\\\  //');
    console.log('    \\\\//  \\\\//');
    return true;
}

function moveTo(fromCards,to,upSuits,board) {
    let column;
    if(moveIsUpSuit(to)) {
        // moving to an upSuit?
        if(fromCards.length != 1) throw `LOGIC ERROR! - can't move ${fromCards.length} card(s) to upSuit!`;

        upSuits[moveUpSuitColumn(to)].push(fromCards[0][0]);

        return;
    }

    // moving to a board column.
    board[moveColumnColumn(to)].push(...fromCards);
}

function doFini(board,upSuits) {
    for(let column of board) {
        if(!column.length) continue;
        let lastCard = column[column.length - 1][0];
        let suit = cardGetSuit(lastCard);
        let suitMatch = false;
        let upCard;
        let upSuitIndex;
        let upSuit;
        for(upSuitIndex = 0; upSuitIndex < upSuits.length; upSuitIndex++) {
            upSuit = upSuits[upSuitIndex];
            if(!upSuit.length) continue;
            upCard = upSuit[upSuit.length - 1];
            let upSuitSuit = cardGetSuit(upCard);
            if(upSuitSuit != suit) continue;
            suitMatch = true;
            break;
        }
        if(!suitMatch) continue;
        let value = cardGetValue(lastCard);
        let upValue = cardGetValue(upCard);
        if(value != upValue + 1) continue;
        column.pop();
        upSuit.push(lastCard);
        // show last card if not shown.
        if(column.length && !column[column.length - 1][1]) column[column.length - 1][1] = true;
        return true;
    }
    return false
}

function cardIsRed(card) {
    return redSuits.indexOf(cardGetSuit(card)) != -1;
}

function cardIsBlack(card) {
    return blackSuits.indexOf(cardGetSuit(card)) != -1;
}

function cardGetSuit(card) {
    if(!card.hasOwnProperty('length') || card.length != 2) throw `The thing ${card} passed to me doesn't look like a card`;
    if(!suitCharacterMap.hasOwnProperty(card[1])) throw `Couldn't determine the suit of ${card} from ${card[1]}`;
    return card[1];
}

function cardGetValue(card) {
    if(!card.hasOwnProperty('length') || card.length != 2) throw `The thing ${card} passed to me doesn't look like a card`;
    let value = values.indexOf(card[0]);
    if(value == -1) throw `Couldn't determine the value of ${card} from ${card[0]}`;
    return value;
}

function renderBoard(board,deck,kitty,upSuits) {
    let line = '';
    // 1st line - render the deck 
    if(deck.length) line += 'XXX';
    else line += '___';
    line += ' ';
    // render the kitty
    for(let i = 0; i < 3; i++) {
        line += ' | ';
        let kittyIndex = kitty.length - (3 - i);
        if(kittyIndex >= 0) line += renderCard(kitty[kittyIndex]);
        else line += '   ';
    }
    line += ' |    | ';
    // render the upSuits.
    let first = true;
    for(let suit of upSuits) {
        if(!first) line += ' | ';
        first = false;
        if(!suit.length) { line += '   '; continue; }
        let last = suit[suit.length - 1];
        line += renderCard(last);
    }
    line += ' |';
    console.log(line);
    // end of the first line
    // second line - render some helpful text, indicate what cards are
    //  in the kitty...
    line = '         k  i  t  t  y        ';
    first = true;
    // ...and what labels are on the upSuits
    for(let suitIndex in upSuits) {
        if(!first) line += '   ';
        first = false;
        line += `U ${parseInt(suitIndex) + 1}`;
    }
    console.log(line);
    console.log();
    // now we can render the board.
    let vIndex = 0;
    let count = 0;
    // while true.  Whatever you do, don't ever ever ever implement a while
    //  true, unless it makes sense to.
    while(true) {
        line = '        ';
        let any = false;
        for(let column of board) {
            if(vIndex >= column.length) {
                // if the line is empty, and this is the first row of the
                //  column from the top, put some underscores as a visual
                //  cue that the column is empty.  Note we check this is
                //  the first row of the column so we don't have a column
                //  of underscores, which, trust me, is unsightly 🙄
                if(!column.length && !vIndex) line += '___    ';
                else line += '       ';
                continue;
            }
            let card = column[vIndex];
            if(card[1]) line += renderCard(card[0]);
            else line += 'XXX';
            line += '    ';
            any = true;
        }
        console.log(line);
        if(!any) break;
        vIndex++;

        // paranoia will destroya.  In a while true loop, it can be stupid
        //  hard to kill a program running in a terminal in a while-true
        //  loop gone bad.  We'll never have 100 lines of output rendering
        //  the board, so this is just for sanity.
        // n.b.: trying to get stupid node readline to work on stupid
        //  windows, I had a while-true loop (the main game loop) that I
        //  couldn't break with ctrl-c; true story, thank you bro it is a 
        //  cool one, too!
        count++;
        if(count >= 100) throw `something bad happened!`;
    }
    // finally, last line is labels for the columns.
    line = '        ';
    for(let i = 0; i < 7; i++) {
        line += ` ${columnLetterOf(i)}     `
    }
    console.log(line);
    console.log();
}

// credit where it's due - https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html
function renderCard(card) {
    let value = card[0];
    // bright white.
    let result = '\u001b[37;1m';
    // cards render in 3 characters; so pad '4C' so it and '10C' take the same
    //  space
    if(value != '10') result += ' ';
    result += value;
    // reset color.
    result += '\u001b[0m';
    result += renderSuit(card);
    return result;
}

function renderSuit(card) {
    let suit = cardGetSuit(card);

    let result = '';

    // if it's a red suit, render suit in red; otherwise default to white on
    //  black for clubs/spades
    if(redSuits.indexOf(suit) != -1) result += '\u001b[31;1m';
    result += suitCharacterMap[suit];
    if(redSuits.indexOf(suit) != -1) result += '\u001b[0m';

    return result;
}

function columnLetterOf(columnIndex) {
    return String.fromCharCode('A'.charCodeAt(0) + columnIndex);
}

function columnIndexOf(columnLetter) {
    return columnLetter.charCodeAt(0) - 'a'.charCodeAt(0);
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
/*
cheatz

    upSuits = [ [ 'AH' ], [ 'AD' ], [ 'AC' ], [ 'AS' ] ];
    board = [
        [ [ [ 'K', 'D' ], true ], [ [ 'Q', 'C' ], true ], [ [ 'J', 'D' ], true ], [ [ '10', 'C' ], true ], [ [ '9', 'D' ], true ], [ [ '8', 'C' ], true ], [ [ '7', 'D' ], true ], [ [ '6', 'C' ], true ], [ [ '5', 'D' ], true ], [ [ '4', 'C' ], true ], [ [ '3', 'D' ], true ], [ [ '2', 'C' ], true ] ],
        [ [ [ 'K', 'S' ], true ], [ [ 'Q', 'D' ], true ], [ [ 'J', 'S' ], true ], [ [ '10', 'D' ], true ], [ [ '9', 'S' ], true ], [ [ '8', 'D' ], true ], [ [ '7', 'S' ], true ], [ [ '6', 'D' ], true ], [ [ '5', 'S' ], true ], [ [ '4', 'D' ], true ], [ [ '3', 'S' ], true ], [ [ '2', 'D' ], true ] ],
        [ [ [ 'K', 'H' ], true ], [ [ 'Q', 'S' ], true ], [ [ 'J', 'H' ], true ], [ [ '10', 'S' ], true ], [ [ '9', 'H' ], true ], [ [ '8', 'S' ], true ], [ [ '7', 'H' ], true ], [ [ '6', 'S' ], true ], [ [ '5', 'H' ], true ], [ [ '4', 'S' ], true ], [ [ '3', 'H' ], true ], [ [ '2', 'S' ], true ] ],
        [ [ [ 'K', 'C' ], true ], [ [ 'Q', 'H' ], true ], [ [ 'J', 'C' ], true ], [ [ '10', 'H' ], true ], [ [ '9', 'C' ], true ], [ [ '8', 'H' ], true ], [ [ '7', 'C' ], true ], [ [ '6', 'H' ], true ], [ [ '5', 'C' ], true ], [ [ '4', 'H' ], true ], [ [ '3', 'C' ], true ], [ [ '2', 'H' ], true ] ],
        [ ],
        [ ],
        [ ]
        ];
    deck = [];

 */
