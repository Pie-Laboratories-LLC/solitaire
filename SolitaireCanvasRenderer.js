// https://codepen.io/kazaak/pen/MWVYewm
import { CardSuit } from './Card.js';
import { Location,LocationType } from './Location.js';
import GameMessage from './GameMessage.js';
import { SolitaireBoard } from './SolitaireBoard.js';
import SolitaireGame from './SolitaireGame.js';

export default class SolitaireCanvasRenderer {
    get pending() { return !this.#initialized; }
    get isRendering() { return typeof this.#renderLoopId !== 'undefined'; }
    #config;
    #canvasContainer;
    #gameDialog;
    #gameDialogContent;
    #canvas;
    #cards;
    #messageBoard;
    #solitaire;
    #locations;
    #messages;
    #typing;
    #selected;
    #downCardPromise;
    #cardBackSvg;
    #bgImageRenderingProperties;
    #bounds;
    #preAnimations = [];
    #animations = [];
    #postAnimations = [];
    #renderLoopId;
    #initialized = false;
    #resizing;

    constructor(config,solitaire) {
        this.#config = config
        if(!this.#config.bgImage) throw new Error(`You must specify bgImage!`);
        if(!this.#config.card) throw new Error(`I can't find the configuration for cards! :(`);
        if(!this.#config.html) throw new Error(`I can't find the configuration for html! :(`);
        this.#canvasContainer = this.#config.html.canvasContainer;
        this.#canvas = this.#config.html.canvas;
        this.#solitaire = solitaire;
        this.#locations = [];
        let resize = (initial) => {
            let doResize = () => {
                this.#calculateCardSize().then(() => {
                    if(!this.#initialized) {
                        this.#canvas.onclick = (e) => {
                            this.#click(e);
                        };
                        document.onkeyup = (e) => {
                            this.#keyUp(e);
                        };
                        document.body.onresize = (e) => {
                            resize();
                        };
                    }
                    this.#canvas.width = this.#canvasContainer.clientWidth;
                    this.#calculateKittyBounds();
                    this.#calculateUpSuitBounds();
                    this.#resizeForBoard();
                    this.#initializeCards();
                    this.#renderLoop();
                });
            }
            if(!initial) {
                // debounce the resize.
                if(this.#resizing) clearTimeout(this.#resizing);
                this.#resizing = setTimeout(() => {
                    this.#resizing = undefined;
                    doResize();
                }, 350);
            }
            else doResize();
        }
        resize(true);
    }

    setRendering(renderOn) {
        if(renderOn && (typeof this.#renderLoopId === 'undefined')) this.#renderLoop();
        else if(!renderOn && (typeof this.#renderLoopId !== 'undefined')) clearTimeout(this.#renderLoopId);
    }

    reset() {
        this.#messages = undefined;
        this.#solitaire = new SolitaireGame(this.#solitaire.renderCard,this.#solitaire.renderSuit);
//        this.#solitaire.cheeseKitty();
        this.#calculateKittyBounds();
        this.#calculateUpSuitBounds();
        this.#resizeForBoard();
        this.#initializeCards();
    }

    #lastStart;
    #count = 0;
    #fps;
    #renderLoop() {
        let startTime = new Date();
        let fps = this.#config.fps ? this.#config.fps : 40;
        let msPerFrame = 1000/ fps;
        if(this.#preAnimations && this.#preAnimations.length) {
            this.#animations.unshift(...this.#preAnimations);
            this.#preAnimations = [];
        }
        if(this.#postAnimations && this.#postAnimations.length) {
            this.#animations.push(...this.#postAnimations);
            this.#postAnimations = [];
        }
        this.#render();
        let duration = new Date() - startTime;
        let delay = 0;
        if(duration > msPerFrame) delay = 0;
        else delay = msPerFrame - duration;
        if(!this.#renderLoopId) this.#renderLoopId = setTimeout(() => {
            this.#renderLoopId = undefined;
            this.#renderLoop();
        },msPerFrame - duration);
        if(!this.#lastStart) {
            this.#lastStart = startTime;
            this.#count = 0;
        }
        else {
            this.#count++;
            if(startTime - this.#lastStart > 1000) {
                this.#fps = this.#count;
                this.#lastStart = undefined;
            }
        }
    }

    #render() {
        if(!this.#cardBackSvg || !this.#bgImageRenderingProperties) throw new Error(`Too soon: I haven't loaded the background image for the cards...`);
        let canvasHeight = this.#calculateCanvasHeight();
        this.#canvas.height = canvasHeight;
        this.#doRender();
        this.#renderMessages();
    }

    #calculateCardSize() {
        // kitty shows 1 card
        let cardsCount = 1;
        // plus the number of other cards in the kitty (-1) times the percentage
        //  visible in the kitty
        cardsCount += (this.#solitaire.kittyCount - 1) * this.#getConfigKittyShownCardPercentage();
        cardsCount += this.#solitaire.upSuitCount;
        cardsCount += (this.#solitaire.upSuitCount - 1) * this.#getConfigUpSuitColumnPaddingRatio();
        // for some padding.
        cardsCount += 3;
        let idealCardWidth = this.#canvasContainer.clientWidth / cardsCount;
        // orificial reasoning
        if(idealCardWidth < 64) idealCardWidth = 64;
        let cardFaceAspect = this.#getConfigCardFaceAspect();
        let idealCardHeight = idealCardWidth / cardFaceAspect;
        this.#config.card.minWidth = idealCardWidth;
        this.#config.card.minHeight = idealCardHeight;
        let returnPromise = this.#loadCardBackground();
        returnPromise = returnPromise.then((results) => {
            this.#cardBackSvg = results[0];
            this.#bgImageRenderingProperties = results[1];
        });
        return returnPromise;
    }

    #resizeForBoard() {
        this.#calculateBoardBounds();
        let canvasHeight = this.#calculateCanvasHeight();
        if(Math.floor(this.#canvas.height) != Math.floor(canvasHeight)) {
            this.#canvas.height = canvasHeight;
        }
        let boardHeight = this.#calculateBoardHeight();
        this.#canvasContainer.style.height = `${boardHeight}px`;
        // TODO - chicken and horse problem here, we need to know the
        //  height of the board to calculate the canvas container height;
        //  that may remove the scrollbar, so we can't calculate board
        //  bounds until after that determination.  But as it stands, we
        //  require board bounds to determine canvas height.
        this.#calculateBoardBounds();
    }

    #initializeCards() {
        let solitaire = this.#solitaire;
        this.#cards = { };

        if(solitaire.deckLength) this.#cards.deck = {
            isDown: true,
            bounds: this.#bounds.kitty.deckCard
        }
        else delete this.#cards.deck;

        let kitty = solitaire.kitty;
        for(let index = 0; index < solitaire.kittyCount; index++) {
            if(index < kitty.length) {
                this.#cards[`kitty-${index}`] = {
                    card: kitty[index],
                    bounds: this.#bounds.kitty[`kitty-${index}`],
                    isDown: false
                };
            }
            else delete this.#cards[`kitty-${index}`];
        }

        for(let index = 0; index < solitaire.columnCount; index++) this.#initializeColumnCards(index);

        for(let index = 0; index < solitaire.upSuitCount; index++) {
            if(!solitaire.getUpSuitLength(index)) {
                delete this.#cards[`upSuit-${index}`];
                continue;
            }
            this.#cards[`upSuit-${index}`] = {
                card: solitaire.peekUpSuit(index),
                bounds: this.#bounds.upSuit[`card-${index}`],
                isDown: false
            }
        }
    }

    #initializeColumnCards(index) {
        let solitaire = this.#solitaire;
        let columnLength = solitaire.getColumnLength(index);
        let offset;
        for(offset = 0; offset < columnLength[0]; offset++) {
            if(offset < columnLength[1])  this.#cards[`board-${index}-${offset}`] = {
                bounds: this.#bounds.board[`column-${index}-${offset}`],
                isDown: true
            }
            else this.#cards[`board-${index}-${offset}`] = {
                card: solitaire.peekColumnCard(index,offset),
                bounds: this.#bounds.board[`column-${index}-${offset}`],
                isDown: false
            }
        }
        offset = columnLength[0];
        while(this.#cards.hasOwnProperty(`board-${index}-${offset}`)) {
            delete this.#cards[`board-${index}-${offset}`];
            offset++;
        }
    }

    // TODO 
    // this should go away with better handling of board size!
    #reboundCards() {
        for(let index = 0; index < this.#solitaire.columnCount; index++) {
            let offset = 0;
            while(this.#cards.hasOwnProperty(`board-${index}-${offset}`)) {
                this.#cards[`board-${index}-${offset}`].bounds.x =
                    this.#bounds.board[`column-${index}-${offset}`].x;
                this.#cards[`board-${index}-${offset}`].bounds.width =
                    this.#bounds.board[`column-${index}-${offset}`].width;
                offset++;
            }
        }
    }

    #doRender() {
        let canvas = this.#canvas;
        let width = canvas.offsetWidth;
        let height = canvas.offsetHeight;
        const ctx = canvas.getContext('2d');
        this.#fillBackground(ctx,width,height);
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        this.#renderKitty(ctx,padding,minWidth,minHeight);
        this.#renderUpSuits(ctx,width,height,padding,minWidth,minHeight);
        let boardBound = this.#renderBoard(ctx,width,height,minWidth,minHeight);
        this.#renderCards(ctx);
        this.#renderAnimations(ctx);
        if(this.#selected) {
            let selectedColour = this.#config.selectedColour ? this.#config.selectedColour : 'rgba(200,200,255,0.5)';
            ctx.fillStyle = selectedColour;
            ctx.beginPath();
            ctx.rect(this.#selected.x, this.#selected.y, this.#selected.width, this.#selected.height);
            ctx.closePath();
            ctx.fill();
        }
        if(this.#typing) this.#renderTyping(ctx,padding,this.#canvasContainer.clientWidth);
        this.#label(ctx,this.#fps,0,0,'black',undefined,'left','top');
    }

    #renderCards(ctx) {
        for(const [name,card] of Object.entries(this.#cards)) {
            try {
                if(card.isDown) this.#drawCardDown(ctx,card.bounds);
                else this.#drawCardUp(ctx,card.card,card.bounds);
            }
            catch(e) {
                console.log(`while drawing ${name}: ${e}`);
            }
        }
    }

    #renderCard(ctx,name) {
        if(!this.#cards.hasOwnProperty(name)) throw new Error(`Couldn't find card ${name} to render :(`);
        let card = this.#cards[name];
        if(card.isDown) this.#drawCardDown(ctx,card.bounds);
        else this.#drawCardUp(ctx,card.card,card.bounds);
    }

    #renderBackground(ctx,bounds) {
        let bgImage = this.#config.bgImage;
        ctx.drawImage(bgImage,
            bgImage.width % bounds.x,
            bgImage.height % bounds.y,
            bounds.width,
            bounds.height,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height);
    }

    #renderMessages() {
        if(this.#messages && this.#messages.length && !this.#messageBoard) {
            this.#messageBoard = document.createElement('div');
            this.#messageBoard.id = 'message-board';
            let xBar = document.createElement('div');
            xBar.classList.add('x-bar');
            this.#messageBoard.append(xBar);
            let first = true;
            for(let message of this.#messages) {
                if(!first) {
                    let spacerDiv = document.createElement('div');
                    spacerDiv.classList.add('spacer');
                    this.#messageBoard.append(spacerDiv);
                }
                first = false;
                let messageDiv = document.createElement('div');
                messageDiv.classList.add('message',`${message.severity.toLowerCase()}`);
                messageDiv.innerHTML = message.message;
                this.#messageBoard.append(messageDiv);
            }
            this.#messageBoard.onclick = (e) => {
                this.#messageBoard.remove();
                this.#messageBoard = undefined;
                this.#messages = undefined;
            };
            this.#canvasContainer.append(this.#messageBoard);
        }
        else if((!this.#messages || !this.#messages.length) && this.#messageBoard) {
            this.#messageBoard.remove();
            this.#messageBoard = undefined;
            this.#messages = undefined;
        }
    }

    #renderTyping(ctx,padding,width) {
        let labelPadding = this.#getConfigLabelPadding(padding);
        let typingLineWidth = this.#getConfigTypingLineWidth();
        let typingStrokeColour = this.#getConfigTypingStrokeColour();
        let typingFillColour = this.#getConfigTypingFillColour();
        let typingLabelColour = this.#getConfigTypingLabelColour();
        let textMetrics = ctx.measureText(this.#typing);
        ctx.strokeStyle = typingStrokeColour;
        ctx.lineWidth = typingLineWidth;
        ctx.fillStyle = typingFillColour;
        let bounds = {
            x: width / 2 - textMetrics.width / 2 - labelPadding,
            y: this.#bounds.upSuit.upSuitBounds.y + this.#bounds.upSuit.upSuitBounds.height - labelPadding,
            width: textMetrics.width + labelPadding * 2,
            height: textMetrics.fontBoundingBoxAscent+ textMetrics.fontBoundingBoxDescent+ labelPadding * 2,
        }
        ctx.beginPath();
        ctx.rect(bounds.x,bounds.y,bounds.width,bounds.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.#label(ctx,this.#typing,bounds.x + labelPadding + textMetrics.width / 2,bounds.y + labelPadding,typingLabelColour,undefined,'center','top');
    }

    #calculateCanvasHeight() {
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        return this.#calculateCanvasBottom() + padding;
    }

    #calculateBoardHeight() {
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        return this.#calculateBoardBottom() + padding;
    }

    #renderBoard(ctx,width,height,minWidth,minHeight) {
        let solitaire = this.#solitaire;
        let emptyColumnColour = this.#getConfigBoardEmptyColumnColour();
        let emptyColumnLineWidth = this.#getConfigBoardEmptyColumnLineWidth();
        ctx.strokeStyle = emptyColumnColour;
        ctx.lineWidth = emptyColumnLineWidth;
        for(let index = 0; index < solitaire.columnCount; index++) {
            let columnLength = solitaire.getColumnLength(index);
            if(!columnLength[0]) {
                ctx.beginPath();
                let bounds = this.#bounds.board[`column-${index}`];
                ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
                ctx.closePath();
                ctx.stroke();
            }
            this.#label(ctx,SolitaireBoard.columnLetterOf(index),this.#bounds.board[`column-label-${index}`].x,this.#bounds.board[`column-label-${index}`].y);
        }
    }

    #renderUpSuits(ctx,width,height,padding,minWidth,minHeight) {
        let solitaire = this.#solitaire;
        let emptyUpSuitColour = this.#getConfigUpSuitColour();
        let lineWidth = this.#getConfigUpSuitLineWidth();
        for(let index = solitaire.upSuitCount; index >= 1; index--) {
            let rectBounds = this.#bounds.upSuit[index - 1];
            let cardBounds = this.#bounds.upSuit[`card-${index - 1}`];
            let labelBounds = this.#bounds.upSuit[`label-${index - 1}`];
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = emptyUpSuitColour;
            ctx.beginPath();
            ctx.rect(rectBounds.x,rectBounds.y,rectBounds.width,rectBounds.height);
            ctx.closePath();
            ctx.stroke();
            this.#label(ctx,`U   ${index}`,labelBounds.x,labelBounds.y,undefined,undefined,undefined,'top');
        }
    }

    #calculateKittyBounds() {
        let solitaire = this.#solitaire;
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        let kittyX = padding;
        let kittyY = padding;
        let kittyLineWidth = this.#getConfigKittyLineWidth();
        let emptyKittyHeight = minHeight * this.#getConfigKittyFrameVPadding() + 2* kittyLineWidth;
        let kittyWidth = minWidth +  2* minWidth * this.#getConfigKittyShownCardPercentage();
        let emptyKittyWidth = kittyWidth * this.#getConfigKittyFrameHPadding() + 2* kittyLineWidth;
        let deckLineWidth = this.#getConfigKittyDeckLineWidth();
        let deckRectWidth = minWidth + 2* deckLineWidth;
        let deckRectHeight = minHeight + 2* deckLineWidth;
        let deckOffsetY = (emptyKittyHeight - deckRectHeight) / 2;
        let labelPadding = this.#getConfigLabelPadding(padding);

        if(!this.#bounds) this.#bounds = {};
        this.#bounds.kitty = {};
        this.#bounds.kitty.deck = {
            x: kittyX, y: kittyY + deckOffsetY,
            width: deckRectWidth, height: deckRectHeight
        };
        this.#bounds.kitty.deckCard = {
            x: kittyX + deckLineWidth, y: kittyY + deckOffsetY + deckLineWidth,
            width: minWidth, height: minHeight
        };

        let deckKittySpacing = minWidth / 5;
        kittyX += (deckRectWidth + deckKittySpacing);
        this.#bounds.kitty.kitty = {
            x: kittyX, y: kittyY,
            width: emptyKittyWidth, height: emptyKittyHeight
        }
        this.#bounds.kitty.kittyLabel = {
            x: kittyX + kittyWidth / 2,y: kittyY + emptyKittyHeight + labelPadding
        };
        this.#bounds.kitty.kittyBounds = {
            x: padding,y: padding,
            width: kittyX + emptyKittyWidth - padding,height: kittyY + emptyKittyHeight + 3 * labelPadding - padding
        };

        kittyX += (emptyKittyWidth - kittyWidth) / 2;
        // NOTE - add deck line width here else the kitty is lineWidth
        //  pixels higher than the deck, which is annoying
        kittyY += (deckOffsetY + deckLineWidth);
        for(let index = 0; index < solitaire.kittyCount; index++) {
            this.#bounds.kitty[`kitty-${index}`] = {
                x: kittyX,y: kittyY,width: minWidth, height: minHeight
            }
            kittyX += minWidth * this.#getConfigKittyShownCardPercentage();
        }
    }

    #calculateBoardBounds() {
        let solitaire = this.#solitaire;
        let width = this.#canvasContainer.offsetWidth;
        let kittyBottom = this.#calculateKittyBottom();
        let boardStartY = this.#calculateKittyBottom();
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        let boardColumnSpacing = minWidth * this.#getConfigBoardColumnPaddingRatio();
        let lineWidth = this.#getConfigBoardEmptyColumnLineWidth();
        let boardWidth = solitaire.columnCount * (minWidth+ lineWidth* 2) + boardColumnSpacing * (solitaire.columnCount - 1);
        // TODO - make sure the board fits on the canvas.
        let boardStartX = boardWidth < width ? (width - boardWidth) / 2 : padding;
        let labelPadding = this.#getConfigLabelPadding(padding);
        if(!this.#bounds) this.#bounds = {};
        this.#bounds.board = {};

        let maxY = 0;
        for(let index = 0; index < solitaire.columnCount; index++) {
            let boardY = boardStartY;
            let bounds = {
                x: boardStartX,
                y: boardY,
                width: minWidth + lineWidth * 2,
                height: minHeight + lineWidth * 2
            };
            // NOTE: board may be empty, so this would be bottom of the page
            if(boardY + lineWidth*2 + minHeight > maxY) maxY = boardY + lineWidth*2 + minHeight;
            // NOTE: no reason to copy bounds here.  It is never altered;
            //  it is replaced below, but the members aren't altered
            this.#bounds.board[`column-${index}`] = bounds;
            let columnMaxY = this.#calculateColumnBounds(index);
            this.#bounds.board[`column-label-${index}`] = {
                x: boardStartX + minWidth / 2,
                y: Math.max(columnMaxY,bounds.y + bounds.height) + labelPadding
            }
            if(columnMaxY > maxY) maxY = columnMaxY;
            boardStartX += (minWidth+ lineWidth* 2+ boardColumnSpacing)
        }

        this.#bounds.board.boardBounds = {
            x: (width - boardWidth) / 2,
            y: this.#calculateKittyBottom(),
            width: boardWidth,
            height: maxY + labelPadding * 2 - this.#calculateKittyBottom()
        }

        // hurp, all the fuss and bother to calculate and resize canvas,
        //  but unfortunately it flickers to resize the canvas, even if
        //  we cheated and rendered background on the canvas container
        //  we'd still see it flicker, so just figure out the max height
        //  that the canvas could be, if all 13 cards were in the last
        //  column
        maxY = boardStartY
             + minHeight * (this.#solitaire.columnCount - 1)* this.#getConfigStackDownCardVisibleRatio()
             + minHeight * (this.#solitaire.anyCard.values.length - 1)* this.#getConfigStackUpCardVisibleRatio()
             + minHeight
             + labelPadding * 2;

        this.#bounds.board.canvasBounds = {
            x: (width - boardWidth) / 2,
            y: this.#calculateKittyBottom(),
            width: boardWidth,
            height: maxY - this.#calculateKittyBottom()
        }
    }

    #calculateColumnBounds(index) {
        let solitaire = this.#solitaire;
        let columnLength = solitaire.getColumnLength(index);
        let lineWidth = this.#getConfigBoardEmptyColumnLineWidth();
        let columnBounds = this.#bounds.board[`column-${index}`];
        let boardStartX = columnBounds.x;
        let boardY = columnBounds.y;
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        let labelPadding = this.#getConfigLabelPadding(padding);
        // cheeky / NOTE - we actually count one additional bounds, so
        //  we know the location where a card or cards will move when
        //  moved from kitty or another stack or whatever.
        let offset;
        let maxY = 0;
        for(offset = 0; offset <= columnLength[0]; offset++) {
            let bounds = {
                x: boardStartX + lineWidth,
                y: boardY + lineWidth,
                width: minWidth,
                height: minHeight,
            }
            if(offset < columnLength[0] && boardY + lineWidth + minHeight > maxY) maxY = boardY + lineWidth + minHeight;
            this.#bounds.board[`column-${index}-${offset}`] = bounds;
            if(offset < columnLength[1]) boardY += minHeight * this.#getConfigStackDownCardVisibleRatio();
            else boardY += minHeight * this.#getConfigStackUpCardVisibleRatio();
        }
        // TODO - fixme fixme: we need this because it's called directly
        //  when moving to a column.  when this is fixed, label padding
        //  might be able to go away here.
        if(offset > 1) {
            this.#bounds.board[`column-label-${index}`] = {
                x: boardStartX + minWidth / 2,
                y: maxY + labelPadding
            }
        }
        else {
            this.#bounds.board[`column-label-${index}`] = {
                x: this.#bounds.board[`column-${index}`].x + minWidth / 2,
                y: this.#bounds.board[`column-${index}`].y + this.#bounds.board[`column-${index}`].height + labelPadding
            }
        }

        // delete any extraneous bounds; note we keep one extra for
        //  destination of move.
        offset = columnLength[0] + 1;
        while(this.#bounds.board.hasOwnProperty(`column-${index}-${offset}`)) {
            delete this.#bounds.board[`column-${index}-${offset}`];
            offset++;
        }
        return maxY;
    }

    #calculateUpSuitBounds() {
        let width = this.#canvasContainer.offsetWidth;
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        let upSuitX = width - padding;
        let upSuitY = padding;
        let lineWidth = this.#getConfigUpSuitLineWidth();
        let upSuitRectWidth = minWidth + 2* lineWidth;
        let upSuitRectHeight = minHeight + 2* lineWidth;
        let upSuitSpacing = minWidth * this.#getConfigUpSuitColumnPaddingRatio();
        let labelPadding = this.#getConfigLabelPadding(padding);
        if(!this.#bounds) this.#bounds = {};
        this.#bounds.upSuit = {};
        // TODO
        // make sure the upSuits don't overwrite the kitty.
        let minKittyUpSuitPadding = minWidth * .1;
        if(upSuitX - upSuitRectWidth * this.#solitaire.upSuitCount - upSuitSpacing * (this.#solitaire.upSuitCount - 1) <= this.#bounds.kitty.kittyBounds.x + this.#bounds.kitty.kittyBounds.width + minKittyUpSuitPadding) {
            upSuitX = this.#bounds.kitty.kittyBounds.x + this.#bounds.kitty.kittyBounds.width + minKittyUpSuitPadding + upSuitRectWidth * this.#solitaire.upSuitCount + upSuitSpacing * (this.#solitaire.upSuitCount - 1);
        }
        for(let index = this.#solitaire.upSuitCount; index >= 1; index--) {
            this.#bounds.upSuit[index - 1] = {
                x: upSuitX - upSuitRectWidth,y: upSuitY,
                width: upSuitRectWidth,height: upSuitRectHeight
            };
            this.#bounds.upSuit[`card-${index - 1}`] = {
                x: upSuitX - upSuitRectWidth + lineWidth,y: upSuitY + lineWidth,
                width: minWidth,height: minHeight
            };
            upSuitX -= upSuitRectWidth;
            this.#bounds.upSuit[`label-${index - 1}`] = {
                x: upSuitX + upSuitRectWidth / 2,
                y: upSuitY + upSuitRectHeight + labelPadding
            };
            upSuitX -= upSuitSpacing;
        }
        this.#bounds.upSuit.upSuitBounds = {
            x: upSuitX,
            y: padding,
            width: width - upSuitX - padding,
            height: upSuitY + upSuitRectHeight + labelPadding * 2
        }
    }

    #calculateKittyBottom() {
        return this.#bounds.kitty.kittyBounds.y + this.#bounds.kitty.kittyBounds.height;
    }

    #calculateCanvasBottom() {
        return this.#bounds.board.canvasBounds.y + this.#bounds.board.canvasBounds.height;
    }

    #calculateBoardBottom() {
        return this.#bounds.board.boardBounds.y + this.#bounds.board.boardBounds.height;
    }

    #renderKitty(ctx,padding,minWidth,minHeight) {
        let solitaire = this.#solitaire;
        let emptyKittyColour = this.#getConfigKittyEmptyColour();
        let emptyDeckColour = this.#getConfigKittyEmptyDeckColour();
        let lineWidth = this.#getConfigKittyDeckLineWidth();
        ctx.strokeStyle = emptyDeckColour;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.rect(this.#bounds.kitty.deck.x,this.#bounds.kitty.deck.y,
                 this.#bounds.kitty.deck.width,this.#bounds.kitty.deck.height);
        ctx.closePath();
        ctx.stroke();
        lineWidth = this.#getConfigKittyLineWidth();
        let deckKittySpacing = minWidth / 5;
        ctx.strokeStyle = emptyKittyColour;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.rect(this.#bounds.kitty.kitty.x,this.#bounds.kitty.kitty.y,
                 this.#bounds.kitty.kitty.width,this.#bounds.kitty.kitty.height);
        ctx.closePath();
        ctx.stroke();

        this.#label(ctx,'K      I      T      T      Y',this.#bounds.kitty.kittyLabel.x,this.#bounds.kitty.kittyLabel.y,undefined,undefined,undefined,'top');
    }

    #label(ctx,label,x,y,labelColour,labelFont,textAlign,textBaseline) {
        labelColour = labelColour ? labelColour : this.#getConfigLabelColour();
        labelFont = labelFont ? labelFont : this.#getConfigLabelFont();
        ctx.fillStyle = labelColour;
        ctx.font = labelFont;
        ctx.textAlign = textAlign ? textAlign : 'center';
        ctx.textBaseline = textBaseline ? textBaseline : 'alphabetic';
        ctx.beginPath();
        ctx.fillText(label, x, y);
        ctx.closePath();
    }

    #fillBackground(ctx,width,height) {
        let y = 0;
        let bgImage = this.#config.bgImage;
        while(y < height) {
            let x = 0;
            while(x < width) {
                ctx.drawImage(bgImage,x,y);
                x += bgImage.width;
            }
            y += bgImage.height;
        }
    }

    #drawCardUp(ctx,card,bounds) {
        let config = this.#config.card;
        if(config.cardFaceSvg) {
            let svgDetails = config.cardFaceSvg(card);
            ctx.drawImage(svgDetails[0],svgDetails[1],svgDetails[2],svgDetails[3],svgDetails[4],bounds.x,bounds.y,bounds.width,bounds.height);
            return;
        }
        let hPadding = this.#getConfigCardHPadding();
        let vPadding = this.#getConfigCardVPadding();
        let roundness = this.#getConfigCardRoundness();
        let hRoundness = this.#getConfigCardHRoundness(roundness);
        let vRoundness = this.#getConfigCardVRoundness(roundness);
        let fillColour = this.#getConfigCardFaceFillColour();
        let strokeColour = this.#getConfigCardFaceStrokeColour();
        let labelBlackColour = this.#config.card.labelBlackColour ? this.#config.labelBlackColour : 'black';
        let labelRedColour = this.#config.card.labelRedColour ? this.#config.labelRedColour : 'red';
        let cardCornerLabelFont = this.#config.card.cardCornerLabelFont ? this.#config.cardCornerLabelFont : 'bold 32px serif';
        let faceLabelFont = this.#config.card.faceLabelFont ? this.#config.faceLabelFont : 'bold 50px serif';
        let aceLabelFont = this.#config.card.aceLabelFont ? this.#config.aceLabelFont : 'bold 120px serif';
        ctx.fillStyle = fillColour;
        ctx.strokeStyle = strokeColour;
        ctx.roundRect(bounds.x,bounds.y,bounds.width,bounds.height,{hRoundness,vRoundness},true,true);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        if(CardSuit.isRedSuit(card.suit)) ctx.fillStyle = labelRedColour;
        else ctx.fillStyle = labelBlackColour;
        ctx.font = cardCornerLabelFont;
        ctx.beginPath();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(card.toString(), x + (hPadding < hRoundness ? hRoundness : hPadding), y + (vPadding < vRoundness ? vRoundness : vPadding));
        ctx.closePath();
        ctx.save();
        ctx.translate(x + minWidth - (hPadding < hRoundness ? hRoundness : hPadding), y + minHeight - (vPadding < vRoundness ? vRoundness : vPadding));
        ctx.rotate(Math.PI);
        ctx.beginPath();
        ctx.fillText(card.toString(), 0, 0);
        ctx.closePath();
        ctx.restore();

        ctx.save();
        ctx.translate(x + minWidth / 2, y + minHeight / 2);
        switch(card.value.toLowerCase()) {
        case 'a':
            ctx.font = aceLabelFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.beginPath();
            ctx.fillText(card.suit, 0, 0);
            ctx.closePath();
            break;

        case '2':
        case '3':
            ctx.font = faceLabelFont;
            if(card.value.toLowerCase() == '3') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.beginPath();
                ctx.fillText(card.suit, 0, 0);
                ctx.closePath();
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.beginPath();
            ctx.fillText(card.suit, 0, -(4 * minHeight / 10));
            ctx.closePath();
            ctx.rotate(Math.PI);
            ctx.beginPath();
            ctx.fillText(card.suit, 0, -(4 * minHeight / 10));
            ctx.closePath();
            break;

        case '4':
        case '5':
            ctx.font = faceLabelFont;
            if(card.value.toLowerCase() == '5') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.beginPath();
                ctx.fillText(card.suit, 0, 0);
                ctx.closePath();
            }
            ctx.textBaseline = 'top';
            ctx.beginPath();
            ctx.textAlign = 'left';
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.textAlign = 'right';
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.closePath();
            ctx.rotate(Math.PI);
            ctx.beginPath();
            ctx.textAlign = 'left';
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.textAlign = 'right';
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.closePath();
            break;

        case '6':
        case '7':
        case '8':
            ctx.font = faceLabelFont;
            if(card.value.toLowerCase() != '6') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.beginPath();
                ctx.fillText(card.suit, 0, -(1 * minHeight / 7));
                ctx.closePath();
            }
            ctx.beginPath();
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.textBaseline = 'middle';
            ctx.fillText(card.suit, -(3 * minWidth / 10), 0);
            ctx.textBaseline = 'top';
            ctx.textAlign = 'right';
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.textBaseline = 'middle';
            ctx.fillText(card.suit, (3 * minWidth / 10), 0);
            ctx.closePath();
            ctx.rotate(Math.PI);
            ctx.beginPath();
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.textAlign = 'right';
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.closePath();
            if(['6','7'].indexOf(card.value.toLowerCase()) == -1) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.beginPath();
                ctx.fillText(card.suit, 0, -(1 * minHeight / 7));
                ctx.closePath();
            }
            break;

        case '9':
        case '10':
            ctx.font = faceLabelFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if(card.value.toLowerCase() != '10') {
                ctx.beginPath();
                ctx.fillText(card.suit, 0, 0);
                ctx.closePath();
            }
            else {
                ctx.beginPath();
                ctx.fillText(card.suit, 0, -(1 * minHeight / 6));
                ctx.closePath();
            }
            ctx.beginPath();
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 16) - 5);
            ctx.textAlign = 'right';
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 16) - 5);
            ctx.closePath();
            ctx.rotate(Math.PI);
            ctx.beginPath();
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.fillText(card.suit, -(3 * minWidth / 10), -(3 * minHeight / 16) - 5);
            ctx.textAlign = 'right';
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 8));
            ctx.fillText(card.suit, (3 * minWidth / 10), -(3 * minHeight / 16) - 5);
            ctx.closePath();
            if(card.value.toLowerCase() != '9') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.beginPath();
                ctx.fillText(card.suit, 0, -(1 * minHeight / 6));
                ctx.closePath();
            }
            break;
        }
        ctx.restore();
    }

    #drawCardDown(ctx,bounds,hSkew) {
        let svgImage = this.#cardBackSvg;
        let bgImage = this.#config.card.bgImage;
        if(bounds.hasOwnProperty('width') && bounds.hasOwnProperty('height') && typeof hSkew !== 'undefined') {
            ctx.drawImage(svgImage,bounds.x,bounds.y,bounds.width,bounds.height);
            let minWidth = this.#getConfigCardMinWidth();
            ctx.drawImage(bgImage,
                bounds.x + this.#bgImageRenderingProperties.imageX * hSkew,
                bounds.y + this.#bgImageRenderingProperties.imageY,
                this.#bgImageRenderingProperties.imageWidth * hSkew,
                this.#bgImageRenderingProperties.imageHeight
            );
            return;
        }
        ctx.drawImage(svgImage,bounds.x,bounds.y);
        ctx.drawImage(bgImage,
            bounds.x + this.#bgImageRenderingProperties.imageX,
            bounds.y + this.#bgImageRenderingProperties.imageY,
            this.#bgImageRenderingProperties.imageWidth,
            this.#bgImageRenderingProperties.imageHeight
        );
    }

    #calculatePadding(minWidth,minHeight) {
        return minWidth > minHeight ? minWidth / 10 : minHeight / 10
    }

    #getConfigUpSuitLineWidth() {
        return this.#config.upSuit && this.#config.upSuit.lineWidth ? this.#config.upSuit.lineWidth : 3;
    }

    #getConfigUpSuitColour() {
        return this.#config.upSuit && this.#config.upSuit.colour ? this.#config.upSuit.colour : 'white';
    }

    #getConfigUpSuitColumnPaddingRatio() {
        return this.#config.upSuit && this.#config.upSuit.columnPaddingRatio ? this.#config.upSuit.columnPaddingRatio : 1 / 3;
    }

    #getConfigKittyEmptyColour() {
       return this.#config.kitty && this.#config.kitty.emptyColour ? this.#config.kitty.emptyColour : 'yellow';
    }

    #getConfigKittyEmptyDeckColour() {
       return this.#config.kitty && this.#config.kitty.emptyDeckColour ? this.#config.kitty.emptyDeckColour : 'green';
    }

    #getConfigKittyFramePadding() {
       return this.#config.kitty && this.#config.kitty.framePadding ? this.#config.kitty.framePadding : 1.15;
    }

    #getConfigKittyFrameVPadding() {
        return this.#config.kitty && this.#config.kitty.frameVPadding ? this.#config.kitty.frameVPadding : this.#getConfigKittyFramePadding();
    }

    #getConfigKittyFrameHPadding() {
        return this.#config.kitty && this.#config.kitty.frameHPadding ? this.#config.kitty.frameHPadding : this.#getConfigKittyFramePadding();
    }

    #getConfigKittyShownCardPercentage() {
        return this.#config.kitty && this.#config.kitty.shownCardPercentage ? this.#config.kitty.shownCardPercentage : (1 / 3);
    }

    #getConfigKittyDeckLineWidth() {
        return this.#config.kitty && this.#config.kitty.deckLineWidth ? this.#config.kitty.deckLineWidth : 3;
    }

    #getConfigKittyLineWidth() {
        return this.#config.kitty && this.#config.kitty.lineWidth ? this.#config.kitty.lineWidth : 1;
    }

    #getConfigLabelPadding(padding) {
        return this.#config.labelPadding ? this.#config.labelPadding : padding;
    }

    #getConfigLabelColour() {
        return this.#config.labelColour ? this.#config.labelColour : 'white';
    }

    #getConfigLabelFont() {
        return this.#config.labelFont ? this.#config.labelFont : 'bold 18px system-ui';
    }

    #getConfigLabelFontHeight() {
        return this.#config.labelFontHeight ? this.#config.labelFontHeight : 18;
    }

    #getConfigTypingLineWidth() {
        return this.#config.typingLineWidth ? this.#config.typingLineWidth : 3;
    }

    #getConfigTypingStrokeColour() {
        return this.#config.typingStrokeColour ? this.#config.typingStrokeColour : 'black';
    }

    #getConfigTypingFillColour() {
        return this.#config.typingFillColour ? this.#config.typingFillColour : 'white';
    }

    #getConfigTypingLabelColour() {
        return this.#config.typingLabelColour ? this.#config.typingLabelColour : 'black';
    }

    #getConfigStackUpCardVisibleRatio() {
        return this.#config.stackUpCardVisibleRatio ? this.#config.this.#config.stackUpCardVisibleRatio : 1 / 8;
    }

    #getConfigStackDownCardVisibleRatio() {
        return this.#config.stackDownCardVisibleRatio ? this.#config.this.#config.stackDownCardVisibleRatio : 1 / 20;
    }

    #getConfigBoardEmptyColumnColour() {
        return this.#config.board && this.#config.board.emptyColumnColour ? this.#config.board.emptyColumnColour : 'green';
    }

    #getConfigBoardEmptyColumnLineWidth() {
        return this.#config.board && this.#config.board.emptyColumnLineWidth ? this.#config.board.emptyColumnLineWidth : 3;
    }

    #getConfigBoardColumnPaddingRatio() {
        return this.#config.board && this.#config.board.columnPaddingRatio ? this.#config.this.#config.board.columnPaddingRatio : 1 / 5;
    }

    #getConfigCardMinWidth() {
        return this.#config.card.minWidth ? this.#config.card.minWidth : 300
    }

    #getConfigCardMinHeight() {
        return this.#config.card.minHeight ? this.#config.card.minHeight : 500
    }

    #getConfigCardPadding() {
        return this.#config.card.padding ? this.#config.card.padding : 5;
    }

    #getConfigCardHPadding(padding) {
        return this.#config.card.hPadding ? this.#config.card.hPadding : this.#getConfigCardPadding();
    }

    #getConfigCardVPadding(padding) {
        return this.#config.card.vPadding ? this.#config.card.vPadding : this.#getConfigCardPadding();
    }

    #getConfigCardRoundness() {
        return this.#config.card.roundness ? this.#config.card.roundness : 5;
    }

    #getConfigCardHRoundness(roundness) {
        return this.#config.card.hRoundness ? this.#config.card.hRoundness : roundness
    }

    #getConfigCardVRoundness(roundness) {
        return this.#config.card.vRoundness ? this.#config.card.vRoundness : roundness
    }

    #getConfigCardFaceFillColour() {
        return this.#config.card.fillColour ? this.#config.card.fillColour : 'white';
    }

    #getConfigCardFaceStrokeColour() {
        return this.#config.card.strokeColour ? this.#config.card.strokeColour : 'blue';
    }

    #getConfigCardFaceAspect() {
        return this.#config.hasOwnProperty('card') && this.#config.card.hasOwnProperty('cardFaceAspect') ? this.#config.card.cardFaceAspect : 2 / 3;
    }

    #loadCardBackground() {
        let config = this.#config.card;
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#getConfigCardPadding();
        let hPadding = this.#getConfigCardHPadding(padding);
        let vPadding = this.#getConfigCardVPadding(padding);
        let roundness = this.#getConfigCardRoundness();
        let hRoundness = this.#getConfigCardHRoundness(roundness);
        let vRoundness = this.#getConfigCardVRoundness(roundness);
        let fillColour = config.fillColour ? config.fillColour : 'white';
        let strokeColour = config.strokeColour ? config.strokeColour : 'blue';
        let bgImage = config.bgImage ? config.bgImage : undefined;
        let bgImageFillColour = config.bgImageFillColour ? config.bgImageFillColour : undefined;
        if(!bgImage || !bgImageFillColour) throw new Error(`required element(s) missing!`);
        if(minWidth < 2 * (hRoundness + hPadding)) throw new Error(`padding and roundness exceed width!`);
        if(minHeight < 2 * (vRoundness + vPadding)) throw new Error(`padding and roundness exceed height!`);
        let imageX = hPadding < hRoundness ? hRoundness : hPadding;
        let imageY = vPadding < vRoundness ? vRoundness : vPadding;
        let imageWidth = minWidth - imageX * 2;
        let imageHeight = minHeight - imageY * 2;
        // https://stackoverflow.com/a/33227005
        let svg = `
<svg width="${minWidth}" height="${minHeight}" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${minWidth}" height="${minHeight}" rx="${hRoundness}" ry="${vRoundness}" stroke="${strokeColour}" fill="${fillColour}" stroke-width="1"/>
  <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="0" ry="0" stroke="${bgImageFillColour}" fill="${bgImageFillColour}"/>
</svg>
`;
        let dataURL = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        if(bgImage.width <= imageWidth && bgImage.height <= imageHeight) {
            imageX += (imageWidth - bgImage.width)/ 2;
            imageY += (imageHeight - bgImage.height)/ 2;
            imageWidth = bgImage.width;
            imageHeight = bgImage.height;
        }
        else {
            const hScale = imageWidth / bgImage.width;
            const vScale = imageHeight / bgImage.height;
            if(hScale * bgImage.height <= imageHeight) {
                const newImageHeight = bgImage.height * hScale;
                imageY += (imageHeight - newImageHeight) / 2;
                imageHeight = newImageHeight;
            }
            else {
                const newImageWidth = bgImage.width * vScale;
                imageX += (imageWidth - newImageWidth) / 2;
                imageWidth = newImageWidth;
            }
        }

        let svgImage = new Image();
        return new Promise((resolve,reject) => {
            svgImage.onload = () => {
                resolve([svgImage,{imageX,imageY,imageWidth,imageHeight}]);
            }
            svgImage.onerror = (e) => {
                reject([`Couldn't create svg 😢`,e]);
            }
            svgImage.src = dataURL;
        });
    }

    #dealToKitty() {
        let solitaire = this.#solitaire;
        let originalKitty = solitaire.kitty;
        let originalDeckLength = solitaire.deckLength;
        let response = solitaire.dealToKitty();
        this.#messages = [...response.messages];
        if(!response.success) return undefined;

        let newKitty = solitaire.kitty;

        // if there were more cards in the original deck then there are 
        //  kards in the kitty, only the number of cards originally in the
        //  deck were flipped.
        let count = originalDeckLength >= solitaire.kittyCount ? solitaire.kittyCount : originalDeckLength;
        // paranoia will destroya
        if(!count) throw new Error(`Internal error; solitaire dealt to kitty successfully but we don't think there were any cards in the deck 😢`);

        console.log(`original kitty: ${originalKitty} new kitty: ${newKitty}; count = ${count}`);

        let animations = [];

        let kittyCount = solitaire.kittyCount;

        let maxKs;
        // if k is in the original kitty, there's nothing to slide;
        // if k j is in the original kitty, we need to slide the jack
        // if k j 4 is in the original kitty, we need to slide jack & 4
        for(let index = 1; index < originalKitty.length; index++) {
            maxKs = `ks-${index}`;
            let animation = {
                id: maxKs,
                type: (ctx,animation) => this.#slide(ctx,animation),
                card: originalKitty[index],
                duration: 250* index,
                start: () => {
                    delete this.#cards[`kitty-${index}`];
                },
                startPosition: this.#bounds.kitty[`kitty-${index}`]
            };
            let destinationPosition = index - count;
            if(destinationPosition < 0) {
                animation.endPosition =  this.#bounds.kitty[`kitty-0`];
                if(index == 1) {
                    animation.finish = (ctx,animation) => {
                        this.#cards['kitty-0'] = {
                            card: originalKitty[index],
                            bounds: this.#bounds.kitty[`kitty-0`],
                            isDown: false
                        }
                        this.#renderCard(ctx,'kitty-0');
                    }
                }
            }
            else {
                animation.endPosition = this.#bounds.kitty[`kitty-${index - count}`];
                animation.finish = (ctx,animation) => {
                    this.#cards[`kitty-${index - count}`] = {
                        card: originalKitty[index],
                        bounds: {...this.#bounds.kitty[`kitty-${index - count}`]},
                        isDown: false
                    };
                    this.#renderCard(ctx,`kitty-${index - count}`);
                }
            }
            animations.push(animation);
        }

        let shift = 0;
        // okl 12 c 3 => shift = 12
        if(originalKitty.length + count > kittyCount) shift = originalKitty.length + count - kittyCount;
        let kittyPromise = new Promise((resolve,reject) => {
            for(let index = 0; index < count; index++) {
                let destinationPosition = originalKitty.length + index - shift;
                let start = [];
                if(index == count - 1 && !solitaire.deckLength) start.push(() => delete this.#cards.deck);
                let id = `k${index}`;
                let kittyIndex = kittyCount - count + index;
                let animation = {
                    id,
                    type: (ctx,animation) => this.#flipCard(ctx,animation),
                    startPosition: this.#bounds.kitty.deckCard,
                    endPosition:  this.#bounds.kitty[`kitty-${destinationPosition}`],
                    duration: 500 + index * 250,
                    card: newKitty[destinationPosition],
                    down: true,
                    minimumTime: new Date(new Date().getTime() + 250 * index),
                    start,
                    finish: (ctx,animation) => {
                        this.#cards[`kitty-${destinationPosition}`] = {
                            card: newKitty[destinationPosition],
                            bounds: this.#bounds.kitty[`kitty-${destinationPosition}`],
                            isDown: false
                        }
                        this.#renderCard(ctx,`kitty-${destinationPosition}`);
                        if(index == count - 1) resolve();
                    }
                };
                if(index) animation.depends = `ks-${index - 1}`;
                else animation.depends = maxKs;
                animations.push(animation);
            }
        });

        this.#postAnimations.push(...animations);

        return kittyPromise.then(() => {
            if(solitaire.isWinner()) this.#canvasContainer.dispatchEvent(new CustomEvent('solitaire',{ detail: { type: 'winner' }, bubbles: true }));
            else this.#canvasContainer.dispatchEvent(new CustomEvent('solitaire',{ detail: { type: 'nowinner' }, bubbles: true }));
        });
    }

    #redeal() {
        let solitaire = this.#solitaire;
        let originalWholeKitty = solitaire.wholeKitty;
        let response = solitaire.redeal();
        this.#messages = [...response.messages];
        if(!response.success) return undefined;

        let animations = [];
        let redeal;
        let redealPromise = new Promise((resolve,reject) => {
            // a closure to redeal from the kitty to the deck.  We'll do this
            //  every 500ms or whatever until the kitty's been redealt.
            redeal = (index) => {
                let animation = {
                    id: `redeal-${index}`,
                    startPosition: {...this.#bounds.kitty['kitty-0']},
                    endPosition: {...this.#bounds.kitty.deck},
                    type: (ctx,animation) => this.#flipCard(ctx,animation),
                    card: originalWholeKitty[index],
                    down: false,
                    duration: 750,
                    start: (ctx,animation) => {
                        if(index) {
                            this.#cards['kitty-0'] = {
                                isDown: false,
                                card: originalWholeKitty[index - 1],
                                bounds: {...this.#bounds.kitty['kitty-0']}
                            };
                        }
                        else delete this.#cards['kitty-0'];
                    },
                    finish: (ctx,animation) => {
                        if(index == originalWholeKitty.length - 1 && !this.#cards.deck) {
                            this.#cards.deck = {
                                isDown: true,
                                bounds: this.#bounds.kitty.deckCard
                            };
                            this.#renderCard(ctx,'deck');
                        }
                    }
                };
                this.#postAnimations.push(animation);
                if(index > 0) setTimeout(() => redeal(index - 1),250);
                else resolve();
            }
        });

        // if the kitty has more than one card face up, slide them back
        //  into a stack.
        let calledRedeal = false;
        for(let index = 1; index < solitaire.kittyCount && index < originalWholeKitty.length; index++) {
            let last = index == solitaire.kittyCount - 1 || index == originalWholeKitty.length - 1;
            let card = originalWholeKitty[originalWholeKitty.length - solitaire.kittyCount + index];
            let animation = {
                id: `rs-${index}`,
                startPosition: this.#bounds.kitty[`kitty-${index}`],
                endPosition: this.#bounds.kitty[`kitty-0`],
                duration: 250 * index,
                card,
                type: (ctx,animation) => this.#slide(ctx,animation),
                start: () => delete this.#cards[`kitty-${index}`],
                finish: [
                    (ctx,animation) => {
                        this.#cards[`kitty-0`] = {
                            isDown: false,
                            card,
                            bounds: {...this.#bounds.kitty[`kitty-0`]}
                        }
                        this.#renderCard(ctx,'kitty-0');
                    }
                ]
            }
            if(last) {
                calledRedeal = true;
                animation.finish.push(() => {
                    setTimeout(() => redeal(originalWholeKitty.length - 1), 10);
                });
            }
            animations.push(animation);
        }

        if(!calledRedeal) redeal(originalWholeKitty.length - 1);

        this.#postAnimations.push(...animations);

        return redealPromise.then(() => {
            if(solitaire.isWinner()) this.#canvasContainer.dispatchEvent(new CustomEvent('solitaire',{ detail: { type: 'winner' }, bubbles: true }));
            else this.#canvasContainer.dispatchEvent(new CustomEvent('solitaire',{ detail: { type: 'nowinner' }, bubbles: true }));
        });
    }

    #performMove(from,to) {
        let solitaire = this.#solitaire;
        let originalKitty = solitaire.kitty;

        let originalFromLength;
        if(from.type == LocationType.COLUMN) originalFromLength = solitaire.getColumnLength(from.index);

        let originalToLength;
        if(to.type == LocationType.COLUMN) originalToLength = solitaire.getColumnLength(to.index);

        let result = solitaire.performMove(from,to);
        this.#messages = [...result.messages];
        if(!result.success) return undefined;

        let minHeight = this.#getConfigCardMinHeight();

        let idFrom;
        let idTo;
        let card;
        let startPosition;
        let endPosition;
        let finish = [];
        let start = [];
        let duration;
        let preAnimations = [];
        let postAnimations = [];
        let fromPromises = [];
        let toPromises = [];

        if(from.type == LocationType.KITTY) {
            let newKitty = solitaire.kitty;
            let originalKittyIndex = originalKitty.length - 1;
            card = originalKitty[originalKitty.length - 1];
            idFrom = 'k';
            startPosition = {...this.#bounds.kitty[`kitty-${originalKittyIndex}`]};
            start.push((ctx,animation) => {
                delete this.#cards[`kitty-${originalKittyIndex}`];
                this.#renderBackground(ctx,{...this.#bounds.kitty[`kitty-${originalKittyIndex}`]});
            });
            // see if we need to reveal a card in the kitty;
            // when moving the "4" from kitty:
            // 9 a k 4 => a k => 9 a k
            if(newKitty.length == solitaire.kittyCount) {
                for(let index = 1; index < solitaire.kittyCount; index++) {
                    fromPromises.push(new Promise((resolve,reject) => {
                        let animation = {
                            id: `ks-${index}`,
                            type: (ctx,animation) => this.#slide(ctx,animation),
                            start: (ctx,animation) => {
                                // when we slide the first card, we need to
                                //  reveal the card beneath
                                if(index == 1) this.#cards[`kitty-0`] = {
                                    isDown: false,
                                    card: newKitty[0],
                                    bounds: {...this.#bounds.kitty[`kitty-0`]}
                                }
                                else {
                                    // when moving the second card, we need to
                                    //  delete the card before, i.e., that's the
                                    //  one we're moving.  e.g., when index is
                                    //  1, we reveal the 0 card.  When index is
                                    //  2, we're moving the card from position
                                    //  1.  So delete it.  the previous animation
                                    //  will set it on finish.
                                    delete this.#cards[`kitty-${index - 1}`];
                                    this.#renderBackground(ctx,{...this.#bounds.kitty[`kitty-${index - 1}`]});
                                }
                            },
                            card: newKitty[index],
                            startPosition: {...this.#bounds.kitty[`kitty-${index - 1}`]},
                            endPosition: {...this.#bounds.kitty[`kitty-${index}`]},
                            duration: 500,
                            finish: (ctx,animation) => {
                                // set the kitty card.
                                this.#cards[`kitty-${index}`] = {
                                    isDown: false,
                                    card: newKitty[index],
                                    bounds: {...this.#bounds.kitty[`kitty-${index}`]}
                                }
                                this.#renderCard(ctx,`kitty-${index}`);
                                resolve();
                            }
                        };
                        //  do this to ensure cards to the right in the
                        //  kitty are rendered on top.
                        if(index > 1) animation.depends = `ks-${index - 1}`;
                        preAnimations.push(animation);
                    }));
                }
            }
        }
        else if(from.type == LocationType.UPSUIT) {
            idFrom = `u${from.index}`;
            startPosition = {...this.#bounds.upSuit[`card-${from.index}`]};
            card = this.#cards[`upSuit-${from.index}`].card;
            start.push((ctx,animation) => {
                if(solitaire.getUpSuitLength(from.index)) {
                    this.#cards[`upSuit-${from.index}`] = {
                        isDown: false,
                        card: solitaire.peekUpSuit(from.index),
                        bounds: {...this.#bounds.upSuit[`card-${from.index}`]}
                    }
                    this.#renderCard(ctx,`upSuit-${from.index}`);
                    return;
                }
                delete this.#cards[`upSuit-${from.index}`];
                this.#renderBackground(ctx,{...this.#bounds.upSuit[`card-${from.index}`]});
            });
        }
        else if(from.type == LocationType.COLUMN) {
            idFrom = `c${from.index}`;
            let offset;
            if(from.offset < 0) offset = originalFromLength[0] + from.offset;
            else offset = originalFromLength[1] + from.offset;
            startPosition = {...this.#bounds.board[`column-${from.index}-${offset}`]};
            card = [];
            let cardsToDelete = [];
            while(offset < originalFromLength[0]) {
                let cardToDelete = `board-${from.index}-${offset}`;
                cardsToDelete.push(cardToDelete);
                card.push(this.#cards[cardToDelete].card);
                offset++;
            }
            start.push((ctx,animation) => {
                for(let cardToDelete of cardsToDelete) delete this.#cards[cardToDelete];
                this.#calculateColumnBounds(from.index);
                this.#resizeForBoard();
                this.#reboundCards();
            });
            finish.push((ctx,animation) => {
                this.#calculateColumnBounds(from.index);
                this.#initializeColumnCards(from.index);
            });
            if(card.length == originalFromLength[2] && originalFromLength[1]) {
                let startBounds = {...this.#bounds.board[`column-${from.index}-${originalFromLength[1] - 1}`]};
                let endBounds = {...startBounds};
                let flipCardOffset = originalFromLength[1] - 1;
                let flipCard = solitaire.peekColumnCard(from.index, flipCardOffset);
                fromPromises.push(new Promise((resolve,reject) => {
                    preAnimations.push({
                        id: `fromFlip`,
                        startPosition: startBounds,
                        endPosition: endBounds,
                        type: (ctx,animation) => this.#flipCard(ctx,animation),
                        card: flipCard,
                        down: true,
                        duration: 500,
                        start: (ctx,animation) => {
                            // delete the existing down card that we're
                            //  animating.  We'll set it in the finish.
                            delete this.#cards[`board-${from.index}-${flipCardOffset}`];
                            if(flipCardOffset) {
                                // now - if there was a card underneath the one
                                //  we're flipping, render it, and draw the
                                //  little bit of background beneath it and
                                //  under the card we're flipping.
                                this.#renderCard(ctx,`board-${from.index}-${flipCardOffset - 1}`);
                                let backgroundBounds = {...this.#bounds.board[`column-${from.index}-${flipCardOffset - 1}`]};
                                backgroundBounds.y += minHeight;
                                backgroundBounds.height = minHeight * this.#getConfigStackDownCardVisibleRatio();
                                this.#renderBackground(ctx,backgroundBounds);
                            }
                            else {
                                // if this is the top card in the column,
                                //  render the background that was
                                //  underneath the one we're flipping
                                this.#renderBackground(ctx,{...this.#bounds.board[`column-${from.index}-${flipCardOffset}`]});
                            }
                        },
                        finish: (ctx,animation) => {
                            // subtle - be sure the record for this card shows
                            //  that it's flipped
                            this.#cards[`board-${from.index}-${flipCardOffset}`] = {
                                card: flipCard,
                                isDown: false,
                                bounds: this.#bounds.board[`column-${from.index}-${flipCardOffset}`]
                            };
                            this.#renderCard(ctx,`board-${from.index}-${originalFromLength[1] - 1}`);
                            resolve();
                        }
                    })
                }));
            }
        }
        else throw new Error(`Somehow I'm trying to move from ${from.type}`);

        if(to.type == LocationType.UPSUIT) {
            idTo = `u${to.index}`;
            endPosition = {...this.#bounds.upSuit[`card-${to.index}`]};
            finish.push((ctx,animation) => {
                let usCard;
                if(Array.isArray(animation.card)) usCard = animation.card[0];
                else usCard = animation.card;
                this.#cards[`upSuit-${to.index}`] = {
                    isDown: false,
                    card: usCard,
                    bounds: this.#bounds.upSuit[`card-${to.index}`]
                };
                this.#renderCard(ctx,`upSuit-${to.index}`);
            });
            duration = 750;
        }
        else if(to.type == LocationType.COLUMN) {
            idTo = `c${to.index}`;
            endPosition = {...this.#bounds.board[`column-${to.index}-${originalToLength[0]}`]};
            start.push((ctx,animation) => {
                this.#calculateColumnBounds(to.index);
                this.#resizeForBoard();
                this.#reboundCards();
            });
            finish.push((ctx,animation) => {
                let cards;
                if(!Array.isArray(card)) cards = [ card ];
                else cards = card;
                this.#calculateColumnBounds(to.index);
                this.#initializeColumnCards(to.index);
                for(let index = 0; index < cards.length; index++) {
                    this.#renderCard(ctx,`board-${to.index}-${originalToLength[0] + index}`);
                }
            });
            duration = 750;
        }
        else throw new Error(`Inexplicably, I am moving to ${to.type}???`);

        let animationPromise = new Promise((resolve,reject) => {
            finish.push(() => resolve());
        });

        let animation = {
            id: `${idFrom}-${idTo}`,
            type: (ctx,animation) => this.#slide(ctx,animation),
            card,
            startPosition,
            endPosition,
            duration,
            start,
            finish,
            duration
        };

        let animations = [];
        if(preAnimations) animations.push(...preAnimations);
        animations.push(animation);
        if(postAnimations) animations.push(...postAnimations);
        this.#postAnimations.push(...animations);

        return Promise.all([...fromPromises,animationPromise,...toPromises]).then(() => {
            if(solitaire.isWinner()) this.#canvasContainer.dispatchEvent(new CustomEvent('solitaire',{ detail: { type: 'winner' }, bubbles: true }));
            else this.#canvasContainer.dispatchEvent(new CustomEvent('solitaire',{ detail: { type: 'nowinner' }, bubbles: true }));
        });
    }

    doFini(redealt,count,resolve,reject) {
        // ok - a little abusive.  We'll return a promise from the first time
        //  we're called that we'll resolve (or reject...) appropriately.  To
        //  do so, we only pass resolve/reject handlers and use them to
        //  determine whether to create/return the promise
        let doFiniPromise;
        if(typeof resolve === 'undefined') {
            doFiniPromise = new Promise((resolveMethod, rejectMethod) => {
                resolve = resolveMethod;
                reject = rejectMethod;
            });
        }
        let finiFinished = () => {
            this.#messages = [
                new GameMessage(`Fini finished`)
            ];
            resolve();
        }
        if(typeof redealt === 'undefined') redealt = false;
        if(typeof count === 'undefined') count = 0;
        count++;
        if(count == 100) {
            this.#messages = [
                new GameMessage(`Fini tried but failed to complete 😿`)
            ]
            reject();
            return;
        }
        let move = this.#solitaire.doFini();
        if(!move) {
            finiFinished();
            return;
        }
        let animationPromise;
        if(move == 'deal') {
            animationPromise = this.#dealToKitty();
        }
        if(!animationPromise && (move == 'redeal')) {
            if(redealt) {
                finiFinished();
                return;
            }
            redealt = true;
            animationPromise = this.#redeal();
        }
        if(!animationPromise) {
            if(!Array.isArray(move) || move.length != 2) throw new Error(`Got a weird thing back from doFini - not an array/not length 2 :(`);
            animationPromise = this.#performMove(...move);
            redealt = false;
        }
        animationPromise.then(() => {
            this.doFini(redealt,count + 1,resolve,reject);
        });

        return doFiniPromise;
    }

    #renderAnimations(ctx) {
        if(!this.#animations.length) return;
        let animationsInFlight = {};
        let finishedAnimationIndexes = [];
        for(let animation of this.#animations) animationsInFlight[animation.id] = 1;
        for(let index in this.#animations) {
            let animation = this.#animations[index];
            if(!animation.duration) throw new Error(`animation ${animation.id} has no duration!`);
            // if there's a minimum time set for the animation and we
            //  haven't exeeded it yet, keep going.
            if(animation.minimumTime && new Date() < animation.minimumTime) continue;
            if(!animation.startTime) {
                // i.e., animation hasn't started yet, so start it
                animation.startTime = new Date();
                animation.percentage = 0;
                if(animation.hasOwnProperty('start')) {
                    if(!Array.isArray(animation.start)) animation.start(ctx,animation);
                    else animation.start.forEach((s) => s(ctx,animation));
                }
            }
            else {
                // calculate the percent the animation is complete,
                //  based upon the startTime and duration
                animation.percentage = (new Date() - animation.startTime)/ animation.duration;
                if(animation.percentage < 0) animation.percentage = 0;
                else if(animation.percentage > 1) animation.percentage = 1;
            }
            if(animation.percentage >= 1) {
                // animation is complete
                // let's see if animation is dependent upon another.  If
                //  so, let's verify the other one isn't still in flight
                let canProceed = true;
                if(animation.hasOwnProperty('depends')) {
                    if(!Array.isArray(animation.depends)) { if(animationsInFlight.hasOwnProperty(animation.depends)) canProceed = false; }
                    else animation.depends.forEach((d) => { if(animationsInFlight.hasOwnProperty(d)) canProceed = false; });
                }
                if(!canProceed) continue;

                if(animation.hasOwnProperty('finish')) {
                    if(!Array.isArray(animation.finish)) animation.finish(ctx,animation);
                    else animation.finish.forEach((f) => f(ctx,animation));
                }
                delete animationsInFlight[animation.id];
                finishedAnimationIndexes.push(index);
                continue;
            }
            if(animation.hasOwnProperty('type')) {
                // call the animation's function, if defined
                if(!Array.isArray(animation.type)) animation.type(ctx,animation);
                else animation.type.forEach((t) => t(ctx,animation));
            }
        }

        // delete the animations that have completed; sort their indexes
        //  in descending order first (because splicing them out will
        //  change the indexes of subsequent animations..)
        finishedAnimationIndexes.sort((a,b) => {
            if(a > b) return 1;
            if(a < b) return -1;
            return 0;
        });

        for(let index of finishedAnimationIndexes.reverse()) {
            this.#animations.splice(index,1);
        }
    }

    #click(e) {
        if(this.#animations.length) return;
        let inBounds = (e,bounds) => {
            return bounds
                && e.offsetX >= bounds.x
                && e.offsetX <= (bounds.x + bounds.width)
                && e.offsetY >= bounds.y
                && e.offsetY <= (bounds.y + bounds.height);
        }
        let solitaire = this.#solitaire;
        let response;

        // always clear anything typed at this point
        this.#typing = undefined;

        // if they select the same thing over again, clear the selection,
        //  no fuss, no muss
        if(this.#selected && inBounds(e,this.#selected)) {
            this.#selected = undefined;
            this.#locations = []
            this.#messages = undefined;
            return;
        }
        if(inBounds(e,this.#bounds.kitty.deck)) {
            if(this.#locations.length || this.#selected) {
                this.#messages = [
                    new GameMessage(`Invalid Move!`)
                ];
                this.#locations = [];
                this.#selected = undefined;
            }
            else if(!solitaire.deckLength && !solitaire.kittyLength) {
                this.#messages = [
                    new GameMessage(`Invalid Move!`)
                ];
            }
            else {
                if(solitaire.deckLength) this.#dealToKitty();
                else this.#redeal();
            }
            return;
        }
        let selected;
        if(!selected) {
            let kittyIndex = (this.#solitaire.kittyLength > 3 ? 3 : this.#solitaire.kittyLength) - 1;
            if(kittyIndex >= 0 && inBounds(e,this.#bounds.kitty[`kitty-${kittyIndex}`])) {
                this.#locations.push(new Location('k'));
                selected = {...this.#bounds.kitty[`kitty-${kittyIndex}`]};
            }
        }
        if(!selected) {
            for(let index = 0; index < this.#solitaire.upSuitCount; index++) {
                if(inBounds(e,this.#bounds.upSuit[index])) {
                    this.#locations.push(new Location(`u${index + 1}`));
                    selected = {...this.#bounds.upSuit[index]};
                    break;
                }
            }
        }
        if(!selected) {
            for(let index = 0; index < this.#solitaire.columnCount; index++) {
                let columnLetter = SolitaireBoard.columnLetterOf(index)
                let columnLength = solitaire.getColumnLength(index);
                // if the column is empty, check if they've clicked in the
                //  empty column region
                if(!columnLength[0] && inBounds(e,this.#bounds.board[`column-${index}`])) {
                    selected = {...this.#bounds.board[`column-${index}`]};
                    this.#locations.push(new Location(columnLetter));
                    break;
                }
                for(let offset = columnLength[0] - 1; offset >= 0; offset--) {
                    // can't select face-down cards
                    if(offset < columnLength[1]) break;
                    let offsetBounds = this.#bounds.board[`column-${index}-${offset}`];
                    if(inBounds(e,offsetBounds)) {
                        if(!columnLength[0]) this.#locations.push(new Location(columnLetter));
                        else this.#locations.push(new Location(`${columnLetter}${offset - columnLength[0]}`));
                        selected = {...offsetBounds};
                        // select not just the card, but any visible cards
                        //  on top of it, too
                        offset++;
                        while(offset < columnLength[0]) {
                            offsetBounds = this.#bounds.board[`column-${index}-${offset}`];
                            if(offsetBounds.y + offsetBounds.height > selected.y + selected.height) selected.height = offsetBounds.y + offsetBounds.height - selected.y;
                            offset++;
                        }
                        break;
                    }
                }
                // don't keep looping through columns.
                if(selected) break;
            }
        }

        this.#selected = undefined;
        this.#messages = undefined;
        if(!selected) {
            this.#locations = [];
            return;
        }
        if(this.#locations.length == 1) {
            this.#selected = selected;
            return;
        }

        this.#performMove(...this.#locations);
        this.#locations = [];
    }

    #keyUp(e) {
        if(this.#animations.length) return;
        if(this.#locations || this.#selected) {
            this.#locations = [];
            this.#selected = undefined;
            this.#messages = undefined;
        }
        if(!e.altKey && !e.ctrlKey && !e.metaKey) {
            if(!this.#typing) this.#typing = '';
            if(e.key.match(/^[\p{Letter}\p{Number}\s]$/u)) {
                this.#typing += e.key;
            }
            else if(e.key.toLowerCase() == 'escape') {
                this.#typing = undefined;
            }
            else if(e.key.toLowerCase() == 'backspace') {
                // TODO - I don't think this work work in kanji or with other
                //  multi-byte characters
                this.#typing = this.#typing.substring(0,this.#typing.length - 1);
            }
            else if(e.key.toLowerCase() == 'enter') {
                let input = this.#typing;
                this.#typing = undefined;
                if(input == 'fini') this.doFini();
                else if(input == 'deal') this.#dealToKitty();
                else if(input == 'redeal') this.#redeal();
                else if(input == 'reset') this.reset();
                else if(input == 'pizzapart') {
                    alert('You found the secret sauce!!!!');
                }
                else {
                    let moveMatch = input.match(SolitaireGame.MOVE_REGEX);
                    if(!moveMatch) {
                        this.#messages = [
                            new GameMessage(`Invalid move!  Try again, fathead!`)
                        ];
                    }
                    else {
                        let from = new Location(moveMatch[1]);
                        let to = new Location(moveMatch[2]);
                        this.#performMove(from,to);
                    }
                }
            }
        }
    }

    #flipCard(ctx,animation) {
        if(!animation.hasOwnProperty('card')) throw new Error(`flip animation has no card!`);
        let startX = animation.startPosition.x;
        let endX = animation.endPosition.x;
        let startY = animation.startPosition.y;
        let endY = animation.endPosition.y;
        let x = startX + (endX - startX) * animation.percentage;
        let y = startY + (endY - startY) * animation.percentage;
        let effectivePercentage = animation.percentage;
        if(animation.percentage >= 0.5) effectivePercentage = 1 - animation.percentage;
        effectivePercentage = (0.5 - effectivePercentage) * 2;
        let width = animation.startPosition.width * effectivePercentage;
        let height = animation.startPosition.height;
        x = x + (animation.startPosition.width - width) / 2;
        if(((!animation.hasOwnProperty('down') || animation.down) && animation.percentage < 0.5) || ((!animation.hasOwnProperty('down') || !animation.down) && animation.percentage >= 0.5)) this.#drawCardDown(ctx,{x,y,width,height},effectivePercentage);
        else this.#drawCardUp(ctx,animation.card,{x,y,width,height},effectivePercentage);
    }

    #slide(ctx,animation) {
        let startX = animation.startPosition.x;
        let endX = animation.endPosition.x;
        let startY = animation.startPosition.y;
        let endY = animation.endPosition.y;
        let x = startX + (endX - startX) * animation.percentage;
        let y = startY + (endY - startY) * animation.percentage;
        if(!Array.isArray(animation.card)) this.#drawCardUp(ctx,animation.card,{x,y,width:animation.startPosition.width,height:animation.startPosition.height});
        else {
            let minHeight = this.#getConfigCardMinHeight();
            let yDelta = minHeight * this.#getConfigStackUpCardVisibleRatio();
            animation.card.forEach((c) => {
                this.#drawCardUp(ctx,c,{x,y,width:animation.startPosition.width,height:animation.startPosition.height})
                y += yDelta;
            });
        }
    }
}

// https://stackoverflow.com/a/7592676
CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius, fill, stroke) {
    var cornerRadius = { hRoundness: 0, vRoundness: 0 };
    if (typeof stroke == "undefined") {
        stroke = true;
    }
    if (typeof radius === "object") {
        for (var side in radius) {
            cornerRadius[side] = radius[side];
        }
    }

    this.beginPath();
    this.moveTo(x + cornerRadius.hRoundness, y);
    this.lineTo(x + width - cornerRadius.hRoundness, y);
    this.quadraticCurveTo(x + width, y, x + width, y + cornerRadius.vRoundness);
    this.lineTo(x + width, y + height - cornerRadius.vRoundness);
    this.quadraticCurveTo(x + width, y + height, x + width - cornerRadius.hRoundness, y + height);
    this.lineTo(x + cornerRadius.hRoundness, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - cornerRadius.vRoundness);
    this.lineTo(x, y + cornerRadius.vRoundness);
    this.quadraticCurveTo(x, y, x + cornerRadius.hRoundness, y);
    this.closePath();
    if (stroke) {
        this.stroke();
    }
    if (fill) {
        this.fill();
    }
}
