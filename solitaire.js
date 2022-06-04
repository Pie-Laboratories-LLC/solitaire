const readline = require('readline-sync');


let suits = [ 'C', 'S', 'D', 'H' ];
let redSuits = [ 'D', 'H' ];
let blackSuits = [ 'C', 'S' ];
let cards = [ '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A' ];

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
    // shuffle deck
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
    let board = [];
    for(let i = 0; i < 7; i++) {
        board.push([]);
    }
    for(let i = 0; i < 7; i++) {
        for(let j = i; j < 7; j++) {
            if(j == i) board[j].push([deck.shift(), true]);
            else board[j].push([deck.shift(), false]);
        }
    }
    let upStack = [];
    let upSuits = [[],[],[],[]];
    renderBoard(board,deck,upStack,upSuits);
}

function renderBoard(board,deck,upStack,upSuits) {
    let line = '';
    if(deck.length) line += 'XXX';
    else line += '___';
    line += ' ';
    for(let i = 0; i < 3; i++) {
        line += ' | ';
        if(i < upStack.length) {
            if(upStack[i].startsWith('10')) line += upStack[i];
            else line += ` ${upStack[i]}`;
        }
        else {
            line += '   ';
        }
    }
    line += ' |    | ';
    let first = true;
    for(let suit of upSuits) {
        if(!first) line += ' | ';
        first = false;
        if(!suit.length) { line += '   '; continue; }
        let last = suit[suit.length - 1];
        if(last.startsWith('10')) line += last;
        else line += ` ${last}`;
    }
    line += ' |';
    console.log(line);
    console.log();
    let vIndex = 0;
    let count = 0;
    while(true) {
        line = '        ';
        let any = false;
        for(let column of board) {
            if(vIndex >= column.length) { line += '       '; continue; }
            let card = column[vIndex];
            if(card[1]) {
                if(card[0].startsWith('10')) line += card[0];
                else line += ` ${card[0]}`;
            }
            else line += 'XXX';
            line += '    ';
            any = true;
        }
        console.log(line);
        if(!any) break;
        vIndex++;
        count++;
        if(count >= 100) throw `something bad happened!`;
    }
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
