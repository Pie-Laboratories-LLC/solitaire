import { CardSuit,CardValues,Card } from './Card.js';
import { SolitaireBoard,Column } from './SolitaireBoard.js';
import Deck from './Deck.js';
import SolitaireGame from './SolitaireGame.js';
import SolitaireCanvasRenderer from './SolitaireCanvasRenderer.js';
// Bundled by webpack (see webpack.config.js's asset/resource and
// asset/source rules), not fetched at runtime -- there used to be an
// axios.get() for each of the three HTML fragments here, which meant
// anything embedding this bundle also had to have axios as a global (never
// declared as an actual dependency anywhere, easy to miss) and had to serve
// these files itself at the right relative path. Importing them lets
// webpack package everything the game needs into one build.
import cardBackUrl from './Pictures/MaryWollstonecraft.jpg';
import cardFaceUrl from './Pictures/SVG-cards-2.0.1/svg-cards.svg';
import bgUrl from './Pictures/BG.png';
import winnerHtml from './solitaire-winner.html';
import helpHtml from './solitaire-help.html';
import startHtml from './solitaire-start.html';

export default class SolitiareLoader {
    #solitaire;
    #solitaireCanvasRenderer;
    // container defaults to #solitaire for the standalone demo
    // (solitaire-index.html); an embedder can instead pass its own element
    // directly, so it doesn't have to own a page-global id="solitaire".
    constructor(container) {
        this.#solitaireDiv = container ?? document.getElementById('solitaire');
        try {
            this.#initialize();
        }
        catch(e) {
            if(e) {
                let div = document.createElement('div');
                div.append(e);
                document.body.append(div);
                if(e.hasOwnProperty('stack')) {
                    for(let line of e.stack.split(/\n/)) {
                        let div = document.createElement('div');
                        div.append(line);
                        document.body.append(div);
                    }
                }
            }
        }
    }

    #winnerHtml;
    #helpHtml;
    #startHtml;
    #solitaireDiv;
    #gameDialog;
    #gameDialogContent;
    #errorDialog;
    #errorDialogContent;
    #canvasContainer;
    #canvas;
    #initialize() {
        if(!this.#solitaireDiv) throw new Error("Couldn't find solitaire element :(");
        this.#gameDialog = getSingleElementByClass(this.#solitaireDiv,'solitaireDiv','game-dialog');
        getSingleElementByClass(this.#gameDialog,'gameDialog','x-bar').addEventListener('click',(e) => this.#gameDialog.style = 'display:none');
        this.#gameDialogContent = getSingleElementByClass(this.#gameDialog,'gameDialog','content');
        this.#errorDialog = getSingleElementByClass(this.#solitaireDiv,'solitaireDiv','error-dialog');
        getSingleElementByClass(this.#errorDialog,'errorDialog','x-bar').addEventListener('click',(e) => this.#errorDialog.style = 'display:none');
        this.#errorDialogContent = getSingleElementByClass(this.#errorDialog,'errorDialog','content');
        this.#canvasContainer = getSingleElementByClass(this.#solitaireDiv,'solitaireDiv','canvas-container');
        let canvases = this.#canvasContainer.getElementsByTagName('canvas');
        if(canvases.length != 1) throw new Error(`Couldn't find solitaire canvas element, found ${canvases.length} :(`);
        this.#canvas = canvases[0];
        this.#canvas.focus();
        this.#solitaireDiv.addEventListener('solitaire',(e) => this.#solitaireEvent(e));
        this.#solitaire = this.#makeSolitaire();
        this.#winnerHtml = winnerHtml;
        this.#helpHtml = helpHtml;
        this.#startHtml = startHtml;
        let cardPromise = this.#loadImage(cardBackUrl);
        let cardFacePromise = this.#loadImage(cardFaceUrl);
        let backgroundPromise = this.#loadImage(bgUrl);
        Promise.all([cardPromise,cardFacePromise,backgroundPromise]).then((promiseResults) => {
            let cardBgImage = promiseResults[0];
            let cardFaces = promiseResults[1];
            let bgImage = promiseResults[2];
            this.#solitaireCanvasRenderer = new SolitaireCanvasRenderer({
                bgImage,
                card: {
                    bgImage: cardBgImage,
                    bgImageFillColour: 'black',
                    bgImageStrokeColour: 'black',
                    cardFaceSvg: (card) => {
                        let column;
                        switch(card.value.toLowerCase()) {
                        case 'k': column = 12; break;
                        case 'q': column = 11; break;
                        case 'j': column = 10; break;
                        default: column = card.valueIndex;
                        }
                        let row;
                        switch(card.suit) {
                        case '♣': row = 0; break;
                        case '♠': row = 3; break;
                        case '♦': row = 1; break;
                        case '♥': row = 2; break;
                        default: throw new Error(`unexpected suit ${card.suit}`);
                        }
                        return [ cardFaces, column * 167.5, row* 243, 168, 243 ];
                    },
                    cardFaceAspect: 168 / 243,
                    fillColour: 'white',
                    strokeColour: 'blue',
                    minWidth: 155,
                    minHeight: 225,
                    roundness: 10,
                    padding: 5
                },
                html: {
                    canvasContainer: this.#canvasContainer,
                    canvas: this.#canvas,
                    gameDialog: this.#gameDialog,
                    gameDialogContent: this.#gameDialogContent,
                }
            },this.#solitaire);
            this.#canvasContainer.dispatchEvent(new CustomEvent('solitaire',{ detail: { type: 'start' }, bubbles: true }))
        }).catch((e) => this.#error(e));
    }

    #loadImage(url) {
        const image = new Image();
        image.src = url;
        return new Promise((resolve,reject) => {
            image.onload = () => {
                resolve(image);
            };
            image.onerror = (e) => {
                reject(`Couldn't load image`,e);
            };
        });
    }

    #makeSolitaire() {
        let deck = new Deck([]);
        let kitty = [];
        let board = [];
        let upSuits = [new Column(),new Column(),new Column(),new Column()];
        let cardValues = new CardValues(false);
        let column1 = new Column();
        let column2 = new Column();
        let column3 = new Column();
        let column4 = new Column();
        board.push(column1,column2,column3,column4);
        for(let index = cardValues.length - 1; index >= 0; index--) {
            if(index % 2) {
                column1.push(true, new Card(cardValues.getValue(index),CardSuit.DIAMOND,cardValues));
                column2.push(true, new Card(cardValues.getValue(index),CardSuit.SPADE,cardValues));
                column3.push(true, new Card(cardValues.getValue(index),CardSuit.HEART,cardValues));
                column4.push(true, new Card(cardValues.getValue(index),CardSuit.CLUB,cardValues));
            }
            else {
                column1.push(true, new Card(cardValues.getValue(index),CardSuit.CLUB,cardValues));
                column2.push(true, new Card(cardValues.getValue(index),CardSuit.DIAMOND,cardValues));
                column3.push(true, new Card(cardValues.getValue(index),CardSuit.SPADE,cardValues));
                column4.push(true, new Card(cardValues.getValue(index),CardSuit.HEART,cardValues));
            }
        }
        while(board.length < 7) board.push(new Column());
        let solitaireBoard = new SolitaireBoard(board);
        let solitaire = new SolitaireGame(renderCard,renderSuit,deck,kitty,solitaireBoard,upSuits);
        return solitaire;
    }

    #error(e) {
        this.#errorDialog.style = 'display: block';
        let div = document.createElement('div');
        div.append(e);
        this.#errorDialogContent.append(div);
        if(e.hasOwnProperty('stack')) {
            for(let line of e.stack.split(/\n/)) {
                div = document.createElement('div');
                div.append(line);
                this.#errorDialogContent.append(div);
            }
        }
    }

    #solitaireEvent(e) {
        let type = e.detail && e.detail.type ? e.detail.type : `👻 bizarre unknown mystery event 👻`;
        if(['play','nowinner'].indexOf(type) !== -1) {
            this.#gameDialog.style = 'display:none';
            return;
        }
        if(['forfeit','reset','restart'].indexOf(type) !== -1) {
            if(type === 'forfeit' && !confirm('Are you absolutely positively positive enough to proceed?')) return;
            this.#solitaireCanvasRenderer.reset();
            if(['forfeit','restart'].indexOf(type) !== -1) this.#gameDialog.style = 'display:none';
            return;
        }
        if(type === 'fini') {
            this.#solitaireCanvasRenderer.doFini();
            return;
        }
        // https://www.javascripttutorial.net/dom/manipulating/remove-all-child-nodes/
        while(this.#gameDialogContent.firstChild) {
            this.#gameDialogContent.removeChild(this.#gameDialogContent.firstChild);
        }
        switch(type) {
        case 'winner': this.#gameDialogContent.innerHTML = this.#winnerHtml; break;
        case 'start': this.#gameDialogContent.innerHTML = this.#startHtml; break;
        case 'help': this.#gameDialogContent.innerHTML = this.#helpHtml; break;
        default: this.#gameDialogContent.innerText = `I got some weird solitaire event ${type}`;
        }
        this.#gameDialog.style = 'display:block';
    }
}

function renderCard(card) {
    let result = card.value;
    result += renderSuit(card);
    return result;
}

function renderSuit(card) {
    let result = '';

    // use classes for the suit.
    if(CardSuit.isRedSuit(card.suit)) result += '<span class="red-suit">';
    else result += '<span class="black-suit">';
    result += card.suit;
    result += '</span>';

    return result;
}
function getSingleElementByClass(root,context,className) {
    let matches = root.getElementsByClassName(className);
    if(matches.length != 1) throw new Error(`Tried finding single element ${className} in ${contenxt} but found ${gameDialogs.length} instead 😢`);
    return matches[0];
}
