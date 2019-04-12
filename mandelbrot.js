'use strict';
var canvas = null;
var canvasStretch = 1;
var mandelWorker = null;
var MAX_ITER = 256;
var colorList = [{ R: 33, G: 33, B: 33 }, { R: 0, G: 0, B: 255 }, { R: 0, G: 255, B: 0 },];
//colorList = [ {R:0, G:0, B:0}, {R:12, G:12, B:12}, {R:24, G:24, B:24},
//  {R:36, G:36, B:36}, {R:0, G:255, B:0},  {R:255, G:165, B:0}, {R:255, G:0, B:0}];
/**
 * Fractal image generator that wraps around a Canvas element.
 * This worker will draw a fractal (or a portion of one) on the Canvas.
 * The x axis will correspond to the real dimension.
 * The y axis will correspond to the imaginary dimension.
 */
var MandelCanvas = (function () {
    function MandelCanvas(canvas_, minX_, minY_, maxX_, maxY_, minR_, minI_, maxR_, maxI_) {
        /** Shared canvas on which fractal is drawn. */
        this.canvas = null;
        this.image = null;
        this.ctx = null;
        this.canvasWidth = 640;
        this.canvasHeight = 480;
        this.iHeight = 2.0;
        this.rWidth = 2.0;
        /** Left-most pixel to start drawing. */
        this.minX = 0;
        /** Top-most pixel to start drawing. */
        this.minY = 0;
        /** Right-most pixel to start drawing. */
        this.maxX = 640;
        /** Bottom-most pixel to start drawing. */
        this.maxY = 480;
        /** Real component of the top side of the canvas. */
        this.minR = -1.0;
        /** Imaginary component of the left side of the canvas. */
        this.minI = -1.0;
        /** Real component of the right side of the canvas. */
        this.maxR = 1.0;
        /** Imaginary component of the bottom of the canvas. */
        this.maxI = 1.0;
        this.paletteR = null;
        this.paletteG = null;
        this.paletteB = null;
        this.canvas = canvas_;
        this.canvasWidth = canvas_.width;
        this.canvasHeight = canvas_.height;
        this.minX = minX_;
        this.minY = minY_;
        this.maxX = maxX_;
        this.maxY = maxY_;
        this.minI = minI_;
        this.minR = minR_;
        this.maxI = maxI_;
        this.maxR = maxR_;
        this.iHeight = this.maxI - this.minI;
        this.rWidth = this.maxR - this.minR;
        this.ctx = this.canvas.getContext('2d');
    }
    /** Draw the fractal portion onto the canvas. */
    MandelCanvas.prototype.run = function () {
        var img = this.ctx.getImageData(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
        var pix = img.data;
        var index = 0;
        for (var y = this.minY; y < this.maxY; y++) {
            for (var x = this.minX; x < this.maxX; x++) {
                var color = this.pointValue(this.toR(x), this.toI(y));
                pix[index++] = this.paletteR[color];
                pix[index++] = this.paletteG[color];
                pix[index++] = this.paletteB[color];
                pix[index++] = 255;
            }
        }
        this.image = img;
    };
    /**
     * Determine the Mandelbrot value for a point in complex number space.
     * @param {number} cr - distance along the real axis.
     * @param {number} ci - distance along the imaginary axis.
     */
    MandelCanvas.prototype.pointValue = function (cr, ci) {
        var zr = 0.0;
        var zi = 0.0;
        var t;
        var i;
        for (i = 0; i < MAX_ITER; i++) {
            t = 2 * zr * zi;
            zr = zr * zr - zi * zi + cr;
            zi = t + ci;
            if (zr * zr + zi * zi > 4.0) {
                break;
            }
        }
        return i;
    };
    MandelCanvas.prototype.toI = function (y) {
        return (y * this.iHeight / this.canvasHeight) + this.minI;
    };
    MandelCanvas.prototype.toR = function (x) {
        return (x * this.rWidth / this.canvasWidth) + this.minR;
    };
    MandelCanvas.prototype.toX = function (r) {
        return (r - this.minR) * this.canvasWidth / this.rWidth;
    };
    MandelCanvas.prototype.toY = function (i) {
        return (i - this.minI) * this.canvasHeight / this.iHeight;
    };
    MandelCanvas.prototype.zoomIn = function (minX_, minY_, maxX_, maxY_) {
        this.maxR = this.toR(maxX_);
        this.maxI = this.toI(maxY_);
        this.minR = this.toR(minX_);
        this.minI = this.toI(minY_);
        this.iHeight = this.maxI - this.minI;
        this.rWidth = this.maxR - this.minR;
        this.run();
    };
    MandelCanvas.prototype.zoomOut = function (minX_, minY_, maxX_, maxY_) {
        var minX2 = this.minX - minX_;
        var maxX2 = (this.maxX - minX_) * this.canvasWidth / (maxX_ - minX_);
        var minY2 = this.minY - minY_;
        var maxY2 = (this.maxY - minY_) * this.canvasHeight / (maxY_ - minY_);
        this.maxR = this.toR(maxX2);
        this.maxI = this.toI(maxY2);
        this.minR = this.toR(minX2);
        this.minI = this.toI(minY2);
        this.maxI = this.minI + (this.maxR - this.minR) * this.canvasHeight / this.canvasWidth;
        this.iHeight = this.maxI - this.minI;
        this.rWidth = this.maxR - this.minR;
        this.run();
    };
    MandelCanvas.prototype.shiftOver = function (minX_, minY_, maxX_, maxY_) {
        var minX2 = minX_ - maxX_;
        var maxX2 = this.canvasWidth + minX_ - maxX_;
        var minY2 = minY_ - maxY_;
        var maxY2 = this.canvasHeight + minY_ - maxY_;
        this.maxR = this.toR(maxX2);
        this.maxI = this.toI(maxY2);
        this.minR = this.toR(minX2);
        this.minI = this.toI(minY2);
        this.run();
    };
    /**
     * Configure the color by distributing a list of RGB
     * colors evenly across larger arrays of palette colors.
     */
    MandelCanvas.prototype.setupColorList = function (list) {
        this.paletteR = [];
        this.paletteG = [];
        this.paletteB = [];
        var w = Math.floor(MAX_ITER / (list.length - 1));
        var i = 0;
        for (var j = 1; j < list.length; j++) {
            var c1 = list[j - 1];
            var c2 = list[j];
            for (var k = 0; k < w; k++) {
                var p = k / w;
                this.paletteR[i] = Math.floor(p * (c2.R - c1.R)) + c1.R;
                this.paletteG[i] = Math.floor(p * (c2.G - c1.G)) + c1.G;
                this.paletteB[i] = Math.floor(p * (c2.B - c1.B)) + c1.B;
                i++;
            }
        }
        this.paletteR[MAX_ITER - 1] = 0;
        this.paletteG[MAX_ITER - 1] = 0;
        this.paletteB[MAX_ITER - 1] = 0;
    };
    return MandelCanvas;
})();
var drag1 = null;
var drag2 = null;
function handleMouseDown(event) {
    drag1 = { x: event.offsetX / canvasStretch, y: event.offsetY / canvasStretch };
    drag2 = null;
}
function handleMouseMove(event) {
    var dragAction = event.shiftKey ? 'shiftOver' : (event.metaKey ? 'zoomOut' : 'zoomIn');
    drag2 = { x: event.offsetX / canvasStretch, y: event.offsetY / canvasStretch, action: dragAction };
}
function handleMouseUp(event) {
    var dragAction = event.metaKey ? 'zoomOut' : 'zoomIn';
    if (!drag1) {
        dragAction = 'nothing';
    }
    else if (event.shiftKey) {
        dragAction = 'shiftOver';
    }
    else {
        if (Math.abs(drag1.x - drag2.x) <= 5) {
            dragAction = 'nothing';
        }
        if (Math.abs(drag1.y - drag2.y) <= 5) {
            dragAction = 'nothing';
        }
    }
    drag2 = { x: event.offsetX, y: event.offsetY, action: dragAction };
    if (dragAction === 'shiftOver') {
        mandelWorker.shiftOver(drag1.x, drag1.y, drag2.x, drag2.y);
        mandelWorker.run();
    }
    else if (dragAction === 'zoomOut' || dragAction === 'zoomIn') {
        var minX = Math.min(drag1.x, drag2.x);
        var maxX = Math.max(drag1.x, drag2.x);
        var minY = Math.min(drag1.y, drag2.y);
        var maxY = Math.max(drag1.y, drag2.y);
        var canvasRatio = canvas.width / canvas.height;
        if (((maxX - minX) / (maxY - minY)) > canvasRatio) {
            maxX = minX + (maxY - minY) * canvasRatio;
        }
        else if (((maxX - minX) / (maxY - minY)) < canvasRatio) {
            maxY = minY + (maxX - minX) / canvasRatio;
        }
        if (dragAction === 'zoomOut') {
            mandelWorker.zoomOut(minX, minY, maxX, maxY);
        }
        else {
            mandelWorker.zoomIn(minX, minY, maxX, maxY);
        }
        mandelWorker.run();
    }
    drag1 = null;
    drag2 = null;
}
function setup() {
    canvas = document.getElementById('canvas');
    canvasStretch = canvas.clientWidth / canvas.width;
    var canvasContext = canvas.getContext('2d');
    if (!canvasContext) {
        return;
    }
    var centerR = -0.5;
    var centerI = 0.0;
    var wR = 3.0;
    var minR = centerR - (wR / 2.0);
    var maxR = centerR + (wR / 2.0);
    var minI = centerI - (wR * canvas.height / (canvas.width * 2.0));
    var maxI = centerI + (wR * canvas.height / (canvas.width * 2.0));
    mandelWorker = new MandelCanvas(canvas, 0, 0, canvas.width, canvas.height, minR, minI, maxR, maxI);
    mandelWorker.setupColorList(colorList);
    mandelWorker.run();
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    draw(0);
}
function draw(ts) {
    if (mandelWorker && mandelWorker.image) {
        var ctx = mandelWorker.ctx;
        ctx.putImageData(mandelWorker.image, mandelWorker.minX, mandelWorker.minY);
        if (drag1 && drag2) {
            var minX = Math.min(drag1.x, drag2.x);
            var minY = Math.min(drag1.y, drag2.y);
            var width = Math.abs(drag1.x - drag2.x);
            var height = Math.abs(drag1.y - drag2.y);
            ctx.save();
            ctx.strokeStyle = (drag2.action === 'shiftOver' ? "yellow" : (drag2.action === 'zoomOut' ? "white" : "red"));
            ctx.beginPath();
            if (drag2.action === 'shiftOver') {
                ctx.translate((drag2.x - drag1.x), (drag2.y - drag1.y));
                ctx.rect(0, 0, canvas.width, canvas.height);
            }
            else {
                ctx.rect(minX, minY, width, height);
            }
            ctx.stroke();
            ctx.restore();
        }
    }
    window.requestAnimationFrame(draw);
}
