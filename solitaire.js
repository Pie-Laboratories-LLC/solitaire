import * as readline from 'readline-sync';

import SolitaireGame from './SolitaireGame.js';
import { SolitaireBoard } from './SolitaireBoard.js';
import { CardSuit } from './Card.js';
import { Location } from './Location.js';
import GameResponse from './GameResponse.js';
import GameMessage from './GameMessage.js';

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
    let game = new SolitaireGame(renderCard,renderSuit);

    let result;

    // game loop!
    while(true) {
        if(result && result.messages) {
            for(let response of result.messages) renderMessage(response)
        }

        // draw the board
        renderGame(game);

        // if the player's won the game, it's game over!
        if(game.isWinner()) {
            // n.b.: how this ugly thing works to produce a pretty picture is a
            //  trade secret, I'm afraid, and is the sort of thing which
            //  distinguishes your bush league hackers from your professional
            //  implementors of solitaire.
            console.log('\\\\              //');
            console.log(' \\\\            //');
            console.log('  \\\\    /\\    //    INNER!');
            console.log('   \\\\  //\\\\  //');
            console.log('    \\\\//  \\\\//');
            return;
        }

        // if there are cards on the deck still, player can deal to the
        //  kitty
        if(game.deckLength) console.log('1) deal to kitty');
        // if there are no cards on the deck and cards in the kitty, the
        //  player can reset the kitty to the deck
        else if(game.kittyLength) console.log('2) redeal');
        // when life gives you lemons, give up in existential despair
        console.log('3) quit');
        console.log('Or, enter move');
        // get input from player
        let input = readline.question('-> ');

        // figure out what to do with input
        if(input == '1') result = game.dealToKitty();
        else if(input == '2') result = game.redeal();
        else if(input == '3') {
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
        else if(input == 'fini') {
            while(game.doFini()) ;
            let response = [
                new GameMessage('Fini Finished.')
            ];
            result = new GameResponse(true, response);
        }
        else {
            let moveMatch = input.match(SolitaireGame.MOVE_REGEX);
            // make sure it's a valid move
            if(!moveMatch) {
                let response = [
                    new GameMessage(`That's not a valid move.  Try again, fathead!`)
                ]
                result = new GameResponse(false, response);
                continue;
            }

            // clean up the input, e.g., change "a  3" -> "a3".
            let from = new Location(moveMatch[1]);
            let to = new Location(moveMatch[2]);
            result = game.performMove(from,to);
        }
    }
}

function renderMessage(message) {
    console.log(message.message);
}

function renderGame(game) {
    let cardCount = game.deckLength + game.kittyLength;
    for(let index = 0; index < game.columnCount; index++) {
        let columnLength = game.getColumnLength(index);
        cardCount += columnLength[0];
    }
    for(let index = 0; index < game.upSuitCount; index++) cardCount += game.getUpSuitLength(index);
    console.log(`*** cardCount ${cardCount} ***`);

    let line = '';
    // 1st line - render the deck 
    if(game.deckLength) line += 'XXX';
    else line += '___';
    line += ' ';
    // render the kitty
    let kitty = game.kitty;
    for(let i = 0; i < 3; i++) {
        line += ' | ';
        let kittyIndex = kitty.length - (3 - i);
        if(kittyIndex >= 0) line += renderCard(kitty[kittyIndex]);
        else line += '   ';
    }
    line += ' |    | ';
    // render the upSuits.
    let first = true;
    for(let index = 0; index < game.upSuitCount; index++) {
        if(!first) line += ' | ';
        first = false;
        if(!game.getUpSuitLength(index)) { line += '   '; continue; }
        let upSuitCard = game.peekUpSuit(index);
        line += renderCard(upSuitCard);
    }
    line += ' |';
    console.log(line);
    // end of the first line
    // second line - render some helpful text, indicate what cards are
    //  in the kitty...
    line = '         k  i  t  t  y        ';
    first = true;
    // ...and what labels are on the upSuits
    for(let index = 0; index < game.upSuitCount; index++) {
        if(!first) line += '   ';
        first = false;
        line += `U ${parseInt(index) + 1}`;
    }
    console.log(line);
    console.log();
    // now we can render the board.
    let offset = 0;
    let count = 0;
    // while true.  Whatever you do, don't ever ever ever implement a while
    //  true, unless it makes sense to.
    while(true) {
        line = '        ';
        let any = false;
        for(let index = 0; index < game.columnCount; index++) {
            let columnLength = game.getColumnLength(index);
            if(offset >= columnLength[0]) {
                // if the line is empty, and this is the first row of the
                //  column from the top, put some underscores as a visual
                //  cue that the column is empty.  Note we check this is
                //  the first row of the column so we don't have a column
                //  of underscores, which, trust me, is unsightly 🙄
                if(!columnLength[0] && !offset) line += '___    ';
                else line += '       ';
                continue;
            }
            // if card is not visible, indicate so; otherwise, show the up card
            if(offset < columnLength[1]) line += 'XXX';
            else line += renderCard(game.peekColumnCard(index,offset));
            line += '    ';
            any = true;
        }
        console.log(line);
        if(!any) break;
        offset++;

        // paranoia will destroya.  In a while true loop, it can be stupid
        //  hard to kill a program running in a terminal in a while-true
        //  loop gone bad.  We'll never have 100 lines of output rendering
        //  the board, so this is just for sanity.
        // n.b.: trying to get stupid node readline to work on stupid
        //  windows, I had a while-true loop (the main game loop) that I
        //  couldn't break with ctrl-c; true story, thank you bro it is a 
        //  cool one, too!
        count++;
        if(count >= 100) throw new Error(`Didn't exit infinite loop rendering board 😢`);
    }
    // finally, last line is labels for the columns.
    line = '        ';
    for(let i = 0; i < game.columnCount; i++) {
        line += ` ${SolitaireBoard.columnLetterOf(i)}     `
    }
    console.log(line);
    console.log();
}

// credit where it's due - https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html
function renderCard(card) {
    // bright white.
    let result = '\u001b[37;1m';
    // cards render in 3 characters; so pad '4C' so it and '10C' take the same
    //  space
    if(card.value.length < 2) result += ' ';
    result += card.value;
    // reset color.
    result += '\u001b[0m';
    result += renderSuit(card);
    return result;
}

function renderSuit(card) {
    let result = '';

    // if it's a red suit, render suit in red; otherwise default to white on
    //  black for clubs/spades
    if(CardSuit.isRedSuit(card.suit)) result += '\u001b[31;1m';
    result += card.suit;
    if(CardSuit.isRedSuit(card.suit)) result += '\u001b[0m';

    return result;
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
