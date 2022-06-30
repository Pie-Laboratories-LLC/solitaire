// https://codepen.io/kazaak/pen/MWVYewm
import { CardSuit } from './Card.js';
import { Location } from './Location.js';
import GameMessage from './GameMessage.js';
import { SolitaireBoard } from './SolitaireBoard.js';
import SolitaireGame from './SolitaireGame.js';

export default class SolitaireCanvasRenderer {
    get pending() { return this.#downCardPromise; }
    #config;
    #canvas;
    #canvasContainer;
    #messageBoard;
    #solitaire;
    #locations;
    #messages;
    #typing;
    #selected;
    #downCardPromise;
    #svg;
    #bgImageRenderingProperties;
    #deckBounds;
    #kittyBounds;
    #upSuitBounds;
    #boardBounds;
    #animations;

    constructor(config,canvasContainer,canvas,solitaire) {
        this.#config = config
        this.#canvasContainer = canvasContainer;
        this.#canvas = canvas;
        let width = this.#canvasContainer.offsetWidth;
        let height = this.#canvasContainer.offsetHeight;
        canvas.width = width;
        canvas.height = height;
        this.#solitaire = solitaire;
        this.#locations = [];
        if(!this.#config.bgImage) throw new Error(`You must specify bgImage!`);
        if(!this.#config.hasOwnProperty('card')) throw new Error(`I can't find the configuration for cards! :(`);
        if(this.#config.card.hasOwnProperty('labelFont') && !this.#config.card.hasOwnProperty('labelFontHeight')) throw new Error(`If you specify card.labelFont, you must also specify card.labelFontHeight`);
        if(this.#config.card.hasOwnProperty('faceLabelFont') && !this.#config.card.hasOwnProperty('faceLabelFontHeight')) throw new Error(`If you specify card.faceLabelFont, you must also specify card.faceLabelFontHeight`);
        if(this.#config.card.hasOwnProperty('aceLabelFont') && !this.#config.card.hasOwnProperty('aceLabelFontHeight')) throw new Error(`If you specify card.aceLabelFont, you must also specify card.aceLabelFontHeight`);
        this.#downCardPromise = this.#loadCardBackground();
        this.#downCardPromise.then((results) => {
            this.#svg = results[0];
            this.#bgImageRenderingProperties = results[1];
            this.#canvas.onclick = (e) => {
                this.#click(e);
            };
            document.onkeyup = (e) => {
                this.#keyUp(e);
            };
            document.body.onresize = (e) => {
                this.render();
            };
        });
    }

    render() {
        if(!this.#svg || !this.#bgImageRenderingProperties) throw new Error(`Too soon: I haven't loaded the background image for the cards...`);
        let canvasHeight = this.#calculateCanvasHeight();
        this.#canvas.height = canvasHeight;
        this.#canvasContainer.height = `${canvasHeight}px`;
        this.#canvas.width = this.#canvasContainer.clientWidth;
        this.#doRender();
        this.#renderMessages();
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
        let kittyBottom = this.#calculateKittyBottom(padding,minHeight,this.#getConfigLabelFontHeight());
        let boardBound = this.#renderBoard(ctx,width,height,minWidth,minHeight,kittyBottom);
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
        let labelColour = this.#getConfigLabelColour();
        let labelFont = this.#getConfigLabelFont();
        let labelFontHeight = this.#getConfigLabelFontHeight();
        this.#label(ctx,this.#typing,labelColour,labelFont,1,width/ 2,padding + labelFontHeight);
    }

    #calculateCanvasHeight() {
        let minWidth = this.#getConfigCardMinWidth();
        let minHeight = this.#getConfigCardMinHeight();
        let padding = this.#calculatePadding(minWidth,minHeight);
        let labelFontHeight = this.#getConfigLabelFontHeight();
        let canvasHeight = this.#calculateKittyBottom(padding,minHeight,labelFontHeight);
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
            canvasHeight += (maxCardCount - 1) * (minHeight / 5);
            canvasHeight += minHeight;
            // for the bottom below
            canvasHeight += padding;
        }
        return canvasHeight;
    }

    #renderBoard(ctx,width,height,minWidth,minHeight,boardStartY) {
        let solitaire = this.#solitaire;
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
                    this.#drawCardDown(ctx,boardStartX + lineWidth, boardStartY + lineWidth);
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
                    this.#drawCardUp(ctx,card,boardStartX + lineWidth, boardStartY + lineWidth,minWidth,minHeight);
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
            boardStartY += minHeight / 5;
        }
        this.#boardBounds = boardBounds;
        return boardBottom;
    }

    #renderUpSuits(ctx,width,height,padding,minWidth,minHeight) {
        let solitaire = this.#solitaire;
        let emptyUpSuitColour = this.#config.emptyUpSuitColour ? this.#config.emptyUpSuitColour : 'white';
        let labelColour = this.#getConfigLabelColour();
        let labelFont = this.#getConfigLabelFont();
        let labelFontHeight = this.#getConfigLabelFontHeight();
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
            this.#label(ctx,`U   ${index}`,labelColour,labelFont,1,upSuitX + upSuitRectWidth / 2,upSuitY + upSuitRectHeight + 2* labelFontHeight);
            if(solitaire.getUpSuitLength(index - 1)) {
                let upSuitCard = solitaire.peekUpSuit(index - 1);
                this.#drawCardUp(ctx,upSuitCard,upSuitX + lineWidth, upSuitY + lineWidth,minWidth,minHeight);
            }
            upSuitX -= upSuitSpacing;
        }
        this.#upSuitBounds = upSuitBounds;
    }

    #renderKitty(ctx,padding,minWidth,minHeight) {
        let solitaire = this.#solitaire;
        let emptyKittyColour = this.#config.emptyKittyColour ? this.#config.emptyKittyColour : 'yellow';
        let emptyDeckColour = this.#config.emptyDeckColour ? this.#config.emptyDeckColour : 'green';
        let labelColour = this.#config.labelColour ? this.#config.labelColour : 'white';
        let labelFont = this.#config.labelFont ? this.#config.labelFont : 'bold 18px system-ui';
        let labelFontHeight = this.#config.labelFontHeight ? this.#config.labelFontHeight : 18;
        let kittyX = padding;
        let kittyY = padding;
        let emptyKittyHeight = minHeight * 1.15;
        let lineWidth = 3;
        let deckRectWidth = minWidth + 2* lineWidth;
        let deckRectHeight = minHeight + 2* lineWidth;
        let deckOffsetY = (emptyKittyHeight - deckRectHeight) / 2;
        ctx.strokeStyle = emptyDeckColour;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.rect(kittyX,kittyY+deckOffsetY,deckRectWidth,deckRectHeight);
        this.#deckBounds = {
            x: kittyX, y: kittyY + deckOffsetY,
            width: deckRectWidth, height: deckRectHeight
        };
        ctx.closePath();
        ctx.stroke();
        if(solitaire.deckLength) {
            this.#drawCardDown(ctx,kittyX + lineWidth,kittyY+deckOffsetY+lineWidth)
        }
        lineWidth = 1;
        let deckKittySpacing = minWidth / 5;
        kittyX += (deckRectWidth + deckKittySpacing);
        deckKittySpacing = minWidth / 8;
        ctx.strokeStyle = emptyKittyColour;
        ctx.lineWidth = lineWidth;
        let kittyWidth = minWidth +  2* minWidth/ 3;
        ctx.beginPath();
        ctx.rect(kittyX,kittyY,kittyWidth * 1.15,emptyKittyHeight);
        ctx.closePath();
        ctx.stroke();

        let kittyBottom = this.#calculateKittyBottom(padding,minHeight,labelFontHeight);
        this.#label(ctx,'K      I      T      T      Y',labelColour,labelFont,1, kittyX + kittyWidth / 2,kittyBottom - labelFontHeight);

        let kittyBounds;
        if(solitaire.kittyLength) {
            let kitty = solitaire.kitty;
            kittyX += (kittyWidth * 1.15 - kittyWidth) / 2;
            kittyY += deckOffsetY;
            for(let card of kitty) {
                this.#drawCardUp(ctx,card,kittyX,kittyY,minWidth,minHeight);
                kittyBounds = {
                    x: kittyX, y: kittyY,
                    width: minWidth, height: minHeight
                };
                kittyX += minWidth / 3;
            }
        }
        this.#kittyBounds = kittyBounds;
    }

    #calculateKittyBottom(padding,minHeight,labelFontHeight) {
        return padding + (minHeight * 1.15) + 3* labelFontHeight;
    }

    #label(ctx,label,labelColour,labelFont,lineWidth,x,y) {
        ctx.lineWidth = lineWidth;
        ctx.fillStyle = labelColour;
        ctx.font = labelFont;
        ctx.lineWidth = lineWidth;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
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

    #drawCardUp(ctx,card,x,y,minWidth,minHeight) {
        let config = this.#config.card;
        if(config.cardFaceSvg) {
            let svgDetails = config.cardFaceSvg(card);
            ctx.drawImage(svgDetails[0],svgDetails[1],svgDetails[2],svgDetails[3],svgDetails[4],x,y,minWidth,minHeight);
            return;
        }
        let padding = this.#getConfigCardPadding();
        let hPadding = this.#getConfigCardHPadding(padding);
        let vPadding = this.#getConfigCardVPadding(padding);
        let roundness = this.#getConfigCardRoundness();
        let hRoundness = this.#getConfigCardHRoundness(roundness);
        let vRoundness = this.#getConfigCardVRoundness(roundness);
        let fillColour = config.fillColour ? config.fillColour : 'white';
        let strokeColour = config.strokeColour ? config.strokeColour : 'blue';
        let labelBlackColour = this.#config.card.labelBlackColour ? this.#config.labelBlackColour : 'black';
        let labelRedColour = this.#config.card.labelRedColour ? this.#config.labelRedColour : 'red';
        let labelFont = this.#config.card.labelFont ? this.#config.labelFont : 'bold 32px serif';
        let labelFontHeight = this.#config.card.labelFontHeight ? this.#config.labelFontHeight : 32;
        let faceLabelFont = this.#config.card.faceLabelFont ? this.#config.faceLabelFont : 'bold 50px serif';
        let faceLabelFontHeight = this.#config.card.faceLabelFontHeight ? this.#config.faceLabelFontHeight : 50;
        let aceLabelFont = this.#config.card.aceLabelFont ? this.#config.aceLabelFont : 'bold 120px serif';
        let aceLabelFontHeight = this.#config.card.aceLabelFontHeight ? this.#config.aceLabelFontHeight : 120;
        ctx.fillStyle = fillColour;
        ctx.strokeStyle = strokeColour;
        ctx.roundRect(x,y,minWidth,minHeight,{hRoundness,vRoundness},true,true);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        if(CardSuit.isRedSuit(card.suit)) ctx.fillStyle = labelRedColour;
        else ctx.fillStyle = labelBlackColour;
        ctx.font = labelFont;
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

    #drawCardDown(ctx,x,y) {
        let svgImage = this.#svg;
        let bgImage = this.#config.card.bgImage;
        ctx.drawImage(svgImage,x,y);
        ctx.drawImage(bgImage,
            x + this.#bgImageRenderingProperties.imageX,
            y + this.#bgImageRenderingProperties.imageY,
            this.#bgImageRenderingProperties.imageWidth,
            this.#bgImageRenderingProperties.imageHeight
        );
    }

    #calculatePadding(minWidth,minHeight) {
        return minWidth > minHeight ? minWidth / 10 : minHeight / 10
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
        return this.#config.card.hPadding ? this.#config.card.hPadding : padding
    }

    #getConfigCardVPadding(padding) {
        return this.#config.card.vPadding ? this.#config.card.vPadding : padding
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

        /*
        if(!this.#animations) this.#animations = [];
        for(let index = 0; index < count; index++) {
            this.#animations.push({
                type: 'kitty',
            });
        }
        */

        return response;
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
        if(inBounds(e,this.#deckBounds)) {
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
                else response = solitaire.redeal();
                this.#messages = response.messages;
            }
            this.render();
            return;
        }
        let selected;
        if(inBounds(e,this.#kittyBounds)) {
            this.#locations.push(new Location('k'));
            selected = {...this.#kittyBounds};
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
