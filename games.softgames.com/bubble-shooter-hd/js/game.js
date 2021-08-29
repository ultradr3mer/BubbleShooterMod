(function() {

    var G = {};
    window.G = G;
    window.gameG = G;


    if (typeof G == 'undefined') G = {};

    G.ExtLoader = function() {

        Phaser.Loader.call(this, game);
        game.state.onStateChange.add(this.reset, this);
        this.imagesToRemoveOnStateChange = [];
        this.loadedUrls = {};

    };

    G.ExtLoader.prototype = Object.create(Phaser.Loader.prototype);

    G.ExtLoader.prototype.reset = function(hard, clearEvents) {

        this.imagesToRemoveOnStateChange.forEach(function(key) {
            this.cache.removeImage(key);
        }, this);
        this.imagesToRemoveOnStateChange = [];

        Phaser.Loader.prototype.reset.call(this, hard, clearEvents);

    };

    G.ExtLoader.prototype.addToFileList = function(type, key, url, properties, overwrite, extension) {

        if (overwrite === undefined) {
            overwrite = false;
        }

        if (key === undefined || key === '') {
            console.warn("Phaser.Loader: Invalid or no key given of type " + type);
            return this;
        }

        if (url === undefined || url === null) {
            if (extension) {
                url = key + extension;
            } else {
                console.warn("Phaser.Loader: No URL given for file type: " + type + " key: " + key);
                return this;
            }
        }

        var file = {
            type: type,
            key: key,
            path: this.path,
            url: url,
            syncPoint: this._withSyncPointDepth > 0,
            data: null,
            loading: false,
            loaded: false,
            error: false
        };

        if (properties) {
            for (var prop in properties) {
                file[prop] = properties[prop];
            }
        }

        var fileIndex = this.getAssetIndex(type, key);

        if (overwrite && fileIndex > -1) {
            var currentFile = this._fileList[fileIndex];

            if (!currentFile.loading && !currentFile.loaded) {
                this._fileList[fileIndex] = file;
            } else {
                this._fileList.push(file);
                this._totalFileCount++;
            }
        } else if (fileIndex === -1) {
            this._fileList.push(file);
            this._totalFileCount++;
        }

        this.loadFile(this._fileList.shift());

        return this;

    }

    G.ExtLoader.prototype.asyncComplete = function(file, errorMessage) {

        if (errorMessage === undefined) {
            errorMessage = '';
        }

        file.loaded = true;
        file.error = !!errorMessage;

        if (errorMessage) {
            file.errorMessage = errorMessage;

            console.warn('Phaser.Loader - ' + file.type + '[' + file.key + ']' + ': ' + errorMessage);
            // debugger;
        }

        //this.processLoadQueue();

    }

    G.ExtLoader.prototype.fileComplete = function(file, xhr) {

        var loadNext = true;



        switch (file.type) {
            case 'packfile':

                // Pack data must never be false-ish after it is fetched without error
                var data = JSON.parse(xhr.responseText);
                file.data = data || {};
                break;

            case 'image':

                this.cache.addImage(file.key, file.url, file.data);
                break;

            case 'spritesheet':

                this.cache.addSpriteSheet(file.key, file.url, file.data, file.frameWidth, file.frameHeight, file.frameMax, file.margin, file.spacing);
                break;

            case 'textureatlas':

                if (file.atlasURL == null) {
                    this.cache.addTextureAtlas(file.key, file.url, file.data, file.atlasData, file.format);
                } else {
                    //  Load the JSON or XML before carrying on with the next file
                    loadNext = false;

                    if (file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_ARRAY || file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_HASH || file.format == Phaser.Loader.TEXTURE_ATLAS_JSON_PYXEL) {
                        this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', this.jsonLoadComplete);
                    } else if (file.format == Phaser.Loader.TEXTURE_ATLAS_XML_STARLING) {
                        this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', this.xmlLoadComplete);
                    } else {
                        throw new Error("Phaser.Loader. Invalid Texture Atlas format: " + file.format);
                    }
                }
                break;

            case 'bitmapfont':

                if (!file.atlasURL) {
                    this.cache.addBitmapFont(file.key, file.url, file.data, file.atlasData, file.atlasType, file.xSpacing, file.ySpacing);
                } else {
                    //  Load the XML before carrying on with the next file
                    loadNext = false;
                    this.xhrLoad(file, this.transformUrl(file.atlasURL, file), 'text', function(file, xhr) {
                        var json;

                        try {
                            // Try to parse as JSON, if it fails, then it's hopefully XML
                            json = JSON.parse(xhr.responseText);
                        } catch (e) {}

                        if (!!json) {
                            file.atlasType = 'json';
                            this.jsonLoadComplete(file, xhr);
                        } else {
                            file.atlasType = 'xml';
                            this.xmlLoadComplete(file, xhr);
                        }
                    });
                }
                break;

            case 'video':

                if (file.asBlob) {
                    try {
                        file.data = xhr.response;
                    } catch (e) {
                        throw new Error("Phaser.Loader. Unable to parse video file as Blob: " + file.key);
                    }
                }

                this.cache.addVideo(file.key, file.url, file.data, file.asBlob);
                break;

            case 'audio':

                if (this.game.sound.usingWebAudio) {
                    file.data = xhr.response;

                    this.cache.addSound(file.key, file.url, file.data, true, false);

                    if (file.autoDecode) {
                        this.game.sound.decode(file.key);
                    }
                } else {
                    this.cache.addSound(file.key, file.url, file.data, false, true);
                }
                break;

            case 'text':
                file.data = xhr.responseText;
                this.cache.addText(file.key, file.url, file.data);
                break;

            case 'shader':
                file.data = xhr.responseText;
                this.cache.addShader(file.key, file.url, file.data);
                break;

            case 'physics':
                var data = JSON.parse(xhr.responseText);
                this.cache.addPhysicsData(file.key, file.url, data, file.format);
                break;

            case 'script':
                file.data = document.createElement('script');
                file.data.language = 'javascript';
                file.data.type = 'text/javascript';
                file.data.defer = false;
                file.data.text = xhr.responseText;
                document.head.appendChild(file.data);
                if (file.callback) {
                    file.data = file.callback.call(file.callbackContext, file.key, xhr.responseText);
                }
                break;

            case 'binary':
                if (file.callback) {
                    file.data = file.callback.call(file.callbackContext, file.key, xhr.response);
                } else {
                    file.data = xhr.response;
                }

                this.cache.addBinary(file.key, file.data);

                break;
        }

        this.onFileComplete.dispatch(0, file.key, !file.error);

    }
    /*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
    var saveAs = saveAs || function(e) {
        "use strict";
        if (typeof e === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
            return
        }
        var t = e.document,
            n = function() {
                return e.URL || e.webkitURL || e
            },
            r = t.createElementNS("http://www.w3.org/1999/xhtml", "a"),
            o = "download" in r,
            a = function(e) {
                var t = new MouseEvent("click");
                e.dispatchEvent(t)
            },
            i = /constructor/i.test(e.HTMLElement) || e.safari,
            f = /CriOS\/[\d]+/.test(navigator.userAgent),
            u = function(t) {
                (e.setImmediate || e.setTimeout)(function() {
                    throw t
                }, 0)
            },
            s = "application/octet-stream",
            d = 1e3 * 40,
            c = function(e) {
                var t = function() {
                    if (typeof e === "string") {
                        n().revokeObjectURL(e)
                    } else {
                        e.remove()
                    }
                };
                setTimeout(t, d)
            },
            l = function(e, t, n) {
                t = [].concat(t);
                var r = t.length;
                while (r--) {
                    var o = e["on" + t[r]];
                    if (typeof o === "function") {
                        try {
                            o.call(e, n || e)
                        } catch (a) {
                            u(a)
                        }
                    }
                }
            },
            p = function(e) {
                if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)) {
                    return new Blob([String.fromCharCode(65279), e], {
                        type: e.type
                    })
                }
                return e
            },
            v = function(t, u, d) {
                if (!d) {
                    t = p(t)
                }
                var v = this,
                    w = t.type,
                    m = w === s,
                    y, h = function() {
                        l(v, "writestart progress write writeend".split(" "))
                    },
                    S = function() {
                        if ((f || m && i) && e.FileReader) {
                            var r = new FileReader;
                            r.onloadend = function() {
                                var t = f ? r.result : r.result.replace(/^data:[^;]*;/, "data:attachment/file;");
                                var n = e.open(t, "_blank");
                                if (!n) e.location.href = t;
                                t = undefined;
                                v.readyState = v.DONE;
                                h()
                            };
                            r.readAsDataURL(t);
                            v.readyState = v.INIT;
                            return
                        }
                        if (!y) {
                            y = n().createObjectURL(t)
                        }
                        if (m) {
                            e.location.href = y
                        } else {
                            var o = e.open(y, "_blank");
                            if (!o) {
                                e.location.href = y
                            }
                        }
                        v.readyState = v.DONE;
                        h();
                        c(y)
                    };
                v.readyState = v.INIT;
                if (o) {
                    y = n().createObjectURL(t);
                    setTimeout(function() {
                        r.href = y;
                        r.download = u;
                        a(r);
                        h();
                        c(y);
                        v.readyState = v.DONE
                    });
                    return
                }
                S()
            },
            w = v.prototype,
            m = function(e, t, n) {
                return new v(e, t || e.name || "download", n)
            };
        if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
            return function(e, t, n) {
                t = t || e.name || "download";
                if (!n) {
                    e = p(e)
                }
                return navigator.msSaveOrOpenBlob(e, t)
            }
        }
        w.abort = function() {};
        w.readyState = w.INIT = 0;
        w.WRITING = 1;
        w.DONE = 2;
        w.error = w.onwritestart = w.onprogress = w.onwrite = w.onabort = w.onerror = w.onwriteend = null;
        return m
    }(typeof self !== "undefined" && self || typeof window !== "undefined" && window || this.content);
    if (typeof module !== "undefined" && module.exports) {
        module.exports.saveAs = saveAs
    } else if (typeof define !== "undefined" && define !== null && define.amd !== null) {
        define("FileSaver.js", function() {
            return saveAs
        })
    }
    if (typeof G == 'undefined') G = {};


    G.Button = function(x, y, sprite, callback, context) {

        Phaser.Button.call(this, game, G.l(x), G.l(y), null);

        this.state = game.state.getCurrentState();

        G.changeTexture(this, sprite);
        this.anchor.setTo(0.5);

        this.sfx = G.sfx.button_click;

        this.active = true;

        this.onClick = new Phaser.Signal();
        if (callback) {
            this.onClick.add(callback, context || this);
        }

        this.onInputDown.add(this.click, this);

        this.terms = [];

        this.IMMEDIATE = false;

        this.scaleOnClick = true;

        this.targetAlphaTermsNotFulfilled = 0.5;
        this.targetAlpha = 1;


        this.pulsing = false;



    }

    G.Button.prototype = Object.create(Phaser.Button.prototype);
    G.Button.constructor = G.Button;

    G.Button.prototype.update = function() {

        if (this.checkTerms()) {
            this.targetAlpha = 1;
        } else {
            this.targetAlpha = this.targetAlphaTermsNotFulfilled;
        }

        this.alpha = G.lerp(this.alpha, this.targetAlpha, 0.2, 0.05);

        this.updateChildren();

    };

    G.Button.prototype.pulse = function(maxScale) {
        this.pulsing = true;
        this.pulsingTween = game.add.tween(this.scale).to({
            x: maxScale || 1.1,
            y: maxScale || 1.1
        }, 500, Phaser.Easing.Sinusoidal.InOut, true, 0, -1, true);
    };

    G.Button.prototype.stopPulse = function(maxScale) {
        if (this.pulsingTween) this.pulsingTween.stop();
        this.scale.setTo(maxScale || 1);
        this.pulsing = false;
    };


    G.Button.prototype.click = function() {
        if (!this.active) return;

        if (!this.checkTerms()) return;

        this.active = false;
        this.onClick.dispatch();

        //this.sfx.play();

        var orgScaleX = this.scale.x;
        var orgScaleY = this.scale.y;

        if (this.IMMEDIATE) {
            this.active = true;
        } else {

            if (this.pulsing || !this.scaleOnClick) {

                game.time.events.add(400, function() {
                    this.active = true
                }, this);

            } else {

                game.add.tween(this.scale).to({
                    x: orgScaleX + 0.2,
                    y: orgScaleY + 0.2
                }, 200, Phaser.Easing.Quadratic.Out, true).onComplete.add(function() {
                    game.add.tween(this.scale).to({
                        x: orgScaleX,
                        y: orgScaleY
                    }, 200, Phaser.Easing.Quadratic.Out, true).onComplete.add(function() {
                        this.active = true;
                    }, this)
                }, this)

            }

        }

    };

    G.Button.prototype.checkTerms = function() {

        for (var i = 0; i < this.terms.length; i++) {
            if (!this.terms[i][0].call(this.terms[i][1])) {
                return false;
            }
        }

        return true;

    };

    G.Button.prototype.addTerm = function(callback, context) {
        this.terms.push([callback, context]);
    }

    G.Button.prototype.addImageLabel = function(image) {
        this.label = game.make.image(0, 0, 'ssheet', image);
        this.label.anchor.setTo(0.5);
        this.addChild(this.label);
    };

    G.Button.prototype.addTextLabel = function(font, text, size) {
        var multi = 1 / G.Loader.currentConfigMulti;
        this.label = new G.OneLineText(-7, -6, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);
        this.addChild(this.label);
    };

    G.Button.prototype.addTextLabelMultiline = function(font, text) {
        var multi = 1 / G.Loader.currentConfigMulti;
        this.label = new G.MultiLineText(0, 0, font, text, Math.floor(this.height * multi * 0.5), this.width * multi * 0.8, this.height * multi * 0.7, 'center', 0.5, 0.5);
        this.addChild(this.label);
    };


    G.Button.prototype.stopTweens = function() {
        G.stopTweens(this);
    };

    G.Button.prototype.changeTexture = function(image) {
        G.changeTexture(this, image);
    };

    G.Button.prototype.add = function(obj) {
        return this.addChild(obj)
    };

    G.Button.prototype.updateChildren = function() {

        for (var i = this.children.length; i--;) {
            this.children[i].update();
        }

    };

    if (typeof G == 'undefined') G = {};


    G.FrameAnimation = function(x, y, frameName, frameRate, autoPlay) {

        Phaser.Image.call(this, game, G.l(x), G.l(y));

        this.anchor.setTo(0.5);

        this.frameNamePrefix = frameName;
        this.animFramesLen = this.getAnimationLength(this.frameNamePrefix);

        this.timerEvery = frameRate ? (60 / frameRate) : 1;
        this.animDir = 1;

        G.changeTexture(this, this.frameNamePrefix + '_0');

        this.currentTimer = 0;
        this.currentIndex = 0;

        this.onFinish = new Phaser.Signal();

        this.active = autoPlay || false;


    };

    G.FrameAnimation.prototype = Object.create(Phaser.Image.prototype);

    G.FrameAnimation.prototype.play = function(loop, bounce, startFrame) {

        this.currentTimer = 0;
        this.currentIndex = startFrame || 0;
        this.active = true;
        this.loop = loop - 1 || 0;
        this.animDir = 1;
        this.bounce = bounce || false;
        G.changeTexture(this, this.frameNamePrefix + '_' + this.currentIndex);

        return this;

    };

    G.FrameAnimation.prototype.update = function() {

        if (!this.active) return;

        if (this.currentTimer += G.deltaTime >= this.timerEvery) {

            this.currentTimer = this.currentTimer - this.timerEvery;
            this.currentIndex += this.animDir;

            if (this.bounce) {
                if (this.currentIndex == this.animFramesLen || this.currentIndex == 0) {

                    if (this.loop == 0 && this.currentIndex == 0) {
                        this.onFinish.dispatch();
                        return this.active = false;
                    }

                    if (this.loop > 0 && this.currentIndex == 0) {
                        this.loop--;
                    }

                    if (this.currentIndex == this.animFramesLen) this.currentIndex = this.animFramesLen - 1;

                    this.animDir *= -1;

                }
            } else {

                if (this.currentIndex == this.animFramesLen) {
                    if (this.loop == 0) {
                        this.onFinish.dispatch();
                        return this.active = false;
                    }
                    if (this.loop > 0) this.loop--;

                    this.currentIndex = 0;

                }

            }

            G.changeTexture(this, this.frameNamePrefix + '_' + this.currentIndex);

        }

    };

    G.FrameAnimation.prototype.getAnimationLength = function(frameNamePrefix) {

        if (G.FrameAnimation.CacheAnimLength[frameNamePrefix]) return G.FrameAnimation.CacheAnimLength[frameNamePrefix];

        var len = 0;

        for (var i = 0; i < 1000; i++) {
            if (G.isImageInCache(frameNamePrefix + '_' + i)) {
                len++;
            } else {
                break;
            }
        }

        G.FrameAnimation.CacheAnimLength[frameNamePrefix] = len;

        return len;

    };

    G.FrameAnimation.CacheAnimLength = {};
    /*G.Gift = function(type) {

      if (type === undefined) type = this.createRandom();

      if (type.constructor == G.Gift) return type;

      if (Array.isArray(type)) arguments = type;
      
      this.type = arguments[0];
      this.amount = arguments[1];
      this.icon = G.json.settings.gifts.icons[this.type];

      this.dataArray = Array.prototype.slice.call(arguments);

      this.applied = false;

    };

    G.Gift.prototype.createRandom = function() {


      var possibleGifts = [];
      
      G.json.settings.gifts.normals.list.forEach(function(e) {
        console.log(e);
        if (e[0] == 'coin') {
          possibleGifts.push(e);
        }else if (e[0].indexOf('booster') !== -1 && G.saveState.isBoosterUnlocked(parseInt(e[0][8]))) {
          possibleGifts.push(e);
        }
      });


      console.log(possibleGifts);

      return game.rnd.pick(possibleGifts);

    };


    G.Gift.prototype.getLabelString = function() {

      if (this.type == 'coin') {
        return  this.amount+' @'+this.icon+'@';
      }else if (this.type.indexOf('booster') !== -1) {
        return this.amount+'x '+'@'+this.icon+'@';
      }

    };

    G.Gift.prototype.getData = function() {

      return this.dataArray;

    };

    G.Gift.prototype.applyGift = function() {

      if (this.applied) return;

      if (this.type == 'coin') {
        G.saveState.changeCoins(this.amount);
      }else if (this.type.indexOf('booster') != -1) {
        G.saveState.changeBoosterAmount(parseInt(this.type[8]),this.amount);
      }

      this.applied = true;

    }*/


    G.gift = {};

    G.gift.getGift = function(giftsGroup) {

        var giftsGroup = giftsGroup || 'normals';

        var giftsObj = G.json.settings.gifts[giftsGroup];

        var boosterMaxNr = giftsObj.boosterMaxNr || G.json.settings.gifts.boosterMaxNr;
        var boosterChance = giftsObj.boosterChance || G.json.settings.gifts.boosterChance;

        console.log(boosterMaxNr + ' & ' + boosterChance);

        var possibleGifts = [];



        giftsObj.list.forEach(function(e) {
            if (e[0] == 'coin') {
                possibleGifts.push(e);
            } else {

                if (e[0].indexOf('booster') !== -1 &&
                    G.saveState.isBoosterUnlocked(parseInt(e[0][8])) &&
                    G.saveState.getBoosterAmount(parseInt(e[0][8])) < boosterMaxNr) {
                    possibleGifts.push(e);
                }

            }
        });

        Phaser.ArrayUtils.shuffle(possibleGifts);

        var booster = Math.random() < boosterChance;

        for (var i = 0; i < possibleGifts.length; i++) {
            var gift = possibleGifts[i];
            if (gift[0].indexOf('booster') !== -1) {
                if (booster) {
                    return gift.slice();
                }
            } else {
                return gift.slice();
            }
        }

        // fallback

        return ['coin', 50];

    };

    G.gift.getLabelString = function(giftData) {
        return giftData[1] + ' @' + G.json.settings.gifts.icons[giftData[0]] + '@';
    };

    G.gift.applyGift = function(giftData) {

        if (giftData[0] == 'coin') {
            G.saveState.changeCoins(giftData[1]);
        } else {
            G.saveState.changeBoosterAmount(parseInt(giftData[0][8]), giftData[1]);
        }

    };

    G.gift.getIcon = function(giftData) {

        return G.json.settings.gifts.icons[giftData[0]];

    };
    if (typeof G == 'undefined') G = {};

    G.GridArray = function(width, height, value, dbg) {

        if (typeof width == 'number') {

            this.createGrid.apply(this, arguments);

        } else if (typeof width == "string") {

            this.data = JSON.parse(arguments[0]);
            this.width = this.data.length;
            this.height = this.data[0].length;

        } else if (Array.isArray(width)) {
            a = arguments[0];
            this.data = arguments[0];
            this.width = this.data.length;
            this.height = this.data[0].length;

        }

    };

    G.GridArray.prototype = {

        createGrid: function(width, height, value) {

            this.data = [];
            this.width = width;
            this.height = height;

            for (var collumn = 0; collumn < width; collumn++) {
                this.data[collumn] = [];
                for (var row = 0; row < height; row++) {
                    this.data[collumn][row] = value;
                }
            }

        },

        set: function(x, y, val) {
            if (this.isInGrid(x, y)) {
                return this.data[x][y] = val;
            } else {
                if (this.dbg) console.log("setValue OUT OF RANGE");
                return false;
            }
        },

        get: function(x, y) {
            if (this.isInGrid(x, y)) {
                return this.data[x][y];
            } else {
                if (this.dbg) console.log("getValue OUT OF RANGE");
                return false;
            }
        },

        swapValues: function(x1, y1, x2, y2) {

            if (this.isInGrid(x1, y1) && this.isInGrid(x2, y2)) {
                var tmp = this.data[x1][y1];
                this.data[x1][y1] = this.data[x2][y2];
                this.data[x2][y2] = tmp;
            } else {
                if (this.dbg) console.log("swapValues OUT OF RANGE");
                return false;
            }

        },

        isInGrid: function(x, y) {
            return !(x < 0 || x >= this.width || y < 0 || y >= this.height);
        },


        find: function(func, context) {

            for (var coll = 0; coll < this.width; coll++) {
                for (var row = 0; row < this.height; row++) {
                    var val = func.call(context, this.data[coll][row], coll, row, this.data);
                    if (val) return this.data[coll][row];
                }
            }

            return false;

        },


        filter: function(func, context) {

            var result = [];

            for (var coll = 0; coll < this.width; coll++) {
                for (var row = 0; row < this.height; row++) {
                    var val = func.call(context, this.data[coll][row], coll, row, this.data);
                    if (val) result.push(this.data[coll][row]);
                }
            }

            return result;
        },


        loop: function(func, context) {

            for (var coll = 0; coll < this.width; coll++) {
                for (var row = 0; row < this.height; row++) {
                    func.call(context, this.data[coll][row], coll, row, this.data);
                }
            }
        },

        clear: function(value) {
            this.loop(function(elem, x, y, array) {
                array[x][y] = value || false;
            });
        },

        findPattern: function(positions, mark) {

            var result = false;
            var len = positions.length;

            this.loop(function(elem, x, y, array) {
                if (elem == mark && !result) {

                    for (var i = 0; i < len; i += 2) {
                        //console.log('pos: '+(x+positions[i])+'x'+(y+positions[i+1])+' val: ' + this.get(x+positions[i],y+positions[i+1]));
                        if (!this.get(x + positions[i], y + positions[i + 1])) return;
                        if (this.get(x + positions[i], y + positions[i + 1]) !== mark) return;
                    }

                    //console.log("PASSED FIRST LOOP "+x+'x'+y);
                    result = [];
                    for (var j = 0; j < len; j += 2) {
                        result.push(x + positions[j], y + positions[j + 1]);
                    }
                    //console.log('got patt: ');
                    //console.log(x+'x'+y);
                    //console.log(result);


                }
            }, this);

            return result;

        },

        count: function() {

            var result = 0;

            for (var coll = 0; coll < this.width; coll++) {
                for (var row = 0; row < this.height; row++) {
                    if (this.data[coll][row]) {
                        result++;
                    }
                }
            }

            return result;

        },

        getAllElements: function() {

            var result = [];

            for (var coll = 0; coll < this.width; coll++) {
                for (var row = 0; row < this.height; row++) {
                    if (this.data[coll][row]) {
                        result.push(this.data[coll][row]);
                    }
                }
            }

            return result;

        }


    };
    G.Image = function(x, y, frame, anchor, groupToAdd) {

        Phaser.Image.call(this, game, G.l(x), G.l(y), null);

        //overwrite angle component, so angle is not wrapped anymore
        Object.defineProperty(this, 'angle', {
            get: function() {
                return Phaser.Math.radToDeg(this.rotation);
            },
            set: function(value) {
                this.rotation = Phaser.Math.degToRad(value);
            }
        });

        this.angle = 0;

        this.state = game.state.getCurrentState();

        this.changeTexture(frame);

        if (anchor) {
            if (typeof anchor == 'number') {
                this.anchor.setTo(anchor);
            } else {
                this.anchor.setTo(anchor[0], anchor[1]);
            }
        }

        if (groupToAdd) {
            (groupToAdd.add || groupToAdd.addChild).call(groupToAdd, this);
        } else if (groupToAdd !== null) {
            game.world.add(this);
        }




        //game.add.existing(this)
    };

    G.Image.prototype = Object.create(Phaser.Image.prototype);

    G.Image.prototype.stopTweens = function() {
        G.stopTweens(this);
    };

    G.Image.prototype.changeTexture = function(image) {
        G.changeTexture(this, image);
    };

    Phaser.Image.prototype.changeTexture = function(image) {
        G.changeTexture(this, image);
    };

    G.Image.prototype.add = function(obj) {
        return this.addChild(obj)
    };
    //
    // $ - text from json
    // @ - img
    // % - variable
    // ^ - text as it is
    //


    G.LabelParser = {

        specialChars: ['$', '@', '%', '^'],

        changeIntoTagArray: function(str, propObj) {

            var result = [];

            var i = 0;

            while (str.length > 0) {

                if (i++ > 20) break;

                var firstTag = this.findFirstSpecialChar(str);


                if (firstTag === -1) {
                    result.push(str);
                    break;
                } else {

                    if (firstTag[0] > 0) {
                        result.push(str.slice(0, firstTag[0]))
                        str = str.slice(firstTag[0]);
                    }
                    str = this.cutOffTag(str, result, firstTag[1]);

                }

            }

            // 
            // change strings into objects
            //

            var processedResult = [];
            for (var i = 0; i < result.length; i++) {
                processedResult.push(this.processTag(result[i], propObj));
            }

            // 
            // merge texts obj
            // 
            //

            return this.mergeTextTagsInArray(processedResult);;
        },


        mergeTextTagsInArray: function(tagArray) {

            var mergedArray = [];

            var startIndex = null;
            var endIndex = null;

            for (var i = 0; i < tagArray.length; i++) {

                if (tagArray[i].type !== 'text') {

                    if (startIndex !== null) {
                        mergedArray.push(this.mergeTextTags(tagArray, startIndex, i));
                        startIndex = null;
                    }

                    mergedArray.push(tagArray[i]);

                } else {
                    if (startIndex == null) {
                        startIndex = i;
                    }
                }
            }


            if (startIndex !== null) {
                mergedArray.push(this.mergeTextTags(tagArray, startIndex, i))
            }

            return mergedArray;

        },

        mergeTextTags: function(array, startIndex, endIndex) {

            var newObj = {
                type: 'text',
                content: []
            };

            for (; startIndex < endIndex; startIndex++) {
                newObj.content.push(array[startIndex].content);
            }

            newObj.content = newObj.content.join(' ');

            return newObj;

        },

        processTag: function(elem, propObj) {

            if (elem[0] == '@') {

                var scale = 1;

                if (elem[1] == '*' && elem.indexOf('*', 2)) {
                    scale = parseFloat(elem.slice(elem.indexOf('*') + 1, elem.indexOf('*', 2)));
                    elem = elem.slice(elem.indexOf('*', 2));
                }

                return {
                    type: 'img',
                    content: elem.slice(1, -1),
                    scale: scale
                }
            } else if (elem[0] == '%') {
                return {
                    type: 'text',
                    content: propObj[elem.slice(1, -1)]
                }
            } else if (elem[0] == '$') {

                return {
                    type: 'text',
                    content: G.txt(elem.slice(1, -1))
                }
            } else if (elem[0] == '^') {
                return {
                    type: 'text',
                    content: elem.slice(1, -1)
                }
            } else {

                if (this.isStringJustSpaces(elem)) {
                    return {
                        type: 'separator',
                        content: elem,
                        length: elem.length
                    }
                } else {
                    return {
                        type: 'text',
                        content: elem
                    }
                }

            }


        },

        isStringJustSpaces: function(elem) {
            for (var i = 0; i < elem.length; i++) {
                if (elem[i] !== ' ') return false;
            }
            return true;
        },

        cutOffTag: function(str, result, tag) {

            var startIndex = str.indexOf(tag);
            var endIndex = str.indexOf(tag, startIndex + 1);

            result.push(str.slice(startIndex, endIndex + 1));

            return str.slice(0, startIndex) + str.slice(endIndex + 1);

        },

        findFirstSpecialChar: function(str) {

            var smallest = Infinity;
            var foundedChar = false;

            this.specialChars.forEach(function(char) {
                var index = str.indexOf(char)

                if (index > -1 && smallest > index) {
                    foundedChar = char;
                    smallest = Math.min(index, smallest);
                }
            });

            if (smallest === Infinity) return -1;

            return [smallest, foundedChar];

        },


        createLabel: function(string, propObj, x, y, font, fontSize, anchorX, anchorY, distanceBetween, maxWidth) {

            var tagArray = this.changeIntoTagArray(string, propObj);

            var group = new G.LabelGroup(x, y, fontSize, distanceBetween, anchorX, anchorY, maxWidth);



            return group;

        }

    }


    G.LabelGroup = function(str, x, y, font, fontSize, anchorX, anchorY, maxWidth) {



        Phaser.Group.call(this, game);


        this.fontData = game.cache.getBitmapFont(font).font;
        this.fontBaseSize = this.fontData.size;
        this.fontSpaceOffset = this.fontData.chars['32'].xOffset + this.fontData.chars['32'].xAdvance;

        this.str = str;
        this.tagArray = G.LabelParser.changeIntoTagArray(str);


        this.x = (typeof x === 'undefined' ? 0 : G.l(x));
        this.y = (typeof y === 'undefined' ? 0 : G.l(y));
        this.font = font;
        this.fontSize = (typeof fontSize === 'undefined' ? G.l(30) : G.l(fontSize));
        //this.distanceBetween = (typeof distanceBetween === 'undefined' ? G.l(10) : G.l(distanceBetween));
        this.distanceBetween = 0;

        this.anchorX = (typeof anchorX === 'undefined' ? 0.5 : anchorX);
        this.anchorY = (typeof anchorY === 'undefined' ? 0.5 : anchorY);

        this.maxWidth = maxWidth || 0;

        this.processTagArray();

    };

    G.LabelGroup.prototype = Object.create(Phaser.Group.prototype);

    G.LabelGroup.prototype.processTagArray = function() {

        for (var i = 0; i < this.tagArray.length; i++) {
            if (this.tagArray[i].type == 'img') {
                var img = G.makeImage(0, 0, this.tagArray[i].content, 0, this);
                img.tagScale = this.tagArray[i].scale;
            } else if (this.tagArray[i].type == 'separator') {
                var img = G.makeImage(0, 0, null, 0, this);
                img.SEPARATOR = true;
                img.SEP_LENGTH = this.tagArray[i].length;
            } else {
                this.add(game.add.bitmapText(0, 0, this.font, this.tagArray[i].content, this.fontSize))
            }
        }


        this.refresh();

    };

    G.LabelGroup.prototype.refresh = function() {

        this.applySizeAndAnchor();

        if (this.maxWidth > 0 && this.getWholeWidth() > this.maxWidth) {
            while (this.getWholeWidth() > this.maxWidth) {
                this.distanceBetween *= 0.9;
                this.fontSize *= 0.9;
                this.applySizeAndAnchor();
            }
        }

        this.spreadElements();

    };

    G.LabelGroup.prototype.applySizeAndAnchor = function() {

        this.children.forEach(function(e) {
            e.anchor.setTo(this.anchorX, this.anchorY);

            if (e.fontSize) {
                e.fontSize = this.fontSize;
                e.updateText();
            } else {
                e.height = this.fontSize * (e.tagScale || 1);
                e.scale.x = e.scale.y;
            }



            if (e.SEPARATOR) {
                e.width = (this.fontSize / this.fontBaseSize * this.fontSpaceOffset) * e.SEP_LENGTH;
            }

        }, this);

    };

    G.LabelGroup.prototype.getWholeWidth = function() {

        var allDistanceBetween = (this.children.length - 1) * this.distanceBetween;
        var widthOfAllElements = 0;
        this.children.forEach(function(e) {
            widthOfAllElements += e.width;
        });

        return allDistanceBetween + widthOfAllElements;
    };

    G.LabelGroup.prototype.spreadElements = function() {

        var startX = this.getWholeWidth() * this.anchorX * -1

        this.children.forEach(function(e, index, array) {
            e.left = (index == 0 ? startX : array[index - 1].right + this.distanceBetween);
        }, this);

    };
    if (typeof G == 'undefined') G = {};

    G.Loader = {

        currentConfig: 'hd',
        currentConfigMulti: 1,
        loadingScreenActive: false,

        passConfigs: function(conf) {
            this.configs = conf;
        },

        setConfig: function(chosen) {
            this.currentConfig = chosen;
            this.currentConfigMulti = this.configs[chosen];
        },

        makeLoadingScreen: function() {

            if (this.loadingScreenActive) return;

            this.loadingScreenActive = true;

            G.whiteOverlay = game.add.graphics();
            G.whiteOverlay.fixedToCamera = true;
            G.whiteOverlay.beginFill(0xffffff, 1);
            G.whiteOverlay.drawRect(0, 0, game.width, game.height);

            G.imgRotate = G.makeImage(320, 400, 'candy_1', 0.5);
            G.imgRotate.fadeOut = false;
            G.imgRotate.alpha = 0;
            G.imgRotate.update = function() {
                this.angle += 2;
                if (this.fadeOut) {
                    this.alpha -= 0.05;
                    this.bringToTop();
                    if (this.alpha <= 0) {
                        this.destroy();
                    }
                } else {
                    this.alpha += 0.05;
                }
                this.alpha = game.math.clamp(this.alpha, 0, 1);
            };


            game.load.onLoadComplete.addOnce(this.killLoadingScreen, this);

        },

        killLoadingScreen: function() {

            if (G.imgRotate) {
                G.whiteOverlay.destroy();
                G.imgRotate.fadeOut = true;
                G.imgRotate = false;
                this.loadingScreenActive = false;
            }

        },

        loadPOSTImage: function(name) {

            if (typeof name === 'undefined') return;

            if (!game.cache.checkImageKey(name)) {
                this.makeLoadingScreen();
                game.load.image(name, 'assets/' + this.currentConfig + '/imagesPOST/' + name);
            }

        },

        loadAssets: function() {

            game.load.onLoadComplete.addOnce(this.processAssets, this);
            this.loadSFX(G.ASSETS.sfx);
            this.loadImages(G.ASSETS.images);
            this.loadSpritesheets(G.ASSETS.spritesheets);
            this.loadJson(G.ASSETS.json);
            this.loadFonts(G.ASSETS.fonts);

        },

        processAssets: function() {
            this.processJson(G.ASSETS.json);
            this.processSFX(G.ASSETS.sfx);

            this.createSpritesheetMap();

        },

        createSpritesheetMap: function() {

            G.spritesheetMap = {};

            for (var i = 0, len = G.ASSETS.spritesheets.length; i < len; i++) {

                var sheetName = G.ASSETS.spritesheets[i];

                if (game.cache.checkImageKey(sheetName)) {

                    var sheet = game.cache.getFrameData(sheetName);

                    for (var frameIndex = 0; frameIndex < sheet._frames.length; frameIndex++) {

                        var frame = sheet._frames[frameIndex];

                        if (G.spritesheetMap[frame.name]) console.warn('Images name collision: ' + frame.name);

                        G.spritesheetMap[frame.name] = sheetName;

                    }
                }
            }

        },

        loadSFX: function(list) {
            list.forEach(function(fileName) {
                game.load.audio(
                    this.removeExt(fileName),
                    'assets/sfx/' + fileName
                );
            }, this);
        },

        loadFonts: function(fontObj) {
            for (var font in fontObj) {
                game.load.bitmapFont(font, 'assets/' + this.currentConfig + '/fonts/' + fontObj[font].frame, 'assets/' + this.currentConfig + '/fonts/' + fontObj[font].data);
            }
        },

        loadImages: function(list) {
            list.forEach(function(fileName) {
                game.load.image(
                    this.removeExt(fileName),
                    'assets/' + this.currentConfig + '/images/' + fileName
                );
            }, this);
        },

        loadJson: function(list) {
            list.forEach(function(fileName) {
                game.load.json(this.removeExt(fileName), 'assets/json/' + fileName);
            }, this);
        },

        loadSpritesheets: function(list) {

            list.forEach(function(elem) {
                game.load.atlasJSONHash(elem, 'assets/' + this.currentConfig + '/spritesheets/' + elem + '.png', 'assets/' + this.currentConfig + '/spritesheets/' + elem + '.json');
            }, this);
        },

        removeExt: function(fileName) {
            return fileName.slice(0, fileName.lastIndexOf('.'));
        },

        processJson: function(list) {
            G.json = {};
            list.forEach(function(fileName) {
                fileName = this.removeExt(fileName);
                G.json[fileName] = game.cache.getJSON(fileName);
            }, this);
        },

        processSFX: function(list) {
            G.sfx = {};
            game.sfx = G.sfx;
            list.forEach(function(fileName) {
                fileName = this.removeExt(fileName);
                G.sfx[fileName] = game.add.audio(fileName);
            }, this);
        },

    };
    G.MultiLineText = function(x, y, font, text, size, max_width, max_height, align, hAnchor, vAnchor) {

        x = G.l(x);
        y = G.l(y);
        size = G.l(size);
        max_width = G.l(max_width);
        max_height = G.l(max_height);

        this.maxUserWidth = max_width;
        this.maxUserHeight = max_height;

        Phaser.BitmapText.call(this, game, x, y, font, '', size);

        //this.maxWidth = max_width;
        this.splitText(text, max_width);

        this.align = align || 'center';

        if (max_height) {
            while (this.height > max_height) {
                this.fontSize -= 2;
                this.splitText(text, max_width);
                this.updateText();
                if (this.fontSize < 5) break;
            }
        }

        this.anchor.setTo(hAnchor, vAnchor);

        // this.hAnchor = typeof hAnchor == 'number' ? hAnchor : 0.5;
        //this.vAnchor = typeof vAnchor == 'number' ? vAnchor : 0;

        this.cacheAsBitmap = true;
        //this._cachedSprite.anchor.setTo(this.hAnchor,this.vAnchor);

    };

    G.MultiLineText.prototype = Object.create(Phaser.BitmapText.prototype);
    G.MultiLineText.prototype.constructor = G.MultiLineText;


    G.MultiLineText.prototype.splitText = function(text, max_width) {

        var txt = text;
        var txtArray = [];
        var prevIndexOfSpace = 0;
        var indexOfSpace = 0;
        var widthOverMax = false;

        while (txt.length > 0) {

            prevIndexOfSpace = indexOfSpace;
            indexOfSpace = txt.indexOf(' ', indexOfSpace + 1);


            if (indexOfSpace == -1) this.setText(txt);
            else this.setText(txt.substring(0, indexOfSpace));
            this.updateText();

            if (this.width > max_width) {

                if (prevIndexOfSpace == 0 && indexOfSpace == -1) {
                    txtArray.push(txt);
                    txt = '';
                    indexOfSpace = 0;
                    continue;
                }

                if (prevIndexOfSpace == 0) {
                    txtArray.push(txt.substring(0, indexOfSpace));
                    txt = txt.substring(indexOfSpace + 1);
                    indexOfSpace = 0;
                    continue;
                }

                txtArray.push(txt.substring(0, prevIndexOfSpace));
                txt = txt.substring(prevIndexOfSpace + 1);
                indexOfSpace = 0;


            } else {
                //ostatnia linijka nie za dluga
                if (indexOfSpace == -1) {
                    txtArray.push(txt);
                    txt = '';
                }

            }

        }


        this.setText(txtArray.join('\n'));


    };



    G.MultiLineText.prototype.popUpAnimation = function() {

        this.cacheAsBitmap = false;

        var char_numb = this.children.length;

        //
        var delay_array = [];
        for (var i = 0; i < char_numb; i++) {
            delay_array[i] = i;
        }

        delay_array = Phaser.ArrayUtils.shuffle(delay_array);
        delay_index = 0;
        this.activeTweens = 0;

        this.children.forEach(function(letter) {

            if (letter.anchor.x == 0) {
                letter.x = letter.x + (letter.width * 0.5);
                letter.y = letter.y + letter.height;
                letter.anchor.setTo(0.5, 1);
            }
            var target_scale = letter.scale.x;
            letter.scale.setTo(0, 0);
            this.activeTweens++;
            var tween = game.add.tween(letter.scale)
                .to({
                    x: target_scale * 1.5,
                    y: target_scale * 1.5
                }, 200, Phaser.Easing.Quadratic.In, false, delay_array[delay_index] * 25)
                .to({
                    x: target_scale,
                    y: target_scale
                }, 200, Phaser.Easing.Sinusoidal.In);
            tween.onComplete.add(function() {
                this.activeTweens--;
                if (this.activeTweens == 0) {
                    if (this.alive) this.cacheAsBitmap = true;
                }
            }, this);
            tween.start();
            delay_index++;
        }, this)
    };
    G.OneLineText = function(x, y, font, text, size, width, hAnchor, vAnchor) {

        Phaser.BitmapText.call(this, game, G.l(x), G.l(y), font, text, G.l(size), G.l(width));

        if (width) {
            while (this.width > G.l(width)) {
                this.fontSize -= 2;
                this.updateText();
                if (this.fontSize < 5) break;
            }
        }


        this.orgFontSize = G.l(size);

        this.maxUserWidth = G.l(width);


        this.skipCaching = G.skipOneLineTextCaching || false;

        this.hAnchor = hAnchor;
        this.vAnchor = vAnchor;

        this.anchor.setTo(this.hAnchor, this.vAnchor);
        this.updateText();


        this.insertCoin(this.fontSize);

        if (!this.skipCaching) {
            this.cacheAsBitmap = true;
            this.updateCache();
        }



        //this._cachedSprite.anchor.setTo(typeof this.hAnchor == 'undefined' ? 0.5 : this.hAnchor,this.vAnchor || 0);

        //this.x -= Math.floor(this.width*0.5);


    };


    G.OneLineText.prototype = Object.create(Phaser.BitmapText.prototype);
    G.OneLineText.prototype.constructor = G.OneLineText;

    G.OneLineText.prototype.insertCoin = function(size) {


        if (this.text.indexOf('$$') == -1) return;


        this.children.forEach(function(element, index, array) {

            if (!element.name) return;

            if (element.name == "$" && element.visible) {
                if (index + 1 <= array.length - 1 && array[index].name == '$') {

                    var el = element;
                    var el2 = array[index + 1];

                    el.visible = false;
                    el2.visible = false;
                    coin = G.makeImage(el.x + (size * 0.05), el.y - (size * 0.05), 'coin');
                    coin.width = size;
                    coin.height = size;
                    el.parent.addChild(coin);


                }
            }


        });

    }


    G.OneLineText.prototype.setText = function(text) {

        Phaser.BitmapText.prototype.setText.call(this, text.toString());

        var oldScaleX = this.scale.x;
        var oldScaleY = this.scale.y;
        var oldAlpha = this.alpha;
        var oldAngle = this.angle;

        this.alpha = 1;
        this.scale.setTo(1);


        if (this.maxUserWidth) {
            this.fontSize = this.orgFontSize;
            this.updateText();
            var i = 0;
            while (this.width > this.maxUserWidth) {
                this.fontSize -= 1;

                this.updateText();
                if (this.fontSize < 5) break;
            }
        }

        if (!this.skipCaching && this.cacheAsBitmap) this.updateCache();

        this.scale.setTo(oldScaleX, oldScaleY);
        this.alpha = oldAlpha;
        this.angle = oldAngle;
        //this._cachedSprite.anchor.setTo(this.hAnchor || 0.5,1);

    };


    G.OneLineText.prototype.popUpAnimation = function() {

        this.cacheAsBitmap = false;

        var char_numb = this.children.length;

        //
        var delay_array = [];
        for (var i = 0; i < char_numb; i++) {
            delay_array[i] = i;
        }

        delay_array = Phaser.ArrayUtils.shuffle(delay_array);
        delay_index = 0;
        this.activeTweens = 0;

        this.children.forEach(function(letter) {

            if (letter.anchor.x == 0) {
                letter.x = letter.x + (letter.width * 0.5);
                letter.y = letter.y + letter.height;
                letter.anchor.setTo(0.5, 1);
            }
            var target_scale = letter.scale.x;
            letter.scale.setTo(0, 0);
            this.activeTweens++;
            var tween = game.add.tween(letter.scale)
                .to({
                    x: target_scale * 1.5,
                    y: target_scale * 1.5
                }, 200, Phaser.Easing.Quadratic.In, false, delay_array[delay_index] * 25)
                .to({
                    x: target_scale,
                    y: target_scale
                }, 200, Phaser.Easing.Sinusoidal.In);
            tween.onComplete.add(function() {
                this.activeTweens--;
                if (this.activeTweens == 0) {
                    if (this.alive && !this.skipCaching) this.cacheAsBitmap = true;
                }
            }, this);
            tween.start();
            delay_index++;
        }, this)
    };

    G.OneLineText.prototype.scaleOut = function(onComplete, context) {
        this.cacheAsBitmap = false;

        this.activeTweens = 0;


        this.children.forEach(function(letter, index) {

            if (letter.anchor.x == 0) {
                letter.x = letter.x + letter.width * 0.5;
                letter.y = letter.y + letter.height * 0.5;
                letter.anchor.setTo(0.5, 0.5);
            }
            this.activeTweens++;
            letter.scale.setTo(letter.scale.x, letter.scale.y);

            var tween = game.add.tween(letter.scale)
                .to({
                    x: 0,
                    y: 0
                }, 400, Phaser.Easing.Cubic.In, false, index * 20);
            tween.onComplete.add(function() {
                this.activeTweens--;
                if (this.activeTweens == 0) {
                    this.destroy()
                }
            }, this);
            tween.start();
        }, this)

    }




    G.OneLineCounter = function(x, y, font, amount, size, width, hAnchor, vAnchor, preText, postText) {

        G.OneLineText.call(this, x, y, font, '', size, width, hAnchor, vAnchor);

        this.amount = amount;
        this.amountDisplayed = amount;
        this.amountMaxInterval = 5;
        this.amountMaxNegInterval = -5;

        this.absoluteDisplay = false;
        this.fixedToDecimal = 0;

        this.stepCurrent = 0;
        this.step = 0;

        this.preText = preText || '';
        this.postText = postText || '';

        this.setText(this.preText + amount + this.postText);

    };

    G.OneLineCounter.prototype = Object.create(G.OneLineText.prototype);

    G.OneLineCounter.prototype.update = function() {

        if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0) {
            this.stepCurrent = this.step;

            if (this.amountDisplayed != this.amount) {

                var diff = this.amount - this.amountDisplayed;

                this.amountDisplayed += game.math.clamp(diff, this.amountMaxNegInterval, this.amountMaxInterval);


                var valueToDisplay = this.amountDisplayed;

                if (this.absoluteDisplay) {
                    valueToDisplay = Math.abs(valueToDisplay)
                };
                if (this.fixedTo != 0) {
                    valueToDisplay = valueToDisplay.toFixed(this.fixedToDecimal)
                };

                this.setText(this.preText + valueToDisplay + this.postText);

            }

        }

    };

    G.OneLineCounter.prototype.changeAmount = function(amount) {
        this.amount = amount;
    };

    G.OneLineCounter.prototype.increaseAmount = function(change) {
        this.amount += change;
    };

    G.OneLineCounter.prototype.changeIntervals = function(max, maxNeg) {

        if (typeof maxNeg == 'undefined') {
            this.amountMaxInterval = max;
            this.amountMaxNegInterval = -max;
        } else {
            this.amountMaxInterval = max;
            this.amountMaxNegInterval = maxNeg;
        }

    }

    G.PartCacher = function() {

        Phaser.Group.call(this, game);

        this.active = false;

        this.every = 1;

        this.rt = game.add.renderTexture(10, 10);

        this.frameCounter = 0;

        this.framesToRecord = null;

    };

    G.PartCacher.prototype = Object.create(Phaser.Group.prototype);

    G.PartCacher.prototype.update = function() {

        if (!this.active) return;

        this.stepForward();

        if (!this.checkChildren()) {
            this.active = false;
            this.removeAll(true, true);
            return;
        }

        if (this.frameCounter % this.frameRate === 0) {
            this.saveFrame();
            this.frameNr++;

            if (this.framesToRecord !== null) {
                this.framesToRecord--;
                if (this.framesToRecord == 0) this.active = false;
            }

        }
        this.frameCounter++;

    };

    G.PartCacher.prototype.stepForward = function() {

        for (var i = this.children.length; i--;) {
            this.children[i].update();
        }

    };

    G.PartCacher.prototype.start = function(fileName, frameRate, nrOfFrames) {

        this.fileName = fileName;
        this.frameNr = 0;
        this.frameRate = 60 / frameRate;
        this.active = true;
        this.frameCounter = 0;

        this.framesToRecord = nrOfFrames || null;

    };

    G.PartCacher.prototype.saveFrame = function() {

        var bounds = this.getBounds();

        var widthFromCenter = Math.max(this.x - bounds.x, bounds.x + bounds.width - this.x);
        var heightFromCenter = Math.max(this.y - bounds.y, bounds.y + bounds.height - this.y);
        this.rt.resize(widthFromCenter * 2, heightFromCenter * 2, true);
        this.rt.renderXY(this, widthFromCenter, heightFromCenter, true);

        var c = this.rt.getCanvas();
        var fileName = this.fileName + '_' + this.frameNr;

        c.toBlob(function(blob) {
            saveAs(blob, fileName);
        });

    };

    G.PartCacher.prototype.checkChildren = function() {

        var inactive = this.children.filter(function(child) {
            return !child.alive || child.alpha === 0 || child.scale.x == 0 || child.scale.y == 0;
        });

        return this.children.length !== inactive.length;

    };
    G.PoolGroup = function(elementConstructor, argumentsArray, signal, initFill) {

        Phaser.Group.call(this, game);

        this._deadArray = [];
        this._elementConstructor = elementConstructor;
        this._argumentsArray = argumentsArray || [];
        this._argumentsArray.unshift(null);

        if (signal) {
            G.sb(signal).add(this.init, this);
        }

        if (initFill) {
            for (var i = 0; i < initFill; i++) {
                element = new(Function.prototype.bind.apply(this._elementConstructor, this._argumentsArray));
                this.add(element);
                element.events.onKilled.add(this._onElementKilled, this);
                element.kill();

            }
        }

    }

    G.PoolGroup.prototype = Object.create(Phaser.Group.prototype);

    G.PoolGroup.prototype.getFreeElement = function() {

        var element;

        if (this._deadArray.length > 0) {
            element = this._deadArray.pop()
        } else {
            element = new(Function.prototype.bind.apply(this._elementConstructor, this._argumentsArray));
            element.events.onKilled.add(this._onElementKilled, this);
        }

        this.add(element);
        return element;

    };

    G.PoolGroup.prototype._onElementKilled = function(elem) {
        if (this !== elem.parent) return;
        this._deadArray.push(elem);
        this.removeChild(elem)

    };

    G.PoolGroup.prototype.init = function() {

        var elem = this.getFreeElement();
        elem.init.apply(elem, arguments);

        return elem;

    };

    G.PoolGroup.prototype.initBatch = function(nr) {

        for (var i = 0; i < nr; i++) {
            this.init.apply(this, [].slice.call(arguments, 1));
        }

    };
    G.ProgressBar = function(x, y, sprite, currentValue, maxValue, offsetX, offsetY) {

        G.Image.call(this, x, y, sprite + '_empty', 0, null);

        offsetX = typeof offsetX === 'undefined' ? 0 : offsetX;
        offsetY = typeof offsetY === 'undefined' ? 0 : offsetX;

        this.fill = G.makeImage(offsetX, offsetY, sprite + '_full', 0, this);
        this.fillFullWidth = this.fill.width;

        this.fillOverlay = G.makeImage(offsetX, offsetY, sprite + '_full_overlay', this.fill, this);
        this.fillOverlay.alpha = 0;

        this.fill.cropRect = new Phaser.Rectangle(0, 0, 0, this.fill.height);
        this.fill.updateCrop();

        this.currentValue = currentValue;
        this.prevCurrentValue = currentValue;

        this.targetValue = currentValue;

        //var used for lerp (so lerp dont stuck, because current value will be rounded)
        this.maxValue = maxValue;

        this.lerpValue = 0.05;

        this.updateBarCrop();

        this.onTargetReached = new Phaser.Signal();
        this.onBarFilled = new Phaser.Signal();

    };

    G.ProgressBar.prototype = Object.create(G.Image.prototype);

    G.ProgressBar.prototype.update = function() {

        if (this.currentValue !== this.targetValue) {
            this.currentValue = G.lerp(this.currentValue, this.targetValue, this.lerpValue, this.maxValue * 0.005);
            if (this.currentValue === this.targetValue) {
                this.onTargetReached.dispatch();
            }
        }

        if (this.currentValue !== this.prevCurrentValue) {
            this.updateBarCrop();

            if (this.currentValue === this.maxValue) {
                game.add.tween(this.fillOverlay).to({
                    alpha: 1
                }, 300, Phaser.Easing.Sinusoidal.InOut, true, 0, 0, true);
                this.onBarFilled.dispatch();
                if (this.label) {
                    game.add.tween(this.label).to({
                        alpha: 0
                    }, 600, Phaser.Easing.Sinusoidal.InOut, true);
                }
            }

            if (this.label) {
                if (Math.floor(this.currentValue) !== Math.floor(this.prevCurrentValue)) {
                    console.log('updating label');
                    this.label.updateValue(Math.floor(this.currentValue));
                }
            }

        }


        this.prevCurrentValue = this.currentValue;

    };

    G.ProgressBar.prototype.updateBarCrop = function() {

        var oldCropRectWidth = this.fill.cropRect.width;
        var newCropRectWidth = Math.round(this.fillFullWidth * (this.currentValue / this.maxValue));

        if (oldCropRectWidth !== newCropRectWidth) {
            this.fill.cropRect.width = newCropRectWidth;
            this.fill.updateCrop();
        }

    };

    G.ProgressBar.prototype.changeCurrentValue = function(newTargetValue, lerpValue) {

        this.targetValue = game.math.clamp(newTargetValue, 0, this.maxValue);
        this.lerpValue = lerpValue || this.lerpValue;

    };

    G.ProgressBar.prototype.increaseCurrentValue = function(amount) {

        this.changeCurrentValue(this.targetValue + (amount || 1));

    };

    G.ProgressBar.prototype.decreaseCurrentValue = function(amount) {

        this.changeCurrentValue(this.targetValue - (amount || 1));

    };

    G.ProgressBar.prototype.changeValues = function(currentValue, maxValue) {

        this.currentValue = currentValue;
        this.prevCurrentValue = currentValue;
        this.targetValue = currentValue;
        this.maxValue = maxValue;

        if (this.label) {
            this.label.changeValues(currentValue, maxValue);
        }

        this.updateBarCrop();

    };

    G.ProgressBar.prototype.addLabel = function(labelType, animationOnIncrease) {

        this.label = new G.ProgressBar.Label(G.rl(this.width * 0.5), G.rl(this.height * 0.5), this.currentValue, this.maxValue, Math.floor(G.rl(this.height) * 0.6), G.rl(this.width * 0.7), labelType, animationOnIncrease);
        this.add(this.label);

    };

    //
    // label types:
    // 0 - current/max
    // 1 - 20 left
    //
    G.ProgressBar.Label = function(x, y, currentValue, maxValue, size, maxWidth, labelType, animationOnIncrease) {

        G.OneLineText.call(this, x, y, 'font', '', size, maxWidth, 0.5, 0.5);

        this.labelType = labelType || 0;
        this.labelType1Text = G.txt('%AMOUNT% left');
        this.currentValue = currentValue;
        this.maxValue = maxValue;
        this.animationOnIncrease = animationOnIncrease || false;

        this.updateValue(this.currentValue, true);
    };

    G.ProgressBar.Label.prototype = Object.create(G.OneLineText.prototype);

    G.ProgressBar.Label.prototype.updateValue = function(newCurrentValue, init) {

        if (!init && Math.min(newCurrentValue, this.maxValue) === this.currentValue) return;

        this.currentValue = newCurrentValue;

        this.updateLabelText();

        if (!init && this.animationOnIncrease) {
            G.stopTweens(this);
            this.scale.setTo(1);
            game.add.tween(this.scale).to({
                x: 1.2,
                y: 1.2
            }, 200, Phaser.Easing.Sinusoidal.InOut, true, 0, 0, true);
        }

    };

    G.ProgressBar.Label.prototype.changeValues = function(currentValue, maxValue) {

        this.currentValue = currentValue;
        this.maxValue = maxValue;
        this.alpha = this.currentValue < this.maxValue ? 1 : 0;
        this.updateLabelText();

    };

    G.ProgressBar.Label.prototype.updateLabelText = function() {

        if (this.labelType == 0) {
            this.setText(this.currentValue + '/' + this.maxValue);
        } else {
            this.setText(this.labelType1Text.replace('%AMOUNT%', (this.maxValue - this.currentValue)));
        }

    };
    if (typeof G == 'undefined') G = {};


    G.SignalBox = (function() {

        //add permanents signal functionality
        if (!Phaser.Signal.prototype.addPermanent) {

            Phaser.Signal.prototype.addPermanent = function() {
                var signalBinding = this.add.apply(this, arguments);
                signalBinding._PERMANENT = true;
                return signalBinding;
            };

            Phaser.Signal.prototype.removeNonPermanent = function() {
                if (!this._bindings) {
                    return;
                }

                var n = this._bindings.length;

                while (n--) {
                    if (!this._bindings[n]._PERMANENT) {
                        this._bindings[n]._destroy();
                        this._bindings.splice(n, 1);
                    }
                }
            };
        };

        var clearOnStageChange = false;
        var signals = {};

        function clearNonPermanent() {
            Object.keys(signals).forEach(function(signal) {
                signals[signal].removeNonPermanent();
            });
        };

        function clearAll() {
            Object.keys(signals).forEach(function(signal) {
                signals[signal].removeAll();
            });
        };

        function getSignal(signalName) {

            if (!clearOnStageChange) {
                game.state.onStateChange.add(clearNonPermanent, this);
            }

            if (!signals[signalName]) {
                signals[signalName] = new Phaser.Signal();
            }

            return signals[signalName];

        };

        getSignal.signals = signals;
        getSignal.clearNonPermanent = clearNonPermanent;
        getSignal.clearAll = clearAll;

        return getSignal;



    })();


    G.Slider = function(x, y, width, initPos) {

        Phaser.Graphics.call(this, game, x, y);

        this.sliderWidth = width;
        this.pos = initPos;

        this.beginFill(0x000000, 1);
        v
        this.drawRect(0, -2, this.sliderWidth, 4);

        this.circleGfx = this.addChild(game.make.graphics(width * initPos, 0));
        this.circleGfx.clear();
        this.circleGfx.lineStyle(1, 0x000000, 1);
        this.circleGfx.beginFill(0x999999, 1);
        this.circleGfx.drawCircle(0, 0, 32);
        this.circleGfx.sliderWidth = width;

        this.circleGfx.inputEnabled = true;
        this.circleGfx.input.useHandCursor = true;
        this.circleGfx.input.draggable = true;
        this.circleGfx.input.setDragLock(true, false);


    };

    G.Slider.prototype = Object.create(Phaser.Graphics.prototype);

    G.Slider.prototype.update = function() {

        this.circleGfx.x = game.math.clamp(this.circleGfx.x, 0, this.sliderWidth);
        this.pos = this.circleGfx.x / this.sliderWidth;

    };
    G.SliderPanel = function(x, y, width, height, content, config) {

        Phaser.Group.call(this, game);

        this.sliderWidth = G.l(width);
        this.sliderHeight = G.l(height);

        this.x = x + (this.sliderWidth * -0.5);
        this.y = y + (this.sliderHeight * -0.5);

        //slider mask
        this.gfxMask = game.add.graphics();

        this.gfxMask.beginFill(0x000000, 1);
        this.gfxMask.drawRect(0, 0, width, height);

        this.clickableObjects = [];

        this.config = config;
        this.applyConfig(this.config);

        this.addContent(content);
        this.add(this.gfxMask);
        //this.contentGroup.add(this.gfxMask);
        this.contentGroup.mask = this.gfxMask;

        this.slideY = 0;



        this.inputSprite = G.makeImage(0, 0, null, 0, this);
        this.inputSprite.inputEnabled = true;
        this.inputSprite.hitArea = new Phaser.Rectangle(0, 0, width, height);

        this.inputSpriteDown = false;

        this.inputData = {
            x: null,
            y: null,
            velX: 0,
            velY: 0,
            xStart: null,
            yStart: null,
            startFrameStamp: null,
            clickDistanceWindow: 10,
            clickTimeWindow: 10,

        };

        //blocks input from buttons bellow
        this.inputSprite.events.onInputDown.add(function(pointer) {
            var p = game.input.activePointer;
            this.inputSpriteDown = true;
            this.inputData.x = this.inputData.xStart = p.worldX;
            this.inputData.y = this.inputData.yStart = p.worldY;
            this.inputData.startFrameStamp = this.frameCounter;
        }, this);

        this.inputSprite.events.onInputUp.add(function() {
            var p = game.input.activePointer;
            this.inputSpriteDown = false;

            var distance = game.math.distance(this.inputData.xStart, this.inputData.yStart, p.worldX, p.worldY);
            var timeDelta = this.frameCounter - this.inputData.startFrameStamp;

            if (distance <= this.inputData.clickDistanceWindow && timeDelta <= this.inputData.clickTimeWindow) {
                this.propagateClick(p.x, p.y);
                this.inputData.velX = 0;
                this.inputData.velY = 0;
            }

        }, this);

        //frameCounter for measuring click window
        //if I would use timestamps during low fps buttons could not work
        this.frameCounter = 0;

    };

    G.SliderPanel.prototype = Object.create(Phaser.Group.prototype);

    G.SliderPanel.prototype.applyConfig = function(config) {

        this.horizontal = config.horizontal || false;
        this.horizontalLerp = config.horizontalLerp || false;
        this.vertical = config.vertical || true;
        this.verticalLerp = config.verticalLerp;

    };

    //group is at 0,0;
    G.SliderPanel.prototype.addContent = function(group) {

        this.changeInputSettings(group);

        this.contentGroup = group;
        this.add(group);
        this.contentGroup.x = 0;

        this.contentGroupMinY = -this.contentGroup.height + this.sliderHeight;
        this.contentGroupMaxY = 0;
        this.contentGroupMinX = this.sliderWidth - this.contentGroup.width;
        this.contentGroupMaxX = 0;


    };

    //we have to change input settings, because buttons that are not visible
    //are not covered by input sprite and they would be clickable
    G.SliderPanel.prototype.changeInputSettings = function(group) {

        for (var i = group.children.length; i--;) {
            var child = group.children[i];
            if (child.inputEnabled) {
                this.clickableObjects.push(child);
                child.inputEnabled = false;
            }
            if (child.children.length > 0) {
                this.changeInputSettings(child);
            }
        }

    };

    G.SliderPanel.prototype.update = function() {

        this.frameCounter++;

        if (this.inputSpriteDown && game.input.activePointer.isDown) {

            var difX = this.inputData.x - game.input.activePointer.worldX;
            var difY = this.inputData.y - game.input.activePointer.worldY;

            this.inputData.x = game.input.activePointer.worldX;
            this.inputData.y = game.input.activePointer.worldY;

            this.inputData.velX = 0.8 * (difX) + 0.2 * this.inputData.velX;
            this.inputData.velY = 0.8 * (difY) + 0.2 * this.inputData.velY;

            if (this.horizontal) {
                this.contentGroup.x -= this.inputData.velX;
            }

            if (this.vertical) {
                this.contentGroup.y -= this.inputData.velY;
            }

        } else {

            if (this.horizontal) {
                this.contentGroup.x -= this.inputData.velX;
                this.inputData.velX *= 0.95;
                if (Math.abs(this.inputData.velX) < 1) {
                    this.inputData.velX = 0;
                }
            }

            if (this.vertical) {
                this.contentGroup.y -= this.inputData.velY;
                this.inputData.velY *= 0.95;
                if (Math.abs(this.inputData.velY) < 1) {
                    this.inputData.velY = 0;
                }
            }

        }

        if (this.vertical) {
            this.boundRestrict('y', this.verticalLerp, this.contentGroupMinY, this.contentGroupMaxY);
        }

        if (this.horizontal) {
            this.boundRestrict('x', this.horizontalLerp, this.contentGroupMinX, this.contentGroupMaxX);
        }

        this.boundRestrict();


    };

    G.SliderPanel.prototype.propagateClick = function(pX, pY) {

        for (var i = 0; i < this.clickableObjects.length; i++) {
            if (this.clickableObjects[i].visible && this.clickableObjects[i].getBounds().contains(pX, pY)) {
                this.clickableObjects[i].onInputDown.dispatch();
                break;
            }
        }

    };


    G.SliderPanel.prototype.boundRestrict = function(prop, lerp, min, max) {

        if (lerp) {

            if (this.contentGroup[prop] > max) {
                this.contentGroup[prop] = G.lerp(this.contentGroup[prop], max, 0.5);
                if (this.contentGroup[prop] < max + 1) {
                    this.contentGroup[prop] = max;
                }
            }

            if (this.contentGroup[prop] < min) {
                this.contentGroup[prop] = G.lerp(this.contentGroup[prop], min, 0.2);
                if (this.contentGroup[prop] > min - 1) {
                    this.contentGroup[prop] = min;
                }
            }

        } else {

            this.contentGroup[prop] = game.math.clamp(this.contentGroup[prop], min, max);

        }

    };
    G.StrObjGroup = function(x, y, importObj) {

        Phaser.Group.call(this, game);

        this.x = x || 0;
        this.y = y || 0;

        this.importObj = typeof importObj === 'string' ? JSON.parse(importObj) : importObj;

        this.parseImportObj(this.importObj);

    };

    G.StrObjGroup.prototype = Object.create(Phaser.Group.prototype);

    G.StrObjGroup.prototype.parseImportObj = function(importObj) {

        for (var i = 0; i < importObj.length; i++) {

            var chunk = importObj[i];

            var img = G.makeImage(chunk.x, chunk.y, chunk.frame, chunk.anchor, this);
            img.scale.setTo(chunk.scale[0], chunk.scale[1]);
            img.angle = chunk.angle;

        }

    };
    G.Timer = function(x, y, font, fontSize, maxWidth, anchorX, anchorY) {

        G.OneLineText.call(this, x, y, font, '???', fontSize, maxWidth, anchorX, anchorY);

        this.secLeft = 0;
        this.active = false;

        this.timerBinding = G.sb.onWallClockTimeUpdate.add(this.updateTimer, this);

        this.events.onDestroy.add(function() {
            this.timerBinding.detach();
        }, this);

    }

    G.Timer.prototype = Object.create(G.OneLineText.prototype);


    G.Timer.prototype.updateTimer = function() {

        if (!this.active) return;

        G.sfx.clock_tick.play();

        this.secLeft = Math.max(0, this.secLeft - 1);
        this.setText(G.changeSecToTimerFormat(this.secLeft));

    };

    G.Timer.prototype.setSecLeft = function(secLeft) {

        this.secLeft = secLeft;
        this.setText(G.changeSecToTimerFormat(this.secLeft));

    };

    G.Timer.prototype.start = function(secLeft) {

        this.active = true;

    };


    G.UITargetParticles = function() {

        G.PoolGroup.call(this, G.UITargetParticle);

    }

    G.UITargetParticles.prototype = Object.create(G.PoolGroup.prototype);

    G.UITargetParticles.prototype.initPart = function(x, y, sprite, targetObj, carriedValue, start) {

        var part = this.init(x, y, sprite, targetObj, carriedValue);
        return part;
    };


    G.UITargetParticles.prototype.createDividedBatch = function(x, y, sprite, targetObj, amount, interval) {

        var batchObj = new G.UITargetParticles.BatchObj();

        var maxPartNr = maxPartNr || 25;
        var partNr = (amount / interval);
        if (partNr > maxPartNr) {
            interval = Math.ceil(amount / maxPartNr);
        }

        var nrOfPartsInBatch = Math.floor(amount / interval) + Math.sign(amount % interval);

        for (var i = 0; i < nrOfPartsInBatch; i++) {
            var part = this.init(x, y, sprite, targetObj, Math.min(interval, amount));
            amount -= interval;
            batchObj.add(part);
        }

        return batchObj;

    };

    G.UITargetParticles.prototype.createBatch = function(x, y, sprite, targetObj, carriedValue, nrOfParts) {

        var batchObj = new G.UITargetParticles.BatchObj();

        var array = Array.isArray(x);

        for (var i = 0; i < nrOfParts; i++) {
            if (array) {
                var part = this.init(x[i].x, x[i].y, sprite, targetObj, carriedValue);
            } else {
                var part = this.init(x, y, sprite, targetObj, carriedValue);
            }

            batchObj.add(part);
        }

        return batchObj;

    };

    G.UITargetParticles.BatchObj = function() {

        this.parts = [];
        this.nrOfParts = 0;
        this.nrOfFinished = 0;
        this.onFinish = new Phaser.Signal();

    };

    G.UITargetParticles.BatchObj.prototype.add = function(part) {

        this.parts.push(part);
        part.onFinish.addOnce(this.onPartFinish, this);
        this.nrOfParts++;

    };

    G.UITargetParticles.BatchObj.prototype.onPartFinish = function() {
        this.nrOfFinished++;
        if (this.nrOfFinished == this.nrOfParts) {
            this.onFinish.dispatch();
        }
    };

    G.UITargetParticles.BatchObj.prototype.addOnPartStart = function(func, context) {

        this.parts.forEach(function(part) {
            part.onStart.addOnce(func, context || part, 1);
        });

    };

    G.UITargetParticles.BatchObj.prototype.addOnPartFinish = function(func, context) {

        this.parts.forEach(function(part) {
            part.onFinish.addOnce(func, context || part, 1);
        });

    };

    G.UITargetParticles.BatchObj.prototype.start = function(delayBetween) {

        var delay = 0;
        this.parts.forEach(function(part) {
            part.start(delay);
            delay += delayBetween || 0;
        })

    };




    G.UITargetParticle = function() {

        G.Image.call(this, 0, 0, null, 0.5);
        this.onStart = new Phaser.Signal();
        this.onFinish = new Phaser.Signal();

        this.speed = 0;
        this.speedMax = 30;
        this.speedDelta = 0.75;



        this.vel = new Phaser.Point(0, 0);
        this.velInit = new Phaser.Point(0, 0);

        this.kill();

    };

    G.UITargetParticle.prototype = Object.create(G.Image.prototype);

    G.UITargetParticle.prototype.init = function(x, y, sprite, targetObj, carriedValue) {

        this.position.setTo(x, y);

        this.changeTexture(sprite);

        this.onStart.removeAll();
        this.onFinish.removeAll();

        this.carriedValue = carriedValue || 1;

        this.targetObj = targetObj;


        this.stopTweens(this);
        this.scale.setTo(1);
        this.alpha = 1;

        this.speed = 0;

        this.vel.setTo(0, 0);

    };

    G.UITargetParticle.prototype.start = function(delay) {

        if (delay) {
            game.time.events.add(delay, this.start, this);
            return;
        }

        this.revive();

        this.onStart.dispatch(this, this.carriedValue);

    };

    G.UITargetParticle.prototype.update = function() {

        if (!this.alive) return;

        this.position.add(this.vel.x, this.vel.y);
        this.vel.x *= 0.95;
        this.vel.y *= 0.95;

        this.speed += this.speedDelta;
        this.speed = Math.min(this.speed, this.speedMax);

        var distanceToTarget = Phaser.Point.distance(this.position, this.targetObj.worldPosition);
        var angleToTarget = Phaser.Point.angle(this.targetObj.worldPosition, this.worldPosition);
        this.position.add(
            G.lengthDirX(angleToTarget, Math.min(distanceToTarget, this.speed), true),
            G.lengthDirY(angleToTarget, Math.min(distanceToTarget, this.speed), true)
        );

        if (distanceToTarget < this.speedMax) {
            this.onFinish.dispatch(this, this.carriedValue);
            this.kill();
        };

    };
    if (typeof G == 'undefined') G = {};

    Math.sign = Math.sign || function(x) {
        x = +x; // convert to a number
        if (x === 0 || isNaN(x)) {
            return x;
        }
        return x > 0 ? 1 : -1;
    }


    G.isImageInCache = function(frameName) {

        var spritesheet = this.checkSheet(frameName)
        if (spritesheet != '') {
            return true;
        } else {
            return game.cache.checkImageKey(frameName);
        }

    };


    G.checkSheet = function(frame) {

        if (G.spritesheetMap) {
            return G.spritesheetMap[frame] || '';
        } else {
            return this.checkSheetOld();
        }


    };

    G.checkSheetOld = function() {
        for (var i = 0, len = G.ASSETS.spritesheets.length; i < len; i++) {
            var spritesheet = G.ASSETS.spritesheets[i];
            if (game.cache.checkImageKey(G.ASSETS.spritesheets[i]) && game.cache.getFrameData(G.ASSETS.spritesheets[i]).getFrameByName(frame)) {
                return G.ASSETS.spritesheets[i];
            }
        }
        return '';
    };

    G.lerp = function(valCurrent, valTarget, lerp, snapRange) {

        if (snapRange && Math.abs(valCurrent - valTarget) <= snapRange) {
            return valTarget;
        }

        return valCurrent + lerp * (valTarget - valCurrent);
    };

    G.l = function(value) {
        return Math.floor(value * G.Loader.currentConfigMulti);
    };

    G.rl = function(value) {

        return Math.floor(value * (1 / G.Loader.currentConfigMulti));

    };

    G.lnf = function(value) {
        return value * G.Loader.currentConfigMulti;
    };

    G.rnd = function(min, max) {
        return game.rnd.realInRange(min || 0, max || 1);
    };

    G.rndInt = function(min, max) {
        return game.rnd.between(min, max);
    };

    G.changeTexture = function(obj, image) {

        if (typeof image !== 'string') {
            //probalby texture file
            return obj.loadTexture(image);
        }

        var ssheet = this.checkSheet(image);

        if (ssheet == '') {
            obj.loadTexture(image);
        } else {
            obj.loadTexture(ssheet, image);
        };

    };

    G.txt = function(text) {

        if (!G.lang) G.lang = 'en';
        if (!G.json.languages[G.lang]) G.lang = 'en';
        //if(!G.json.languages[G.lang][text]) return G.json.languages['en'][text];
        return G.json.languages[G.lang][text] || text + '***';

    };

    G.deltaTime = 1;

    G.delta = function() {

        G.deltaTime = Math.min(1.5, game.time.elapsedMS / 16);
        if (game.time.elapsedMS == 17) G.deltaTime = 1;
    };

    G.rotatePositions = function(positions) {

        var result = [];

        for (var i = 0, len = positions.length; i < len; i += 2) {
            result.push(
                positions[i + 1] * -1,
                positions[i]
            )
        }

        return result;

    };

    G.loadTexture = G.changeTexture;

    G.makeImage = function(x, y, frame, anchor, groupToAdd) {

        var ssheet = this.checkSheet(frame);
        var image;

        if (ssheet == '') {
            image = game.make.image(this.l(x), this.l(y), frame);
        } else {
            image = game.make.image(this.l(x), this.l(y), ssheet, frame);
        }

        if (anchor) {
            if (typeof anchor == 'number') {
                image.anchor.setTo(anchor);
            } else {
                image.anchor.setTo(anchor[0], anchor[1]);
            }
        }

        if (groupToAdd) {
            (groupToAdd.add || groupToAdd.addChild).call(groupToAdd, image);
        } else if (groupToAdd !== null) {
            game.world.add(image);
        }

        return image;
    };

    G.capitalize = function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    G.lengthDirX = function(angle, length, rads) {
        var rads = rads || false;
        if (rads) {
            return Math.cos(angle) * length;
        } else {
            return Math.cos(game.math.degToRad(angle)) * length;
        }
    };

    G.lengthDirY = function(angle, length, rads) {
        var rads = rads || false;
        if (rads) {
            return Math.sin(angle) * length;
        } else {
            return Math.sin(game.math.degToRad(angle)) * length;
        }
    };


    G.stopTweens = function(obj) {
        game.tweens._tweens.forEach(function(tween) {
            if (obj.scale && tween.target == obj.scale) tween.stop();
            if (tween.target == obj) tween.stop();
        });
    };


    G.makeExtImage = function(x, y, url, waitImg, anchor, groupToAdd, tmp, func) {

        if (!G.extLoader) G.extLoader = new G.ExtLoader(game);

        var img;

        if (G.extLoader.loadedUrls[url]) {
            img = G.makeImage(x, y, G.extLoader.loadedUrls[url], anchor, groupToAdd);
            func.call(img);
            return img;
        }

        img = G.makeImage(x, y, waitImg, anchor, groupToAdd);
        img.onImgLoaded = new Phaser.Signal();

        if (!G.extImagesKeys) G.extImagesKeys = [];
        var name = 'extImgBlankName' + G.extImagesKeys.length;

        G.extImagesKeys.push(name);

        var binding = G.extLoader.onFileComplete.add(function(progress, key, success) {

            if (key == name && success) {

                G.extLoader.loadedUrls[url] = name;

                G.changeTexture(img, name);
                if (func) func.call(img);
                binding.detach();
            }

        });
        //game.load.start();

        G.extLoader.image(name, url, true);

        /*if (tmp) {
          G.extLoader.imagesToRemoveOnStateChange.push(name);
        }*/

        return img;

    };


    G.drawCircleSegment = function(gfx, x, y, radius, angleStart, angleFinish, segments) {

        if (angleStart === angleFinish) {
            return gfx;
        }

        if (segments === undefined) {
            segments = 10
        };

        var angleDiff = angleFinish - angleStart;
        var segDiff = angleDiff / segments;

        gfx.moveTo(x, y);
        var points = gfx.currentPath.shape.points;

        for (; angleStart <= angleFinish; angleStart += segDiff) {
            points.push(
                Math.floor(x + G.lengthDirX(angleStart, radius, false)),
                Math.floor(y + G.lengthDirY(angleStart, radius, false))
            )
        };

        points.push(
            Math.floor(x + G.lengthDirX(angleFinish, radius, false)),
            Math.floor(y + G.lengthDirY(angleFinish, radius, false))
        )


        gfx.dirty = true;
        gfx._boundsDirty = true;

        return gfx;


    };

    G.centerElements = function(list, distanceList, center) {

        if (center === undefined) center = 0;
        if (distanceList === undefined) distanceList = [];

        var wholeWidth = 0;

        list.forEach(function(e, i) {
            wholeWidth += e.width;
            console.log("list" + i + " : " + e.width);
            if (distanceList[i - 1] !== undefined) {
                console.log("adding distance: " + distanceList[i - 1]);
                wholeWidth += G.l(distanceList[i - 1]);
            }
        });

        console.log('whole Width : ' + wholeWidth);

        var currentX = center + (wholeWidth * -0.5);
        console.log('currentX: ' + currentX);

        list.forEach(function(e, i, a) {
            e.x = currentX;

            console.log(i + ': ' + e.x);

            e.x += e.width * e.anchor.x;

            console.log(i + ': ' + e.x);

            currentX += e.width;
            if (distanceList[i] !== undefined) {
                currentX += G.l(distanceList[i]);
            }
        });

    };


    G.makeMover = function(obj) {

        if (G.activeMover !== undefined) {
            G.activeMover.destroy();
            G.activeMover.eKey.onDown.removeAll();
        }

        G.activeMover = game.add.image();
        G.activeMover.obj = obj;
        G.activeMover.cursors = game.input.keyboard.createCursorKeys();
        G.activeMover.shiftKey = game.input.keyboard.addKey(Phaser.Keyboard.SHIFT);
        G.activeMover.eKey = game.input.keyboard.addKey(Phaser.Keyboard.E);
        G.activeMover.eKey.onDown.add(function() {
            console.log("MOVER: " + this.obj.x + 'x' + this.obj.y);
        }, G.activeMover)

        G.activeMover.update = function() {

            var moveVal = this.shiftKey.isDown ? 10 : 2;

            if (this.cursors.down.isDown) {
                obj.y += moveVal;
            }

            if (this.cursors.up.isDown) {
                obj.y -= moveVal;
            }

            if (this.cursors.left.isDown) {
                obj.x -= moveVal;
            }

            if (this.cursors.right.isDown) {
                obj.x += moveVal;
            }

        };

    };


    G.makeLineEditor = function(interpolation) {

        var be = game.add.group();

        be.interpolation = interpolation || 'linear';
        be.pointsX = [0];
        be.pointsY = [0];



        be.gfx = be.add(game.make.graphics());

        be.shiftKey = game.input.keyboard.addKey(Phaser.Keyboard.SHIFT);

        be.wKey = game.input.keyboard.addKey(Phaser.Keyboard.W);
        be.wKey.onDown.add(function() {

            var xx, yy;

            if (this.children.length > 2) {
                xx = this.children[this.children.length - 1].x;
                yy = this.children[this.children.length - 1].y;
            } else {
                xx = 0;
                yy = 0;
            }

            var newPoint = G.makeImage(xx, yy, 'candy_1');
            newPoint.anchor.setTo(0.5);
            newPoint.scale.setTo(0.1);
            this.add(newPoint);
            this.activeObject = newPoint;
            this.changed = true;
        }, be);

        be.qKey = game.input.keyboard.addKey(Phaser.Keyboard.Q);
        be.qKey.onDown.add(function() {
            if (this.children.length <= 2) return;
            this.removeChildAt(this.children.length - 1);
            if (this.children.length > 3) {
                this.activeObject = this.children[this.children.length - 1];
            } else {
                this.activeObject = null;
            }
            this.changed = true;
        }, be);


        be.aKey = game.input.keyboard.addKey(Phaser.Keyboard.A);
        be.aKey.onDown.add(function() {
            if (!this.activeObject) return;
            var index = this.getChildIndex(this.activeObject);
            if (index == 2) return;
            this.activeObject = this.getChildAt(index - 1);
        }, be);

        be.sKey = game.input.keyboard.addKey(Phaser.Keyboard.S);
        be.sKey.onDown.add(function() {
            if (!this.activeObject) return;
            var index = this.getChildIndex(this.activeObject);
            if (index == this.children.length - 1) return;
            this.activeObject = this.getChildAt(index + 1);
        }, be);

        be.eKey = game.input.keyboard.addKey(Phaser.Keyboard.E);
        be.eKey.onDown.add(function() {
            console.log(JSON.stringify([this.pointsX, this.pointsY]));
        }, be);


        be.cursors = game.input.keyboard.createCursorKeys();

        be.activeObject = null;

        be.preview = G.makeImage(0, 0, 'candy_2', 0.5, be);
        be.preview.width = 8;
        be.preview.height = 8;
        be.preview.progress = 0;

        be.update = function() {

            if (this.activeObject === null) return;

            this.forEach(function(e) {
                if (e == this.activeObject) {
                    e.alpha = 1;
                } else {
                    e.alpha = 0.5;
                }
            }, this)

            if (this.children.length == 0) return;

            var moveVal = this.shiftKey.isDown ? 3 : 1;

            if (this.cursors.down.isDown) {
                this.activeObject.y += moveVal;
                this.changed = true;
            }
            if (this.cursors.up.isDown) {
                this.activeObject.y -= moveVal;
                this.changed = true;
            }
            if (this.cursors.left.isDown) {
                this.activeObject.x -= moveVal;
                this.changed = true;
            }
            if (this.cursors.right.isDown) {
                this.activeObject.x += moveVal;
                this.changed = true;
            }


            be.preview.progress += 0.01;
            if (be.preview.progress > 1) be.preview.progress = 0;
            be.preview.x = game.math[this.interpolation + 'Interpolation'](this.pointsX, be.preview.progress);
            be.preview.y = game.math[this.interpolation + 'Interpolation'](this.pointsY, be.preview.progress);


            if (this.changed) {
                var pointsX = [];
                var pointsY = [];
                this.pointsX = pointsX;
                this.pointsY = pointsY;
                this.children.forEach(function(e, index) {
                    if (index <= 1) return;
                    pointsX.push(e.x);
                    pointsY.push(e.y);
                });

                this.gfx.clear();
                this.gfx.beginFill(0xff0000, 1);
                for (var i = 0; i < 200; i++) {
                    this.gfx.drawRect(
                        game.math[this.interpolation + 'Interpolation'](pointsX, i / 200),
                        game.math[this.interpolation + 'Interpolation'](pointsY, i / 200),
                        3, 3
                    );
                }
            }
        }


        return be;

    };


    G.lineUtils = {

        getWholeDistance: function(pointsX, pointsY) {

            var wholeDistance = 0;
            for (var i = 1; i < pointsX.length; i++) {
                wholeDistance += game.math.distance(pointsX[i - 1], pointsY[i - 1], pointsX[i], pointsY[i]);
            }
            return wholeDistance;

        },

        findPointAtDitance: function(pointsX, pointsY, dist) {

            var soFar = 0;
            for (var i = 1; i < pointsX.length; i++) {
                var currentDistance = game.math.distance(pointsX[i - 1], pointsY[i - 1], pointsX[i], pointsY[i]);
                if (currentDistance + soFar > dist) {
                    var angle = game.math.angleBetween(pointsX[i - 1], pointsY[i - 1], pointsX[i], pointsY[i]);
                    return [
                        pointsX[i - 1] + G.lengthDirX(angle, dist - soFar, true),
                        pointsY[i - 1] + G.lengthDirY(angle, dist - soFar, true)
                    ]
                } else {
                    soFar += currentDistance;
                }

            }
            return [pointsX[pointsX.length - 1], pointsY[pointsY.length - 1]];

        },

        spreadAcrossLine: function(pointsX, pointsY, elementsList, propName1, propName2) {

            console.log("spreadAcrossLine");

            var wholeDistance = this.getWholeDistance(pointsX, pointsY);
            var every = wholeDistance / (elementsList.length - 1);

            for (var i = 0; i < elementsList.length; i++) {
                var point = this.findPointAtDitance(pointsX, pointsY, every * i);
                elementsList[i][propName1 || 'x'] = point[0];
                elementsList[i][propName2 || 'y'] = point[1];
            }

        },

        spreadOnNodes: function(pointsX, pointsY, elementsList, propName1, propName2) {

            console.log("SPREAD ON NODES");
            console.log(arguments);

            for (var i = 0; i < pointsX.length; i++) {
                console.log(i);
                if (typeof elementsList[i] === 'undefined') return;
                elementsList[i][propName1 || 'x'] = pointsX[i];
                elementsList[i][propName2 || 'y'] = pointsY[i];
                console.log(i + ' pos: ' + pointsX[i] + 'x' + pointsY[i]);
            }

        }
    };



    G.changeSecToTimerFormat = function(sec) {

        var sec_num = parseInt(sec, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (seconds < 10) {
            seconds = "0" + seconds;
        }

        if (hours == 0) {
            return minutes + ':' + seconds;
        } else {
            return hours + ':' + minutes + ':' + seconds;
        }

    }

    G.arrayJoin = function(array, marker) {

        return array.reduce(function(accumulator, currentVal) {

            if (currentVal) {

                if (accumulator) {
                    return accumulator + marker + currentVal;
                } else {
                    return currentVal;
                }


            } else {
                return accumulator;
            }

        }, '');


    };

    G.makeTextButton = function(x, y, text, style, func, context) {

        var txt = game.make.text(x, y, text, style)
        txt.inputEnabled = true;
        txt.input.useHandCursor = true;
        txt.hitArea = new Phaser.Rectangle(0, 0, txt.width, txt.height);
        txt.events.onInputDown.add(func, context || null);

        return txt;

    };

    G.setObjProp = function(obj, prop, val) {

        var currentObj = obj;
        if (typeof prop == 'string') {
            prop.split('.');
        }

        try {
            for (var i = 0; i < this.refreshProp.length - 1; i++) {
                currentObj = currentObj[this.refreshProp[i]];
            }

            currentObj[this.refreshProp[this.refreshProp.length - 1]] = val;
        } catch (e) {
            console.warn('cant set prop');
            console.log(obj);
            console.log(prop);
        }


    };

    G.getObjProp = function(obj, prop) {

        var current = obj;
        if (typeof prop == 'string') {
            prop.split('.');
        }

        try {
            for (var i = 0; i < prop.length; i++) {
                current = current[prop[i]];
            }
        } catch (e) {
            console.warn('cant get prop');
            console.log(obj);
            console.log(prop);
            return undefined;
        }

        return current;

    };



    if (typeof G == 'undefined') G = {};

    G.Utils = {

        cacheText: function(cacheLabel, txt, font, fontSize, tint) {

            var txt = game.make.bitmapText(0, 0, font, txt, fontSize);
            txt.tint = tint || 0xffffff;
            txt.updateCache();

            var rt = game.make.renderTexture(txt.width, txt.height, cacheLabel, true);
            rt.render(txt);

            txt.destroy();

        },


        lerp: function(valCurrent, valTarget, lerp, snapRange) {
            if (snapRange && Math.abs(valCurrent - valTarget) <= snapRange) {
                return valTarget;
            }
            return valCurrent + lerp * (valTarget - valCurrent);
        },

        copyToClipboard: function(text) {

            if (!this.copyArea) {
                this.copyArea = document.createElement("textarea");
                this.copyArea.style.positon = 'fixed';
                this.copyArea.style.opacity = 0;
                document.body.appendChild(this.copyArea);

            }

            this.copyArea.value = text;
            this.copyArea.select();
            document.execCommand('copy');

        },

        getObjProp: function(obj, prop) {

            var current = obj;
            if (typeof prop == 'string') {
                prop = prop.split('.');
            }

            try {
                for (var i = 0; i < prop.length; i++) {
                    current = current[prop[i]];
                }
            } catch (e) {
                return undefined;
            }

            return current;

        },

        setObjProp: function(obj, prop, val) {

            var currentObj = obj;
            if (typeof prop == 'string') {
                prop = prop.split('.');
            }

            try {
                for (var i = 0; i < prop.length - 1; i++) {
                    currentObj = currentObj[prop[i]];
                }
                currentObj[prop[prop.length - 1]] = val;
            } catch (e) {
                return null;
            }

        },

        replaceAll: function(string, search, replacement) {
            return string.split(search).join(replacement);
        },

        removeDuplicates: function(array) {

            var result = [];

            array.forEach(function(elem) {
                if (result.indexOf(elem) === -1) result.push(elem);
            });

            return result;

        },

        arraysEqual: function arraysEqual(a, b) {
            if (a === b) return true;
            if (a == null || b == null) return false;
            if (a.length != b.length) return false;

            // If you don't care about the order of the elements inside
            // the array, you should sort both arrays here.

            for (var i = 0; i < a.length; ++i) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }

    };

    G.lineCircleColl = function(LINE, C, point) {

        var A = LINE.start;
        var B = LINE.end;

        var LAB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2))

        var Dx = (B.x - A.x) / LAB
        var Dy = (B.y - A.y) / LAB

        var t = Dx * (C.x - A.x) + Dy * (C.y - A.y)

        var Ex = t * Dx + A.x
        var Ey = t * Dy + A.y

        var LEC = Math.sqrt(Math.pow(Ex - C.x, 2) + Math.pow(Ey - C.y, 2))

        if (LEC < C.radius) {

            var dt = Math.sqrt((C.radius * C.radius) - (LEC * LEC))

            var Fx = (t - dt) * Dx + A.x;
            var Fy = (t - dt) * Dy + A.y;

            var Gx = (t + dt) * Dx + A.x;
            var Gy = (t + dt) * Dy + A.y;

            var FtoLength = game.math.distance(A.x, A.y, Fx, Fy);
            var GtoLength = game.math.distance(A.x, A.y, Gx, Gy);

            if (FtoLength < GtoLength) {
                if (LINE.length > FtoLength) {
                    point.setTo(Fx, Fy);
                    return point;
                } else {
                    return false;
                }
            } else {
                if (LINE.length > GtoLength) {
                    point.setTo(Gx, Gy);
                    return point;
                } else {
                    return false;
                }
            }

        } else {
            return false;
        }

    };


    G.AnimationElement = function(x, y, data, autoplay) {

        G.Image.call(this, x, y, null);

        this.ANIMATIONELEMENT = true;

        //we need to have this element, so constructor act as wrapper
        //so it can be placed, rotated and scaled without affecting
        //values on timelines
        this.SPR = new G.Image(0, 0, null, 0.5, this);

        this.frameCounter = 0;
        this.data = data;

        this.currentAnimationData = null;
        this.currentAnimationName = null;

        this.playing = autoplay === undefined ? true : autoplay;

    };

    G.AnimationElement.prototype = Object.create(G.Image.prototype);

    G.AnimationElement.prototype.update = function() {

        if (!this.currentAnimationName) return;

        if (this.playing) {
            this.frameCounter++;
            this.updateAnimation(this.frameCounter);
        }

    };

    G.AnimationElement.prototype.pause = function() {
        this.playing = false;
    };

    G.AnimationElement.prototype.resume = function() {
        this.playing = true;
    };

    G.AnimationElement.prototype.play = function() {
        this.playing = true;
    };

    G.AnimationElement.prototype.stop = function() {
        this.playing = false;
        this.updateAnimation(0);
    };

    /*G.AnimationElement.prototype.getTotalLength = function(){

      var len = Infinity;

      for (var i = 0; i < this.propKeys.length; i++){
        len = Math.min(
          this.propTLS[this.propKeys[0]].length,
          len
        );
      }

      len = Math.min(this.eventTL.length,len);

      return len;

    };*/

    /*
    G.AnimationElement.prototype.init = function(dataInit){

      this.SPR.x = dataInit.x;
      this.SPR.y = dataInit.y;
      this.SPR.angle = dataInit.angle;
      this.SPR.scale.setTo(dataInit.scale[0],dataInit.scale[1]);
      this.SPR.changeTexture(dataInit.frame);
      this.SPR.anchor.setTo(dataInit.anchor[0],dataInit.anchor[1]);

    };*/

    var testObj = {
        normal: {
            eventTL: [],
            frameTL: [{
                f: 0,
                v: 'candy_1'
            }],
            propTLS: {
                alpha: [{
                    f: 0,
                    v: 1
                }],
                x: [{
                    f: 0,
                    v: 0
                }],
                y: [{
                    f: 0,
                    v: 0
                }],
                angle: [{
                    f: 0,
                    v: 0
                }],
                'scale.x': [{
                    f: 0,
                    v: 1
                }],
                'scale.y': [{
                    f: 0,
                    v: 1
                }],
                'anchor.x': [{
                    f: 0,
                    v: 0.5
                }],
                'anchor.y': [{
                    f: 0,
                    v: 1
                }]
            }
        },
        jump: {
            eventTL: [],
            frameTL: [{
                f: 0,
                v: null
            }],
            propTLS: {
                alpha: [{
                    f: 0,
                    v: 1
                }],
                x: [{
                    f: 0,
                    v: 0
                }],
                y: [{
                    f: 0,
                    v: 0
                }, {
                    f: 120,
                    v: -300
                }],
                angle: [{
                    f: 0,
                    v: 0,
                    e: ['Linear', 'None']
                }, {
                    f: 400,
                    v: 360
                }],
                'scale.x': [{
                    f: 0,
                    v: 1
                }],
                'scale.y': [{
                    f: 0,
                    v: 1
                }],
                'anchor.x': [{
                    f: 0,
                    v: 0.5
                }],
                'anchor.y': [{
                    f: 0,
                    v: 1
                }]
            }
        }
    }

    G.AnimationElement.prototype.changeAnimationData = function(animationName) {

        if (!this.data[animationName]) {
            animationName = Object.keys(this.data)[0];
        }

        this.eventTL = this.data[animationName].eventTL;
        this.frameTL = this.data[animationName].frameTL;
        this.propTLS = this.data[animationName].propTLS;
        this.propKeys = Object.keys(this.propTLS);
        this.currentAnimationData = this.data[animationName];
        this.currentAnimationName = animationName;
        this.updateAnimation(0);


    };

    G.AnimationElement.prototype.playAnimation = function(animationName) {

        this.changeAnimationData(animationName);
        this.playing = true;

    };

    G.AnimationElement.prototype.getLastKeyFrame = function(tl, frameNr) {

        var len = tl.length;
        for (var i = 0; i < len; i++) {
            if (tl[i].f == frameNr || i == len - 1) return tl[i];
            if (tl[i].f < frameNr && frameNr < tl[i + 1].f) {
                return tl[i];
            }
        };

    };

    G.AnimationElement.prototype.getNextKeyFrame = function(tl, frameNr) {

        var len = tl.length;
        for (var i = 0; i < len; i++) {
            if (tl[i].f > tl || i == len - 1) {
                return tl[i];
            }
        };

    };

    G.AnimationElement.prototype.getKeyFrameAt = function(tl, frameNr) {

        if (!this.currentAnimationName) return null;

        for (var i = 0; i < tl.length; i++) {
            var keyFrame = tl[i];
            if (keyFrame.f === frameNr) return keyFrame;
        }

        return null;
    }

    G.AnimationElement.prototype.isAnyKeyFrameAt = function(frameNr) {

        if (!this.currentAnimationName) return false;

        if (this.getKeyFrameAt(this.eventTL, frameNr)) return true;
        if (this.getKeyFrameAt(this.frameTL, frameNr)) return true;

        for (var i = 0; i < this.propKeys.length; i++) {
            var key = this.propKeys[i];
            if (this.getKeyFrameAt(this.propTLS[key], frameNr)) {
                return true;
            }
        }

        return false;

    };

    G.AnimationElement.prototype.getFrameValue = function(tl, frameNr) {

        var lastKey = this.getLastKeyFrame(tl, frameNr);
        var nextKey = this.getNextKeyFrame(tl, frameNr);

        if (!lastKey.e) {
            return lastKey.v;
        } else {
            var animLength = nextKey.f - lastKey.f;
            var valDiff = nextKey.v - lastKey.v;
            var easingVal = Phaser.Easing[lastKey.e[0]][lastKey.e[1]]((frameNr - lastKey.f) / animLength);
            return lastKey.v + (valDiff * easingVal);
        }

    };


    G.AnimationElement.prototype.updateAnimation = function(frameNr) {

        if (!this.currentAnimationName) return;

        this.frameCounter = frameNr;

        this.updateFromPropTLS(frameNr);

        var frame = this.getTextureFrameValue(this.frameTL, frameNr);
        if (this.SPR.key != frame && this.SPR.frameName != frame) {
            G.changeTexture(this.SPR, frame);
        }


    }

    G.AnimationElement.prototype.updateFromPropTLS = function(frameNr) {

        for (var i = 0; i < this.propKeys.length; i++) {
            var key = this.propKeys[i];
            this.setProp(key, this.getFrameValue(this.propTLS[key], frameNr));
        }

    };

    // lets make it a bit faster
    G.AnimationElement.prototype.setProp = function(key, value) {

        if (key == 'scale.x') this.SPR.scale.x = value;
        else if (key == 'scale.y') this.SPR.scale.y = value;
        else if (key == 'anchor.x') this.SPR.anchor.x = value;
        else if (key == 'anchor.y') this.SPR.anchor.y = value;
        else this.SPR[key] = value;

    };


    G.AnimationElement.prototype.getTextureFrameValue = function(tl, frameNr) {

        var lastKey = this.getLastKeyFrame(tl, frameNr);

        var frameSkip = lastKey.frameSkip || 1;

        var frameDiff = frameNr - lastKey.f;

        frameDiff = Math.floor(frameDiff / frameSkip);

        if (!lastKey.animation) {
            return lastKey.v;
        } else {

            var len = lastKey.v.length;

            if (lastKey.loop) {

                if (!lastKey.refraction && !lastKey.reverse) {
                    return lastKey.v[frameDiff % len];
                }
                /*else if (!lastKey.refraction && lastKey.reverse){
                  var fmod = frameNr % (len*2);
                  return fmod < len ? lastKey.v[fmod] : (len-1)-(fmod-len);
                }*/
                else if (lastKey.refraction && !lastKey.reverse) {
                    return lastKey.v[Math.min(len - 1, (frameDiff % (len + lastKey.refraction)))];
                }
                /*else if (lastKey.refraction && lastKey.reverse){

                      }*/

            } else {
                return lastKey.v[Math.min(len - 1, frameDiff)];
            }
        }

    }
    G.GroupColliderLineLine = function(group1, group2, callback, context) {

        G.Image.call(this, 0, 0, null);

        this.group1 = group1;
        this.group2 = group2;
        this.callback = callback;
        this.context = context || null;

        this.collPoint = new Phaser.Point(0, 0);

    };

    G.GroupColliderLineLine.prototype = Object.create(G.Image.prototype);

    G.GroupColliderLineLine.prototype.update = function() {

        var len1 = this.group1.length;
        var len2 = this.group2.length;

        for (var i = 0; i < len1; i++) {
            var e1 = this.group1.children[i];
            for (var j = 0; j < len2; j++) {
                var e2 = this.group2.children[j];
                if (e1 === e2) continue;

                if (e1.collLine.intersects(e2.collLine, true, this.collPoint)) {
                    this.callback.call(this.context, e1, e2, this.collPoint, this.group1, this.group2);
                }

            }
        }

    };


    G.GroupColliderLineCircle = function(group1, group2, callback, context) {

        G.Image.call(this, 0, 0, null);

        this.group1 = group1;
        this.group2 = group2;
        this.callback = callback;
        this.context = context || null;

        this.collPoint = new Phaser.Point(0, 0);

    };

    G.GroupColliderLineCircle.prototype = Object.create(G.Image.prototype);

    G.GroupColliderLineCircle.prototype.update = function() {

        var len1 = this.group1.length;
        var len2 = this.group2.length;

        for (var i = this.group1.length; i--;) {
            var e1 = this.group1.children[i];
            for (var j = this.group2.length; j--;) {
                var e2 = this.group2.children[j];
                if (e1 === e2) continue;

                if (G.lineCircleColl(e1.collLine, e2.collCircle, this.collPoint)) {
                    this.callback.call(this.context, e1, e2, this.collPoint, this.group1, this.group2);
                }

            }
        }

    };
    //OVERWRITES


    //set alive to false
    Phaser.Group.prototype.destroy = function(destroyChildren, soft) {

        if (this.game === null || this.ignoreDestroy) {
            return;
        }

        if (destroyChildren === undefined) {
            destroyChildren = true;
        }
        if (soft === undefined) {
            soft = false;
        }

        this.onDestroy.dispatch(this, destroyChildren, soft);

        this.removeAll(destroyChildren);

        this.cursor = null;
        this.filters = null;
        this.alive = false;
        this.pendingDestroy = false;

        if (!soft) {
            if (this.parent) {
                this.parent.removeChild(this);
            }

            this.game = null;
            this.exists = false;
        }

    };


    Phaser.exportChildren = function(obj) {

        var result = [];

        for (var i = 0; i < obj.children.length; i++) {
            var child = obj.children[i];
            if (child.exportToString) {
                result.push(child.exportToString())
            }
        }

        return result;

    };


    Phaser.Group.prototype.exportToString = function() {

        var exportObj = {
            type: 'GROUP',
            x: this.x,
            y: this.y,
            scale: [this.scale.x, this.scale.y],
            angle: this.angle,
            children: Phaser.exportChildren(this)
        }

        return exportObj

    };

    Phaser.Image.prototype.exportToString = function() {

        exportObj = {
            type: 'IMG',
            x: this.x,
            y: this.y,
            frame: this.frameName,
            anchor: [this.anchor.x, this.anchor.y],
            scale: [this.scale.x, this.scale.y],
            angle: this.angle,
            children: Phaser.exportChildren(this)
        }

        return exportObj

    };
    if (typeof G == 'undefined') G = {};

    G.Button = function(x, y, sprite, callback, context) {

        Phaser.Button.call(this, game, G.l(x), G.l(y), null, this.click, this);

        this.state = game.state.getCurrentState();

        G.changeTexture(this, sprite);
        this.anchor.setTo(0.5);

        this.sfx = G.sfx.button_click;

        this.active = true;

        this.onClick = new Phaser.Signal();
        if (callback) {
            this.onClick.add(callback, context || this);
        }

        this.terms = [];

        this.orgScale = {
            x: 1,
            y: 1
        };


    }

    G.Button.prototype = Object.create(Phaser.Button.prototype);
    G.Button.constructor = G.Button;

    G.Button.prototype.click = function() {
        if (!this.active) return;

        for (var i = 0; i < this.terms.length; i++) {
            if (!this.terms[i][0].call(this.terms[i][1])) {
                return;
            }
        }

        this.active = false;
        this.onClick.dispatch();

        if (this.sfx) this.sfx.play();

        if (this.IMMEDIATE) {
            this.active = true;
        } else {

            game.add.tween(this.scale).to({
                x: this.orgScale.x - 0.1,
                y: this.orgScale.y - 0.1
            }, 100, Phaser.Easing.Quadratic.Out, true).onComplete.add(function() {

                game.add.tween(this.scale).to({
                    x: this.orgScale.x,
                    y: this.orgScale.y
                }, 100, Phaser.Easing.Quadratic.Out, true).onComplete.add(function() {
                    this.active = true;
                }, this)
            }, this)

        }
    }

    G.Button.prototype.addTerm = function(callback, context) {
        this.terms.push([callback, context]);
    }

    G.Button.prototype.addImageLabel = function(image) {
        this.label = game.make.image(0, 0, 'ssheet', image);
        this.label.anchor.setTo(0.5);
        this.addChild(this.label);
    };

    /*addTextLabel = function(font,text,size) {
      var multi = 1/G.Loader.currentConfigMulti;
      this.label = new G.OneLineText(0,0,font,text,size || Math.floor(this.height*multi*0.7),this.width*multi*0.9,0.5,0.5);
      this.addChild(this.label);
    };*/

    G.Button.prototype.addTextLabelMultiline = function(font, text) {
        var multi = 1 / G.Loader.currentConfigMulti;
        this.label = new G.MultiLineText(0, 0, font, text, Math.floor(this.height * multi * 0.5), this.width * multi * 0.8, this.height * multi * 0.7, 'center', 0.5, 0.5);
        this.addChild(this.label);
    };

    G.Button.prototype.addTextLabel = function(font, text, size) {
        /*var button = this;
        var style = { font: 'bold '+G.l(20)+'px Arial', fill: color || 'black', align: 'center', wordWrap: true, wordWrapWidth: button.width*0.9 };
        var txt = game.add.text(0,0,label,style);
        txt.alpha = 0.8;
        txt.anchor.setTo(0.5);
        txt.width = Math.min(txt.width,button.width);
        txt.height = Math.min(txt.height,button.height);
        button.addChild(txt);*/
        var multi = 1 / G.Loader.currentConfigMulti;

        this.label = new G.OneLineText(0, 0, font, text, size || Math.floor(this.height * multi * 0.7), this.width * multi * 0.9, 0.5, 0.5);

        this.label.hitArea = new Phaser.Rectangle(0, 0, 0, 0);
        this.addChild(this.label);
    };
    if (typeof G == 'undefined') G = {};

    G.ExtLoader = function() {

        Phaser.Loader.call(this, game);
        game.state.onStateChange.add(this.reset, this);
        this.imagesToRemoveOnStateChange = [];
        this.loadedUrls = {};

    };

    G.ExtLoader.prototype = Object.create(Phaser.Loader.prototype);

    G.ExtLoader.prototype.reset = function(hard, clearEvents) {

        this.imagesToRemoveOnStateChange.forEach(function(key) {
            this.cache.removeImage(key);
        }, this);
        this.imagesToRemoveOnStateChange = [];

        Phaser.Loader.prototype.reset.call(this, hard, clearEvents);

    };
    G.FrameAnimation = function(x, y, frames, timer, loop) {

        Phaser.Image.call(this, game, G.l(x), G.l(y));

        this.animFrames = frames;
        this.animFramesLen = this.animFrames.length;

        this.timer = timer;
        this.loop = loop;

        G.changeTexture(this, this.animFrames[0]);

        this.currentTimer = 0;
        this.currentIndex = 0;

        this.active = true;


    };

    G.FrameAnimation.prototype = Object.create(Phaser.Image.prototype);

    G.FrameAnimation.prototype.update = function() {

        if (this.active && ++this.currentTimer >= this.timer) {

            this.currentTimer = 0;
            this.currentIndex++;

            if (this.currentIndex == this.animFramesLen) {

                if (this.loop == 0) {
                    return this.active = false;
                }

                if (this.loop > 0) this.loop--;

                this.currentIndex = 0;

            }

            G.changeTexture(this, this.animFrames[this.currentIndex]);

        }

    };
    G.MultiLineText = function(x, y, font, text, size, max_width, max_height, align, hAnchor, vAnchor) {

        if (G.lang == 'ar') {

            var text = game.make.text(x, y, text, {
                fontSize: size,
                fill: 'white',
                align: align == 'left' ? 'right' : align,
                wordWrap: true,
                wordWrapWidth: max_width
            });
            text.anchor.setTo(hAnchor, vAnchor);

            if (max_width) {
                text.width = Math.min(max_width, text.width);
            }

            if (max_height) {
                text.height = Math.min(max_height, text.height);
            }

            return text;

        }

        x = G.l(x);
        y = G.l(y);
        size = G.l(size);
        max_width = G.l(max_width);
        max_height = G.l(max_height);

        this.maxUserWidth = max_width;
        this.maxUserHeight = max_height;

        Phaser.BitmapText.call(this, game, x, y, font, '', size);

        //this.maxWidth = max_width;
        this.splitText(text, max_width);

        this.align = align || 'center';

        if (max_height) {
            while (this.height > max_height) {
                this.fontSize -= 2;
                this.splitText(text, max_width);
                this.updateText();
                if (this.fontSize < 5) break;
            }
        }

        this.anchor.setTo(hAnchor, vAnchor);

        // this.hAnchor = typeof hAnchor == 'number' ? hAnchor : 0.5;
        //this.vAnchor = typeof vAnchor == 'number' ? vAnchor : 0;

        this.cacheAsBitmap = true;
        //this._cachedSprite.anchor.setTo(this.hAnchor,this.vAnchor);

    };

    G.MultiLineText.prototype = Object.create(Phaser.BitmapText.prototype);
    G.MultiLineText.prototype.constructor = G.MultiLineText;


    G.MultiLineText.prototype.splitText = function(text, max_width) {

        var txt = text;
        var txtArray = [];
        var prevIndexOfSpace = 0;
        var indexOfSpace = 0;
        var widthOverMax = false;

        while (txt.length > 0) {

            prevIndexOfSpace = indexOfSpace;
            indexOfSpace = txt.indexOf(' ', indexOfSpace + 1);


            if (indexOfSpace == -1) this.setText(txt);
            else this.setText(txt.substring(0, indexOfSpace));
            this.updateText();

            if (this.width > max_width) {

                if (prevIndexOfSpace == 0 && indexOfSpace == -1) {
                    txtArray.push(txt);
                    txt = '';
                    indexOfSpace = 0;
                    continue;
                }

                if (prevIndexOfSpace == 0) {
                    txtArray.push(txt.substring(0, indexOfSpace));
                    txt = txt.substring(indexOfSpace + 1);
                    indexOfSpace = 0;
                    continue;
                }

                txtArray.push(txt.substring(0, prevIndexOfSpace));
                txt = txt.substring(prevIndexOfSpace + 1);
                indexOfSpace = 0;


            } else {
                //ostatnia linijka nie za dluga
                if (indexOfSpace == -1) {
                    txtArray.push(txt);
                    txt = '';
                }

            }

        }


        this.setText(txtArray.join('\n'));


    };



    G.MultiLineText.prototype.popUpAnimation = function() {

        this.cacheAsBitmap = false;

        var char_numb = this.children.length;

        //
        var delay_array = [];
        for (var i = 0; i < char_numb; i++) {
            delay_array[i] = i;
        }

        delay_array = Phaser.ArrayUtils.shuffle(delay_array);
        delay_index = 0;
        this.activeTweens = 0;

        this.children.forEach(function(letter) {

            if (letter.anchor.x == 0) {
                letter.x = letter.x + (letter.width * 0.5);
                letter.y = letter.y + letter.height;
                letter.anchor.setTo(0.5, 1);
            }
            var target_scale = letter.scale.x;
            letter.scale.setTo(0, 0);
            this.activeTweens++;
            var tween = game.add.tween(letter.scale)
                .to({
                    x: target_scale * 1.5,
                    y: target_scale * 1.5
                }, 200, Phaser.Easing.Quadratic.In, false, delay_array[delay_index] * 25)
                .to({
                    x: target_scale,
                    y: target_scale
                }, 200, Phaser.Easing.Sinusoidal.In);
            tween.onComplete.add(function() {
                this.activeTweens--;
                if (this.activeTweens == 0) {
                    if (this.alive) this.cacheAsBitmap = true;
                }
            }, this);
            tween.start();
            delay_index++;
        }, this)
    };
    G.OneLineText = function(x, y, font, text, size, width, hAnchor, vAnchor, skipArabic) {

        if (!skipArabic && G.lang == 'ar') {

            var text = game.make.text(x, y, text, {
                fontSize: size,
                fill: 'white'
            });
            text.anchor.setTo(hAnchor, vAnchor);

            if (width) {
                text.width = Math.min(width, text.width);
            }

            return text;


        };

        Phaser.BitmapText.call(this, game, G.l(x), G.l(y), font, text, G.l(size), G.l(width));

        if (width) {
            while (this.width > G.l(width)) {
                this.fontSize -= 2;
                this.updateText();
                if (this.fontSize < 5) break;
            }
        }


        this.orgFontSize = G.l(size);

        this.maxUserWidth = G.l(width);


        this.skipCaching = G.skipOneLineTextCaching || false;

        this.hAnchor = hAnchor;
        this.vAnchor = vAnchor;

        this.anchor.setTo(this.hAnchor, this.vAnchor);
        this.updateText();


        this.insertCoin(this.fontSize);

        if (!this.skipCaching) {
            this.cacheAsBitmap = true;
            this.updateCache();
        }



        //this._cachedSprite.anchor.setTo(typeof this.hAnchor == 'undefined' ? 0.5 : this.hAnchor,this.vAnchor || 0);

        //this.x -= Math.floor(this.width*0.5);


    };


    G.OneLineText.prototype = Object.create(Phaser.BitmapText.prototype);
    G.OneLineText.prototype.constructor = G.OneLineText;

    G.OneLineText.prototype.insertCoin = function(size) {


        if (this.text.indexOf('$$') == -1) return;


        this.children.forEach(function(element, index, array) {

            if (!element.name) return;

            if (element.name == "$" && element.visible) {
                if (index + 1 <= array.length - 1 && array[index].name == '$') {

                    var el = element;
                    var el2 = array[index + 1];

                    el.visible = false;
                    el2.visible = false;
                    coin = G.makeImage(el.x + (size * 0.05), el.y - (size * 0.05), 'coin');
                    coin.width = size;
                    coin.height = size;
                    el.parent.addChild(coin);


                }
            }


        });

    }


    G.OneLineText.prototype.setText = function(text) {

        Phaser.BitmapText.prototype.setText.call(this, text.toString());

        var oldScaleX = this.scale.x;
        var oldScaleY = this.scale.y;
        var oldAlpha = this.alpha;
        var oldAngle = this.angle;

        this.alpha = 1;
        this.scale.setTo(1);


        if (this.maxUserWidth) {
            this.fontSize = this.orgFontSize;
            this.updateText();
            var i = 0;
            while (this.width > this.maxUserWidth) {
                this.fontSize -= 1;

                this.updateText();
                if (this.fontSize < 5) break;
            }
        }

        if (!this.skipCaching && this.cacheAsBitmap) this.updateCache();

        this.scale.setTo(oldScaleX, oldScaleY);
        this.alpha = oldAlpha;
        this.angle = oldAngle;
        //this._cachedSprite.anchor.setTo(this.hAnchor || 0.5,1);

    };


    G.OneLineText.prototype.popUpAnimation = function() {

        this.cacheAsBitmap = false;

        var char_numb = this.children.length;

        //
        var delay_array = [];
        for (var i = 0; i < char_numb; i++) {
            delay_array[i] = i;
        }

        delay_array = Phaser.ArrayUtils.shuffle(delay_array);
        delay_index = 0;
        this.activeTweens = 0;

        this.children.forEach(function(letter) {

            if (letter.anchor.x == 0) {
                letter.x = letter.x + (letter.width * 0.5);
                letter.y = letter.y + letter.height;
                letter.anchor.setTo(0.5, 1);
            }
            var target_scale = letter.scale.x;
            letter.scale.setTo(0, 0);
            this.activeTweens++;
            var tween = game.add.tween(letter.scale)
                .to({
                    x: target_scale * 1.5,
                    y: target_scale * 1.5
                }, 200, Phaser.Easing.Quadratic.In, false, delay_array[delay_index] * 25)
                .to({
                    x: target_scale,
                    y: target_scale
                }, 200, Phaser.Easing.Sinusoidal.In);
            tween.onComplete.add(function() {
                this.activeTweens--;
                if (this.activeTweens == 0) {
                    if (this.alive && !this.skipCaching) this.cacheAsBitmap = true;
                }
            }, this);
            tween.start();
            delay_index++;
        }, this)
    };

    G.OneLineText.prototype.scaleOut = function(onComplete, context) {
        this.cacheAsBitmap = false;

        this.activeTweens = 0;


        this.children.forEach(function(letter, index) {

            if (letter.anchor.x == 0) {
                letter.x = letter.x + letter.width * 0.5;
                letter.y = letter.y + letter.height * 0.5;
                letter.anchor.setTo(0.5, 0.5);
            }
            this.activeTweens++;
            letter.scale.setTo(letter.scale.x, letter.scale.y);

            var tween = game.add.tween(letter.scale)
                .to({
                    x: 0,
                    y: 0
                }, 400, Phaser.Easing.Cubic.In, false, index * 20);
            tween.onComplete.add(function() {
                this.activeTweens--;
                if (this.activeTweens == 0) {
                    this.destroy()
                }
            }, this);
            tween.start();
        }, this)

    }




    G.OneLineCounter = function(x, y, font, amount, size, width, hAnchor, vAnchor, preText, postText) {

        G.OneLineText.call(this, x, y, font, '', size, width, hAnchor, vAnchor, true);

        this.amount = amount;
        this.amountDisplayed = amount;
        this.amountMaxInterval = 5;
        this.amountMaxNegInterval = -5;

        this.absoluteDisplay = false;
        this.fixedToDecimal = 0;

        this.stepCurrent = 0;
        this.step = 0;

        this.preText = preText || '';
        this.postText = postText || '';

        this.setText(this.preText + amount + this.postText);

    };

    G.OneLineCounter.prototype = Object.create(G.OneLineText.prototype);

    G.OneLineCounter.prototype.update = function() {

        if (this.amountDisplayed != this.amount && this.stepCurrent-- <= 0) {
            this.stepCurrent = this.step;

            if (this.amountDisplayed != this.amount) {

                var diff = this.amount - this.amountDisplayed;

                this.amountDisplayed += game.math.clamp(diff, this.amountMaxNegInterval, this.amountMaxInterval);


                var valueToDisplay = this.amountDisplayed;

                if (this.absoluteDisplay) {
                    valueToDisplay = Math.abs(valueToDisplay)
                };
                if (this.fixedTo != 0) {
                    valueToDisplay = valueToDisplay.toFixed(this.fixedToDecimal)
                };

                this.setText(this.preText + valueToDisplay + this.postText);

            }

        }

    };

    G.OneLineCounter.prototype.changeAmount = function(amount) {
        this.amount = amount;
    };

    G.OneLineCounter.prototype.increaseAmount = function(change) {
        this.amount += change;
    };

    G.OneLineCounter.prototype.changeIntervals = function(max, maxNeg) {

        if (typeof maxNeg == 'undefined') {
            this.amountMaxInterval = max;
            this.amountMaxNegInterval = -max;
        } else {
            this.amountMaxInterval = max;
            this.amountMaxNegInterval = maxNeg;
        }

    };
    if (typeof G === "undefined") G = {};
    G.ASSETS = {
        "spritesheets": ["ssheet", "ui"],
        "sfx": ["bubble_hits_bubble.mp3", "bubble_hits_wall.mp3", "bubble_pops_1.mp3", "bubble_pops_2.mp3", "bubble_pops_3.mp3", "button_click.mp3", "lost.mp3", "shoot_bubble.mp3", "won.mp3"],
        "images": ["popup_box.png"],
        "json": ["languages.json"],
        "fonts": {
            "font": {
                "data": "font.fnt",
                "frame": "font.png"
            }
        }
    };
    G.Boot = function(game) {};

    G.Boot.prototype = {

        init: function() {

            if (typeof SG !== 'undefined') {
                G.lang = SG.lang;
            } else {
                G.lang = 'en';
            }

            if (this.game.device.android && this.game.device.chrome && this.game.device.chromeVersion >= 55) {
                this.game.sound.touchLocked = true;
                this.game.input.addTouchLockCallback(function() {
                    if (this.noAudio || !this.touchLocked || this._unlockSource !== null) {
                        console.log('no need to unlock');
                        return true;
                    }
                    console.log('usingWebAudio: ', this.usingWebAudio);
                    if (this.usingWebAudio) {
                        var buffer = this.context.createBuffer(1, 1, 22050);
                        this._unlockSource = this.context.createBufferSource();
                        this._unlockSource.buffer = buffer;
                        this._unlockSource.connect(this.context.destination);

                        if (this._unlockSource.start === undefined) {
                            this._unlockSource.noteOn(0);
                        } else {
                            this._unlockSource.start(0);
                        }

                        //Hello Chrome 55!
                        if (this._unlockSource.context.state === 'suspended') {
                            this._unlockSource.context.resume();
                        }
                    }

                    //  We can remove the event because we've done what we needed (started the unlock sound playing)
                    return true;

                }, this.game.sound, true);
            }

            game.renderer.renderSession.roundPixels = true;

            this.scale.pageAlignHorizontally = true
            this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
            this.stage.backgroundColor = 0x000000;
            this.input.maxPointers = 1;
            this.stage.disableVisibilityChange = true;
            game.tweens.frameBased = true;
            game.time.advancedTiming = true;

            this.scaleGameSizeUpdate = function() {

                var standardWidth = game.device.desktop ? G.l(1000) : G.l(640);
                var standardHeight = game.device.desktop ? G.l(800) : G.l(990);

                var ratio = window.innerHeight / window.innerWidth;

                var ratioHeight = Math.floor(standardWidth * ratio);

                game.scale.setGameSize(standardWidth, Math.max(ratioHeight, standardHeight));
                game.world.setBounds(0, 0, game.width, game.height);

                G.sb('onScreenResize').dispatch();

            };

            G.sb = G.SignalBox;
            G.extLoader = new G.ExtLoader(game);

            game.resizeGame = this.scaleGameSizeUpdate;
            this.scale.setResizeCallback(function() {
                if (G.old_w != window.innerWidth || G.old_h != window.innerHeight) {
                    G.old_w = window.innerWidth;
                    G.old_h = window.innerHeight;
                    game.resizeGame();
                }
            });


            G.linePx = 2;
            G.roundCornerPx = 10;
            sdkHandler.trigger('restore', {    
                key: 'gmdatastring',
                callback: function(error, value) {         
                    if (error) {
                        console.error(error);
                    } else {
                        if (value) {
                            G.saveStateData = value;
                        } else {
                            G.saveStateData = {
                                backgroundColor: '#3e4272',
                                gameLevel: 0,
                                top10: [
                                    [],
                                    [],
                                    []
                                ],
                                mute: false,
                                nickname: '',
                                animations: true
                            }
                        }
                        G.saveStateData = JSON.parse(G.saveStateData);
                    } 
                } 
            }, this);

            //SG_Hooks.getStorageItem('saveStateData');

            G.backgroundColor = G.saveStateData.backgroundColor;
            G.gameLevel = G.saveStateData.gameLevel;
            game.sound.mute = G.saveStateData.mute;
            G.save = function() {
                sdkHandler.trigger('save', {
                    key: 'gmdatastring',
                    value: JSON.stringify(G.saveStateData),
                    callback: function(error) {
                        if (error) console.log(error);
                    }
                }, this);
                //SG_Hooks.setStorageItem('saveStateData',JSON.stringify(G.saveStateData));            
            };
        },

        preload: function() {

        },

        create: function() {

            document.body.style.backgroundColor = G.saveStateData.backgroundColor;

            game.resizeGame();

            this.state.start('Preloader');
        }

    };

    (function() {
        var keyboardeventKeyPolyfill = {
            polyfill: polyfill,
            keys: {
                3: 'Cancel',
                6: 'Help',
                8: 'Backspace',
                9: 'Tab',
                12: 'Clear',
                13: 'Enter',
                16: 'Shift',
                17: 'Control',
                18: 'Alt',
                19: 'Pause',
                20: 'CapsLock',
                27: 'Escape',
                28: 'Convert',
                29: 'NonConvert',
                30: 'Accept',
                31: 'ModeChange',
                32: ' ',
                33: 'PageUp',
                34: 'PageDown',
                35: 'End',
                36: 'Home',
                37: 'ArrowLeft',
                38: 'ArrowUp',
                39: 'ArrowRight',
                40: 'ArrowDown',
                41: 'Select',
                42: 'Print',
                43: 'Execute',
                44: 'PrintScreen',
                45: 'Insert',
                46: 'Delete',
                48: ['0', ')'],
                49: ['1', '!'],
                50: ['2', '@'],
                51: ['3', '#'],
                52: ['4', '$'],
                53: ['5', '%'],
                54: ['6', '^'],
                55: ['7', '&'],
                56: ['8', '*'],
                57: ['9', '('],
                91: 'OS',
                93: 'ContextMenu',
                144: 'NumLock',
                145: 'ScrollLock',
                181: 'VolumeMute',
                182: 'VolumeDown',
                183: 'VolumeUp',
                186: [';', ':'],
                187: ['=', '+'],
                188: [',', '<'],
                189: ['-', '_'],
                190: ['.', '>'],
                191: ['/', '?'],
                192: ['`', '~'],
                219: ['[', '{'],
                220: ['\\', '|'],
                221: [']', '}'],
                222: ["'", '"'],
                224: 'Meta',
                225: 'AltGraph',
                246: 'Attn',
                247: 'CrSel',
                248: 'ExSel',
                249: 'EraseEof',
                250: 'Play',
                251: 'ZoomOut'
            }
        };

        // Function keys (F1-24).
        var i;
        for (i = 1; i < 25; i++) {
            keyboardeventKeyPolyfill.keys[111 + i] = 'F' + i;
        }

        // Printable ASCII characters.
        var letter = '';
        for (i = 65; i < 91; i++) {
            letter = String.fromCharCode(i);
            keyboardeventKeyPolyfill.keys[i] = [letter.toLowerCase(), letter.toUpperCase()];
        }

        function polyfill() {

            if (!('KeyboardEvent' in window) ||
                'key' in KeyboardEvent.prototype) {
                return false;
            }

            // Polyfill `key` on `KeyboardEvent`.
            var proto = {
                get: function(x) {
                    var key = keyboardeventKeyPolyfill.keys[this.which || this.keyCode];

                    if (Array.isArray(key)) {
                        key = key[+this.shiftKey];
                    }

                    return key;
                }
            };
            Object.defineProperty(KeyboardEvent.prototype, 'key', proto);
            return proto;
        }

        polyfill();

    })();
    G.Game = function(game) {

        this.GAMESTATE = true;

        G.bubbleNames = ['blue', 'green', 'pink', 'red', 'turquoise', 'yellow'];
    };

    G.Game.prototype = {

        init: function(dataToLoad, ghostData) {

        },

        preload: function() {

        },

        create: function() {

            sdkHandler.trigger('gameStart');

            sdkHandler.trigger("gameTracking", {
              event: "Start",
              dimension1: "GameMode",
            });

            var config;

            this.gameLevel = G.gameLevel;

            if (game.device.desktop) {
                config = {
                    grid: {
                        x: 55,
                        y: 20,
                        sizeW: 17,
                        sizeH: 12,
                        mobile: false,
                        fillTo: 9
                    },
                    shooter: {
                        x: 498,
                        y: 700,
                        chances: 5 - this.gameLevel
                    }
                }
            } else {
                config = {
                    grid: {
                        x: 57,
                        y: 130,
                        sizeW: 10,
                        sizeH: 13,
                        mobile: true,
                        fillTo: 7
                    },
                    shooter: {
                        x: 324,
                        y: 900,
                        chances: 5 - this.gameLevel
                    }
                }
            }




            G.points = 0;
            G.gameOver = false;
            G.sb('gameOver').addOnce(function(won) {
                G.gameOver = true;
                G.sb('pushWindow').dispatch(['gameOver', won]);
            }, this);

            game.delta = 1;

            s = game.state.getCurrentState();
            this.grid = new G.GameGrid(config.grid);
            this.fxLayer = new G.EffectsLayer(this.grid);
            this.shooter = new G.Shooter(498, 700, this.grid, config.shooter);

            this.ui = new G.GameUI(game.device.desktop);


            this.windowLayer = new G.WindowLayer();

            game.time.events.add(1, game.resizeGame, game);

            /*this.gfx = game.add.graphics();
            this.gfx.beginFill(0xff0000,0.2);
            this.gfx.drawRect(this.grid.gridFiledRect.x,this.grid.gridFiledRect.y,this.grid.gridFiledRect.width,this.grid.gridFiledRect.height);*/

        },

        render: function() {


        }

    };

    G.MainMenu = function(game) {


    };

    G.MainMenu.prototype = {

        create: function() {

            this.windowLayer = new G.WindowLayer();
            //G.sb('pushWindow').dispatch(['enterYourNickname',true]);

            G.sb('onAllWindowsClosed').add(function() {
                game.state.start('Game');
            });

            game.resizeGame();

        }

    };


    G.Preloader = function(game) {

        this.ready = false;

    };

    G.Preloader.prototype = {

        preload: function() {

            G.Loader.loadAssets();

        },

        create: function() {

            G.Loader.processAssets();
            //game.state.start('Game');

            G.json = {
                languages: game.cache.getJSON('languages')
            }

            if (typeof SG !== 'undefined') {
                G.lang = SG.lang;
            } else {
                G.lang = window.sgSettings.config.env.locale
            }

            sdkHandler.trigger('loading.completed', {
              callback: function() {},
            });

        },

        update: function() {

        }

    };

    G.Bubble = function(grid) {

        Phaser.Sprite.call(this, game, 0, 0, null);
        this.state = game.state.getCurrentState();
        this.anchor.setTo(0.5);
        this.cell = new Phaser.Point(0, 0);
        this.collCircle = new Phaser.Circle(0, 0, 0);
        this.grid = grid;
        this.signalBindings = [];
        this.kill();

    }

    G.Bubble.prototype = Object.create(Phaser.Sprite.prototype);
    G.Bubble.constructor = G.Bubble;

    G.Bubble.prototype.isMatchingType = function(type) {
        return this.type == type;
    };

    G.Bubble.prototype.clearCheck = function() {
        this.checked = false;
    };

    G.Bubble.prototype.checkType = function(type) {
        if (this.checked) {
            return false;
        } else {
            this.checked = true;
            return this.isMatchingType(type);
        }
    };

    G.Bubble.prototype.vanish = function() {
        this.grid.vanishBubble(this);
    };

    G.Bubble.prototype.getWorldPosition = function() {
        return this.grid.cellToOutsidePx(this.cellX, this.cellY);
    }

    G.Bubble.prototype.getWorldAngle = function() {
        if (this.parent === null) return 0;
        return this.parent.angle + this.angle;
    }

    G.Bubble.prototype.startBounce = function(velX, velY) {


        G.sb('onBubbleStartBounce').dispatch(this);

        this.scaleBounceTweenCompleted = false;

        this.duringBounce = true;
        this.velX = velX;
        this.velY = velY;

        this.scaleBounceTween = game.add.tween(this.scale).to({
            x: 0.9,
            y: 0.9
        }, 100, Phaser.Easing.Elastic.InOut, true, 0, 0, true);

        /*game.add.tween(this).to({x:this.orgX,y:this.orgY},50,Phaser.Easing.Linear.None,true).onComplete.add(function() {
          this.duringBounce = false;
          G.sb('onBubbleFinishBounce.dispatch(this);
        },this);
        */
    }

    G.Bubble.prototype.update = function() {

        if (!this.alive) return;
        if (this.duringBounce) this.bounceUpdate();

    }


    G.Bubble.prototype.bounceUpdate = function() {




        if (this.duringBounce && this.alive) {

            this.x += this.velX * game.delta;
            this.y += this.velY * game.delta;
            this.velX *= 0.9;
            this.velY *= 0.9;

            this.pullX = (this.x - this.orgX) * -0.6;
            this.pullY = (this.y - this.orgY) * -0.6;
            this.x += this.pullX;
            this.y += this.pullY;


            if (!this.scaleBounceTween.isRunning && Math.abs(this.x - this.orgX) < 1 && Math.abs(this.y - this.orgY) < 1) {
                this.x = this.orgX;
                this.y = this.orgY
                this.duringBounce = false;
                G.sb('onBubbleFinishBounce').dispatch(this);
            }

        }
    };

    G.Bubble.prototype.onMatch = function() {

        this.update = this.onMatchUpdate;
        this.grid.moveToMatchGroup(this);
        G.sb('fxMatchParticle').dispatch(this);
        G.sb('fxCircleParticle').dispatch(this);
        G.sb('fxUnderMatch').dispatch(this);

    }

    G.Bubble.prototype.onMatchUpdate = function() {

        this.scale.setTo(this.scale.x + 0.02);
        this.alpha -= 0.05;
        if (this.alpha < 0) this.inGameDestroy();

    }


    G.Bubble.prototype.onPopOut = function() {

        /*this.update = this.popOutUpdate;
  
        this.gravity = BUBBLE.lnf(0.25);
        this.initVelX = BUBBLE.lnf(4);
        this.initVelY = BUBBLE.lnf(-5);
        this.minX = BUBBLE.l(30);
        this.maxX = BUBBLE.l(610);
        this.velX = (-0.5*this.initVelX)+BUBBLE.rnd('B - onPopOut velX')*this.initVelX;
        this.velY = BUBBLE.rnd('B - onPopOut - velY')*this.initVelY;
        */

        this.inGameDestroy();

    }


    G.Bubble.prototype.inGameDestroy = function() {

        this.kill();
        G.sb('onBubbleObjectDestroy').dispatch(this);

    };




    G.Bubble.prototype.normalTypes = ['0', '1', '2', '3', '4', '5'];



    G.Bubble.prototype.basicInit = function(cx, cy, x, y, type, grid) {

        if (this.overlayImg) this.overlayImg.destroy();

        G.stopTweens(this);
        this.alpha = 1;
        this.scale.setTo(1);
        this.angle = 0;

        //detach all bindings like chameleon color change and shit
        if (this.signalBindings.length > 0) {
            this.signalBindings.forEach(function(signal) {
                signal.detach();
            });
            this.signalBindings = [];
        };

        this.bubbleBooster = false;
        this.x = x;
        this.y = y;
        this.cell.set(cx, cy);
        this.cellX = cx;
        this.cellY = cy;
        this.orgX = x;
        this.orgY = y;
        this.checked = false;
        this.bounceable = true;
        this.bombResistant = false;
        this.special = false;
        this.animated = false;
        this.collCircle.setTo(x, y, G.l(50));
        this.duringBounce = false;
        this.velX = 0;
        this.velY = 0;
        this.pullX = 0;
        this.pullY = 0;

        this.update = G.Bubble.prototype.update;
        this.checkType = G.Bubble.prototype.checkType;
        this.onPut = G.Bubble.prototype.onPut;
        this.onPopOut = G.Bubble.prototype.onPopOut;
        this.onMatchHit = G.Bubble.prototype.onMatchHit;
        this.onHit = G.Bubble.prototype.onHit;
        this.onPreciseHit = G.Bubble.prototype.onPreciseHit;
        this.onPutAfterCheckAndProcessHold = G.Bubble.prototype.onPutAfterCheckAndProcessHold;
        this.onMatch = G.Bubble.prototype.onMatch;
        this.onMatchUpdate = G.Bubble.prototype.onMatchUpdate;

        this.revive();

    };



    //
    //  Regular
    //

    G.Bubble.prototype.initRegular = function(cx, cy, x, y, type, grid) {
        this.basicInit(cx, cy, x, y, type, grid);

        G.changeTexture(this, 'bubble_' + G.bubbleNames[parseInt(type)]);
        this.type = parseInt(type);
        this.typeName = G.bubbleNames[parseInt(type)];
        this.onMatch = this.onMatchRegular;
        this.onMatchUpdate = this.onMatchUpdateRegular;
    };

    G.Bubble.prototype.onMatchRegular = function() {

        this.inGameDestroy();

    }

    G.Bubble.prototype.onMatchUpdateRegular = function() {

        if (this.typeName) {

            if (this.animTimer-- == 0) {
                this.animTimer = 2;
                this.frameIndex++;
                if (this.frameIndex == 9) {
                    this.inGameDestroy();
                } else {
                    this.loadTexture('burstsheet', 'burst' + this.typeName + this.frameIndex);
                }
            }

        } else {

            this.scale.setTo(this.scale.x + 0.02);
            this.alpha -= 0.05;
            if (this.overlayImg) this.overlayImg.alpha = this.alpha;
            if (this.alpha < 0) this.inGameDestroy();

        }

    }
    G.BubbleFactory = function(grid) {

        this.grid = grid;
        this.gridArray = grid.gridArray;
        this.neighboursCoordinations = grid.neighboursCoordinations;

        this.colorGroups = ['0', '1', '2', '3', '4'];

        this.freeBubbles = [];

        G.sb('onBubbleObjectDestroy').add(function(bubble) {
            if (bubble.parent && bubble.parent.remove) {
                bubble.parent.remove(bubble);
                this.freeBubbles.push(bubble);
            }
        }, this);

    }

    G.BubbleFactory.prototype.getFreeBubble = function() {

        if (this.freeBubbles.length > 0) return this.freeBubbles.pop();
        return new G.Bubble(this.grid);

    };

    G.BubbleFactory.prototype.makeBubble = function(cellX, cellY, type) {


        var createdBubble = 0;
        var pxPos = this.grid.cellToInsidePx(cellX, cellY);

        var freeBubble = this.getFreeBubble();


        freeBubble.initRegular(cellX, cellY, pxPos[0], pxPos[1], type);

        this.gridArray.set(cellX, cellY, freeBubble);
        if (freeBubble.animated) {
            this.grid.nonCacheGroup.add(freeBubble);
        } else {
            this.grid.add(freeBubble);
        }

        return freeBubble;

    }
    G.BubbleFlying = function(grid) {

        Phaser.Sprite.call(this, game, 0, 0, null);
        this.anchor.setTo(0.5);

        this.grid = grid;
        this.collCircle = new Phaser.Circle(0, 0, G.lnf(25));
        this.spd = G.lnf(12);
        this.cellX = 0;
        this.cellY = 0;
        this.prevCellX = 0;
        this.prevCellY = 0;
        this.neighbours = [];

        this.kill();

    }

    G.BubbleFlying.prototype = Object.create(Phaser.Sprite.prototype);
    G.BubbleFlying.constructor = G.BubbleFlying;


    G.BubbleFlying.prototype.update = function() {
        if (!this.alive) return;

        var delta = game.delta;

        this.updatePosition();
        this.fire ? this.updateCollFire() : this.updateColl();
        this.updatePosition();
        this.fire ? this.updateCollFire() : this.updateColl();
        if (delta > 1) {
            this.updatePosition(delta - 1);
            this.fire ? this.updateCollFire() : this.updateColl();
        }

    }

    G.BubbleFlying.prototype.init = function(x, y, angle, type) {

        this.x = x;
        this.y = y;
        this.collCircle.diameter = G.lnf(25);
        this.cellX = -99999;
        this.cellY = -99999;
        this.alpha = 1;
        this.type = type.toString();
        this.velX = G.lengthDirX(angle, this.spd, false);
        this.velY = G.lengthDirY(angle, this.spd, false);

        this.minX = this.grid.gridFiledRect.x + G.l(35);
        this.maxX = this.grid.gridFiledRect.x + this.grid.gridFiledRect.width - G.l(35);

        this.minY = G.l(this.grid.gridFiledRect.y);
        this.maxY = y;

        G.changeTexture(this, 'bubble_' + G.bubbleNames[parseInt(type)]);

        this.revive();



    };

    G.BubbleFlying.prototype.updateColl = function() {

        if (!this.alive) return;


        var coll = this.grid.checkCollisionAgainst(this, this.neighbours);

        if (coll.length > 0) {



            if (this.grid.getBubble(this.cellX, this.cellY)) {
                //this.grid.bounceBubbles(this.cellX,this.cellY,this.velX,this.velY);
                this.cellX = this.prevCellX;
                this.cellY = this.prevCellY;
            }

            //so move recorder can catch and make walkthroughEndPoint



            G.sb('flyingBubbleToBePut').dispatch(this);
            this.grid.putBubble(this);


            this.kill();

        }
    };


    G.BubbleFlying.prototype.afterPutEmpty = function() {};


    G.BubbleFlying.prototype.updatePosition = function(deltaTime) {

        if (!this.alive) return;

        var delta = deltaTime || 1;

        this.x += this.velX * delta;
        this.y += this.velY * delta;

        if (this.x < this.minX || this.x > this.maxX) {
            var offset = this.x < this.minX ? this.minX - this.x : this.maxX - this.x;
            this.x = game.math.clamp(this.x, this.minX, this.maxX) + offset;
            this.velX *= -1;
            G.sfx.bubble_hits_wall.play();
            //game.sfx['hit_'+game.rnd.between(1,3)].play();
        }

        if (this.y > this.maxY) {
            this.alpha -= 0.07;
            if (this.alpha < 0) {
                this.kill();
            }
        }

        var cellPos = this.grid.outsidePxToCell(this.x, this.y);

        if (this.cellX != cellPos[0] || this.cellY != cellPos[1]) {
            this.prevCellX = this.cellX;
            this.prevCellY = this.cellY;
            this.cellX = cellPos[0];
            this.cellY = cellPos[1];
            this.neighbours = this.grid.getNeighbours(cellPos[0], cellPos[1]);

        }

    };


    G.BubbleFlying.prototype.getInsideGridPx = function() {
        return this.grid.cellToInsidePx(this.cellX, this.cellY);
    };

    G.ButtonPanel = function(x, y) {

        Phaser.Group.call(this, game);

        this.x = x;
        this.y = y;

        this.btnsOffset = 100;


        this.setupBtn = new G.Button(0, 0, 'button_turquoise', function() {
            game.state.getCurrentState().windowLayer.open('windowSetup');
            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "SetupButtonPressed"
            });
        });
        this.setupBtn.addTextLabel('Setup');


        /*this.top10Btn = new G.Button(-this.btnsOffset,this.btnsOffset,'button_yellow',function() {
          game.state.getCurrentState().windowLayer.open('windowTop10');
        });
        this.top10Btn.addTextLabel('Top 10');*/

        this.moreGamesBtn = new G.Button(this.btnsOffset, this.btnsOffset, 'button_blue', function() {
              //window.open("http://m.softgames.de/", "_blank");
              sdkHandler.trigger("gameTracking", {
                event: "Design",
                dimension1: "MoreGamesButtonPressed"
              });
        });
        this.moreGamesBtn.addTextLabel('More Games', 'white');

        this.restartBtn = new G.Button(-this.btnsOffset, -this.btnsOffset, 'button_green', function() {

            var state = game.state.getCurrentState();
          
            sdkHandler.trigger('gameOver', {
              score: state.pointCounter.score
            })

            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "RestartGamePressed"
            });

            game.state.start("Game");

            sdkHandler.trigger('gameStart');

            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "NewGameStart"
            });

        });
        this.restartBtn.addTextLabel('Restart');

        this.helpBtn = new G.Button(this.btnsOffset, -this.btnsOffset, 'button_pink', function() {
            game.state.getCurrentState().windowLayer.open('windowHelp');
            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "HelpButtonPressed",
            });
        });
        this.helpBtn.addTextLabel('Help');

        this.addMultiple([this.setupBtn /*,this.top10Btn*/ , this.moreGamesBtn, this.restartBtn, this.helpBtn])


        G.sb('onWindowOpened').add(function() {
            this.children.forEach(function(e) {
                e.inputEnabled = false;
            }, this)
        }, this);
        G.sb('onWindowClosed').add(function() {
            this.children.forEach(function(e) {
                e.inputEnabled = true;
                e.input.useHandCursor = true;
            }, this)
        }, this);


    }

    G.ButtonPanel.prototype = Object.create(Phaser.Group.prototype);
    G.DifficultyLabel = function(x, y) {

        Phaser.Group.call(this, game);
        this.state = game.state.getCurrentState();

        var gameLevel = this.state.gameLevel;

        this.position.setTo(x, y);

        this.bg = G.makeImage(0, 0, 'bg_numbers_hud', 0.5, this);

        var text = gameLevel == 0 ? G.txt(9) : (gameLevel == 1 ? G.txt(10) : G.txt(11));
        this.txt = new G.OneLineText(0, 0, 'font', text, 30, 180, 0.5, 0.5);
        this.add(this.txt);

    }

    G.DifficultyLabel.prototype = Object.create(Phaser.Group.prototype);
    G.EffectsLayer = function(grid) {

        Phaser.Group.call(this, game);
        this.x = grid.x;
        this.y = grid.y;

        this.queue = [];

        this.timer = 0;

        G.sb('fxRemoveBubbles').add(function(list) {

            for (var i = 0, len = list.length; i < len; i++) {
                var freeFxBubble = this.getFirstDead() || this.add(new G.EffectPart());
                freeFxBubble.init(list[i], i * 4);
            }

        }, this);

    }

    G.EffectsLayer.prototype = Object.create(Phaser.Group.prototype);




    G.EffectPart = function() {

        Phaser.Image.call(this, game);

        this.anchor.setTo(0.5);
        this.kill();
        this.animIndex = 1;
        this.delay = 0;

    }

    G.EffectPart.prototype = Object.create(Phaser.Image.prototype);

    G.EffectPart.prototype.init = function(bubble, delay) {

        this.revive();

        //this.scale.setTo(0.8);

        this.pointsToAdd = bubble.pointsAfterBurst;
        this.x = bubble.x;
        this.y = bubble.y;
        this.animIndex = 1;
        this.delay = delay;
        this.soundPlayed = false;


        G.changeTexture(this, bubble.frameName);

        this.initGfx = bubble.frameName;

    };

    G.EffectPart.prototype.update = function() {

        if (!this.alive) return;

        if (!G.saveStateData.animations) {
            G.sb('onAddPoints').dispatch(this.pointsToAdd);
            G.sfx['bubble_pops_' + game.rnd.between(1, 3)].play();
            this.kill();
            return;
        }

        this.delay--;

        if (this.delay <= 0) {

            if (!this.soundPlayed) {
                G.sb('onAddPoints').dispatch(this.pointsToAdd);
                this.soundPlayed = true;
                if (!G.gameOver) G.sfx['bubble_pops_' + game.rnd.between(1, 3)].play();
            }

            this.animIndex += 0.4;

            if (this.animIndex >= 7) {

                this.kill();
            } else {
                G.changeTexture(this, this.initGfx + '_0' + Math.floor(this.animIndex));
            }



        }

    };
    G.GameGrid = function(config) {

        if (config.mobile) {
            this.bg = G.makeImage(config.x - 1, config.y - 1, 'gamefield_p', 0);
        } else {
            //desktop
            this.bg = G.makeImage(config.x - 1, config.y - 3, 'gamefield_l', 0);
        }


        Phaser.Group.call(this, game);

        this.x = config.x;
        this.y = config.y;

        this.state = game.state.getCurrentState();

        this.gameOverTimer = 0;

        this.bubblesPopped = 0;

        this.offsetX = 0;
        this.offsetY = 0;
        this.gridArray = new G.GridArray();
        this.nonCacheGroup = game.add.group();
        this.nonCacheGroup.grid = this;
        this.matchGroup = game.add.group();
        this.popOutGroup = null;

        this.bubbleFactory = new G.BubbleFactory(this);

        this.cellW = G.l(51);
        this.cellH = G.l(50);

        this.sizeW = config.sizeW;
        this.sizeH = config.sizeH;

        this.gridFiledRect = new Phaser.Rectangle(this.x - 15, this.y, this.sizeW * this.cellW + (this.cellW * 0.5) + 30, (this.sizeH + 1) * this.cellH);
        this.gridFiledRect.offset = G.l(2);
        this.gridFiledRect.radius = G.l(10);


        this.holds = [];
        this.cachingCelling = true;

        this.generateLevel(config.fillTo);

        this.maxY = G.l(400);
        this.targetY = this.getTargetY();

        this.moveDelay = 0;
        this.oldHeight = this.height;

        this.caching = true;
        this.orderCacheAfterUpdate = false;
        this.recacheBitmap();

        //this.forEach(function(child) {if (child.cellY < 45) child.visible = false});

        G.sb('onBubblePutToGrid').add(function() {
            if (this.height == this.oldHeight) return;
            this.targetY = this.getTargetY();
            this.oldHeight = this.height;
        }, this);

        G.sb('onBubblesMatch').add(function(match) {
            this.bubblesPopped += match.length;
        }, this);

        G.sb('onBubbleDestroyed').add(function() {
            if (this.height == this.oldHeight) return;
            this.targetY = this.getTargetY();
            this.oldHeight = this.height;
            this.moveDelay = 30;
        }, this);


        G.sb('onBubbleStartBounce').add(function(bubble) {
            if (!G.animated) {
                this.nonCacheGroup.add(bubble);
            }
        }, this);

        G.sb('onBubbleFinishBounce').add(function(bubble) {
            if (!G.animated) {
                this.add(bubble);
            }
            this.orderCacheAfterUpdate = true;
        }, this);

        G.sb('requestDestroy').add(function(bubble) {
            this.destroyBubbles([bubble]);
            this.checkAndProcessHold();
        }, this);

        G.sb('onBubbleObjectDestroy').add(function(bubble) {
            this.gridArray.set(bubble.cellX, bubble.cellY, null);
        }, this);

        //this.drawRoundedRectangle();

    }

    G.GameGrid.prototype = Object.create(Phaser.Group.prototype);
    G.GameGrid.constructor = G.GameGrid;



    G.GameGrid.prototype.drawRoundedRectangle = function() {

        this.boardGfx.beginFill(0x000000, 0.05);
        this.boardGfx.lineStyle(G.linePx, 0xffffff, 1);
        var offset = this.gridFiledRect.offset;
        var x = this.gridFiledRect.x - offset;
        var y = this.gridFiledRect.y - offset;
        var width = this.gridFiledRect.width + (offset * 2);
        var height = this.gridFiledRect.height + (offset * 2);
        var radius = G.roundCornerPx;


        this.boardGfx.moveTo(x + radius, y);
        this.boardGfx.lineTo(x + width - radius, y);
        this.boardGfx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.boardGfx.lineTo(x + width, y + height - radius);
        this.boardGfx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.boardGfx.lineTo(x + radius, y + height);
        this.boardGfx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.boardGfx.lineTo(x, y + radius);
        this.boardGfx.quadraticCurveTo(x, y, x + radius, y);
        this.boardGfx.endFill();

        this.makeRefillNextUpdate = -1;

    };


    G.GameGrid.prototype.getTargetY = function() {
        return Math.min(0, this.maxY - this.height);
    }

    G.GameGrid.prototype.update = function() {
        this.nonCacheGroup.y = this.y;
        this.nonCacheGroup.x = this.x;
        this.matchGroup.y = this.y;


        if (G.gameOver && this.children.length > 0 && this.gameOverTimer++ % 6 == 0) {



            var bubble = game.rnd.pick(this.children);

            bubble.inGameDestroy();
            bubble.pointsAfterBurst = 0;
            G.sb('fxRemoveBubbles').dispatch([bubble]);
            this.orderCacheAfterUpdate = true;

        }



    }

    G.GameGrid.prototype.postUpdate = function() {

        if (this.fixedToCamera) {
            this.x = this.game.camera.view.x + this.cameraOffset.x;
            this.y = this.game.camera.view.y + this.cameraOffset.y;
        }

        var i = this.children.length;

        while (i--) {
            this.children[i].postUpdate();
        }

        if (this.orderCacheAfterUpdate) {
            this.recacheBitmap();
        }

    };

    G.GameGrid.prototype.updateChildren = function() {
        var len = this.length;
        for (var i = 0; i < len; i++) {
            this.children[i].update();
        }
    }

    G.GameGrid.prototype.makeBubble = function(x, y, type) {
        this.orderCacheAfterUpdate = true;
        return this.bubbleFactory.makeBubble(x, y, type);
    }

    G.GameGrid.prototype.makeBubbleFromFlyingBubble = function(flyingBubble) {

        if (this.getBubble(flyingBubble.cellX, flyingBubble.cellY)) {

        }


        this.prepareBubbleToBePut(flyingBubble);

        var newBubble = this.makeBubble(flyingBubble.cellX, flyingBubble.cellY, flyingBubble.type);

        var xx = flyingBubble.x;
        var yy = flyingBubble.y;
        newBubble.x = flyingBubble.x - this.x;
        newBubble.y = flyingBubble.y;
        newBubble.velX = flyingBubble.velX;
        newBubble.velY = flyingBubble.velY;

        return newBubble;

    };

    G.GameGrid.prototype.isSpaceFreePx = function(px, py) {
        var cell = this.outsidePxToCell(px, py);
        return this.isSpaceFree(cell[0], cell[1]);
    }


    G.GameGrid.prototype.isSpaceFree = function(cx, cy) {
        return this.getBubble(cx, cy) ? false : true;
    }

    G.GameGrid.prototype.outsidePxToCell = function(x, y) {
        return this.insidePxToCell(x - this.x, y - this.y);
    }

    G.GameGrid.prototype.insidePxToCell = function(x, y) {

        var clean;

        y += G.l(6);

        if (y < 0) {
            clean = y % this.cellH > G.l(-34);
        } else {
            clean = y % this.cellH > G.l(17);
        }

        var xx, yy, modX, modY;

        yy = Math.floor(y / this.cellH);

        if (!clean) {

            modX = yy % 2 == 0 ? x % this.cellW : (x - (this.cellW * 0.5)) % this.cellW;
            modX = modX < 0 ? this.cellW + modX : modX;
            modY = y > 0 ? y % this.cellH : this.cellH - Math.abs(y % this.cellH);

            if (modX + modY < G.l(23) || modX + modY > G.l(52)) {
                yy--;
            }

            if (yy % 2 == 0) {
                xx = Math.floor(x / this.cellW);
            } else {
                xx = Math.floor((x - (this.cellW * 0.5)) / this.cellW)
            }

        } else {
            if (yy % 2 == 0) {
                xx = Math.floor(x / this.cellW);
            } else {
                xx = Math.floor((x - (this.cellW * 0.5)) / this.cellW)
            }
        }

        return [xx, yy];


    }


    G.GameGrid.prototype.cellToInsidePx = function(x, y) {

        if (y % 2 == 0) {
            return [Math.floor(x * this.cellW + (this.cellW * 0.5) - this.offsetX), Math.floor(y * this.cellH + (this.cellW * 0.5) - this.offsetY)];
        } else {
            return [Math.floor(x * this.cellW + this.cellW - this.offsetX), Math.floor(y * this.cellH + (this.cellW * 0.5) - this.offsetY)];
        }

    }

    G.GameGrid.prototype.cellToOutsidePx = function(x, y) {


        var pos = this.cellToInsidePx(x, y);
        pos[1] += this.y;

        return pos;

    }



    G.GameGrid.prototype.putBubble = function(flyingBubble) {



        var newBubble = this.makeBubbleFromFlyingBubble(flyingBubble);
        var xx = newBubble.cellX;
        var yy = newBubble.cellY;

        G.sb('onBubblePutToGrid').dispatch(newBubble);

        if (this.getBubble(xx, yy)) {
            var matching = this.getMatching(xx, yy, newBubble.type);

            if (matching.length > 2) {
                matching.forEach(function(e) {
                    e.inGameDestroy();
                });
            } else {
                this.bounceBubbles(newBubble);
                matching = [];
            }
        }




        var popOuts = this.checkAndProcessHold();

        popOuts.forEach(function(e) {
            e.inGameDestroy();
        });

        matching.forEach(function(e, index) {
            e.pointsAfterBurst = (Math.floor(index / 3) + 1) * 10;
        });

        popOuts.forEach(function(e, index) {
            e.pointsAfterBurst = (Math.floor(index / 3) + 1) * 100;
        });


        G.sb('onBubblesMatch').dispatch(matching);
        G.sb('onBubblesPopOut').dispatch(popOuts);

        var toDestroy = matching.concat(popOuts);

        if (toDestroy.length == 0) {
            G.sfx.bubble_hits_bubble.play();
        }

        G.sb('fxRemoveBubbles').dispatch(toDestroy);

        G.sb('onMoveDone').dispatch(toDestroy.length > 0);

        this.orderCacheAfterUpdate = true;

        if (s.grid.getLowestBubble() >= this.sizeH) {
            G.sb('gameOver').dispatch();
        }

        if (this.children.length == 0 && this.nonCacheGroup.children.length == 0) {
            G.sb('gameOver').dispatch(true);
        }

    }


    G.GameGrid.prototype.prepareBubbleToBePut = function(bubble) {
        bubble.y -= this.y;
    }


    G.GameGrid.prototype.outsidePxToInsidePx = function(x, y) {
        return [x, y - this.y];
    }


    G.GameGrid.prototype.checkCollisionAgainst = function(bubble, against, allColl) {

        var circle = this.prepareBubbleCollCircleToCollCheck(bubble);

        against.push(this.getBubble(bubble.cellX, G.cellY));

        var coll = [];

        if (this.cachingCelling && bubble.cellY == 0) return [bubble.cellX, bubble.cellY];

        for (var i = 0; i < against.length; i++) {
            if (against[i] && Phaser.Circle.intersects(circle, against[i].collCircle)) {
                if (allColl) {
                    coll.push(against[i]);
                } else {
                    return [against[i].cellX, against[i].cellY];
                }

            }
        }

        return coll;
    };

    G.GameGrid.prototype.prepareBubbleCollCircleToCollCheck = function(bubble) {
        var circle = bubble.collCircle
        circle.x = bubble.x - this.x + bubble.velX;
        circle.y = bubble.y - this.y + bubble.velY;
        return bubble.collCircle;
    };

    G.GameGrid.prototype.getPreciseHits = function(bubble) {


        var oldDiameter = bubble.collCircle.diameter;
        var oldX = bubble.collCircle.x;
        var oldY = bubble.collCircle.y;

        var neighbours = this.getNeighbours(bubble.cellX, bubble.cellY);
        neighbours.push(this.getBubble(bubble.cellX, bubble.cellY));
        var circle = this.prepareBubbleCollCircleToCollCheck(bubble);
        bubble.collCircle.x = bubble.x;
        bubble.collCircle.y = bubble.y;
        bubble.collCircle.diameter = bubble.l(50);

        var result = [];

        for (var i = 0; i < neighbours.length; i++) {
            if (neighbours[i] && Phaser.Circle.intersects(circle, neighbours[i].collCircle)) {
                result.push(neighbours[i]);
            }
        }

        bubble.collCircle.x = oldX;
        bubble.collCircle.y = oldY;
        bubble.collCircle.diameter = oldDiameter;

        return result;
    };

    G.GameGrid.prototype.hitNeighboursOf = function(bubble) {

        this.getNeighbours(bubble.cellX, bubble.cellY).forEach(function(child) {
            child.onHit(bubble);
        });

    }


    G.GameGrid.prototype.getBubble = function(cellX, cellY) {
        return this.gridArray.get(cellX, cellY);
    }

    G.GameGrid.prototype.neighboursCoordinations = [
        [
            [-1, -1],
            [-1, 0],
            [-1, 1],
            [0, -1],
            [0, 1],
            [1, 0]
        ],
        [
            [0, -1],
            [-1, 0],
            [0, 1],
            [1, -1],
            [1, 1],
            [1, 0]
        ]
    ]

    G.GameGrid.prototype.outerRingCoordinations = [
        //[[0,-2],[1,-2],[1,-1],[2,0],[1,1],[1,2],[0,2],[-1,2],[-2,1],[-2,0],[-2,-1],[-1,-2]],
        [
            [0, -2],
            [-1, -2],
            [1, -1],
            [2, 0],
            [1, 1],
            [1, -2],
            [1, 2],
            [0, 2],
            [-1, 2],
            [-2, 1],
            [-2, 0],
            [-2, -1]
        ],

        //[[0,-2],[1,-2],[2,-1],[2,0],[2,1],[1,2],[0,2],[-1,2],[-1,1],[-2,0],[-1,1],[-1,-2]]
        [
            [-1, -2],
            [0, -2],
            [1, -2],
            [2, -1],
            [2, 0],
            [2, 1],
            [1, 2],
            [0, 2],
            [-1, 2],
            [-1, 1],
            [-2, 0],
            [-1, -1]
        ]
    ]

    G.GameGrid.prototype.getNeighbours = function(cellX, cellY) {

        var result = [];

        this.neighboursCoordinations[Math.abs(cellY % 2)].forEach(function(coords) {

            var bubble = this.getBubble(cellX + coords[0], cellY + coords[1]);
            if (bubble) {
                result.push(bubble);
            }
        }, this);

        return result;

    }

    G.GameGrid.prototype.getOuterRing = function(cellX, cellY) {

        var result = [];

        this.outerRingCoordinations[Math.abs(cellY % 2)].forEach(function(coords) {
            var bubble = this.getBubble(cellX + coords[0], cellY + coords[1]);
            if (bubble) {
                result.push(bubble);
            }
        }, this);
        return result;

    }


    G.GameGrid.prototype.getFreeSpacesAround = function(cellX, cellY) {

        var result = [];

        this.neighboursCoordinations[Math.abs(cellY % 2)].forEach(function(coords) {

            if (!this.getBubble(cellX + coords[0], cellY + coords[1])) {

                var xx = cellX + coords[0];
                var yy = cellY + coords[1];

                if (!this.ghostMode && yy < 0) {
                    return;
                }

                if (yy % 2 == 0) {
                    if (xx >= 0 && xx < 11) {
                        result.push([xx, yy]);
                    }
                } else {
                    if (xx >= 0 && xx < 10) {
                        result.push([xx, yy]);
                    }
                }

            }

        }, this);

        return result;

    }



    G.GameGrid.prototype.getMatching = function(cellX, cellY, type) {

        if (type == "multicolor") {
            return this.getMatchingMulticolor(cellX, cellY)
        };


        this.clearCheck();

        var toCheck = [
            [cellX, cellY]
        ];
        var toCheckIndex = 0;

        if (!this.getBubble(cellX, cellY)) return false;

        var found = [this.getBubble(cellX, cellY)];
        this.getBubble(cellX, cellY).checked = true;

        while (toCheckIndex < toCheck.length) {

            var bubble = this.getBubble(toCheck[toCheckIndex][0], toCheck[toCheckIndex][1]);
            toCheckIndex++;
            var neighbours = this.getNeighbours(bubble.cellX, bubble.cellY);
            for (var i = 0; i < neighbours.length; i++) {
                if (neighbours[i] && neighbours[i].checkType(type)) {
                    found.push(neighbours[i]);
                    toCheck.push([neighbours[i].cellX, neighbours[i].cellY]);
                }
            }

        }

        return found;
    }

    G.GameGrid.prototype.getMatchingMulticolor = function(cellX, cellY) {

        var result = [];
        var neighbours = this.getNeighbours(cellX, cellY);
        var colorsOfNeighbours = [];

        neighbours.forEach(function(bubble) {
            if (bubble.type.length == 1 && colorsOfNeighbours.indexOf(bubble.type) == -1) {
                colorsOfNeighbours.push(bubble.type);
            }
        });

        colorsOfNeighbours.forEach(function(color, index) {
            var match = this.getMatching(cellX, cellY, color);

            match.splice(0, 1);
            result = Array.prototype.concat(result, match);
        }, this);

        result.push(this.getBubble(cellX, cellY));

        return result;

    }


    G.GameGrid.prototype.clearCheck = function() {

        this.forEach(function(child) {
            child.clearCheck();
        });
        this.nonCacheGroup.forEach(function(child) {
            child.clearCheck();
        });

    }

    G.GameGrid.prototype.processMatching = function(match) {

        G.sb('onBubblesMatch').dispatch(match);
        match.forEach(function(bubble) {
            bubble.onMatch();
        })

        this.hitMatchNeighbours(match);

    }


    G.GameGrid.prototype.hitMatchNeighbours = function(match) {

        var matchNeighbours = []


        match.forEach(function(bubble) {

            var matchNeighboursArray = matchNeighbours;
            var matchArray = match;

            this.getNeighbours(bubble.cellX, bubble.cellY).forEach(function(neighbour) {

                if (matchArray.indexOf(neighbour) == -1 && matchNeighboursArray.indexOf(neighbour) == -1) {
                    matchNeighboursArray.push(neighbour);
                }

            });

        }, this);

        matchNeighbours.forEach(function(bubble) {
            bubble.onMatchHit();
        })

    }


    G.GameGrid.prototype.destroyBubbles = function(array) {

        array.forEach(function(child) {
            this.gridArray.set(child.cellX, child.cellY, null);
            child.destroy();
            G.sb('onBubbleDestroyed').dispatch(child);
        }, this);

        this.orderCacheAfterUpdate = true;

    }

    G.GameGrid.prototype.outOfGrid = function(arg) {

        array.forEach(function(child) {
            this.gridArray.set(child.cellX, child.cellY, null);
            G.sb('onBubbleDestroyed').dispatch(child);
        }, this);

        this.orderCacheAfterUpdate = true;

    }

    G.GameGrid.prototype.popOutBubbles = function(list) {
        if (list.length == 0) return;

        //game.sfx.pop.play();
        G.sb('onBubblesPopOut').dispatch(list);
        list.forEach(function(bubble) {
            bubble.onPopOut();
        });

        this.orderCacheAfterUpdate = true;
    };

    G.GameGrid.prototype.checkAndProcessHold = function() {

        this.checkHold();
        return this.getAllNotChecked();

    };


    G.GameGrid.prototype.checkHold = function() {

        this.clearCheck();

        this.holds.forEach(function(child) {
            this.holdCheckFrom(child[0], child[1]);
        }, this);

    }

    G.GameGrid.prototype.holdCheckFrom = function(cellX, cellY) {

        if (!this.getBubble(cellX, cellY)) return;
        if (this.getBubble(cellX, cellY).checked) return;

        var toCheck = [
            [cellX, cellY]
        ];
        var toCheckIndex = 0;
        this.getBubble(cellX, cellY).checked = true;

        while (toCheckIndex < toCheck.length) {

            var bubble = this.getBubble(toCheck[toCheckIndex][0], toCheck[toCheckIndex][1]);
            toCheckIndex++;

            var neighbours = this.getNeighbours(bubble.cellX, bubble.cellY);

            for (var i = 0; i < 6; i++) {
                if (neighbours[i] && !neighbours[i].checked) {
                    neighbours[i].checked = true;
                    toCheck.push([neighbours[i].cellX, neighbours[i].cellY]);
                }
            }

        }

    }

    G.GameGrid.prototype.getAllNotChecked = function() {
        var notChecked = [];
        this.forEach(function(child) {
            if (!child.checked) notChecked.push(child);
        });
        this.nonCacheGroup.forEach(function(child) {
            if (!child.checked) notChecked.push(child);
        });
        return notChecked;
    }



    G.GameGrid.prototype.bounceBubbles = function(bubble) {

        //var neighbours = this.getNeighbours(bubble.cellX,bubble.cellY);

        //var distance = game.math.distance(0,0,bubble.velX,bubble.velY)*0.25;

        bubble.startBounce(bubble.velX * 0.5, bubble.velY * 0.5);

        /*neighbours.forEach(function(child) {
          
          var angle = game.math.angleBetween(bubble.x,bubble.y,child.x,child.y);
          var distanceOffset = child.collCircle.diameter-game.math.distance(bubble.x,bubble.y,child.x,child.y);
          var distanceMultiplier = distanceOffset < 0 ? 0.5 : 1;
          var velX = G.lengthDirX(angle,distance*distanceMultiplier,true); 
          var velY = G.lengthDirY(angle,distance*distanceMultiplier,true); 
          child.startBounce(velX,velY);

        });*/

    }


    G.GameGrid.prototype.generateLevel = function(fillTo) {

        for (var row = 0; row < fillTo; row++) {
            for (var coll = 0, len = this.sizeW; coll < len; coll++) {
                this.makeBubble(coll, row, game.rnd.between(0, 5));
                if (row == 0) this.holds.push([coll, row]);
            }
        }

    };


    G.GameGrid.prototype.parseLevel = function(lvl) {

        var elements = lvl.level;
        var offsetX = 0;
        var offsetY = 0;

        if (lvl.mode == "Ghost") {

            elements.forEach(function(element) {
                if (element[2] === 'GHOST') {
                    offsetX = element[0] * -1;
                    offsetY = element[1] * -1;
                }
            });

            this.cachingCelling = false;
            this.x = (offsetX * this.cellW * -1) + this.offsetX;
            this.y = (offsetY * this.cellH * -1) + this.offsetY;
            this.holds.push([0, 0]);
        }

        elements.forEach(function(element) {

            if (element[2].slice(0, 6) == "SHIELD") {
                this.holds.push([element[0], element[1]]);
                this.cachingCelling = false;
            }

            this.makeBubble(element[0] + offsetX, element[1] + offsetY, element[2]);


        }, this);

        if (lvl.mode == "Classic" || lvl.mode == 'Animals') {

            this.holds = [
                [0, 0],
                [1, 0],
                [2, 0],
                [3, 0],
                [4, 0],
                [5, 0],
                [6, 0],
                [7, 0],
                [8, 0],
                [9, 0],
                [10, 0]
            ];

        } else if (lvl.mode == 'Boss') {

            this.activeTheLowestShield();

        }

    }

    G.GameGrid.prototype.getAllColorsOnBoard = function() {
        var result = [];

        this.forEach(function(child) {

            if (child.type == 0 || child.type == 1 || child.type == 2 || child.type == 3 || child.type == 4 || child.type == 5) {
                if (child.special == 'cham') return;
                if (result.indexOf(child.type) == -1) {
                    result.push(child.type);
                }
            } else if (child.type.slice(0, 7) == "SHIELD_") {
                if (result.indexOf(child.color) == -1) {
                    result.push(child.color);
                }
            }
        });

        this.nonCacheGroup.forEach(function(child) {

            if (child.type == 0 || child.type == 1 || child.type == 2 || child.type == 3 || child.type == 4 || child.type == 5) {
                if (child.special == 'cham') return;
                if (result.indexOf(child.type) == -1) {
                    result.push(child.type);
                }
            } else if (child.type.slice(0, 7) == "SHIELD_") {
                if (result.indexOf(child.color) == -1) {
                    result.push(child.color);
                }
            }
        });

        return result;
    };

    G.GameGrid.prototype.activeTheLowestShield = function() {

        var lowestShield = null;

        this.nonCacheGroup.forEach(function(bubble) {

            if (bubble.type.slice(0, 7) == "SHIELD_") {

                if (lowestShield === null) {
                    lowestShield = bubble;
                } else {
                    lowestShield = bubble.cellY > lowestShield.cellY ? bubble : lowestShield;
                }

            }

        });

        this.forEach(function(bubble) {

            if (bubble.type.slice(0, 7) == "SHIELD_") {

                if (lowestShield === null) {
                    lowestShield = bubble;
                } else {
                    lowestShield = bubble.cellY > lowestShield.cellY ? bubble : lowestShield;
                }

            }

        });



        if (lowestShield) {
            lowestShield.activateShield();
        }

    };

    G.GameGrid.prototype.recacheBitmap = function() {
        if (!this.caching) return;
        this.orderCacheAfterUpdate = false;
        this.updateCache();
    }

    G.GameGrid.prototype.vanishBubble = function(bubble) {
        this.gridArray.set(bubble.cellX, bubble.cellY, null);
        bubble.inGameDestroy();
    };

    G.GameGrid.prototype.moveToPopOutGroup = function(bubble) {
        this.gridArray.set(bubble.cellX, bubble.cellY, null);
        bubble.rotation = this.rotation;
        this.popOutGroup.add(bubble);
        G.sb('onBubbleOutOfGrid').dispatch(bubble);
    }

    G.GameGrid.prototype.moveToMatchGroup = function(bubble) {
        this.gridArray.set(bubble.cellX, bubble.cellY, null);
        bubble.rotation = this.rotation;
        this.matchGroup.add(bubble);
        G.sb('onBubbleOutOfGrid').dispatch(bubble);

    }

    G.GameGrid.prototype.moveToNonCacheGroup = function(bubble) {
        this.nonCacheGroup.add(bubble);
        this.orderCacheAfterUpdate = true;
    }

    G.GameGrid.prototype.moveToCacheGroup = function(bubble) {
        this.add(bubble);
        this.orderCacheAfterUpdate = true;
    }

    G.GameGrid.prototype.getLowestBubble = function() {
        var lowest = 0;
        this.forEach(function(bubble) {
            if (bubble.cellY > lowest) {
                lowest = bubble.cellY;
            }
        });
        this.nonCacheGroup.forEach(function(bubble) {
            if (bubble.cellY > lowest) {
                lowest = bubble.cellY;
            }
        });

        return lowest;
    }

    G.GameGrid.prototype.getBubblesInRange = function(min, max) {
        var result = [];

        this.forEach(function(bubble) {
            if (bubble.cellY >= min && bubble.cellY <= max) {
                result.push(bubble);
            }
        });

        this.nonCacheGroup.forEach(function(bubble) {
            if (bubble.cellY >= min && bubble.cellY <= max) {
                result.push(bubble);
            }
        });

        return result;
    };



    G.GameGrid.prototype.fillRandomInSecondRow = function() {

        var rnd = Math.floor(Math.random() * 10);
        var colors = this.getAllColorsOnBoard();
        var index;


        for (var i = 0; i < 10; i++) {
            index = (i + rnd) % 10;
            if (this.getBubble(index, 1) === null) {
                return this.makeBubble(index, 1, colors[Math.floor(Math.random() * colors.length)]);
            }
        }

    };

    //ENDLESS

    G.GameGrid.prototype.makeRefill = function(data) {

        var rowsToRefill = 7 - s.grid.getAllColorsOnBoard().length;

        this.moveAllBubblesDown(rowsToRefill);
        this.fillTopRows(rowsToRefill);



        var popOuts = this.checkAndProcessHold();

        popOuts.forEach(function(e) {
            e.inGameDestroy();
        });
        popOuts.forEach(function(e, index) {
            e.pointsAfterBurst = 100;
        });
        var toDestroy = popOuts;
        G.sb('fxRemoveBubbles').dispatch(toDestroy);




        this.orderCacheAfterUpdate = true;

        if (s.grid.getLowestBubble() >= this.sizeH) {
            G.sb('gameOver').dispatch();
        }

    };

    G.GameGrid.prototype.moveAllBubblesDown = function(amount) {

        this.gridArray.clear();

        this.children.concat(this.nonCacheGroup.children).forEach(function(bubble) {
            bubble.cellY += amount;
            var insidePx = this.cellToInsidePx(bubble.cellX, bubble.cellY);

            bubble.x = insidePx[0];
            bubble.y = insidePx[1];
            bubble.orgX = insidePx[0];
            bubble.orgY = insidePx[1];
            bubble.collCircle.x = insidePx[0];
            bubble.collCircle.y = insidePx[1];

            this.gridArray.set(bubble.cellX, bubble.cellY, bubble);

        }, this);

        this.matchGroup.forEach(function(bubble) {
            G.stopTweens(bubble);
            bubble.cellY += amount;
            var insidePx = this.cellToInsidePx(bubble.cellX, bubble.cellY);
            bubble.x = bubble.orgX = insidePx[0];
            bubble.y = bubble.orgY = insidePx[1];
            bubble.collCircle.x = bubble.x;
            bubble.collCircle.y = bubble.y;
        }, this);

    };

    G.GameGrid.prototype.fillTopRows = function(rowsToRefill) {

        var colorsAvailable = this.getAllColorsOnBoard();

        for (var row = 0; row < rowsToRefill; row++) {
            for (var coll = 0, len = this.sizeW; coll < len; coll++) {
                this.makeBubble(coll, row, game.rnd.pick(colorsAvailable));
                if (row == 0) this.holds.push([coll, row]);
            }
        }

    };

    G.GridArray = function(minX, maxX, minY, maxY) {

        this.minX = minX || false;
        this.maxX = maxX || false;
        this.minY = minY || false;
        this.maxY = maxY || false;
        this.limited = this.minX || this.maxX || this.minY || this.maxY;

        this.mainArray = [];

        this.maxIndexX = false;
        this.minIndexX = false;
        this.maxIndexY = false;
        this.minIndexY = false;

    }

    G.GridArray.prototype.clear = function() {
        this.mainArray = [];
    };


    G.GridArray.prototype.set = function(x, y, value) {

        if (x.constructor === Array) {
            value = y;
            y = x[1];
            x = x[0];
        }

        if (this.limited && !this.inLinit(x, y)) {
            throw 'Out of limit!';
        }

        if (!this.mainArray[x]) {
            this.mainArray[x] = [];
        }

        this.mainArray[x][y] = value;

        this.setHelperValues(x, y);

        return value;

    }

    G.GridArray.prototype.get = function(x, y) {

        if (x.constructor === Array) {
            y = x[1];
            x = x[0];
        }


        if (this.limited && !this.inLimit(x, y)) {
            throw 'Out of limit!';
        }

        if (this.mainArray[x]) {
            if (this.mainArray[x][y]) {
                return this.mainArray[x][y];
            } else {
                return null;
            }
        } else {
            return null;
        }

    }


    G.GridArray.prototype.inLimit = function(x, y) {
        if (this.minX !== false && x < this.minX) return false;
        if (this.maxX !== false && x > this.maxX) return false;
        if (this.minY !== false && y < this.minY) return false;
        if (this.maxY !== false && y > this.maxY) return false;
        return true;
    }

    G.GridArray.prototype.setHelperValues = function(x, y) {
        if (this.maxIndexX === false) {
            this.maxIndexX = x;
            this.minIndexX = x;
            this.lengthX = 1;
            this.maxIndexY = y;
            this.minIndexY = y;
            this.lengthY = 1;
        } else {

            this.minIndexX = x < this.minIndexX ? x : this.minIndexX;
            this.maxIndexX = x > this.maxIndexX ? x : this.maxIndexX;
            this.minIndexY = y < this.minIndexY ? y : this.minIndexY;
            this.maxIndexY = y > this.maxIndexY ? y : this.maxIndexY;

        }

    };
    G.GameUI = function(desktop) {

        Phaser.Group.call(this, game);

        this.desktop = desktop;

        this.state = game.state.getCurrentState();

        this.difficultyLabel = new G.DifficultyLabel(260, -50);
        this.add(this.difficultyLabel);

        this.pointCounter = new G.PointCounter(735, -50);
        this.add(this.pointCounter);

        this.restartBtn = new G.Button(900, -50, 'button_refresh', function() {
          new G.RestartBox(function(){
              console.log('Retry button pressed');

              sdkHandler.trigger('gameOver', { 
                score: this.state.ui.pointCounter.score,
              })

              sdkHandler.trigger("gameTracking", {
                event: "Design",
                dimension1: "RestartGamePressed"
              });

              // sdkHandler.trigger('playButtonPressed', { 
                  // callback: function() {

                      game.state.start("Game");

                      sdkHandler.trigger('gameStart');

                      sdkHandler.trigger("gameTracking", {
                          event: "Design",
                          dimension1: "NewGameStart"
                      });
                  // } 
              // }, this);
            }, this)

            //SG_Hooks.levelFinished(this.state.gameLevel+1,this.state.ui.pointCounter.score);
            //SG_Hooks.gameOver(this.state.gameLevel+1,this.state.ui.pointCounter.score, function(){});
            //}).bind(this));  

        }, this);
        this.add(this.restartBtn);

        this.settingsMenu = new G.SettingsMenu(60, -80, desktop);
        this.add(this.settingsMenu);

        G.sb('onScreenResize').add(this.onResize, this);
        this.onResize();

    };

    G.GameUI.prototype = Object.create(Phaser.Group.prototype);

    G.GameUI.prototype.onResize = function() {

        if (this.desktop) {
            this.y = game.world.bounds.y + game.height;
        } else {
            this.y = game.world.bounds.y + 100;
            this.settingsMenu.x = 20;
            this.difficultyLabel.x = 215;
            this.pointCounter.x = 436;
            this.restartBtn.x = 580;
        }

    };
    G.MobileButtonPanel = function(x, y) {

        Phaser.Group.call(this, game);

        this.x = game.width - G.l(70);
        this.y = y;

        G.menuOpened = false;

        this.menuBtn = new G.Button(0, 0, 'button_green', this.openCloseMenu, this);
        this.menuBtn.addTextLabel('Menu');
        this.add(this.menuBtn);

        this.openedGroup = game.add.group();
        this.openedGroup.visible = false;
        this.add(this.openedGroup);



        this.setupBtn = new G.Button(0, 0, 'button_turquoise', function() {
            this.openCloseMenu();
            game.state.getCurrentState().windowLayer.open('windowSetup');
            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "SetupButtonPressed"
            });
        }, this);
        this.setupBtn.addTextLabel('Setup');


        /*this.top10Btn = new G.Button(-187,-69,'button_yellow',function() {
          this.openCloseMenu();
          game.state.getCurrentState().windowLayer.open('windowTop10');
        },this);
        this.top10Btn.addTextLabel('Top 10');*/

        this.moreGamesBtn = new G.Button(-100, -173, 'button_blue', function() {
              sdkHandler.trigger ('moreGames');

              sdkHandler.trigger("gameTracking", {
                event: "Design",
                dimension1: "MoreGamesButtonPressed",
              });

              //window.open("http://m.softgames.de/", "_blank");
        }, this);
        this.moreGamesBtn.addTextLabel('More Games', 'white');

        this.restartBtn = new G.Button(-200, 0, 'button_green', function() {

            this.openCloseMenu();

            var state = game.state.getCurrentState();

            //SG_Hooks.gameOver(state.gameLevel+1,state.pointCounter.score, function(){});

            sdkHandler.trigger('gameOver', {
                score: state.pointCounter.score,
            }, this)

            sdkHandler.trigger("gameTracking", {
                event: "Design",
                dimension1: "RestartGamePressed",
            });

            //trackFlurryEvent("gameOver");
            //trackFlurryEvent("restartButtonClicked");

            game.state.start("Game");

            sdkHandler.trigger('gameStart');

            sdkHandler.trigger("gameTracking", {
                event: "Design",
                dimension1: "NewGameStart"
            });

        }, this);        

        this.restartBtn.addTextLabel('Restart');

        this.helpBtn = new G.Button(0, -200, 'button_pink', function() {
            this.openCloseMenu();
            game.state.getCurrentState().windowLayer.open('windowHelp');

            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "HelpButtonPressed",
            });
            
            //trackFlurryEvent("helpButtonClicked");
        }, this);
        this.helpBtn.addTextLabel('Help');

        this.openedGroup.addMultiple([this.setupBtn /*,this.top10Btn*/ , this.moreGamesBtn, this.restartBtn, this.helpBtn]);

        var distance = G.l(250);
        var angleStart = -180;
        var angleDiff = 23;

        this.openedGroup.children.forEach(function(elem, i) {
            elem.x = G.lengthDirX(angleStart + (angleDiff * i), distance, false);
            elem.y = G.lengthDirY(angleStart + (angleDiff * i), distance, false);
        });


        G.events.onWindowOpened.add(function() {
            
            alert('onWindowOpened');
            
            this.menuBtn.inputEnabled = false;
            this.openedGroup.children.forEach(function(e) {
                e.inputEnabled = false;
            }, this)  
        }, this);
        G.events.onWindowClosed.add(function() {

            alert('onWindowClosed');

            this.menuBtn.inputEnabled = true;
            this.openedGroup.children.forEach(function(e) {
                e.inputEnabled = true;
                e.input.useHandCursor = true;
            }, this)
        }, this);


    }

    G.MobileButtonPanel.prototype = Object.create(Phaser.Group.prototype);

    G.MobileButtonPanel.prototype.openCloseMenu = function() {

        this.openedGroup.visible = !this.openedGroup.visible;
        G.menuOpened = this.openedGroup.visible;

    };
    G.PointCounter = function(x, y) {

        Phaser.Group.call(this, game);

        this.position.setTo(x, y);

        this.bg = G.makeImage(0, 0, 'bg_numbers_hud', 0.5, this);

        this.score = 0;

        this.counterTxt = new G.OneLineCounter(0, 0, 'font', 0, 30, 180, 0.5, 0.5);
        this.add(this.counterTxt);

        G.sb('onAddPoints').add(function(amount) {
            if (!amount) return;
            this.score += amount;
            this.counterTxt.changeAmount(this.score);
        }, this);

    };

    G.PointCounter.prototype = Object.create(Phaser.Group.prototype);
    G.ScreenKeyboard = function(font, bgImg, width, height) {

        Phaser.Group.call(this, game);

        this.aeraWidth = width;
        this.aeraHeight = height;

        this.layout = [
            ['1234567890', {
                key: 'Backspace',
                label: 'backspace'
            }],
            ['qwertyuiop'],
            ['asdfghjkl'],
            ['zxcvbnm']
        ]

        this.stepY = Math.floor(this.aeraHeight / this.layout.length);

        this.font = font;
        this.bgImg = bgImg;

        this.init();

        this.onKeyDown = new Phaser.Signal();

        this.onResize();

    };

    G.ScreenKeyboard.prototype = Object.create(Phaser.Group.prototype);

    G.ScreenKeyboard.prototype.onResize = function() {

        //this.x = game.world.bounds.x+game.width*0.5;
        //this.y = game.world.bounds.y+game.height-this.aeraHeight;

    };

    G.ScreenKeyboard.prototype.init = function() {

        this.layout.forEach(function(row, rowIndex) {

            this.processRow(row, rowIndex);

        }, this);

    };

    G.ScreenKeyboard.prototype.processRow = function(row, rowIndex) {

        var buttons = [];

        for (var i = 0; i < row.length; i++) {

            var elem = row[i];

            if (typeof elem == 'string') {

                for (var charIndex = 0; charIndex < elem.length; charIndex++) {
                    var button = this.createButton(0, rowIndex * this.stepY, elem[charIndex]);
                    this.add(button);
                    buttons.push(button);
                }

            } else {

                var button = this.createButton(0, rowIndex * this.stepY, elem);
                this.add(button);
                buttons.push(button);

            }

        }

        this.spreadRow(buttons);

    };



    G.ScreenKeyboard.prototype.createButton = function(x, y, arg) {

        var key;

        var button = new G.Button(x, y, this.bgImg, function() {
            this.onKeyDown.dispatch({
                key: key
            });
        }, this);
        button.alphaOnPointer = false;
        button.IMMEDIATE = true;
        if (typeof arg == 'string') {
            key = arg;
            button.addTextLabel(this.font, arg, 40);
        } else {
            key = arg.key;
            button.label = G.makeImage(0, 0, arg.label, 0.5, button);
        }

        return button;


    };

    G.ScreenKeyboard.prototype.spreadRow = function(buttonList) {

        var buttonWidth = buttonList[0].width;

        var totalWidth = Math.min((buttonList.length - 1) * buttonWidth * 1.5, this.aeraWidth, game.width);
        var stepX = totalWidth / buttonList.length - 1;

        var startX = Math.floor(totalWidth * -0.5) + buttonWidth * 0.75;

        buttonList.forEach(function(key) {
            key.x = startX;
            startX += stepX;
        }, this);

    };
    G.SettingsMenu = function(x, y, desktop) {

        Phaser.Group.call(this, game);
        this.position.setTo(x, y);

        this.state = game.state.getCurrentState();

        this.orgY = y;

        this.desktop = desktop;

        if (!desktop) this.y = -10;

        G.menuOpened = false;
        this.open = false;

        this.bg = G.makeImage(0, 0, 'settings_menue', 0, this);
        if (!desktop) this.bg.scale.y = -1;
        this.bg.inputEnabled = true;
        this.bg.input.useHandCursor = true;
        this.bg.hitArea = new Phaser.Rectangle(0, 0, 80, 80);

        this.bg.events[game.device.desktop ? 'onInputDown' : 'onInputUp'].add(function() {
            
            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "MenuButtonPressed"
            });
            
            if (this.state.windowLayer.children.length == 0) {
                this.open = !this.open;
                G.sfx.button_click.play();
            }
        }, this);
        var offset = -60
        this.buttons = [
            /*this.makeTextButton(200,150,G.txt(3),function(){
              G.sb('pushWindow').dispatch('leaderboard');
              this.open = false;
            },this),
            G.makeImage(200,150+33,'settings_line_pixel',[0.5,0],null),*/
            this.makeTextButton(200, 225 + offset, G.txt(1), function() {
                G.sb('pushWindow').dispatch('help');
                this.open = false;

                sdkHandler.trigger("gameTracking", {
                  event: "Design",
                  dimension1: "HelpButtonPressed"
                });
            }, this),

            G.makeImage(200, 225 + 33 + offset, 'settings_line_pixel', [0.5, 0], null),

            this.makeTextButton(200, 300 + offset, G.txt(2), function() {
                G.sb('pushWindow').dispatch('setup');
                this.open = false;

                sdkHandler.trigger("gameTracking", {
                  event: "Design",
                  dimension1: "SetupButtonPressed"
                });
            }, this),

            G.makeImage(200, 300 + 33 + offset, 'settings_line_pixel', [0.5, 0], null),

            this.makeTextButton(200, 375 + offset, G.txt(4), function() {
                sdkHandler.trigger ('moreGames');
                
                sdkHandler.trigger("gameTracking", {
                  event: "Design",
                  dimension1: "MoreGamesButtonPressed"
                });
            })
        ];

        if (!desktop) this.buttons.forEach(function(c) {
            c.y *= -1
        });

        this.addMultiple(this.buttons);

    };

    G.SettingsMenu.prototype = Object.create(Phaser.Group.prototype);

    G.SettingsMenu.prototype.update = function() {

        if (this.desktop) {
            this.y = G.lerp(this.y, this.open ? -438 : -80, 0.1, 1);
        } else {
            this.y = G.lerp(this.y, this.open ? 330 : -10, 0.1, 1);
        }
        G.menuOpened = this.open;

    };

    G.SettingsMenu.prototype.makeTextButton = function(x, y, label, func, context) {

        var btn = new G.OneLineText(x, y, 'font', label, 35, 370, 0.5, 0.5);
        btn.hitArea = new Phaser.Rectangle(-180, btn.height * -0.5, 360, btn.height);
        btn.inputEnabled = true;
        btn.input.useHandCursor = true;
        btn.events.onInputDown.add(func, context || this);
        return btn;

    };
    G.Shooter = function(x, y, grid, config) {

        Phaser.Group.call(this, game);

        this.grid = grid;
        this.state = game.state.getCurrentState();
        this.shooterMargin = G.l(70);
        //this.x = this.grid.x+(this.grid.sizeW*this.grid.cellW*0.5);
        //this.y = this.grid.y+(this.grid.sizeH*this.grid.cellH)+this.shooterMargin;
        this.x = config.x;
        this.y = config.y;

        this.pointer = G.makeImage(0, 0, 'arrow', [0.5, (178 - (59 * 0.5)) / 178], this);
        this.pointer.alpha = 1;

        if (game.device.desktop) {
            game.input.onDown.add(this.onInputDown, this);
        } else {
            game.input.onUp.add(this.onInputDown, this);
        }


        this.flyingBubbles = game.add.group();
        for (var i = 0; i < 5; i++) {
            this.flyingBubbles.add(new G.BubbleFlying(this.grid));
        }

        this.chances = config.chances;
        this.chancesOrg = config.chances;
        this.chancesIndex = 0;
        this.chancesArray = [6, 5, 5, 4, 4, 3, 3]
        this.chancesCurrent = config.chances;


        var offsetX = 38;
        var startX = (config.chances * 38) * -0.5;

        this.chancesImg = [];

        for (var i = 0; i < config.chances + 1; i++) {
            var emptyBubble = G.makeImage(startX + (i * offsetX), 60, 'bubble_grey', 0.5, this);
            emptyBubble.scale.setTo(0.75);
            this.chancesImg.push(emptyBubble);
        }

        this.nextBubble = G.makeImage(startX, 60, 'bubble_' + game.rnd.pick(G.bubbleNames), 0.5, this);
        this.nextBubble.scale.setTo(0.75);
        this.currentBubble = G.makeImage(0, 0, 'bubble_' + game.rnd.pick(G.bubbleNames), 0.5, this);


        this.ready = true;


        G.sb('onMoveDone').add(this.onMoveDoneNew, this);

        G.sb('gameOver').add(function() {
            this.gameOver = true;
        }, this);

        G.sb('onWindowOpened').add(function() {
            this.windowOpened = true;
        }, this);
        G.sb('onAllWindowsClosed').add(function() {
            this.windowOpened = false;
        }, this);

        //
        //
        // new algorythm
        //
        //

        this.vLCur = config.chances;
        this.max_lives = config.chances;
        this.chancesInit = config.chances;

    };

    G.Shooter.prototype = Object.create(Phaser.Group.prototype);

    G.Shooter.prototype.update = function() {

        if (this.gameOver || G.menuOpened || G.restartOpen) return;

        if (this.isPointerOverField() && !this.windowOpened) {
            this.pointer.angle = game.math.radToDeg(game.math.angleBetween(this.x, this.y, this.activePointer.worldX, this.activePointer.worldY)) + 90;
        }

    };

    G.Shooter.prototype.isPointerOverField = function(pointer) {

        this.activePointer = pointer || game.input.activePointer;
        return this.grid.gridFiledRect.contains(this.activePointer.worldX, this.activePointer.worldY)

    };



    G.Shooter.prototype.isReadyToShoot = function() {

        return !G.menuOpened && this.currentBubble.scale.x == 1 && this.ready && !this.gameOver && !this.windowOpened && !G.restartOpen;

    };


    G.Shooter.prototype.onInputDown = function() {

        if (game.paused) return;

        if (this.isPointerOverField() && this.isReadyToShoot()) {

            var index = G.bubbleNames.indexOf(this.currentBubble.frameName.slice(7));
            var bubble = this.flyingBubbles.getFirstDead();
            this.pointer.angle = game.math.radToDeg(game.math.angleBetween(this.x, this.y, this.activePointer.worldX, this.activePointer.worldY)) + 90;
            bubble.init(this.x, this.y, this.pointer.angle - 90, index);

            this.currentBubble.scale.setTo(0);

            this.ready = false;

            G.sfx.shoot_bubble.play();
            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "ShootPressed"
            });

        }

    };


    G.Shooter.prototype.onMoveDone = function(success) {


        if (this.grid.getAllColorsOnBoard().length == 0) return;

        if (!success) {
            this.chancesCurrent--;
            if (this.chancesCurrent == 0) {
                this.chances--;

                if (this.chances == 0) {
                    var chancesIndexRefill = Math.min(this.chancesIndex, this.chancesArray.length - 1);
                    this.chances = this.chancesArray[chancesIndexRefill];
                    this.chancesIndex++;
                }

                this.grid.makeRefill();
                this.chancesCurrent = this.chances;

                this.chancesImg.forEach(function(elem, index) {
                    if (index < this.chances) {

                        var size = game.device.desktop ? 1 : 0.
                        game.add.tween(elem.scale).to({
                            x: 1,
                            y: 1
                        }, 200, Phaser.Easing.Linear.None, true);
                    }
                }, this);


            } else {
                game.add.tween(this.chancesImg[this.chancesCurrent].scale).to({
                    x: 0,
                    y: 0
                }, 200, Phaser.Easing.Linear.None, true);
            }

        }

        if (!this.gameOver) {
            this.getNextBubble();
        }

    };


    G.Shooter.prototype.onMoveDoneNew = function(success) {

        if (!success) {

            if (this.vLCur > 0) {
                this.vLCur--;
                game.add.tween(this.chancesImg[this.vLCur + 1].scale).to({
                    x: 0,
                    y: 0
                }, 200, Phaser.Easing.Linear.None, true);
            } else {


                var level_max_lives = this.chancesInit;

                var available_colors = this.state.grid.getAllColorsOnBoard();
                var num_available_colors = available_colors.length;

                if (this.max_lives > 0) {
                    this.max_lives--;
                } else {
                    this.max_lives = level_max_lives;
                }

                /*for (i = 0; i <= 5; i++)
                {
                  if (available_colors[i] > 0)
                  {
                    ++num_available_colors;
                  }
                }*/
                num_available_colors = 6 - num_available_colors;

                this.max_lives = game.math.clamp(this.max_lives, 0, level_max_lives - num_available_colors);


                this.vLCur = this.max_lives;


                for (var i = 0; i <= this.max_lives; i++) {
                    game.add.tween(this.chancesImg[i].scale).to({
                        x: 0.75,
                        y: 0.75
                    }, 200, Phaser.Easing.Linear.None, true);


                }
                for (var i = this.max_lives + 1; i <= this.max_lives; i++) {
                    game.add.tween(this.chancesImg[i].scale).to({
                        x: 0,
                        y: 0
                    }, 200, Phaser.Easing.Linear.None, true); // hide lost lives
                }

                this.grid.makeRefill();

            }

        }

        if (!this.gameOver) {
            this.getNextBubble();
        }

    };

    G.Shooter.prototype.getNextBubble = function() {

        var colorsAvailable = this.grid.getAllColorsOnBoard();

        if (colorsAvailable.length == 0) return;

        G.stopTweens(this.currentBubble);
        G.stopTweens(this.nextBubble);

        this.currentBubble.frameName = this.nextBubble.frameName;
        game.add.tween(this.currentBubble.scale).to({
            x: 1,
            y: 1
        }, 200, Phaser.Easing.Linear.None, true);
        game.add.tween(this.nextBubble.scale).to({
            x: 0,
            y: 0
        }, 200, Phaser.Easing.Linear.None, true).onComplete.add(function() {

            G.changeTexture(this.nextBubble, 'bubble_' + G.bubbleNames[game.rnd.pick(colorsAvailable)]);
            game.add.tween(this.nextBubble.scale).to({
                x: 0.75,
                y: 0.75
            }, 200, Phaser.Easing.Linear.None, true).onComplete.add(function() {
                this.ready = true;
            }, this)

        }, this)

    };
    G.Window = function(type) {

        Phaser.Group.call(this, game);
        this.state = game.state.getCurrentState();

        this.gfx = game.add.graphics();
        this.add(this.gfx);
        this.drawWindow(500, 660);
        this.shadow = G.makeImage(5, 5, 'popup_shadow', 0.5, this);

        if (type.constructor === Array) {
            this[type[0]].apply(this, type.slice(1));
        } else {
            this[type].apply(this, Array.prototype.slice.call(arguments, 1));
        }

        G.sb('onWindowOpened').dispatch(this);

    };

    G.Window.prototype = Object.create(Phaser.Group.prototype);

    G.Window.prototype.closeWindow = function() {

        G.sb('onWindowClosed').dispatch();
        this.destroy();

    };

    G.Window.prototype.drawWindow = function(width, height) {

        width = G.l(width) || this.currentWindowWidth;
        height = G.l(height) || this.currentWindowHeight;

        this.gfx.clear();
        this.currentWindowWidth = width;
        this.currentWindowHeight = height;

        this.gfx.beginFill(parseInt(G.backgroundColor.slice(1), 16), 1);
        this.gfx.drawRoundedRect(width * -0.5, height * -0.5, width, height, 40);

    };

    G.Window.prototype.addTitle = function(text) {

        this.headerBg = G.makeImage(0, -290, 'bg_header', 0.5, this);
        this.title = new G.OneLineText(0, -290, 'font', text, 40, 480, 0.5, 0.5);
        this.add(this.title);

    };


    G.Window.prototype.addButton = function(x, y, sprite, text, func, context) {

        var button = new G.Button(x, y, sprite, func, context);
        button.addTextLabel('font', text, 30);
        this.add(button);
        return button;

    };

    G.Window.prototype.addLabelButton = function(x, y, label, labelWidth, sprite) {

        var group = game.make.group();
        group.position.setTo(x, y);
        group.button = new G.Button(0, 0, sprite || 'checkmark_select');
        group.add(group.button);
        group.label = new G.OneLineText(20, 0, 'font', label, 20, labelWidth, 0, 0.5);
        group.add(group.label);
        this.add(group);
        return group;

    };

    G.Window.prototype.addLabel = function(x, y, txt, labelWidth) {

        var label = new G.OneLineText(x, y, 'font', txt, 25, labelWidth || 400, 0, 0);
        this.add(label);
        return label;

    };

    G.Window.prototype.addSlider = function(x, y, pos, range, pxRange, gfx, func, context) {

        var line = G.makeImage(x, y, 'line_color', [0, 0.5], this.elemsLayer);
        this.add(line);
        line.width = G.l(pxRange);

        var button = G.makeImage(x + (pos * pxRange), y, gfx, 0.5, this.elemsLayer);
        button.scale.setTo(0.6);
        button.picked = false;

        button.onSliderMove = new Phaser.Signal();

        button.orgX = G.l(x);
        button.range = range;
        button.pxRange = G.l(pxRange);
        button.pos = pos * 100;
        button.prevPos = button.pos;
        button.prevX;
        button.firstY;

        button.inputEnabled = true;
        button.events.onInputDown.add(function() {
            this.picked = true;
            this.prevX = game.input.activePointer.x;
            this.firstY = game.input.activePointer.y;
        }, button);
        button.events.onInputUp.add(function() {
            this.picked = false;
        }, button);

        button.getValue = function() {
            return Math.floor((this.pos / 100) * this.range);
        }

        button.update = function() {
            if (this.picked) {


                this.x -= (this.prevX - game.input.activePointer.x);
                this.prevX = game.input.activePointer.x;
                this.x = game.math.clamp(this.x, this.orgX, this.orgX + this.pxRange);
                this.pos = ((this.x - this.orgX) / this.pxRange) * 100;

                if (Math.floor(this.prevPos) !== Math.floor(this.pos)) {
                    this.onSliderMove.dispatch(this.pos);
                    this.prevPos = this.pos;
                }

                if (Math.abs(game.input.activePointer.y - this.firstY) > this.height * 1.5) {
                    this.picked = false;
                }

            }
        };

        button.changePos = function(newPos) {

            this.pos = newPos * 100;
            this.x = this.orgX + (this.pxRange * newPos);

        };

        this.add(button);
        return button;


    }


    G.Window.prototype.leaderboard = function(index) {

        if (typeof gameLevel === 'undefined') gameLevel = G.gameLevel;

        this.addTitle(G.txt(3));

        var data = G.saveStateData.top10[G.gameLevel].slice(0, 10);
        this.entries = [];
        for (var i = 0; i < 10; i++) {
            var entry = data[i] || ['---', '---'];
            this.entries.push(this.leaderboardMakeEntry(0, -220 + (i * 45), i + 1, entry, index === i));
        }
        this.addMultiple(this.entries);

        this.btn = this.addButton(0, 280, 'button_big', G.gameOver ? G.txt(13) : G.txt(14), function() {

            if (G.gameOver) {
                console.log('restart 4');

                //SG_Hooks.gameOver(this.state.gameLevel+1,G.points,function(){});
                
                sdkHandler.trigger('gameOver', { 
                  score: G.points
                })

                game.state.start('Game');
            } else {
                this.closeWindow();
            }

        }, this);


    };

    G.Window.prototype.leaderboardMakeEntry = function(x, y, nr, entry, big) {

        var group = game.make.group();
        group.y = y;

        var name = entry[0];
        var points = entry[1];

        group.bg = G.makeImage(0, 0, big ? 'bg_numbers_middle' : 'bg_numbers_small', 0.5, group);
        group.nrTxt = new G.OneLineText(big ? -202 : -190, 0, 'font', nr, 25, 400, 0.5, 0.5);
        group.add(group.nrTxt);

        group.nameTxt = new G.OneLineText(big ? -155 : -120, 0, 'font', name, 25, 170, 0, 0.5);
        group.add(group.nameTxt);

        group.pointsTxt = new G.OneLineText(157, 0, 'font', points, 25, 200, 0.5, 0.5);
        group.add(group.pointsTxt);

        if (big) {
            group.nrTxt.tint = 0xffcc00;
            group.nrTxt.updateCache();
            group.nameTxt.tint = 0xffcc00;
            group.nameTxt.updateCache();
            group.pointsTxt.tint = 0xffcc00;
            group.pointsTxt.updateCache();
        }

        return group;

    }
    G.Window.prototype.enterYourNickname = function(init) {

        this.addTitle(G.txt(25));

        this.inputField = {
            value: 'hate'
        };




        this.inputText = new G.OneLineText(0, -4, 'font', ' ', 40, 300, 0.5, 0.5);
        this.inputText.setText('');
        this.add(this.inputText);

        this.cursorTxt = new G.OneLineText(0, -4, 'font', '|', 40, 300, 0, 0.5);
        this.add(this.cursorTxt);
        this.cursorTxt.inputText = this.inputText;
        this.cursorTxt.frameCounter = 0;
        this.cursorTxt.update = function() {
            this.x = this.inputText.x + this.inputText.width * 0.5;
            this.frameCounter = ++this.frameCounter % 60;
            this.visible = this.frameCounter < 30;
        };

        this.inputRegEx = new RegExp('[a-zA-Z0-9.-_ ]');


        if (init) {

            this.okBtn = this.addButton(0, 280, 'button_big', G.txt(5), this.nicknameAccept, this);

        } else {

            this.okBtn = this.addButton(90, 280, 'button_middle', G.txt(5), this.nicknameAccept, this);
            this.cancelBtn = this.addButton(-150, 280, 'button_small', G.txt(6), function() {

                this.closeWindow();
            }, this);

        }

        if (game.device.desktop) {
            game.input.keyboard.onDownCallback = (this.onDownKeyboardCallback).bind(this);
        } else {
            this.okBtn.y = 0;
            if (this.cancelBtn) this.cancelBtn.y = 0;
            this.cursorTxt.y = -140
            this.inputText.y = -140;
            this.screenKeyboard = new G.ScreenKeyboard('font', 'keyboard', 500, 280);
            this.add(this.screenKeyboard);
            this.screenKeyboard.y = 80
            this.screenKeyboard.onKeyDown.add(this.onDownKeyboardCallback, this);
            this.binding = G.sb('onScreenResize').add(this.screenKeyboard.onResize, this.screenKeyboard);
        }

    };

    G.Window.prototype.pushToTop10 = function(name, score) {

        var newEntry = [name, score];
        G.saveStateData.top10[G.gameLevel].push(newEntry);
        G.saveStateData.top10[G.gameLevel].sort(function(a, b) {
            return b[1] - a[1]
        });
        G.saveStateData.top10[G.gameLevel] = G.saveStateData.top10[G.gameLevel].splice(0, 10);
        G.save();

        return G.saveStateData.top10[G.gameLevel].indexOf(newEntry);

    }

    G.Window.prototype.onDownKeyboardCallback = function(event) {

        if (event.key == 'Backspace') {
            this.inputText.setText(this.inputText.text.slice(0, Math.max(0, this.inputText.text.length - 1)));
            this.cursorTxt.frameCounter = 0;
        } else if (event.key == 'Enter') {
            this.nicknameAccept();
        } else if (this.inputText.text.length < 10 && event.key.length == 1 && this.inputRegEx.test(event.key)) {
            this.inputText.setText(this.inputText.text + event.key);
            this.cursorTxt.frameCounter = 0;
        }

        return false;

    };

    G.Window.prototype.nicknameAccept = function() {

        if (G.saveStateData.nickname === '' && this.inputText.text.length == 0) {
            G.saveStateData.nickname = 'Player';
            G.save();
            this.closeWindow();
            return;
        };

        if (this.inputText.text.length == 0) return;

        if (this.screenKeyboard) this.screenKeyboard.destroy();
        game.input.keyboard.onDownCallback = null;
        if (this.binding) this.binding.detach();

        G.saveStateData.nickname = this.inputText.text;
        G.save();
        this.closeWindow();

    };
    G.Window.prototype.gameOver = function(bonusScore) {

        var won = this.state.grid.children.length == 0;
        var winEvent = "Complete";
        var loseEvent =  "Fail";
        var points = this.state.ui.pointCounter.score;
        var bonus = bonusScore ? this.state.ui.pointCounter.score : 0;
        G.points = points + bonus;

        sdkHandler.trigger("gameTracking", {
          event: won ? winEvent : loseEvent,
          dimension1: "GameMode"
        });

        if (won) {
            G.sfx.won.play();
            this.addTitle(G.txt(27));
        } else {
            G.sfx.lost.play();
            this.addTitle(G.txt(16));
        }

        this.add(this.gameOverMakePosition(0, -150, G.txt(24), this.state.grid.bubblesPopped));
        this.add(this.gameOverMakePosition(0, -80, G.txt(17), points));
        this.add(this.gameOverMakePosition(0, -10, G.txt(18), bonus));
        this.add(this.gameOverMakePosition(0, 60, G.txt(19), G.points, true));


        this.btn = this.addButton(0, 280, 'button_big', G.txt(5), function() {

            // sdkHandler.trigger('playButtonPressed', { 

                // callback: function() { 
                    game.state.start('Game');
                    this.isTop10 = this.checkIfTop10(G.points);

                    if (this.isTop10) {

                        if (G.saveStateData.nickname == '') {
                            this.closeWindow();
                            G.sb('pushWindow').dispatch(['enterYourNickname', true]);
                            G.sb('onAllWindowsClosed').add(function() {
                                console.log('on all closed windows');
                                var posIndex = this.pushToTop10(G.saveStateData.nickname, G.points);
                                game.time.events.add(1, function() {
                                    G.sb('pushWindow').dispatch(['leaderboard', posIndex]);
                                });
                            }, this);

                        } else {

                            var posIndex = this.pushToTop10(G.saveStateData.nickname, G.points);
                            G.sb('pushWindow').dispatch(['leaderboard', posIndex]);
                            this.closeWindow();
                        }
                        //var posIndex = this.pushToTop10(G.saveStateData.nickname,G.points)
                    } else {
                        G.sb('pushWindow').dispatch('leaderboard');
                        this.closeWindow();
                    }

                // }

            // }, this)

            //SG_Hooks.playButtonPressed((function() {
            //SG_Hooks.levelFinished(this.state.gameLevel+1,G.points);
            //SG_Hooks.gameOver(this.state.gameLevel+1,G.points);
            //}).bind(this));
        }, this);

        // this.btn.visible = false;
        // sdkHandler.trigger('beforePlayButtonDisplay', { 
            // callback: function() {
                this.btn.visible = true;
            // }
        // }, this)

    };

    G.Window.prototype.gameOverMakePosition = function(x, y, label, value, tinted) {

        var group = game.make.group();
        group.position.setTo(x, y);

        group.bg = G.makeImage(0, 0, 'bg_numbers_big', 0.5, group);

        group.label = new G.MultiLineText(-140, 0, 'font', label, 20, 170, 50, 'center', 0.5, 0.5);
        group.label.updateCache();
        group.add(group.label);

        group.value = new G.OneLineText(95, 0, 'font', value.toString(), 25, 270, 0.5, 0.5);
        group.add(group.value);

        if (tinted) {
            group.label.tint = 0xffcc00;
            group.label.updateCache();
            group.value.tint = 0xffcc00;
            group.value.updateCache();
        }

        return group;

    };

    G.Window.prototype.checkIfTop10 = function(points) {

        if (points == 0) return false;

        if (G.saveStateData.top10[G.gameLevel].length < 10) return true;

        var result = false;

        G.saveStateData.top10[G.gameLevel].forEach(function(elem) {
            if (points > elem[1]) result = true;
        });

        return result;

    };
    G.Window.prototype.help = function() {

        this.addTitle(G.txt(1));

        this.btn = this.addButton(0, 280, 'button_big', G.txt(14), this.closeWindow, this);

        this.helpTxt = new G.MultiLineText(0, -230, 'font', G.txt(22), 20, 480, 500, 'left', 0.5, 0);
        this.helpTxt.updateCache();
        this.add(this.helpTxt);

    };
    G.Window.prototype.setup = function() {

        this.addTitle(G.txt(2));

        this.colorOnStart = G.saveStateData.backgroundColor;
        this.levelOnStart = G.saveStateData.gameLevel;
        this.soundOnStart = game.sound.mute;
        this.animationsOnStart = G.saveStateData.animations;

        /*this.nicknameLabel = this.addLabel(-220,-210,G.txt(25),160);

        this.nicknameBtn = this.addButton(95,-200,'button_middle',G.saveStateData.nickname,function(){
          G.sb('pushWindow').dispatch('enterYourNickname');
          G.sb('pushWindow').dispatch('setup');
          this.closeWindow();
        },this);*/


        this.addLabel(-220, -140, G.txt(7));

        this.sliderR = this.addSlider(-220, -70,
            parseInt(G.backgroundColor.slice(1, 3), 16) / 255,
            255, 250, 'bubble_red');
        this.sliderR.onSliderMove.add(this.setupRefreshGlobalColor, this);
        this.sliderG = this.addSlider(-220, -20,
            parseInt(G.backgroundColor.slice(3, 5), 16) / 255,
            255, 250, 'bubble_green');
        this.sliderG.onSliderMove.add(this.setupRefreshGlobalColor, this);
        this.sliderB = this.addSlider(-220, 30,
            parseInt(G.backgroundColor.slice(5), 16) / 255,
            255, 250, 'bubble_blue');
        this.sliderB.onSliderMove.add(this.setupRefreshGlobalColor, this);


        this.restartBtn = this.addLabelButton(-220, 80, G.txt(21), 260, 'checkmark_unselect'),
            this.restartBtn.button.onClick.add(function() {
                this.sliderR.changePos(0.2431372549019608);
                this.sliderG.changePos(0.2588235294117647);
                this.sliderB.changePos(0.4470588235294118);
                this.setupRefreshGlobalColor();

                sdkHandler.trigger("gameTracking", {
                  event: "Design",
                  dimension1: "ColorSetupDefaultPressed",
                });
            }, this);


        this.okBtn = this.addButton(150, 20, 'button_small', G.txt(5), function() {



            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "SetupOKPressed"
            });

            G.saveStateData.backgroundColor = G.backgroundColor;
            G.save();
            var state = game.state.getCurrentState();

            if (this.levelOnStart != G.gameLevel) {
                
              new G.RestartBox(function(){
                G.saveStateData.gameLevel = G.gameLevel;

                sdkHandler.trigger('gameOver', { 
                  score: state.ui.pointCounter.score
                }, this);

                sdkHandler.trigger('playButtonPressed', { 
                    callback: function() {
                      game.state.start("Game");

                      sdkHandler.trigger('gameStart');

                      sdkHandler.trigger("gameTracking", {
                        event: "Design",
                        dimension1: "NewGameStart"
                      });
                    } 
                }, this);
              }, this);
            }
            this.closeWindow();

        }, this);

        this.cancelButton = this.addButton(150, -60, 'button_small', G.txt(6), function() {
            G.gameLevel = this.levelOnStart;
            document.body.style.backgroundColor = G.backgroundColor = this.colorOnStart;
            game.sound.mute = this.soundOnStart;
            G.saveStateData.animations = this.animationsOnStart;
            G.save();
            this.closeWindow();

            sdkHandler.trigger("gameTracking", {
              event: "Design",
              dimension1: "SetupCancelPressed"
            });
        }, this);


        this.addLabel(-220, 125, G.txt(8));

        this.levelsButton = [
            this.addLabelButton(-220, 180, G.txt(9), 130),
            this.addLabelButton(-60, 180, G.txt(10), 130),
            this.addLabelButton(100, 180, G.txt(11), 130)
        ];
        this.setupRefreshLevelButtons();

        function getDifficultyString(difficulty) {
          var difficultyString = '';

          switch(difficulty) {
            case 0:
              difficultyString = 'Novice'
              break;
            case 1:
              difficultyString = 'Expert'
              break;
            case 2:
              difficultyString = 'Master'
              break;
          }
          return difficultyString;
        }


        this.levelsButton.forEach(function(btnLabel, index) {
            btnLabel.button.onClick.add(function() {
                G.gameLevel = index;
                difficultyText = getDifficultyString(G.gameLevel);

                sdkHandler.trigger("gameTracking", {
                  event: "Design",
                  dimension1: "GameSettings"+difficultyText,
                });

                this.parent.parent.setupRefreshLevelButtons();
            }, btnLabel.button);
        });

        this.levelsButton[1].inputEnabled = false;
        this.levelsButton[2].inputEnabled = false;

        this.soundBtn = this.addLabelButton(-220,
            220,
            G.txt(12)
        );
        G.changeTexture(this.soundBtn.button, game.sound.mute ? 'checkmark_unselect' : 'checkmark_select');

        this.soundBtn.button.onClick.add(function() {
            game.sound.mute = !game.sound.mute;
            G.saveStateData.mute = game.sound.mute;
            G.save();
            G.changeTexture(this, game.sound.mute ? 'checkmark_unselect' : 'checkmark_select');
        }, this.soundBtn.button);


        this.animationBtn = this.addLabelButton(-220, 260, G.txt(23));
        this.animationBtn.button.onClick.add(function() {
            G.saveStateData.animations = !G.saveStateData.animations;
            G.save();
            G.changeTexture(this, G.saveStateData.animations ? 'checkmark_select' : 'checkmark_unselect');
        }, this.animationBtn.button);
        G.changeTexture(this.animationBtn.button, G.saveStateData.animations ? 'checkmark_select' : 'checkmark_unselect');

    };


    G.Window.prototype.setupRefreshGlobalColor = function() {

        var red = this.sliderR.getValue().toString(16);
        var green = this.sliderG.getValue().toString(16);
        var blue = this.sliderB.getValue().toString(16);

        if (red.length == 1) red = '0' + red;
        if (green.length == 1) green = '0' + green;
        if (blue.length == 1) blue = '0' + blue;

        G.backgroundColor = '#' + red + green + blue;

        sdkHandler.trigger("gameTracking", {
          event: "Design",
          dimension1: "ColorSetupRGB",
          value: G.backgroundColor
        });

        document.body.style.backgroundColor = G.backgroundColor;
        this.gfx.clear();
        this.drawWindow(500, 660);

    };

    G.Window.prototype.setupRefreshLevelButtons = function() {
        this.levelsButton.forEach(function(e, index) {
            e.gameLevel = index;
            if (e.gameLevel == G.gameLevel) {
                G.changeTexture(e.button, 'checkmark_select');
            } else {
                G.changeTexture(e.button, 'checkmark_unselect')
            }
        }, this);
    }


    G.WindowLayer = function() {

        Phaser.Group.call(this, game);
        this.fixedToCamera = true;

        this.state = game.state.getCurrentState();

        this.queue = [];

        G.sb('pushWindow').add(this.pushWindow, this);
        G.sb('onWindowClosed').add(this.onWindowClosed, this);
        G.sb('onWindowOpened').add(this.cacheWindow, this);
        G.sb('onScreenResize').add(this.onResize, this);

    };

    G.WindowLayer.prototype = Object.create(Phaser.Group.prototype);

    G.WindowLayer.prototype.onResize = function() {

        this.cameraOffset.x = game.width * 0.5;
        this.cameraOffset.y = game.height * 0.5;

    };

    G.WindowLayer.prototype.cacheWindow = function(win) {

        this.add(win);

    };

    G.WindowLayer.prototype.onWindowClosed = function() {

        if (this.queue.length > 0) {
            var args = this.queue.splice(0, 1);
            new G.Window(args[0])
        } else {
            G.sb('onAllWindowsClosed').dispatch();
        }

    };

    G.WindowLayer.prototype.pushWindow = function(type, unshift) {


        if (this.queue.length == 0 && this.children.length == 0) {
            new G.Window(type);
        } else {
            if (unshift) {
                this.queue.unshift(type);
            } else {
                this.queue.push(type);
            }
        }

    };


    G.RestartBox = function(okFunc, context) {
      Phaser.Group.call(this,game);

      G.restartOpen = true;

      this.fixedToCamera = true;
      this.cameraOffset.x = game.width*0.5;
      this.cameraOffset.y = game.height*0.5;

      this.bg = G.makeImage(0 ,0, "popup_box", 0.5, this);
      this.bg.inputEnabled = true;
      this.bg.hitArea = new Phaser.Rectangle(-2000,-2000,4000,4000);

      this.header = new G.OneLineText(0, -180, 'font', G.txt(0), 40, 400, 0.5, 0.5);
      this.add(this.header);

      this.areYouSureTxt = new G.OneLineText(0, -40, 'font', G.txt(26), 40, 400, 0.5, 0.5);
      this.add(this.areYouSureTxt);

      // G.Window.prototype.addButton = function(x, y, sprite, text, func, context)
      this.okBtn = G.Window.prototype.addButton.call(this, -110, 100, "button_small", G.txt(5), function(){
        G.restartOpen = false;
		okFunc.call(context);
      }, this);
      this.cancelBtn = G.Window.prototype.addButton.call(this, 110, 100, "button_small", G.txt(6), function() {
        // sdkHandler.trigger('playButtonPressed', { 
          // callback: function() {
            G.restartOpen = false;
            this.destroy();
          // } 
        // }, this);      
      }, this);

      //this.okBtn.visible = false;
      // this.cancelBtn.visible = false;
      // sdkHandler.trigger('beforePlayButtonDisplay', {     
        // callback: function() {      
          this.okBtn.visible = true;
          this.cancelBtn.visible = true;
        // } 
        // }, this);
    };

    G.RestartBox.prototype = Object.create(Phaser.Group.prototype);


    window.startGame = function() {
        sgSdk.initialize(['basic', 'scoreGame'], {

            build: "1.0.0",
            supportedLanguages: ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'tr', 'nl', 'pl', 'ar'],
            id: 'bubble-shooter-hd',

            freezeGame: function() {
                if (game) game.paused = true;
            },

            unfreezeGame: function() {
                if (game) game.paused = false;
            },

            runGame: function() {
                if(game) {
                  game.state.start("Game");
                  sdkHandler.trigger('start');
                }
            },

            startOver: function() {},

            gameAnalyticsKey: "27c0914683c3d8960db9e8bf26e18d0b",
            gameAnalyticsSecret: "d49a43c3a361006eaef20877e99bd6984f12ff82"

        }, function(error, settings, sdkHandler) {
            if (error) console.error(error);

            window.sgSettings = settings; //an object contains your commands (settings.commands) and config (settings.config)
            window.sdkHandler = sdkHandler; //this is the sdk to be used to call events in the game
            
            var game = new Phaser.Game(1250, 900, Phaser.CANVAS, '', null, true);
            window.game = game;

            game.state.add('Boot', G.Boot);
            game.state.add('Preloader', G.Preloader);
            game.state.add('MainMenu', G.MainMenu);
            game.state.add('Game', G.Game);
            game.state.start('Boot');

        });
    }

})();

