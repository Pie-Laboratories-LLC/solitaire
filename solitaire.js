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
    // upsuits is where we keep the cards ace to king of each suit.  an
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
                console.log(`${deck.length ? "Deck is not empty; ":""}${!kitty.length ? "Upstack is empty; ": ""}can't redeal; something's broken!`);
                continue;
            }
            // this restores the deck, without shuffling.
            while(kitty.length) deck.push(kitty.shift());
            continue;
        }
        // how player can specify the location:
        // 1) kitty 2) u1-u4 for upsuite 3) a-g for column, or a1 to mean
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
        let from = moveMatch[1].replaceAll(/\s+/g,'').toLowerCase();
        let to = moveMatch[2].replaceAll(/\s+/g,'').toLowerCase();
        // do some validation.
        if(to.match(/^[a-g]/) && to.match(/\d$/)) {
            console.log(`You can't specify offset, moving to a column!`);
            continue;
        }
        if(to.match(/^u/) && from.match(/^[a-g]/) && from.match(/\d$/)) {
            console.log(`You can't specify offset moving from column to upstack!`);
            continue;
        }
        if(to.match(/^k(?:itty)?$/)) {
            console.log(`You can't move _to_ the kitty!`);
            continue;
        }
        // perform the move
        let fromCard;
        if(from.match(/^k(?:itty)?$/)) {
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
            moveTo(fromCard,to,upSuits,board);
            continue;
        }
        let fromMatch = from.match(/^u(\d+)$/);
        if(fromMatch) {
            // moving from the upsuite
            let fromColumn = parseInt(fromMatch[1]) - 1;
            if(!upSuits[fromColumn].length) {
                console.log(`upSuits ${fromMatch[1]} is empty!`);
                continue;
            }
            fromCard = upSuits[fromColumn][upSuits[fromColumn].length - 1];
            if(!validateMove(fromCard,to,upSuits,board)) continue;
            upSuits[fromColumn].pop();
            moveTo(fromCard,to,upSuits,board);
            continue;
        }

        // moving from a column
        fromMatch = from.match(/^([a-g])(\d*)$/);
        if(!fromMatch) {
            // this shouldn't happen.  it's nice to throw an exception here,
            //  but that rudely terminates the program. with thousands of
            //  dollars riding in your professional vegas solitaire match,
            //  people gonna get sued.  So we'll print a nice message and
            //  continue.
            console.log `LOGIC ERROR! Oops, can't match from ${from}`;
            continue;
        }
        // ascii magic.  Figre out the index in the board - an array of
        //  columns - of the column from which they're moving
        let fromColumnIndex = fromMatch[1].charCodeAt(0) - 'a'.charCodeAt(0);

        // get the specified column from the board.
        let fromColumn = board[fromColumnIndex];

        if(!fromColumn.length) {
            console.log(`There are no cards in column ${fromMatch[1]}`);
            continue;
        }

        // locate index of first visible card in the column
        let fromIndex = 0;

        // if they're moving card to upsuits, it can *only* be the last
        //  card visible in the column (we validated above...)
        if(to.match(/^u/i)) fromIndex = fromColumn.length - 1;
        else {
            // they're not moving the card to the upsuite, assume first
            //  visible card in the column
            while(fromIndex < fromColumn.length && !fromColumn[fromIndex][1]) fromIndex++;
            if(fromIndex >= fromColumn.length) {
                console.log(`There are no visible cards in column ${fromMatch[1]}`);
                continue;
            }

            // if they don't want to move all the visible cards, verify there are
            //  enough visible cards to accomodate the request.
            if(fromMatch[2].length) {
                let visibleIndex = parseInt(fromMatch[2]);
                if(fromIndex + visibleIndex >= fromColumn.length) {
                    console.log(`Index ${visibleIndex} exceeds the number of visible cards (${fromColumn.length - fromIndex}) in column ${fromMatch[1]}`);
                }
                fromIndex += visibleIndex;
            }
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

        // it's quite upsetting to copy and paste this logic from
        //  performMove :(  it was such a nice method, but alas, here the
        //  player may be moving a whack of cards rather than just one.
        let toMatch = to.match(/^u(\d+)/i);
        let column;
        if(toMatch) {
            column = parseInt(toMatch[1]) - 1;
            if(cards.length > 1) throw `Logic error; we validated you can't take more than one column when moving to upSuits :(!`;
            upSuits[column].push(cards[0][0]);
            continue;
        }
        column = to.charCodeAt(0) - 'a'.charCodeAt(0);
        board[column].splice(board[column].length,0,...cards);
    }
}

function validateMove(fromCard,to,upSuits,board) {
    let column;
    let fromValue;
    let toValue;
    let fromIndexOf;
    let toIndexOf;
    let toMatch = to.match(/^u(\d+)/i);
    if(toMatch) {
        // they are moving to upsuites.
        column = parseInt(toMatch[1]) - 1;
        let upSuit = upSuits[column];
        if(!upSuit.length) {
            if(fromCard[0] == 'A') return true;
            console.log(`You can only move an ace to an empty stack!`);
            return false;
        }
        // make sure the suit matches
        if(fromCard[1] != upSuit[upSuit.length - 1][1]) {
            console.log(`You can't move a ${renderSuit(fromCard[1])} to a stack of ${renderSuit(upSuit[upSuit.length - 1][1])}`);
            return false;
        }
        // make sure the card being moved is the next card for this suit.
        //  little surprising it's as difficult as it is to do this.
        fromValue = fromCard[0];
        toValue = upSuit[upSuit.length - 1][0];
        fromIndexOf = values.indexOf(fromValue);
        toIndexOf = values.indexOf(toValue);
        if(fromIndexOf == -1) {
            console.log(`LOGIC ERROR! Couldn't find index of ${fromValue} in values :(`);
            return false;
        }
        if(toIndexOf == -1) {
            console.log(`LOGIC ERROR! Couldn't find index of ${toValue} in values :(`);
            return false;
        }
        if(fromIndexOf != toIndexOf + 1) {
            console.log(`Can't put ${renderCard(fromCard)} (${fromIndexOf}) on ${renderCard(upSuit[upSuit.length - 1])} (${toIndexOf})`);
            return false;
        }
        return true;
    }
    // they're moving to a column on the board.  more ascii magic.
    column = to.charCodeAt(0) - 'a'.charCodeAt(0);

    // get the column to which they're moving
    let boardColumn = board[column];
    if(!boardColumn.length) {
        if(fromCard[0] == 'K') return true;
        console.log(`Can only move a King to empty column ${to}, not ${renderCard(fromCard)} :(`);
        return false;
    }
    if(!boardColumn[boardColumn.length - 1][1]) throw `Logic error - last card in ${to} is not visible :(`;

    // make sure they alternate suits
    let fromSuit = fromCard[1];
    let toSuit = boardColumn[boardColumn.length - 1][0][1];
    if(blackSuits.indexOf(fromSuit) != -1) {
        if(blackSuits.indexOf(toSuit) != -1) {
            console.log(`Can't move black suit ${renderSuit(fromSuit)} of ${renderCard(fromCard)} onto black suit ${renderSuit(toSuit)} of ${renderCard(boardColumn[boardColumn.length - 1][0])}`);
            return false;
        }
        if(redSuits.indexOf(toSuit) == -1) {
            console.log(`LOGIC ERROR! toSuit ${toSuit} isn't a blackSuit or a redSuit! :(`);
            return false;
        }
    }
    else if(redSuits.indexOf(fromSuit) != -1) {
        if(redSuits.indexOf(toSuit) != -1) {
            console.log(`Can't move red suit ${renderSuit(fromSuit)} of ${renderCard(fromCard)} onto red suit ${renderSuit(toSuit)} of ${renderCard(boardColumn[boardColumn.length - 1][0])}`);
            return false;
        }
        if(blackSuits.indexOf(toSuit) == -1) {
            console.log(`LOGIC ERROR! toSuit ${toSuit} isn't a redSuit or a blackSuit! :(`);
            return false;
        }
    }
    else {
        console.log(`LOGIC ERROR! fromSuit ${fromSuit} isn't a blackSuit or a redSuit! :(`);
        return false;
    }

    // now validate that the card being moved is the next lower card to
    //  what's on the destination: e.g., 8 can go on 9
    fromValue = fromCard[0];
    toValue = boardColumn[boardColumn.length - 1][0][0];
    fromIndexOf = values.indexOf(fromValue);
    toIndexOf = values.indexOf(toValue);
    if(fromIndexOf == -1) {
        console.log(`Couldn't find index of ${fromValue} in values :(`);
        return false;
    }
    if(toIndexOf == -1) {
        console.log(`Couldn't find index of ${toValue} in values :(`);
        return false;
    }
    // NOTE - this is the _opposite_ logic we checked when moving to
    //  upSuits, because upSuits increase but moving to a column on the
    //  board, the card values decrease.
    if(toIndexOf != fromIndexOf + 1) {
        console.log(`Can't put ${renderCard(fromCard)} (${fromIndexOf}) on ${renderCard(boardColumn[boardColumn.length - 1][0])} (${toIndexOf})`);
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
    // ...we infer the cards must all be in upSuits.  It wouldn't be wrong
    //  to check the length of each upSuits column is 13, but the logic
    //  of midieval monks prevails for the nonce.
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

function moveTo(fromCard,to,upSuits,board) {
    let toMatch = to.match(/^u(\d+)/i);
    let column;
    if(toMatch) {
        // moving to an upSuit?
        column = parseInt(toMatch[1]) - 1;
        upSuits[column].push(fromCard);
        return;
    }
    // moving to a board column.  NOTE - moving to the board column,
    //  of course it's a face up card.
    column = to.charCodeAt(0) - 'a'.charCodeAt(0);
    board[column].push([fromCard,true]);
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
        line += ` ${String.fromCharCode('A'.charCodeAt() + i)}     `
    }
    console.log(line);
    console.log();
}

// credit where it's due - https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html
function renderCard(card) {
    let suit = card[1];
    let value = card[0];
    // bright white.
    let result = '\u001b[37;1m';
    // cards render in 3 characters; so pad '4C' so it and '10C' take the same
    //  space
    if(value != '10') result += ' ';
    result += value;
    // reset color.
    result += '\u001b[0m';
    result += renderSuit(suit);
    return result;
}

function renderSuit(suit) {
    // make sure we recognize the suit.
    if(!suitCharacterMap.hasOwnProperty(suit)) throw `LOGIC ERROR ${suit}!`;

    let result = '';

    // if it's a red suit, render suit in red; otherwise default to white on
    //  black for clubs/spades
    if(redSuits.indexOf(suit) != -1) result += '\u001b[31;1m';
    result += suitCharacterMap[suit];
    if(redSuits.indexOf(suit) != -1) result += '\u001b[0m';

    return result;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
