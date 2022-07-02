// https://codepen.io/kazaak/pen/MWVYewm
import { CardSuit } from './Card.js';
import { Location } from './Location.js';
import GameMessage from './GameMessage.js';
import { SolitaireBoard } from './SolitaireBoard.js';
import SolitaireGame from './SolitaireGame.js';

export default class SolitaireCanvasRenderer {
    get pending() { return this.#downCardPromise; }
    #config;
    #canvasContainer;
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
    #upSuitBounds;
    #boardBounds;
    #animations;

    constructor(config,canvasContainer,canvas,solitaire) {
        this.#config = config
        this.#canvasContainer = canvasContainer;
        this.#canvas = canvas;
        this.#solitaire = solitaire;
        this.#locations = [];
        if(!this.#config.bgImage) throw new Error(`You must specify bgImage!`);
        if(!this.#config.hasOwnProperty('card')) throw new Error(`I can't find the configuration for cards! :(`);
        this.#downCardPromise = this.#loadCardBackground();
        let resize = () => {
            this.#calculateKittyBounds();
            let canvasHeight = this.#calculateCanvasHeight();
            this.#canvas.height = canvasHeight;
            this.#canvasContainer.height = `${canvasHeight}px`;
            this.#canvas.width = this.#canvasContainer.clientWidth;
        }
        resize();
        this.#downCardPromise.then((results) => {
            this.#initializeCards();
            this.#cardBackSvg = results[0];
            this.#bgImageRenderingProperties = results[1];
            this.#canvas.onclick = (e) => {
                this.#click(e);
            };
            document.onkeyup = (e) => {
                this.#keyUp(e);
            };
            document.body.onresize = (e) => {
                resize();
                this.render();
            };
        });
    }

    render() {
        if(!this.#cardBackSvg || !this.#bgImageRenderingProperties) throw new Error(`Too soon: I haven't loaded the background image for the cards...`);
        let canvasHeight = this.#calculateCanvasHeight();
        this.#canvas.height = canvasHeight;
        this.#doRender();
        this.#renderMessages();
    }

    #initializeCards() {
        this.#cards = { };
        if(this.#solitaire.deckLength) {
            this.#cards.deck = {
                isDown: true,
                bounds: this.#bounds.kitty.deckCard
            };
        }
        if(this.#solitaire.kittyLength) {
            let kitty = this.#solitaire.kitty;
            for(let index = 0; index < kitty.length; index++) {
                this.#cards[`kitty-${index}`] = {
                    card: kitty[index],
                    bounds: this.#bounds.kitty[`kitty-${index}`],
                    isDown: false
                };
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
        if(this.#typing) {
            this.#renderTyping(ctx,padding,this.#canvasContainer.clientWidth);
        }
    }

    #renderCards(ctx) {
        for(let card of Object.values(this.#cards)) {
            if(card.isDown) this.#drawCardDown(ctx,card.bounds);
            else this.#drawCardUp(ctx,card.card,card.bounds);
        }
    }

    #renderMessages() {
        if(this.#messageBoard) {
            this.#messageBoard.remove();
        }
        if(this.#messages && this.#messages.length) {
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
                    this.#messageBoard.append(spacer);
                }
                first = false;
                let messageDiv = document.createElement('div');
                messageDiv.classList.add('message',`${message.severity.toLowerCase()}`);
                messageDiv.innerHTML = message.message;
                this.#messageBoard.append(messageDiv);
            }
            this.#messageBoard.onclick = (e) => {
                this.#messageBoard.remove();
            };
            this.#canvasContainer.append(this.#messageBoard);
        }
    }

    #renderTyping(ctx,padding,width) {
        this.#label(ctx,this.#typing,width/ 2,padding);
    }

    #calculateCanvasHeight() {
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        let canvasHeight = this.#bounds.kitty.kittyBounds.y + this.#bounds.kitty.kittyBounds.height;

        // def-o kludgey here; we want to calculate the height of the board,
        //  we'll go through, figure out the column with the most cards,
        //  figure out the height of that, and add to canvas height from
        //  kitty;
        let maxCardCount = 0;
        for(let index = 0; index < this.#solitaire.columnCount; index++) {
            let columnCount = this.#solitaire.getColumnLength(index);
            if(columnCount[0] > maxCardCount) maxCardCount = columnCount[0];
        }
        if(maxCardCount) {
            canvasHeight += (maxCardCount - 1) * (minHeight / this.#getConfigStackUpCardVisibleRatio());
            canvasHeight += minHeight;
            // for the bottom below
            canvasHeight += padding;
        }
        return canvasHeight;
    }

    #renderBoard(ctx,width,height,minWidth,minHeight) {
        let solitaire = this.#solitaire;
        let boardStartY = this.#calculateKittyBottom();
        let emptyBoardColour = this.#config.emptyBoardColour ? this.#config.emptyBoardColour : 'green';
        let boardColumnSpacing = minWidth / 5;
        let lineWidth = 3;
        let boardWidth = solitaire.columnCount * (minWidth+ lineWidth* 2) + boardColumnSpacing * (solitaire.columnCount - 1);
        let boardStartX = (width - boardWidth) / 2;
        ctx.lineWidth = lineWidth;
        let offset = 0;
        let saveBoardStartX = boardStartX;
        let boardBounds = [];
        let boardBottom = 0;
        while(true) {
            let any = false;
            boardStartX = saveBoardStartX;
            for(let index = 0; index < solitaire.columnCount; index++) {
                if(boardBounds.length < solitaire.columnCount) boardBounds.push([]);
                if(index) boardStartX += (minWidth+ lineWidth* 2+ boardColumnSpacing);
                let columnLength = solitaire.getColumnLength(index);
                if(!columnLength[0]) {
                    if(!offset) {
                        ctx.strokeStyle = emptyBoardColour;
                        ctx.beginPath();
                        boardBounds[index].push({
                            x: boardStartX, y: boardStartY,
                            width: minWidth+lineWidth*2, height: minHeight+lineWidth*2
                        });
                        if(boardStartY + minHeight+lineWidth*2 > boardBottom) boardBottom = boardStartY + minHeight+lineWidth*2;
                        ctx.rect(boardStartX,boardStartY,minWidth+lineWidth*2,minHeight+lineWidth*2);
                        ctx.closePath();
                        ctx.stroke();
                        any = true;
                    }
                    continue;
                }
                if(offset < columnLength[1]) {
                    this.#drawCardDown(ctx,{ x: boardStartX + lineWidth, y: boardStartY + lineWidth });
                    any = true;
                    boardBounds[index].push({
                        x: boardStartX, y: boardStartY,
                        width: minWidth+lineWidth*2, height: minHeight+lineWidth*2
                    });
                    if(boardStartY + minHeight+lineWidth*2 > boardBottom) boardBottom = boardStartY + minHeight+lineWidth*2;
                    continue;
                }
                if(offset < columnLength[0]) {
                    let card = solitaire.peekColumnCard(index, offset);
                    this.#drawCardUp(ctx,card,{ x: boardStartX + lineWidth, y: boardStartY + lineWidth, width: minWidth, height: minHeight });
                    any = true;
                    boardBounds[index].push({
                        x: boardStartX, y: boardStartY,
                        width: minWidth+lineWidth*2, height: minHeight+lineWidth*2
                    });
                    if(boardStartY + minHeight+lineWidth*2 > boardBottom) boardBottom = boardStartY + minHeight+lineWidth*2;
                    continue;
                }

                // don't really need to continue in the last case above, nothing
                //  to do, but imo continue above is better for consistency...
            }
            if(!any) break;
            offset++;
            boardStartY += minHeight * this.#getConfigStackUpCardVisibleRatio();
        }
        this.#boardBounds = boardBounds;
        return boardBottom;
    }

    #renderUpSuits(ctx,width,height,padding,minWidth,minHeight) {
        let solitaire = this.#solitaire;
        let emptyUpSuitColour = this.#config.emptyUpSuitColour ? this.#config.emptyUpSuitColour : 'white';
        let labelPadding = this.#getConfigLabelPadding(padding);
        let upSuitX = width - padding;
        let upSuitY = padding;
        let lineWidth = 3;
        let upSuitRectWidth = minWidth + 2* lineWidth;
        let upSuitRectHeight = minHeight + 2* lineWidth;
        let upSuitSpacing = minWidth / 3;
        let upSuitBounds = [];
        for(let index = solitaire.upSuitCount; index >= 1; index--) {
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = emptyUpSuitColour;
            ctx.beginPath();
            ctx.rect(upSuitX - upSuitRectWidth,upSuitY,upSuitRectWidth,upSuitRectHeight);
            ctx.closePath();
            ctx.stroke();
            upSuitX -= upSuitRectWidth;
            upSuitBounds.unshift({
                x: upSuitX, y: upSuitY,
                width: upSuitRectWidth, height: upSuitRectHeight
            });
            this.#label(ctx,`U   ${index}`,upSuitX + upSuitRectWidth / 2,upSuitY + upSuitRectHeight + labelPadding,undefined,undefined,undefined,'top');
            if(solitaire.getUpSuitLength(index - 1)) {
                let upSuitCard = solitaire.peekUpSuit(index - 1);
                this.#drawCardUp(ctx,upSuitCard,{ x: upSuitX + lineWidth, y: upSuitY + lineWidth, width: minWidth, height: minHeight });
            }
            upSuitX -= upSuitSpacing;
        }
        this.#upSuitBounds = upSuitBounds;
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
        kittyY += deckOffsetY;
        for(let index = 0; index < solitaire.kittyCount; index++) {
            this.#bounds.kitty[`kitty-${index}`] = {
                x: kittyX,y: kittyY,width: minWidth, height: minHeight
            }
            kittyX += minWidth * this.#getConfigKittyShownCardPercentage();
        }
    }

    #calculateKittyBottom() {
        return this.#bounds.kitty.kittyBounds.y + this.#bounds.kitty.kittyBounds.height;
    }

    #calculateBoardBounds() {
        let solitaire = this.#solitaire;
        let width = canvas.offsetWidth;
        let height = canvas.offsetHeight;
        let boardStartY = this.#calculateKittyBottom();
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let boardColumnSpacing = minWidth * this.#getConfigBoardColumnPaddingRatio();
        let lineWidth = 3;
        let boardWidth = solitaire.columnCount * (minWidth+ lineWidth* 2) + boardColumnSpacing * (solitaire.columnCount - 1);
        let boardStartX = (width - boardWidth) / 2;
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
            this.#bounds.board[`column-${index}`] = {...bounds};
            let columnLength = solitaire.getColumnLength(index);
            for(let offset = 0; offset < columnLength[0]; offset++) {
                bounds = {
                    x: boardStartX + lineWidth,
                    y: boardY + lineWidth,
                    width: minWidth,
                    height: minHeight,
                }
                if(boardY + lineWidth + minHeight > maxY) maxY = boardY + lineWidth + minHeight > maxY;
                this.#bounds[`column-${index}-${offset}`] = bounds;
                if(offset < columnLength[1]) boardY += minHeight * this.#getConfigStackDownCardVisibleRatio();
                else boardY += minHeight * this.#getConfigStackUpCardVisibleRatio();
            }
            boardStartX += (minWidth+ lineWidth* 2+ boardColumnSpacing)
        }
        this.#bounds.board.boardBounds = {
            x: (width - boardWidth) / 2,
            y: this.#calculateKittyBottom(),
            width: boardWidth,
            height: maxY - this.#calculateKittyBottom()
        }
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

/*
        if(solitaire.kittyLength) {
            let kitty = solitaire.kitty;
            for(let index = 0; index < kitty.length; index++) {
                let card = kitty[index];
                let bounds = this.#bounds.kitty[`kitty-${index}`];
                this.#drawCardUp(ctx,card,bounds);
            }
        }
 */
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

    #drawCardDown(ctx,bounds) {
        let svgImage = this.#cardBackSvg;
        let bgImage = this.#config.card.bgImage;
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

    #getConfigStackUpCardVisibleRatio() {
        return this.#config.stackUpCardVisibleRatio ? this.#config.this.#config.stackUpCardVisibleRatio : 1 / 5;
    }

    #getConfigStackDownCardVisibleRatio() {
        return this.#config.stackDownCardVisibleRatio ? this.#config.this.#config.stackDownCardVisibleRatio : 1 / 6;
    }

    #getConfigBoardColumnPaddingRatio() {
        return this.#config.boardColumnPaddingRatio ? this.#config.this.#config.boardColumnPaddingRatio : 1 / 5;
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
        return config.strokeColour ? config.strokeColour : 'blue';
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
        let originalKitty = this.#solitaire.kitty;
        let response = this.#solitaire.dealToKitty();
        if(!response) return response;
        let newKitty = this.#solitaire.kitty;
        let count = newKitty.length;
        // this would be easier if solitaire returned the new cards dealt
        //  to the kitty in the response.  Instead, let's figure out if
        //  there was overlap with the last card in the original kitty and
        //  the new kitty; whatever index indicates how many cards are left
        //  over; if we match at index zero, there's 1 card left over so
        //  only 2 were dealt, assuming 3 cards in kitty: hence add 1 below
        if(originalKitty.length) {
            let ok = originalKitty[originalKitty.length - 1];
            let matchedIndex = newKitty.indexOf(nk => (nk.value == ok.value) && (nk.suit == ok.suit));
            if(matchedIndex != -1) count -= (matchedIndex + 1);
        }

        if(!this.#animations) this.#animations = [];
        let kittyCount = this.#solitaire.kittyCount;

        let slideCount = originalKitty.length + count - kittyCount;
        if(slideCount) {
            this.#cards['kitty-junk'] = {
                card: originalKitty[0],
                bounds: {...this.#bounds.kitty[`kitty-0`]},
                isDown: false
            }
            for(let index = 1; index < originalKitty.length; index++) {
                let animation = {
                    id: `ks-${index}`,
                    type: (ctx,animation) => this.#slide(ctx,animation),
                    card: originalKitty[index],
                    duration: 500* index,
                    start: () => delete this.#cards[`kitty-${index}`],
                    startPosition: this.#bounds.kitty[`kitty-${index}`]
                };
                if(index - slideCount <= 0) {
                    animation.endPosition =  this.#bounds.kitty[`kitty-0`];
                    animation.finish = () => this.#cards['kitty-junk'] = {
                        card: originalKitty[index],
                        bounds: this.#bounds.kitty['kitty-0'],
                        isDown: false
                    };
                }
                else {
                    animation.endPosition = this.#bounds.kitty[`kitty-${index - slideCount}`];
                    animation.finish = () => this.#cards[`kitty-${index - slideCount}`] = {
                        card: oldKitty[index],
                        bounds: {...this.#bounds.kitty[`kitty-${index - slideCount}`]},
                        isDown: false
                    };
                }
                this.#animations.push(animation);
            }
        }

        let shift = 0;
        if(originalKitty.length + count > kittyCount) shift = originalKitty.length + count - kittyCount;
        let makeKittyFlip = (index) => {
            let destinationPosition = originalKitty.length + index - shift;
            let start;
            if(index == count - 1 && !this.#solitaire.deckLength) start = () => delete this.#cards.deck;
            let id = `k${index}`;
            let kittyIndex = kittyCount - count + index;
            let animation = {
                id,
                type: (ctx,animation) => this.#flipCard(ctx,animation),
                startPosition: this.#bounds.kitty.deckCard,
                endPosition:  this.#bounds.kitty[`kitty-${destinationPosition}`],
                duration: 1750 + index * 500,
                card: newKitty[kittyIndex],
                down: true,
                finish: () => {
                    if(!index) delete this.#cards['kitty-junk'];
                    this.#cards[`kitty-${kittyIndex}`] = {
                        card: newKitty[kittyIndex],
                        bounds: this.#bounds.kitty[`kitty-${kittyIndex}`],
                        isDown: false
                    }
                }
            };
            if(start) animation.start = [ start ];
            this.#animations.push(animation);
            if(index < count - 1) setTimeout(() => makeKittyFlip(index+1),750);
        }
        makeKittyFlip(0);

        return response;
    }

    #redeal() {
        let solitaire = this.#solitaire;
        let originalKitty = solitaire.wholeKitty;
        let response = solitaire.redeal();
        if(!response) return response;

        if(!this.#animations) this.#animations = [];
        // a closure to redeal from the kitty to the deck.  We'll do this
        //  every 500ms or whatever until the kitty's been redealt.
        let redeal = (index) => {
            let animation = {
                id: 'redeal',
                startPosition: {...this.#bounds.kitty['kitty-0']},
                endPosition: {...this.#bounds.kitty.deck},
                type: (ctx,animation) => this.#flipCard(ctx,animation),
                card: originalKitty[index],
                down: false,
                duration: 750,
                finish: () => {
                    if(index == originalKitty.length - 1 && !this.#cards.deck) {
                        this.#cards.deck = {
                            isDown: true,
                            bounds: this.#bounds.kitty.deckCard
                        };
                    }
                    if(index) this.#cards['kitty-0'] = {
                        isDown: false,
                        card: originalKitty[index - 1],
                        bounds: this.#bounds.kitty['kitty-0']
                    }
                    else delete this.#cards['kitty-0'];
                }
            };
            if(!this.#animations) this.#animations = [];
            this.#animations.push(animation);
            if(index > 0) setTimeout(() => redeal(index - 1),250);
            this.render();
        }

        // if the kitty has more than one card face up, slide them back
        //  into a stack.
        let calledRedeal = false;
        for(let index = 1; index < solitaire.kittyCount && index < originalKitty.length; index++) {
            let last = index == solitaire.kittyCount - 1 || index == originalKitty.length - 1;
            let card = originalKitty[originalKitty.length - solitaire.kittyCount + index];
            let animation = {
                id: `rs-${index}`,
                startPosition: this.#bounds.kitty[`kitty-${index}`],
                endPosition: this.#bounds.kitty[`kitty-0`],
                duration: 500 * index,
                card,
                type: (ctx,animation) => this.#slide(ctx,animation),
                start: () => delete this.#cards[`kitty-${index}`],
                finish: () => this.#cards[`kitty-0`] = {
                    isDown: false,
                    card,
                    bounds: {...this.#bounds.kitty[`kitty-0`]}
                }
            }
            if(last) {
                calledRedeal = true;
                animation.finish = () => {
                    // note, setTimeout: 0 => will run after animations render
                    setTimeout(() => redeal(originalKitty.length - 1), 0);
                }
            }
            this.#animations.push(animation);
        }

        if(!calledRedeal) redeal(originalKitty.length - 1);

        return response;
    }

    #renderAnimations(ctx) {
        if(!this.#animations) return;
        let startTime = new Date();
        let finishedAnimationIndexes = [];
        for(let index in this.#animations) {
            let animation = this.#animations[index];
            if(!animation.duration) throw new Error(`animation ${animation.id} has no duration!`);
            if(!animation.startTime) {
                animation.startTime = new Date();
                animation.percentage = 0;
                if(animation.hasOwnProperty('start')) {
                    if(!Array.isArray(animation.start)) animation.start(animation);
                    else animation.start.forEach((s) => s(animation));
                }
            }
            else {
                animation.percentage = (startTime - animation.startTime)/ animation.duration;
                if(animation.percentage < 0) animation.percentage = 0;
                else if(animation.percentage > 1) animation.percentage = 1;
            }
            if(startTime - animation.startTime > animation.duration) {
                if(animation.hasOwnProperty('finish')) {
                    if(!Array.isArray(animation.finish)) animation.finish(animation);
                    else animation.finish.forEach((f) => f(animation));
                }
                finishedAnimationIndexes.push(index);
                continue;
            }
            if(animation.hasOwnProperty('type')) {
                if(!Array.isArray(animation.type)) animation.type(ctx,animation);
                else animation.type.forEach((t) => t(ctx,animation));
            }
        }
        finishedAnimationIndexes.sort((a,b) => {
            if(a < b) return 1;
            if(a > b) return -1;
            return 0;
        });

        for(let index of finishedAnimationIndexes.reverse()) {
            this.#animations.splice(index,1);
        }
        if(this.#animations.length) {
            let fps = this.#config.fps ? this.#config.fps : 30;
            let msPerFrame = 1000/ fps;
            let duration = new Date() - startTime;
            let delay = 0;
            if(duration > msPerFrame) delay = 0;
            else setTimeout(() => this.render(),msPerFrame - duration);
        }
        else {
            this.#animations = undefined;
            this.render();
        }
    }

    #click(e) {
        if(this.#animations) return;
        let inBounds = (e,bounds) => {
            return bounds
                && e.layerX >= bounds.x
                && e.layerX <= (bounds.x + bounds.width)
                && e.layerY >= bounds.y
                && e.layerY <= (bounds.y + bounds.height);
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
            this.render();
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
                if(solitaire.deckLength) {
                    response = this.#dealToKitty();
                }
                else response = this.#redeal();
                this.#messages = response.messages;
            }
            this.render();
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
            for(let index = 0; index < this.#upSuitBounds.length; index++) {
                if(inBounds(e,this.#upSuitBounds[index])) {
                    this.#locations.push(new Location(`u${index + 1}`));
                    selected = {...this.#upSuitBounds[index]};
                    break;
                }
            }
        }
        if(!selected) {
            for(let index = 0; index < this.#boardBounds.length; index++) {
                let columnBounds = this.#boardBounds[index];
                let columnLength = solitaire.getColumnLength(index);
                for(let offset = columnBounds.length; offset >= 0; offset--) {
                    // can't select face-down cards
                    if(offset < columnLength[1]) break;
                    if(inBounds(e,columnBounds[offset])) {
                        let columnLetter = SolitaireBoard.columnLetterOf(index)
                        if(!columnLength[0]) this.#locations.push(new Location(columnLetter));
                        else this.#locations.push(new Location(`${columnLetter}${offset - columnBounds.length}`));
                        selected = {...columnBounds[offset]};
                        offset++;
                        while(offset < columnBounds.length) {
                            if(columnBounds[offset].y + columnBounds[offset].height >
                               selected.y + selected.height) {
                                selected.height = columnBounds[offset].y + columnBounds[offset].height
                                                - selected.y;
                            }
                            offset++;
                        }
                        break;
                    }
                }
            }
        }

        if(!selected) {
            this.#locations = [];
            this.#messages = undefined;
            if(this.#selected) {
                this.#selected = undefined;
                this.render();
            }
            return;
        }
        if(this.#locations.length == 1) {
            this.#messages = undefined;
            this.#selected = selected;
            this.render();
            return;
        }

        response = solitaire.performMove(...this.#locations);
        this.#locations = [];
        this.#selected = undefined;
        this.#messages = response.messages;
        this.render();
    }

    #keyUp(e) {
        if(this.#animations) return;
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
                if(input == 'fini') {
                    alert('fini goes here!');
                }
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
                        let result = this.#solitaire.performMove(from,to);
                        this.#messages = result.messages;
                    }
                }
            }
        }
        this.render();
    }

    #flipCard(ctx,animation) {
        let startX = animation.startPosition.x;
        let endX = animation.endPosition.x;
        let startY = animation.startPosition.y;
        let endY = animation.endPosition.y;
        let x = startX + (endX - startX) * animation.percentage;
        let y = startY + (endY - startY) * animation.percentage;
        this.#drawCardDown(ctx,{x,y});
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
