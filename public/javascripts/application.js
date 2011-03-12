$(function () {
    var $imageURL = $("#image-url"),
        $load = $("#load-image"),
        $loadingMessage = $("#loading-message"),
        $imageScroller = $("#image-scroller"),
        $spriteMarker = $("#sprite-marker"),
        $w = $("#w"), $h = $("#h"),
        $x = $("#x"), $y = $("#y"),
        $bgposInfo = $("#bgpos-info"),
        $sizeInfo = $("#size-info"),
        $zoomLevel = $("#zoom-level"),
        $bgType = $("#bg-type"),
        bgType = "gray-check",
        $binaryTransparency = $("#binary-transparency"),
        binaryTransparency = true,

        cropType = -1,
        lockedX, lockedY, lockedW, lockedH,

        $cropTopLeft = $("#crop-top,#crop-left"),
        $cropBottomRight = $("#crop-bottom,#crop-right"),
        $cropTop = $("#crop-top"),
        $cropRight = $("#crop-right"),
        $cropBottom = $("#crop-bottom"),
        $cropLeft = $("#crop-left"),

        drawScaledImage2, drawAutoScaledImage,

        sourceImage = new Image(),
        transPatternImage = new Image(),

        viewportCanvas = document.getElementById("viewport"),
        viewport = viewportCanvas.getContext("2d"),
        sourceCanvas = document.createElement("canvas"),
        sourceBuffer = sourceCanvas.getContext("2d"),
        transPatternCanvas = document.createElement("canvas"),
        transPattern = transPatternCanvas.getContext("2d"),
        renderBufferCanvas = document.createElement("canvas"),
        renderBuffer = renderBufferCanvas.getContext("2d"),
        compBufferCanvas = document.createElement("canvas"),
        compBuffer = compBufferCanvas.getContext("2d"),
        compBuffer2Canvas = document.createElement("canvas"),
        compBuffer2 = compBuffer2Canvas.getContext("2d"),

        sx, sy, sw, sh, // source coords
        dx, dy, dw, dh, // dest coords
        ox, oy, // sub-zoomed-pixel offsets
        spriteL = 0, spriteT = 0, spriteR = 0, spriteB = 0,
        spriteW = 0, spriteH = 0,
        zoomLevel = parseInt($zoomLevel.val(), 10);

    // Create a viewport-sized source tiled with the 'transparency.png' image.
    // This is to avoid having to tile it each frame.
    createTransparency = function () {
        var x, y,
            transW = transPatternImage.width,
            transH = transPatternImage.height;

        for (y = 0; y <= dh + transH; y += transH) {
            for (x = 0; x <= dw + transW; x += transW) {
                transPattern.drawImage(transPatternImage, x, y);
            }
        }
    };

    resetSizes = function () {
        var scaledW = sourceImage.width * zoomLevel,
            scaledH = sourceImage.height * zoomLevel;

        dw = Math.floor($imageScroller.width() / zoomLevel + 1) * zoomLevel;
        dh = Math.floor($imageScroller.height() / zoomLevel + 1) * zoomLevel;

        viewportCanvas.width = dw;
        viewportCanvas.height = dh;

        transPatternCanvas.width = dw;
        transPatternCanvas.height = dh;

        renderBufferCanvas.width = dw;
        renderBufferCanvas.height = dh;

        compBufferCanvas.width = dw;
        compBufferCanvas.height = dh;

        compBuffer2Canvas.width = dw;
        compBuffer2Canvas.height = dh;

        $cropTop.width(scaledW);
        $cropBottom.width(scaledW);

        $cropLeft.height(scaledH);
        $cropRight.height(scaledH);

        $spriteMarker.width(scaledW);
        $spriteMarker.height(scaledH);

        createTransparency();
    }; // resetSizes()

    transPatternImage.src = "images/transparent.png";

    // Demo image
    sourceImage.src = "images/pixy_sample.png";

    $load.click(function () {
        $loadingMessage.fadeIn(100);
        $.get("image", { url: $imageURL.val() }, function (data) {
            if (data === "ERROR") {
                alert("Sorry, unable to load that image.");
                $loadingMessage.fadeOut();
            } else {
                sourceImage.src = data;
            }
        });
    });

    $(sourceImage).load(function () {
        var w, h, tempCanvas, tempCtx;

        $imageScroller.show();
        $loadingMessage.fadeOut();

        w = sourceImage.width;
        h = sourceImage.height;
        $w.text(w);
        $h.text(h);

        sourceCanvas.width = w;
        sourceCanvas.height = h;
        sourceBuffer.drawImage(sourceImage, 0, 0);

        $spriteMarker.width(w * zoomLevel).height(h * zoomLevel);

        resetSizes();
        cropType = -1;
        $imageScroller.trigger("click");
        $imageScroller.trigger("scroll");
    });

    $(window).resize(function () {
        resetSizes();
        $imageScroller.trigger("scroll");
    });

    $zoomLevel.change(function () {
        var oldScrollL = $imageScroller.scrollLeft(),
            oldScrollT = $imageScroller.scrollTop(),
            scrollOffset,
            scale, scalePos,
            oldZoomLevel = zoomLevel;

        zoomLevel = parseInt($zoomLevel.val(), 10);

        scale = function(v) {
            return v * zoomLevel / oldZoomLevel;
        };

        scalePos = function($c, tl) {
            // Use offset position for top and left crop markers, to account
            // for their height/width.
            var offset = tl ? Math.min($c.height(), $c.width()) : 0,
                oldPos = {
                    left: parseInt($c.css("left"), 10) + offset,
                    top: parseInt($c.css("top"), 10) + offset
                };
            $c.css({
                top: scale(oldPos.top) - offset,
                left: scale(oldPos.left) - offset
            });
        };

        $(window).trigger("resize");

        $imageScroller.scrollLeft(scale(oldScrollL));
        $imageScroller.scrollTop(scale(oldScrollT));

        // Scale sprite marker positions
        scalePos($cropLeft, true);
        scalePos($cropTop, true);
        scalePos($cropRight);
        scalePos($cropBottom);
    });

    $bgType.change(function () {
        bgType = $bgType.val();
        $(window).trigger("resize");
    });

    $binaryTransparency.change(function () {
        binaryTransparency = this.checked;
        $(window).trigger("resize");
    });

    // Uses browser's own scaling algorithm, which is probably fast, and
    // probaly not very nice.
    drawAutoScaledImage = function () {
        compBuffer.clearRect(0, 0, dw, dh);
        compBuffer.drawImage(sourceCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    // Custom nearest-neighbour scaling algorithm, for pixel-perfect
    // positioning when zoomed in.
    drawScaledImage2 = function () {
       var sourceData, destData, sd, dd,
            sp, dp,
            x1, y1, x2, y2;

        sourceData = sourceBuffer.getImageData(sx, sy, sw, sh);
        destData = renderBuffer.createImageData(dw, dh);

        sd = sourceData.data;
        dd = destData.data;

        for (y1 = 0; y1 < sh; y1 += 1) {
            for (x1 = 0; x1 < sw; x1 += 1) {
                sp = (x1 + y1 * sw) * 4;

                x2 = x1 * zoomLevel;
                y2 = y1 * zoomLevel;

                dp = (x2 + y2 * dw) * 4;

                if (sd[sp + 3] !== 0) {
                    dd[dp]     = sd[sp];
                    dd[dp + 1] = sd[sp + 1];
                    dd[dp + 2] = sd[sp + 2];
                    dd[dp + 3] = binaryTransparency ? 255 : sd[sp + 3];
                }
            }
        }

        renderBuffer.putImageData(destData, 0, 0);

        compBuffer2.clearRect(0, 0, dw, dh);

        for (x1 = 0; x1 < zoomLevel; x1 += 1) {
            compBuffer2.drawImage(renderBufferCanvas, x1, 0);
        }

        for (y1 = 0; y1 < zoomLevel; y1 += 1) {
            compBuffer.drawImage(compBuffer2Canvas, 0, y1);
        }

        //compBuffer.drawImage(compBuffer2Canvas, 0, 0);
    }; // drawScaledImage2()

    $imageScroller.scroll(function () {
        var sT = $imageScroller.scrollTop(),
            sL = $imageScroller.scrollLeft();

        sx = Math.floor(sL / zoomLevel);
        sy = Math.floor(sT / zoomLevel);

        sw = Math.floor(viewportCanvas.width / zoomLevel);
        sh = Math.floor(viewportCanvas.height / zoomLevel);

        dw = sw * zoomLevel;
        dh = sh * zoomLevel;

        dx = 0;
        dy = 0;

        ox = -(sL %  zoomLevel);
        oy = -(sT %  zoomLevel);

        if (bgType === "gray-check") {
            compBuffer.drawImage(transPatternCanvas, -ox, -oy);
        } else {
            switch (bgType) {
            case "white":
                compBuffer.fillStyle = "#FFF";
                break;
            case "gray":
                compBuffer.fillStyle = "#888";
                break;
            case "black":
                compBuffer.fillStyle = "#000";
                break;
            case "blue":
                compBuffer.fillStyle = "#33F";
                break;
            default:
                compBuffer.fillStyle = "#F00"; // alert!
            }
            compBuffer.fillRect(0, 0, dw, dh);
        }

        //drawAutoScaledImage();
        drawScaledImage2();

        viewport.drawImage(compBufferCanvas, ox, oy);
    });

    $imageScroller.click(function () {
        // Cycle through setting types.
        // -1 = setting bottom/right
        //  0 = setting nothing
        //  1 = setting top/left
        if (cropType < 1) {
            cropType += 1;
        } else {
            cropType = -1;
        }

        $cropTopLeft.toggleClass("active", cropType === 1);
        $cropBottomRight.toggleClass("active", cropType === -1);
        $bgposInfo.toggleClass("active", cropType === 1);
        $sizeInfo.toggleClass("active", cropType === -1);
    });

    $imageScroller.mousemove(function (e) {
        var x1 = e.pageX - $imageScroller.offset().left,
            y1 = e.pageY - $imageScroller.offset().top,
            sL = $imageScroller.scrollLeft(),
            sT = $imageScroller.scrollTop(),
            $setLeft, $setTop;

        x1 = Math.floor(x1 / zoomLevel);
        y1 = Math.floor(y1 / zoomLevel);

        switch (cropType) {
        case 1:
            $setLeft = $cropLeft;
            $setTop = $cropTop;
            break;
        case -1:
            $setLeft = $cropRight;
            $setTop = $cropBottom;
            break;
        default:
            return;
        }

        if (cropType > 0) {
            spriteL = Math.floor(x1 + sL / zoomLevel);
            spriteT = Math.floor(y1 + sT / zoomLevel);
        } else {
            spriteR = Math.floor(x1 + sL / zoomLevel);
            spriteB = Math.floor(y1 + sT / zoomLevel);
        }

        spriteW = spriteR - spriteL + 1;
        spriteH = spriteB - spriteT + 1;

        $x.text(spriteL); $y.text(spriteT);
        $w.text(spriteW); $h.text(spriteH);

        x1 = x1 * zoomLevel - $setLeft.width() * cropType;
        y1 = y1 * zoomLevel - $setTop.height() * cropType;

        // Small offset to account for scrollbars being set part-way through a
        // scaled pixel.
        ox = sL % zoomLevel;
        oy = sT % zoomLevel;

        // Shift bottom/right markers up and left a bit.
        if (cropType === -1) {
            ox += $setLeft.width() - zoomLevel;
            oy += $setTop.height() - zoomLevel;
        }

        $setLeft.css("left", (x1 + sL - ox) + "px");
        $setTop.css("top", (y1 + sT - oy) + "px");
    });
});
