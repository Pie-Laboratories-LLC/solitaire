const readline = require('readline-sync');
const sleep = require('system-sleep');

const suits = [ 'C', 'S', 'D', 'H' ];
const redSuits = [ 'D', 'H' ];
const blackSuits = [ 'C', 'S' ];
// n.b. - is the ace high or low?
const cards = [ 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K' ];
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
        for(let card of cards) {
            deck.push(`${card}${suit}`);
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
    let lastLineCount = 0;
    let extraLineCount = 0;
    let fini = false;
    while(true) {
        if(extraLineCount) console.log(`\u001b[${extraLineCount}A`);
        extraLineCount = 0;
        // draw the board
        lastLineCount = renderBoard(board,deck,kitty,upSuits,lastLineCount);
        // if the player's won the game, it's game over!
        if(checkWinner(board,deck,kitty,upSuits)) return;

        if(fini) {
            if(doFini(board,upSuits)) { 
                sleep(500);
                extraLineCount += 2; 
                continue;
            }
            console.log('Fini finished :(');
            fini = false;
            extraLineCount++;
        }

        // if there are cards on the deck still, player can deal to the
        //  kitty
        if(deck.length) { console.log('\u001b[2K1) deal to kitty'); extraLineCount++; }
        // if there are no cards on the deck and cards in the kitty, the
        //  player can reset the kitty to the deck
        else if(kitty.length) { console.log('\u001b[2K2) redeal'); extraLineCount++; }
        // when life gives you lemons, give up in existential despair
        console.log('\u001b[2K3) quit');
        console.log('\u001b[2KOr, enter move');
        console.log('\u001b[2K');
        // get input from player
        let input = readline.question('\u001b[2K-> ');
        extraLineCount += 6;
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
                extraLineCount++;
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
        if(input == 'fini') {
            fini = true;
            doFini(board,upSuits);
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
            extraLineCount++;
            continue;
        }
        if(input.match(/^k.*g$/)) { console.log('PICK OF DESTINY!!!!'); extraLineCount++ }

        // clean up the input, e.g., change "a  3" -> "a3".
        let from = moveMatch[1].replaceAll(/\s+/g,'').toLowerCase();
        let to = moveMatch[2].replaceAll(/\s+/g,'').toLowerCase();
        // do some validation.
        if(to.match(/^[a-g]/) && to.match(/\d$/)) {
            console.log(`You can't specify offset, moving to a column!`);
            extraLineCount++;
            continue;
        }
        if(to.match(/^u/) && from.match(/^[a-g]/) && from.match(/\d$/)) {
            console.log(`You can't specify offset moving from column to upstack!`);
            extraLineCount++;
            continue;
        }
        if(to.match(/^k(?:itty)?$/)) {
            console.log(`You can't move _to_ the kitty!`);
            extraLineCount++;
            continue;
        }
        // perform the move
        let fromCard;
        if(from.match(/^k(?:itty)?$/)) {
            // moving from the kitty
            if(!kitty.length) {
                console.log(`You can't move _from_ an empty kitty!`);
                extraLineCount++;
                if(deck.length) { console.log(`Try dealing first!`); extraLineCount++; }
                continue;
            }
            fromCard = kitty[kitty.length - 1];
            // make sure it's a valid move
            if(!validateMove(fromCard,to,upSuits,board)) { extraLineCount++; continue; }
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
                extraLineCount++;
                continue;
            }
            fromCard = upSuits[fromColumn][upSuits[fromColumn].length - 1];
            if(!validateMove(fromCard,to,upSuits,board)) { extraLineCount++; continue; }
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
            extraLineCount++;
            continue;
        }
        // ascii magic.  Figre out the index in the board - an array of
        //  columns - of the column from which they're moving
        let fromColumnIndex = fromMatch[1].charCodeAt(0) - 'a'.charCodeAt(0);

        // get the specified column from the board.
        let fromColumn = board[fromColumnIndex];

        if(!fromColumn.length) {
            console.log(`There are no cards in column ${fromMatch[1]}`);
            extraLineCount++;
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
                extraLineCount++;
                continue;
            }

            // if they don't want to move all the visible cards, verify there are
            //  enough visible cards to accomodate the request.
            if(fromMatch[2].length) {
                let visibleIndex = parseInt(fromMatch[2]);
                if(fromIndex + visibleIndex >= fromColumn.length) {
                    console.log(`Index ${visibleIndex} exceeds the number of visible cards (${fromColumn.length - fromIndex}) in column ${fromMatch[1]}`);
                    extraLineCount++;
                    continue;
                }
                fromIndex += visibleIndex;
            }
        }

        fromCard = fromColumn[fromIndex][0];
        if(fromCard == 'QH') { console.log('The joker is the only foo-oo-ool, to do anything with you!'); extraLineCount++ }

        // make sure the card is valid
        if(!validateMove(fromCard,to,upSuits,board)) { extraLineCount++; continue; }

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
            if(fromCard.match(/^a/i)) return true;
            console.log(`You can only move an ace to an empty stack!`);
            return false;
        }
        // make sure the suit matches
        if(fromCard[fromCard.length - 1].toLowerCase() != upSuit[0][upSuit[0].length - 1].toLowerCase()) {
            console.log(`You can't move a ${fromCard[fromCard.length - 1].toUpperCase()} to a stack of ${upSuit[0].toUpperCase()}`);
            return false;
        }
        // make sure the card being moved is the next card for this suit.
        //  little surprising it's as difficult as it is to do this.
        fromValue = fromCard.substring(0, fromCard.length - 1);
        toValue = upSuit[upSuit.length - 1].substring(0, upSuit[upSuit.length - 1].length - 1);
        fromIndexOf = cards.indexOf(fromValue);
        toIndexOf = cards.indexOf(toValue);
        if(fromIndexOf == -1) {
            console.log(`LOGIC ERROR! Couldn't find index of ${fromValue} in cards :(`);
            return false;
        }
        if(toIndexOf == -1) {
            console.log(`LOGIC ERROR! Couldn't find index of ${toValue} in cards :(`);
            return false;
        }
        if(fromIndexOf != toIndexOf + 1) {
            console.log(`Can't put ${fromCard} (${fromIndexOf}) on ${upSuit[upSuit.length - 1]} (${toIndexOf})`);
            return false;
        }
        return true;
    }
    // they're moving to a column on the board.  more ascii magic.
    column = to.charCodeAt(0) - 'a'.charCodeAt(0);

    // get the column to which they're moving
    let boardColumn = board[column];
    if(!boardColumn.length) {
        if(fromCard.startsWith('K')) return true;
        console.log(`Can only move a King to empty column ${to}, not ${fromCard} :(`);
        return true;
    }
    if(!boardColumn[boardColumn.length - 1][1]) throw `Logic error - last card in ${to} is not visible :(`;

    // make sure they alternate suits
    let fromSuit = fromCard[fromCard.length - 1];
    let toSuit = boardColumn[boardColumn.length - 1][0][boardColumn[boardColumn.length - 1][0].length - 1];
    if(blackSuits.indexOf(fromSuit) != -1) {
        if(blackSuits.indexOf(toSuit) != -1) {
            console.log(`Can't move black suit ${fromSuit} of ${fromCard} onto black suit ${toSuit} of ${boardColumn[boardColumn.length - 1][0]}`);
            return false;
        }
        if(redSuits.indexOf(toSuit) == -1) {
            console.log(`LOGIC ERROR! toSuit ${toSuit} isn't a blackSuit or a redSuit! :(`);
            return false;
        }
    }
    else if(redSuits.indexOf(fromSuit) != -1) {
        if(redSuits.indexOf(toSuit) != -1) {
            console.log(`Can't move red suit ${fromSuit} of ${fromCard} onto red suit ${toSuit} of ${boardColumn[boardColumn.length - 1][0]}`);
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
    //  what's on the destination: e.g., 8 can go on 9.
    fromValue = fromCard.substring(0, fromCard.length - 1);
    toValue = boardColumn[boardColumn.length - 1][0].substring(0, boardColumn[boardColumn.length - 1][0].length - 1);
    fromIndexOf = cards.indexOf(fromValue);
    toIndexOf = cards.indexOf(toValue);
    if(fromIndexOf == -1) {
        console.log(`Couldn't find index of ${fromValue} in cards :(`);
        return false;
    }
    if(toIndexOf == -1) {
        console.log(`Couldn't find index of ${toValue} in cards :(`);
        return false;
    }
    // NOTE - this is the _opposite_ logic we checked when moving to
    //  upSuits, because upSuits increase but moving to a column on the
    //  board, the card values decrease.
    if(toIndexOf != fromIndexOf + 1) {
        console.log(`Can't put ${fromCard} (${fromIndexOf}) on ${boardColumn[boardColumn.length - 1][0]} (${toIndexOf})`);
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

function renderBoard(board,deck,kitty,upSuits,lastLineCount) {
    let lines = [];
    let line = '';
    // 1st line - render the deck 
    if(deck.length) line += 'XXX';
    else line += '___';
    line += ' ';
    // render the kitty
    for(let i = 0; i < 3; i++) {
        line += ' | ';
        let kittyIndex = kitty.length - (3 - i);
        if(kittyIndex >= 0) {
            line += renderCard(kitty[kittyIndex]);
        }
        else {
            line += '   ';
        }
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
    lines.push(line);
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
    lines.push(line);
    lines.push('');
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
            if(card[1]) {
                line += renderCard(card[0]);
            }
            else line += 'XXX';
            line += '    ';
            any = true;
        }
        lines.push(line);
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
    lines.push(line);
    lines.push('');
    if(lastLineCount) console.log(`\u001b[${lastLineCount}A`);
    for(let line of lines) {
        console.log(`\u001b[2K${line}`);
    }
    if(lines.length < lastLineCount) {
        for(let index = lines.length; index < lastLineCount; index++) {
            console.log(`\u001b[2K`);
        }
        console.log(`\u001b[${lastLineCount - lines.length + 1}A`);
    }
    return lines.length;
}

function renderCard(card) {
    if(!card.length) throw `LOGIC ERROR!`;
    let suit = card[card.length - 1];
    if(!suitCharacterMap.hasOwnProperty(suit)) throw `LOGIC ERROR!`;
    let value = card.substring(0,card.length - 1);
    let result = '\u001b[37;1m';
    if(value != '10') result += ' ';
    result += value;
    result += '\u001b[0m';
    if(redSuits.indexOf(suit) != -1) result += '\u001b[31;1m';
    result += suitCharacterMap[suit];
    if(redSuits.indexOf(suit) != -1) result += '\u001b[0m';
    return result;
}

function doFini(board,upSuits) {
    for(let column of board) {
        if(!column.length) continue;
        let lastCard = column[column.length - 1][0];
        let suit = lastCard[lastCard.length - 1];
        let suitMatch = false;
        let upCard;
        let upSuitIndex;
        let upSuit;
        for(upSuitIndex = 0; upSuitIndex < upSuits.length; upSuitIndex++) {
            upSuit = upSuits[upSuitIndex];
            if(!upSuit.length) continue;
            upCard = upSuit[upSuit.length - 1];
            let upSuitSuit = upCard[upCard.length - 1];
            if(upSuitSuit != suit) continue;
            suitMatch = true;
            break;
        }
        if(!suitMatch) continue;
        let value = lastCard.substring(0, lastCard.length - 1);
        let upValue = upCard.substring(0, upCard.length - 1);
        let valueIndex = cards.indexOf(value);
        let upValueIndex = cards.indexOf(upValue);
        if(valueIndex == -1 || upValueIndex == -1) return false;
        if(valueIndex != upValueIndex + 1) continue;
        column.pop();
        upSuit.push(lastCard);
        // show last card if not shown.
        if(column.length && !column[column.length - 1][1]) column[column.length - 1][1] = true;
        return true;
    }
    return false
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
