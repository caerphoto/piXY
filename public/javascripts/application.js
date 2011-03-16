$(function () {
    var $imageURL = $("#image-url"),
        $load = $("#load-image"),
        $uploadButton = $("#upload-button"),
        $frame = $("#upload-receiver"),
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

        $debug1 = $("#debug1"),
        $debug2 = $("#debug2"),
        $debug3 = $("#debug3"),

        cropType = -1,
        lockedX, lockedY, lockedW, lockedH,

        $cropTopLeft = $("#crop-top,#crop-left"),
        $cropBottomRight = $("#crop-bottom,#crop-right"),
        $cropTop = $("#crop-top"),
        $cropRight = $("#crop-right"),
        $cropBottom = $("#crop-bottom"),
        $cropLeft = $("#crop-left"),

        drawScaledImage, drawAutoScaledImage, scaleFunction,

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

    // Use browser's native scaling algorithm. Will only be used if we can be
    // sure the browser can be set to use nearest-neighbour scaling. Hopefully
    // WHATWG will see the light and provide a standard way to control the
    // resampling method.
    drawAutoScaledImage = function () {
        var start = new Date(), fullRenderTime;

        // Smoothing must apparently be disabled right before drawing. That or
        // I'm getting confused.
        compBuffer.mozImageSmoothingEnabled = false;
        compBuffer.drawImage(binaryTransparency ?
            compBuffer2Canvas : sourceImage,
            sx, sy, sw, sh, dx, dy, dw, dh);

        fullRenderTime = (new Date()) - start;
        $debug3.text(fullRenderTime);
    };

    // Custom nearest-neighbour scaling algorithm. Slower than using the
    // browser's native scaling, but the only way to do it if the browser
    // doesn't support disabling of image smoothing.
    drawScaledImage = function () {
       var sourceData, destData, sd, dd,
            sp, dp,
            x1, y1, x2, y2,
            scaleRenderTime, dupRenderTime, finalRenderTime;

        var startTime = new Date();

        sourceData = sourceBuffer.getImageData(sx, sy, sw, sh);
        destData = renderBuffer.createImageData(dw, dh);

        sd = sourceData.data;
        dd = destData.data;

        // Draw a copy of each source pixel at the scaled location.
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

        scaleRenderTime = (new Date()) - startTime;
        $debug1.text(scaleRenderTime);

        renderBuffer.putImageData(destData, 0, 0);

        // Duplicate the scaled pixels using drawImage - this is much faster
        // than drawing each pixel individually.
        compBuffer2.clearRect(0, 0, dw, dh);
        // Duplicate horizontally.
        for (x1 = 0; x1 < zoomLevel; x1 += 1) {
            compBuffer2.drawImage(renderBufferCanvas, x1, 0);
        }
        // Duplicate the horizontal row vertically.
        for (y1 = 0; y1 < zoomLevel; y1 += 1) {
            compBuffer.drawImage(compBuffer2Canvas, 0, y1);
        }

        dupRenderTime = (new Date()) - scaleRenderTime - startTime;
        fullRenderTime = (new Date()) - startTime;
        $debug2.text(dupRenderTime);
        $debug3.text(fullRenderTime);
    }; // drawScaledImage()

    if (typeof compBuffer.mozImageSmoothingEnabled !== "undefined") {
        scaleFunction = drawAutoScaledImage;
    } else {
        scaleFunction = drawScaledImage;
    }

    transPatternImage.src = "images/transparent.png";

    // Demo image
    sourceImage.src = "images/pixy_sample.png";

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

    // Adjust canvas sizes to match the viewport.
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

        if (scaleFunction !== drawAutoScaledImage) {
            compBuffer2Canvas.width = dw;
            compBuffer2Canvas.height = dh;
        }

        $cropTop.width(scaledW);
        $cropBottom.width(scaledW);

        $cropLeft.height(scaledH);
        $cropRight.height(scaledH);

        $spriteMarker.width(scaledW);
        $spriteMarker.height(scaledH);

        createTransparency();
    }; // resetSizes()

    // Load base64-encoded image from the server. Ideally I'd use the request
    // URL as the actual image source, but this means fetching the image
    // server-side, then relaying it to the client. I don't know how to do this
    // in Rails :( Instead I'm sending a base64-encoded data: URI.
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

    // The iframe reveives the base64-encoded image in its body tag.
    $frame.load(function () {
        var data = $frame[0].contentWindow.document.body.innerHTML;
        if (data === "ERROR") {
            alert("Sorry, unable to load that image.");
            $loadingMessage.fadeOut();
        } else {
            sourceImage.src = data;
        }
    });

    $("#upload-url-toggle").click(function () {
            $("#src-url").toggle();
            $("#src-upload").toggle();
        });

    $uploadButton.click(function () {
        $loadingMessage.fadeIn(100);
        $("#upload-form").submit();
    }); // $uploadButton.click(handler)

    // Image onLoad event handler: sets up source image canvas etc.
    $(sourceImage).load(function () {
        var w, h, sp, sd, sourceData;

        $imageScroller.show();
        $loadingMessage.fadeOut();

        w = sourceImage.width;
        h = sourceImage.height;
        $w.text(w);
        $h.text(h);

        sourceCanvas.width = w;
        sourceCanvas.height = h;
        sourceBuffer.drawImage(sourceImage, 0, 0);

        // Create a binary transparency version of the source image.
        if (scaleFunction === drawAutoScaledImage) {
            sourceData = sourceBuffer.getImageData(0, 0, w, h);
            sd = sourceData.data;

            for (sp = 3, len = sd.length; sp < len; sp += 4) {
                if (sd[sp]) {
                    sd[sp] = 255;
                }
            }

            compBuffer2Canvas.width = w;
            compBuffer2Canvas.height = h;
            compBuffer2.putImageData(sourceData, 0, 0);
        }

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

        // Calculate an marker position for the new scale level equivalent(ish)
        // to the previous scale.
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

        // Make sure elements are resized before trying to set new positions.
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

    // Math-tastic image and marker positioning stuff.
    $imageScroller.scroll(function () {
        var sT = $imageScroller.scrollTop(),
            sL = $imageScroller.scrollLeft();

        sx = Math.floor(sL / zoomLevel);
        sy = Math.floor(sT / zoomLevel);

        sw = Math.floor(viewportCanvas.width / zoomLevel);
        sh = Math.floor(viewportCanvas.height / zoomLevel);

        // Ensure we don't try to get image data from outside the image
        // (Firefox doesn't like it when we try to do this - complains about an
        // invalid string, error 12).
        sw = Math.min(sw, sourceImage.width - sx);
        sh = Math.min(sh, sourceImage.height - sy);

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

        scaleFunction();

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
